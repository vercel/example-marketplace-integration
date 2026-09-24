import {
  type JWTVerifyGetKey,
  type ProtectedHeaderParameters,
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
} from "jose";
import {
  JOSEAlgNotAllowed,
  JOSEError,
  JWKSInvalid,
  JWKSMultipleMatchingKeys,
  JWKSNoMatchingKey,
  JWKSTimeout,
  JWSInvalid,
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTExpired,
  JWTInvalid,
} from "jose/errors";
import { env } from "../env";

const DEFAULT_ISSUER_BASE = "https://integrations.vercel.com";

export const RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS = 60;

const issuerBase = (
  env.VERCEL_INTEGRATIONS_ISSUER_BASE ?? DEFAULT_ISSUER_BASE
).replace(/\/$/, "");

export const resourceTokenIssuer = `${issuerBase}/${env.INTEGRATION_CLIENT_ID}`;

export const resourceTokenJwksUri = `${resourceTokenIssuer}/jwks.json`;

export const resourceTokenDiscoveryUri = `${resourceTokenIssuer}/.well-known/openid-configuration`;

export interface ResourceTokenActor {
  sub: string;
}

export interface ResourceTokenClaims {
  iss: string;
  aud: string | string[];
  sub: string;
  resource: string;
  act?: ResourceTokenActor;
  owner?: string;
  project?: string;
  environment?: string;
  customEnvironmentId?: string;
  deployment?: string;
  iat: number;
  nbf: number;
  exp: number;
  [claim: string]: unknown;
}

const RESOURCE_TOKEN_DEFAULT_CLAIMS: ReadonlySet<string> = new Set([
  "iss",
  "aud",
  "sub",
  "resource",
  "act",
  "owner",
  "project",
  "environment",
  "customEnvironmentId",
  "deployment",
  "iat",
  "nbf",
  "exp",
]);

export function resourceTokenCustomClaims(
  claims: Partial<ResourceTokenClaims>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(claims).filter(
      ([name]) => !RESOURCE_TOKEN_DEFAULT_CLAIMS.has(name),
    ),
  );
}

const CHECK_LABELS = {
  signature: "Signed by Vercel",
  issuer: "Issued for this integration",
  lifetime: "Within its 300s lifetime",
  audience: "Audience is an installation we hold",
  resource: "Resource exists under that installation",
  subject: "Subject is a role this resource grants",
  project: "Names the calling Vercel project",
  deployment: "Names the minting deployment",
  actor: "Names the minting deployment identity",
} as const;

export type ResourceTokenCheckName = keyof typeof CHECK_LABELS;

type SignatureCheckName = Extract<
  ResourceTokenCheckName,
  "signature" | "issuer" | "lifetime"
>;

export interface ResourceTokenCheck {
  name: ResourceTokenCheckName;
  label: string;
  passed: boolean;
  detail: string;
}

export interface VerifiedResource {
  id: string;
  name: string;
  status: string;
  productId?: string;
  roles?: string[];
}

export interface ResourceTokenStore {
  findInstallation(
    installationId: string,
  ): Promise<{ deleted: boolean } | null>;
  findResource(
    installationId: string,
    resourceId: string,
  ): Promise<VerifiedResource | null>;
}

interface AcceptedResourceToken {
  ok: true;
  checks: ResourceTokenCheck[];
  header: ProtectedHeaderParameters;
  claims: ResourceTokenClaims;
  installationId: string;
  resource: VerifiedResource;
}

interface RejectedResourceToken {
  ok: false;
  checks: ResourceTokenCheck[];
  error: string;
  retryable?: boolean;
  header?: ProtectedHeaderParameters;
  claims?: Partial<ResourceTokenClaims>;
  installationId?: string;
  resource?: VerifiedResource;
}

export type ResourceTokenVerification =
  | AcceptedResourceToken
  | RejectedResourceToken;

let remoteJwks: JWTVerifyGetKey | undefined;

function getRemoteJwks(): JWTVerifyGetKey {
  remoteJwks ??= createRemoteJWKSet(new URL(resourceTokenJwksUri));
  return remoteJwks;
}

function check(
  name: ResourceTokenCheckName,
  passed: boolean,
  detail: string,
): ResourceTokenCheck {
  return { name, label: CHECK_LABELS[name], passed, detail };
}

function isKeySetUnavailable(err: unknown): err is JOSEError {
  return (
    err instanceof JWKSInvalid ||
    err instanceof JWKSTimeout ||
    err instanceof JWKSMultipleMatchingKeys ||
    (err instanceof JOSEError && err.code === "ERR_JOSE_GENERIC")
  );
}

