import { createRemoteJWKSet, jwtVerify } from "jose";
import { JWTExpired, JWTInvalid } from "jose/errors";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "../env";

const JWKS = createRemoteJWKSet(
  new URL("https://marketplace.vercel.com/.well-known/jwks")
);

const BEARER_TOKEN_REGEX = /^bearer (.+)$/i;

export interface OidcClaims {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  account_id: string;
  installation_id: string;
  user_id: string;
  user_role: string;
  user_name?: string;
  user_avatar_url?: string;
}

export const withAuth = (
  callback: (
    claims: OidcClaims,
    req: NextRequest,
    ...rest: unknown[]
  ) => Promise<Response>
) => {
  return async (req: NextRequest, ...rest: unknown[]) => {
    try {
      const token = getAuthorizationToken(req);
      const claims = await verifyToken(token);

      return callback(claims, req, ...rest);
    } catch (err) {
      if (err instanceof AuthError) {
        return new NextResponse(err.message, { status: 403 });
      }

      throw err;
    }
  };
};

export const verifyToken = async (token: string) => {
  try {
    const { payload: claims } = await jwtVerify<OidcClaims>(token, JWKS);

    if (claims.aud !== env.INTEGRATION_CLIENT_ID) {
      throw new AuthError("Invalid audience");
    }

    if (claims.iss !== "https://marketplace.vercel.com") {
      throw new AuthError("Invalid issuer");
    }

    return claims;
  } catch (err) {
    if (err instanceof JWTExpired) {
      throw new AuthError("Auth expired");
    }

    if (err instanceof JWTInvalid) {
      throw new AuthError("Auth invalid");
    }

    throw err;
  }
};

const getAuthorizationToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(BEARER_TOKEN_REGEX);

  if (!match) {
    throw new AuthError("Invalid Authorization header");
  }

  return match[1];
};

class AuthError extends Error {}
