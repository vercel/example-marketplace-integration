import {
  recordResourceTokenPresentation,
  redisResourceTokenStore,
} from "@/lib/partner/resource-tokens";
import { buildError } from "@/lib/utils";
import {
  RESOURCE_TOKEN_CLAIM_GUIDE,
  type ResourceTokenVerification,
  resourceTokenCustomClaims,
  resourceTokenDiscoveryUri,
  resourceTokenIssuer,
  resourceTokenJwksUri,
  verifyResourceToken,
} from "@/lib/vercel/resource-token";
import type { NextRequest } from "next/server";

function bearerToken(request: NextRequest): string | null {
  const match = request.headers
    .get("authorization")
    ?.match(/^bearer[ ]+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function recordPresentation(
  token: string,
  verification: ResourceTokenVerification,
): Promise<string | null> {
  try {
    const presentation = await recordResourceTokenPresentation({
      accepted: verification.ok,
      error: verification.ok ? undefined : verification.error,
      checks: verification.checks,
      claims: verification.claims,
      header: verification.header,
      installationId: verification.installationId,
      resource: verification.resource,
      token,
    });
    return presentation.id;
  } catch (error) {
    console.warn("Failed to record resource token presentation", error);
    return null;
  }
}

const UNVERIFIABLE = {
  code: "resource_token_unverifiable",
  message:
    "The token could not be verified because our key set was temporarily unavailable. This is a transient problem on our side — retry shortly with the same token.",
  status: 503,
};

const REJECTED = {
  code: "resource_token_rejected",
  message:
    "The resource token was not accepted. Mint a fresh one for a resource on this installation.",
  status: 403,
};

function rejection(
  verification: Extract<ResourceTokenVerification, { ok: false }>,
  presentationId: string | null,
): Response {
  const { code, message, status } = verification.retryable
    ? UNVERIFIABLE
    : REJECTED;

  return Response.json(
    {
      ...buildError(code, verification.error, { message }),
      presentationId,
      checks: verification.checks,
    },
    { status },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const token = bearerToken(request);

  if (!token) {
    return Response.json(
      buildError(
        "missing_credential",
        "Present the resource token as `Authorization: Bearer <token>`.",
      ),
      { status: 401 },
    );
  }

  const verification = await verifyResourceToken(
    token,
    redisResourceTokenStore,
  );
  const presentationId = await recordPresentation(token, verification);

  if (!verification.ok) {
    return rejection(verification, presentationId);
  }

  const { claims, resource, installationId, header, checks } = verification;

  return Response.json({
    accepted: true,
    presentationId,
    identity: {
      installationId,
      resourceId: resource.id,
      resourceName: resource.name,
      resourceStatus: resource.status,
      productId: resource.productId,
      role: claims.sub,
      project: claims.project ?? null,
      environment: claims.environment ?? null,
      deployment: claims.deployment ?? null,
      mintedBy: claims.act?.sub ?? null,
      grants: resourceTokenCustomClaims(claims),
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      secondsRemaining: Math.max(0, claims.exp - Math.floor(Date.now() / 1000)),
    },
    checks,
    header,
    claims,
    dashboardUrl: "/dashboard/oidc-tokens",
  });
}

export function GET(): Response {
  return Response.json({
    issuer: resourceTokenIssuer,
    jwksUri: resourceTokenJwksUri,
    discoveryUri: resourceTokenDiscoveryUri,
    acceptedAlgorithms: ["RS256"],
    presentAs: "Authorization: Bearer <resource token>",
    claims: RESOURCE_TOKEN_CLAIM_GUIDE,
  });
}
