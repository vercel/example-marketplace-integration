import {
  recordResourceTokenPresentation,
  redisResourceTokenStore,
} from "@/lib/partner/resource-tokens";
import { buildError } from "@/lib/utils";
import {
  RESOURCE_TOKEN_CLAIM_GUIDE,
  resourceTokenDiscoveryUri,
  resourceTokenIssuer,
  resourceTokenJwksUri,
  verifyResourceToken,
} from "@/lib/vercel/resource-token";
import type { NextRequest } from "next/server";

/**
 * Stands in for this integration's data plane.
 *
 * The real shape of this feature is a customer's deployment presenting a minted
 * resource token where a long-lived secret used to go — a database password, an
 * API key header. So this endpoint takes the token exactly that way, as a bearer
 * credential, verifies it, and answers with what it resolved the caller to.
 *
 * Deliberately *not* under `/v1/installations/...`: those routes are the
 * Marketplace API contract that Vercel calls with an SSO/API token. This is a
 * partner-owned endpoint that customers call with a resource token.
 *
 * `GET` returns the metadata a customer (or a debugging session) needs to
 * reason about what this endpoint will accept.
 */

function bearerToken(request: NextRequest): string | null {
  const match = request.headers
    .get("authorization")
    ?.match(/^bearer[ ]+(.+)$/i);
  return match ? match[1].trim() : null;
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

  // Best-effort, like `recordParentAttribution` in `withAuth`: the demo log is
  // an observability nicety, and losing it must never turn a clean verdict into
  // a 500 the caller cannot interpret.
  let presentationId: string | null = null;
  try {
    const presentation = await recordResourceTokenPresentation({
      accepted: verification.ok,
      error: verification.ok ? undefined : verification.error,
      checks: verification.checks,
      claims: verification.claims,
      header: verification.header as Record<string, unknown> | undefined,
      installationId: verification.installationId,
      resource: verification.resource,
      token,
    });
    presentationId = presentation.id;
  } catch (error) {
    console.warn("Failed to record resource token presentation", error);
  }

  if (!verification.ok) {
    return Response.json(
      {
        ...buildError("resource_token_rejected", verification.error, {
          message:
            "The resource token was not accepted. Mint a fresh one for a resource on this installation.",
        }),
        presentationId,
        checks: verification.checks,
      },
      { status: 403 },
    );
  }

  const { claims, resource, installationId, header, checks } = verification;

  return Response.json({
    accepted: true,
    presentationId,
    // What the token authenticated the caller *as* — the whole point of the
    // exchange. A real data plane would authorize against exactly these.
    identity: {
      installationId,
      resourceId: resource.id,
      resourceName: resource.name,
      resourceStatus: resource.status,
      productId: resource.productId,
      project: claims.sub,
      mintedBy: claims.act?.sub ?? null,
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