function classifyVerifyError(err: unknown): {
  failed: SignatureCheckName;
  detail: string;
  retryable?: boolean;
} {
  if (err instanceof JWTExpired) {
    return {
      failed: "lifetime",
      detail: "Token is expired. Resource tokens live 300s; mint a new one.",
    };
  }

  if (err instanceof JWTClaimValidationFailed) {
    if (err.claim === "nbf") {
      return {
        failed: "lifetime",
        detail: "Token is not valid yet (nbf is in the future).",
      };
    }
    return {
      failed: "issuer",
      detail:
        err.claim === "iss"
          ? `Not issued for this integration. Expected iss "${resourceTokenIssuer}".`
          : `Claim "${err.claim}" is invalid.`,
    };
  }

  if (err instanceof JWKSNoMatchingKey) {
    return {
      failed: "signature",
      detail: `No key in ${resourceTokenJwksUri} matches this token's kid.`,
    };
  }

  if (isKeySetUnavailable(err)) {
    return {
      failed: "signature",
      detail: `Could not read the key set at ${resourceTokenJwksUri} (${err.message}). The token was not judged — this is a metadata availability problem, not a bad signature.`,
      retryable: true,
    };
  }

  if (
    err instanceof JWSSignatureVerificationFailed ||
    err instanceof JOSEAlgNotAllowed ||
    err instanceof JWSInvalid ||
    err instanceof JWTInvalid
  ) {
    return {
      failed: "signature",
      detail: `Signature did not verify against ${resourceTokenJwksUri}: ${err.message}`,
    };
  }

  return {
    failed: "signature",
    detail: err instanceof Error ? err.message : "Unknown verification failure",
  };
}

function checksPassedBefore(failed: SignatureCheckName): ResourceTokenCheck[] {
  const signature = check(
    "signature",
    true,
    `RS256 verified against ${resourceTokenJwksUri}`,
  );
  const issuer = check("issuer", true, resourceTokenIssuer);

  return { signature: [], issuer: [signature], lifetime: [signature, issuer] }[
    failed
  ];
}

function normalizeAudience(aud: string | string[] | undefined): string[] {
  if (!aud) return [];
  return Array.isArray(aud) ? aud : [aud];
}

function safeDecodeHeader(
  token: string,
): ProtectedHeaderParameters | undefined {
  try {
    return decodeProtectedHeader(token);
  } catch {
    return undefined;
  }
}

function reject(
  checks: ResourceTokenCheck[],
  failed: ResourceTokenCheck,
  context: Omit<RejectedResourceToken, "ok" | "checks" | "error">,
): RejectedResourceToken {
  return {
    ok: false,
    checks: [...checks, failed],
    error: failed.detail,
    ...context,
  };
}

function subjectCheck(
  claims: ResourceTokenClaims,
  resource: VerifiedResource,
): ResourceTokenCheck {
  const subject = typeof claims.sub === "string" ? claims.sub : "";
  const roles = resource.roles ?? [];

  if (roles.length > 0) {
    return roles.includes(subject)
      ? check("subject", true, `Role ${subject}`)
      : check(
          "subject",
          false,
          `${subject || "(absent)"} is not a role this resource grants (${roles.join(", ")}).`,
        );
  }

  if (subject.length === 0) {
    return check("subject", false, "Token carries no `sub` claim.");
  }

  return check(
    "subject",
    true,
    subject === claims.resource
      ? `${subject} — the resource itself; it defines no roles`
      : subject,
  );
}

function projectCheck(claims: ResourceTokenClaims): ResourceTokenCheck {
  return check(
    "project",
    true,
    typeof claims.project === "string"
      ? claims.project
      : "Not carried — the resource's claim rules removed `project`.",
  );
}

function deploymentCheck(claims: ResourceTokenClaims): ResourceTokenCheck {
  return check(
    "deployment",
    true,
    typeof claims.deployment === "string"
      ? claims.deployment
      : "Not carried — the minting token had no `deployment_id`, or the resource's claim rules removed `deployment`.",
  );
}

function actorCheck(claims: ResourceTokenClaims): ResourceTokenCheck {
  const actor = claims.act?.sub;

  return typeof actor === "string" && actor.length > 0
    ? check("actor", true, actor)
    : check(
        "actor",
        false,
        "Token carries no `act.sub` claim, so the minting deployment is unknown.",
      );
}

