import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env";
import { JWTExpired, JWTInvalid } from "jose/errors";

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

export function withAuth(
  callback: (
    claims: OidcClaims,
    req: NextRequest,
    ...rest: any[]
  ) => Promise<Response>,
  {
    getAuthorizationToken = getBearerAuthorizationToken,
  }: {
    getAuthorizationToken?: (
      request: NextRequest
    ) => string | null | Promise<string | null>;
  } = {}
): (req: NextRequest, ...rest: any[]) => Promise<Response> {
  return async (req: NextRequest, ...rest: any[]): Promise<Response> => {
    try {
      const token = await getAuthorizationToken(req);

      if (!token) {
        throw new AuthError("Invalid Authorization header, no token found");
      }

      const claims = await verifyToken(token);

      return callback(claims, req, ...rest);
    } catch (err) {
      if (err instanceof AuthError) {
        return new NextResponse(err.message, { status: 403 });
      }

      throw err;
    }
  };
}

export async function verifyToken(token: string): Promise<OidcClaims> {
  try {
    const { payload: claims } = await jwtVerify<OidcClaims>(
      token,
      await createRemoteJWKSet(
        new URL(`https://marketplace.vercel.com/.well-known/jwks`)
      )
    );

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
}

export function getBearerAuthorizationToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^bearer (.+)$/i);

  if (!match) {
    return null;
  }

  return match[1];
}

class AuthError extends Error {}
