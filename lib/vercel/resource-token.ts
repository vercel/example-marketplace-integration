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

/**
 * Verification for Vercel Marketplace *resource tokens* — the short-lived,
 * resource-scoped OIDC tokens a customer's deployment mints for one of our
 * resources and then presents to us in place of a long-lived secret.
 *
 * These are a different credential from the marketplace SSO / API tokens
 * handled in `./auth.ts`:
 *
 * |             | SSO / API token (`./auth.ts`)      | Resource token (this file)                        |
 * | ----------- | --------------------------------- | ------------------------------------------------- |
 * | `iss`       | `https://marketplace.vercel.com`  | `https://integrations.vercel.com/<integrationId>` |
 * | `aud`       | our integration id                | the *installation* id the resource belongs to     |
 * | `sub`       | the Vercel user                   | the requested role, else our resource id          |
 * | minted by   | Vercel, for a user or our API     | the customer's deployment, from its OIDC token    |
 * | lifetime    | long-ish                          | 300s                                              |
 *
 * One Vercel key signs resource tokens for *every* integration, so key identity
 * proves nothing about which integration a token was minted for. Isolation comes
 * from the claims: `iss` must be our integration, `aud` must be an installation
 * we hold, and `resource` must name a resource under that installation. All
 * three are enforced below.
 */

const DEFAULT_ISSUER_BASE = "https://integrations.vercel.com";

/** Matches the 300s token TTL — generous enough for clock skew, far short of a replay window. */
export const RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS = 60;

const issuerBase = (
  env.VERCEL_INTEGRATIONS_ISSUER_BASE ?? DEFAULT_ISSUER_BASE
).replace(/\/$/, "");

/**
 * `INTEGRATION_CLIENT_ID` *is* our integration id — it is what Vercel puts in
 * `aud` on SSO tokens (see `./auth.ts`) — so the issuer needs no new config.
 */
export const resourceTokenIssuer = `${issuerBase}/${env.INTEGRATION_CLIENT_ID}`;

/** Advertised by the discovery document as `jwks_uri`. */
export const resourceTokenJwksUri = `${resourceTokenIssuer}/jwks.json`;

export const resourceTokenDiscoveryUri = `${resourceTokenIssuer}/.well-known/openid-configuration`;

/** RFC 8693 §4.1: `act` is an object whose `sub` names the actor, not a bare string. */
export interface ResourceTokenActor {
  sub: string;
}

export interface ResourceTokenClaims {
  /** The role the deployment minted for, or our resource id when the resource defines none. */
  sub: string;
  /** `https://integrations.vercel.com/<our integration id>`. */
  iss: string;
  /** The installation id the resource belongs to. */
  aud: string | string[];
  /** Our own id for the resource — what we returned as `id` when provisioning it. */
  resource: string;
  /** The deployment OIDC token that asked for the mint. */
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

export const RESOURCE_TOKEN_DEFAULT_CLAIMS = [
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
] as const;

const defaultClaims: ReadonlySet<string> = new Set(
  RESOURCE_TOKEN_DEFAULT_CLAIMS,
);

export function resourceTokenCustomClaims(
  claims: Partial<ResourceTokenClaims>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(claims).filter(([name]) => !defaultClaims.has(name)),
  );
}

export type ResourceTokenCheckName =
  | "signature"
  | "issuer"
  | "lifetime"
  | "audience"
  | "resource"
  | "subject"
  | "project"
  | "deployment"
  | "actor";

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

export type ResourceTokenVerification =
  | {
      ok: true;
      checks: ResourceTokenCheck[];
      header: ProtectedHeaderParameters;
      claims: ResourceTokenClaims;
      installationId: string;
      resource: VerifiedResource;
    }
  | {
      ok: false;
      checks: ResourceTokenCheck[];
      header?: ProtectedHeaderParameters;
      claims?: Partial<ResourceTokenClaims>;
      installationId?: string;
      resource?: VerifiedResource;
      error: string;
      /**
       * True when the token was never actually judged because the key set could
       * not be read (a JWKS availability problem on our side). Callers should
       * retry (5xx) rather than treat the token as permanently rejected (403).
       */
      retryable?: boolean;
    };

/**
 * What the token has to be checked against. Injected so the verification path
 * can be tested without Redis, and so a partner reading this can see exactly
 * which two lookups their own store has to answer.
 */
export interface ResourceTokenStore {
  /** Resolve `aud`. Must return null for an installation we do not hold, including an uninstalled one. */
  findInstallation(
    installationId: string,
  ): Promise<{ deleted: boolean } | null>;
  /** Resolve `resource` *within* `aud` — never globally, or one installation could name another's resource. */
  findResource(
    installationId: string,
    resourceId: string,
  ): Promise<VerifiedResource | null>;
}