export async function verifyResourceToken(
  token: string,
  store: ResourceTokenStore,
  options: { jwks?: JWTVerifyGetKey; currentDate?: Date } = {},
): Promise<ResourceTokenVerification> {
  const header = safeDecodeHeader(token);

  let claims: ResourceTokenClaims;
  let keyId: string | undefined;
  try {
    const verified = await jwtVerify<ResourceTokenClaims>(
      token,
      options.jwks ?? getRemoteJwks(),
      {
        issuer: resourceTokenIssuer,
        algorithms: ["RS256"],
        clockTolerance: RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS,
        currentDate: options.currentDate,
      },
    );
    claims = verified.payload;
    keyId = verified.protectedHeader.kid;
  } catch (err) {
    const { failed, detail, retryable } = classifyVerifyError(err);
    return reject(checksPassedBefore(failed), check(failed, false, detail), {
      header,
      retryable,
    });
  }

  const checks = [
    check(
      "signature",
      true,
      `RS256 verified against ${resourceTokenJwksUri} (kid ${keyId ?? "unknown"})`,
    ),
    check("issuer", true, claims.iss),
    check(
      "lifetime",
      true,
      `exp ${new Date(claims.exp * 1000).toISOString()} (${claims.exp - claims.iat}s TTL, ±${RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS}s tolerance)`,
    ),
  ];

  const audiences = normalizeAudience(claims.aud);
  if (audiences.length !== 1) {
    return reject(
      checks,
      check(
        "audience",
        false,
        `Expected exactly one audience, got ${audiences.length}.`,
      ),
      { header, claims },
    );
  }

  const [installationId] = audiences;
  const installation = await store.findInstallation(installationId);
  if (!installation || installation.deleted) {
    return reject(
      checks,
      check(
        "audience",
        false,
        installation
          ? `Installation ${installationId} is uninstalled.`
          : `Installation ${installationId} is unknown to this integration.`,
      ),
      { header, claims, installationId },
    );
  }
  checks.push(
    check("audience", true, `Installation ${installationId} is installed here`),
  );

  if (typeof claims.resource !== "string" || claims.resource.length === 0) {
    return reject(
      checks,
      check("resource", false, "Token carries no `resource` claim."),
      { header, claims, installationId },
    );
  }

  const resource = await store.findResource(installationId, claims.resource);
  if (!resource) {
    return reject(
      checks,
      check(
        "resource",
        false,
        `Resource ${claims.resource} does not exist under installation ${installationId}.`,
      ),
      { header, claims, installationId },
    );
  }
  checks.push(
    check(
      "resource",
      true,
      `${resource.name} (${resource.id}), status ${resource.status}`,
    ),
    subjectCheck(claims, resource),
    projectCheck(claims),
    deploymentCheck(claims),
    actorCheck(claims),
  );

  const failed = checks.find((entry) => !entry.passed);
  if (failed) {
    return {
      ok: false,
      checks,
      error: failed.detail,
      header,
      claims,
      installationId,
      resource,
    };
  }

  return {
    ok: true,
    checks,
    header: header ?? {},
    claims,
    installationId,
    resource,
  };
}

export const RESOURCE_TOKEN_CLAIM_GUIDE = [
  {
    claim: "iss",
    meaning: "Our integration. Pinned during verification.",
    example: resourceTokenIssuer,
  },
  {
    claim: "aud",
    meaning: "The installation the resource belongs to. Must be one we hold.",
    example: "icfg_d5746caf3c00c0628a53316b",
  },
  {
    claim: "sub",
    meaning:
      "The role the deployment minted for (`?role=`, else our `defaultRole`), or our resource id when the resource defines no roles.",
    example: "readwrite",
  },
  {
    claim: "resource",
    meaning: "Our own resource id, as returned when we provisioned it.",
    example: "young-pine-52426100",
  },
  {
    claim: "owner / project / environment",
    meaning: "The Vercel team, project, and environment that minted the token.",
    example: "team_acme / prj_storefront / production",
  },
  {
    claim: "deployment",
    meaning: "The deployment that minted the token.",
    example: "dpl_7Gw5ZMBpQA8h9GF832KGp7nwbuh3",
  },
  {
    claim: "…custom",
    meaning:
      "Whatever our `customClaims` rules resolve to for this role and environment, then any `resource-claims` deployment action outcome on top.",
    example: '{ "scope": "read write", "branch": "main" }',
  },
  {
    claim: "act.sub",
    meaning:
      "The deployment OIDC identity that requested the mint (RFC 8693 actor).",
    example: "owner:acme:project:storefront:environment:production",
  },
  {
    claim: "iat / nbf / exp",
    meaning: "Set by Vercel's signer. 300s lifetime; callers cannot extend it.",
    example: "exp = iat + 300",
  },
] as const;
