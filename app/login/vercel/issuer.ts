import {
  allowInsecureRequests,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  Configuration,
  discovery,
  IDToken,
  randomState,
} from "openid-client";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const OIDC_ISSUER =
  process.env.OIDC_ISSUER || "https://marketplace.vercel.com";

let clientPromise: Promise<Configuration> | undefined;
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

export async function getOidcConfiguration(): Promise<Configuration> {
  if (clientPromise) {
    return clientPromise;
  }

  clientPromise = (async () => {
    try {
      const oidcClientId = process.env.INTEGRATION_CLIENT_ID;
      if (!oidcClientId) {
        throw new Error("Missing INTEGRATION_CLIENT_ID environment variable");
      }
      const oidcClientSecret = process.env.INTEGRATION_CLIENT_SECRET;
      if (!oidcClientSecret) {
        throw new Error(
          "Missing INTEGRATION_CLIENT_SECRET environment variable"
        );
      }
      const configuration = await discovery(
        new URL(OIDC_ISSUER),
        oidcClientId,
        {
          client_id: oidcClientId,
          client_secret: oidcClientSecret,
        },
        undefined,
        {
          algorithm: "oidc",
          execute: [allowInsecureRequests],
        }
      );
      console.log("Discovered configuration: ", configuration.serverMetadata());
      return configuration;
    } catch (error) {
      console.error(
        "Error discovering OIDC issuer or initializing client:",
        error
      );
      throw error;
    }
  })();
  return clientPromise;
}

export async function createAuthorizationUrl({
  callbackUrl,
  login_hint,
  v_deeplink,
  explicit = true,
}: {
  callbackUrl: string;
  login_hint?: string;
  v_deeplink?: string;
  explicit?: boolean;
}): Promise<{
  redirectTo: string;
  state: string;
}> {
  const config = await getOidcConfiguration();

  const state = randomState();

  const redirectTo = buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid",
    state,
    response_type: explicit ? "code" : "id_token",
    ...(login_hint ? { login_hint } : null),
    ...(v_deeplink ? { v_deeplink } : null),
  });

  return {
    redirectTo: redirectTo.toString(),
    state,
  };
}

async function getJwks() {
  if (!jwks) {
    const config = await getOidcConfiguration();
    const serverMetadata = config.serverMetadata();
    if (!serverMetadata.jwks_uri) {
      throw new Error("JWKS URI not found in server metadata.");
    }
    console.log("Creating JWKS from server metadata:", serverMetadata.jwks_uri);
    jwks = createRemoteJWKSet(new URL(serverMetadata.jwks_uri));
  }
  return jwks;
}

async function validateIdToken(id_token: string): Promise<IDToken> {
  const jwks = await getJwks();
  const token = await jwtVerify<IDToken>(id_token, jwks);
  console.log("ID Token claims:", token.payload);
  return token.payload;
}

export async function getTokens(
  currentUrl: string,
  expectedState: string | undefined
): Promise<{ id_token: string; claims: IDToken } | null> {
  const config = await getOidcConfiguration();

  const tokens = await authorizationCodeGrant(config, new URL(currentUrl), {
    expectedState,
    idTokenExpected: true,
  });

  console.log("Token Endpoint Response", tokens);

  const id_token = tokens.id_token;
  if (!id_token) {
    console.warn("No ID token received from the token endpoint.");
    return null;
  }

  const claims2 = tokens.claims();
  console.log("Claims2", claims2);

  const claims = await validateIdToken(id_token);
  console.log("Token Endpoint Response claims", claims);

  return { id_token, claims };
}