let remoteJwks: JWTVerifyGetKey | undefined;

/** Lazy so that importing this module never reaches the network, and `jose` caches the fetch. */
function getRemoteJwks(): JWTVerifyGetKey {
  remoteJwks ??= createRemoteJWKSet(new URL(resourceTokenJwksUri));
  return remoteJwks;
}

function check(
  name: ResourceTokenCheckName,
  label: string,
  passed: boolean,
  detail: string,
): ResourceTokenCheck {
  return { name, label, passed, detail };
}

/**
 * `jwtVerify` collapses signature, issuer, and expiry into one throw, so map the
 * error back onto the check that actually failed — otherwise a demo of an expired
 * token would read as a signature problem.
 */
function classifyVerifyError(err: unknown): {
  failed: ResourceTokenCheckName;
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
    if (err.claim === "iss") {
      return {
        failed: "issuer",
        detail: `Not issued for this integration. Expected iss "${resourceTokenIssuer}".`,
      };
    }
    if (err.claim === "nbf") {
      return {
        failed: "lifetime",
        detail: "Token is not valid yet (nbf is in the future).",
      };
    }
    return { failed: "issuer", detail: `Claim "${err.claim}" is invalid.` };
  }

  if (err instanceof JWKSNoMatchingKey) {
    return {
      failed: "signature",
      detail: `No key in ${resourceTokenJwksUri} matches this token's kid.`,
    };
  }

  // The key set could not be *read*, which is an availability problem on our
  // side, not a claim about the token. Called out separately because it is
  // indistinguishable from a bad signature otherwise, and the two want opposite
  // responses: retry versus reject.
  // `ERR_JOSE_GENERIC` is what a non-200 from the JWKS endpoint surfaces as
  // (`fetch_jwks` throws a bare `JOSEError`), so match on the code rather than
  // the class — `instanceof JOSEError` alone would swallow every case above.
  if (
    err instanceof JWKSInvalid ||
    err instanceof JWKSTimeout ||
    err instanceof JWKSMultipleMatchingKeys ||
    (err instanceof JOSEError && err.code === "ERR_JOSE_GENERIC")
  ) {
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

/** The checks that had already passed by the time `failed` threw. */
function checksBefore(failed: ResourceTokenCheckName): ResourceTokenCheck[] {
  const passed: ResourceTokenCheck[] = [];

  if (failed !== "signature") {
    passed.push(
      check(
        "signature",
        "Signed by Vercel",
        true,
        `RS256 signature verified against ${resourceTokenJwksUri}`,
      ),
    );
  }
  if (failed !== "signature" && failed !== "issuer") {
    passed.push(
      check("issuer", "Issued for this integration", true, resourceTokenIssuer),
    );
  }

  return passed;
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

function failure(
  checks: ResourceTokenCheck[],
  error: string,
  rest: Partial<Extract<ResourceTokenVerification, { ok: false }>> = {},
): ResourceTokenVerification {
  return { ok: false, checks, error, ...rest };
}

export async function verifyResourceToken(
  token: string,
  store: ResourceTokenStore,
  options: { jwks?: JWTVerifyGetKey; currentDate?: Date } = {},
): Promise<ResourceTokenVerification> {
  const header = safeDecodeHeader(token);
  let claims: ResourceTokenClaims;
  const checks: ResourceTokenCheck[] = [];

  try {
    const verified = await jwtVerify<ResourceTokenClaims>(
      token,
      options.jwks ?? getRemoteJwks(),
      {
        // Pinned, not merely inspected: a token minted for another integration
        // carries a valid Vercel signature and would otherwise pass.
        issuer: resourceTokenIssuer,
        algorithms: ["RS256"],
        clockTolerance: RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS,
        currentDate: options.currentDate,
      },
    );
    claims = verified.payload;

    checks.push(
      check(
        "signature",
        "Signed by Vercel",
        true,
        `RS256 verified against ${resourceTokenJwksUri} (kid ${verified.protectedHeader.kid ?? "unknown"})`,
      ),
      check("issuer", "Issued for this integration", true, claims.iss),
      check(
        "lifetime",
        "Within its 300s lifetime",
        true,
        `exp ${new Date(claims.exp * 1000).toISOString()} (${claims.exp - claims.iat}s TTL, ±${RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS}s tolerance)`,
      ),
    );
  } catch (err) {
    const { failed, detail, retryable } = classifyVerifyError(err);
    return failure(
      [
        ...checksBefore(failed),
        check(failed, checkLabel(failed), false, detail),
      ],
      detail,
      { header, retryable },
    );
  }

  // `aud` is the installation, and the only thing separating our tokens from
  // another integration's under the same signing key — so an unknown or
  // uninstalled installation is a hard reject, not a warning.
  const audiences = normalizeAudience(claims.aud);
  if (audiences.length !== 1) {
    const detail = `Expected exactly one audience, got ${audiences.length}.`;
    checks.push(check("audience", checkLabel("audience"), false, detail));
    return failure(checks, detail, { header, claims });
  }

  const installationId = audiences[0];
  const installation = await store.findInstallation(installationId);

  if (!installation || installation.deleted) {
    const detail = installation
      ? `Installation ${installationId} is uninstalled.`
      : `Installation ${installationId} is unknown to this integration.`;
    checks.push(check("audience", checkLabel("audience"), false, detail));
    return failure(checks, detail, { header, claims, installationId });
  }

  checks.push(
    check(
      "audience",
      checkLabel("audience"),
      true,
      `Installation ${installationId} is installed here`,
    ),
  );

  if (typeof claims.resource !== "string" || claims.resource.length === 0) {
    const detail = "Token carries no `resource` claim.";
    checks.push(check("resource", checkLabel("resource"), false, detail));
    return failure(checks, detail, { header, claims, installationId });
  }

  const resource = await store.findResource(installationId, claims.resource);

  if (!resource) {
    const detail = `Resource ${claims.resource} does not exist under installation ${installationId}.`;
    checks.push(check("resource", checkLabel("resource"), false, detail));
    return failure(checks, detail, { header, claims, installationId });
  }

  checks.push(
    check(
      "resource",
      checkLabel("resource"),
      true,
      `${resource.name} (${resource.id}), status ${resource.status}`,
    ),
  );

  checks.push(subjectCheck(claims, resource));

  // `project`, `deployment`, and `act.sub` do not gate access — the checks
  // above do that. They are recorded because they are the audit trail: which
  // project holds the credential, which deployment and deployment identity
  // asked Vercel to mint it.
  const project = typeof claims.project === "string" ? claims.project : "";
  checks.push(
    check(
      "project",
      checkLabel("project"),
      true,
      project.length === 0
        ? "Token carries no `project` claim."
        : `${project}${project.startsWith("prj_") ? "" : " (not a prj_ id — unexpected)"}`,
    ),
  );

  checks.push(
    check(
      "deployment",
      checkLabel("deployment"),
      true,
      typeof claims.deployment === "string"
        ? claims.deployment
        : "Absent — the minting deployment's OIDC token carried no `deployment_id`.",
    ),
  );

  const actor = claims.act?.sub;
  checks.push(
    check(
      "actor",
      checkLabel("actor"),
      typeof actor === "string" && actor.length > 0,
      actor
        ? actor
        : "Token carries no `act.sub` claim, so the minting deployment is unknown.",
    ),
  );

  const failedCheck = checks.find((entry) => !entry.passed);
  if (failedCheck) {
    return failure(checks, failedCheck.detail, {
      header,
      claims,
      installationId,
      resource,
    });
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

function subjectCheck(
  claims: ResourceTokenClaims,
  resource: VerifiedResource,
): ResourceTokenCheck {
  const subject = typeof claims.sub === "string" ? claims.sub : "";
  const roles = resource.roles ?? [];

  if (roles.length === 0) {
    return check(
      "subject",
      checkLabel("subject"),
      subject.length > 0,
      subject.length === 0
        ? "Token carries no `sub` claim."
        : subject === claims.resource
          ? `${subject} — the resource itself; it defines no roles`
          : subject,
    );
  }

  return check(
    "subject",
    checkLabel("subject"),
    roles.includes(subject),
    roles.includes(subject)
      ? `Role ${subject}`
      : `${subject || "(absent)"} is not a role this resource grants (${roles.join(", ")}).`,
  );
}

export function checkLabel(name: ResourceTokenCheckName): string {
  switch (name) {
    case "signature":
      return "Signed by Vercel";
    case "issuer":
      return "Issued for this integration";
    case "lifetime":
      return "Within its 300s lifetime";
    case "audience":
      return "Audience is an installation we hold";
    case "resource":
      return "Resource exists under that installation";
    case "subject":
      return "Subject is a role this resource grants";
    case "project":
      return "Names the calling Vercel project";
    case "deployment":
      return "Names the minting deployment";
    case "actor":
      return "Names the minting deployment identity";
  }
}

/** Rendered on the dashboard and returned by `GET /oidc/resource-token`. */
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
