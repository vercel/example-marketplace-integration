import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env";
import { JWTExpired, JWTInvalid } from "jose/errors";
import { createDecipheriv } from "crypto";

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
  ) => Promise<Response>
): (req: NextRequest, ...rest: any[]) => Promise<Response> {
  return async (req: NextRequest, ...rest: any[]): Promise<Response> => {
    try {
      const token = await getRequestAuthJWT(req);

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

function getRequestAuthJWT(req: Request): string | null {
  switch (req.headers.get("x-vercel-auth")) {
    case "shared-secret":
      return getSharedSecretAuthorizationToken(req);

    default:
      return getBearerAuthorizationToken(req);
  }
}

function getSharedSecretAuthorizationToken(req: Request): string | null {
  const token = getBearerAuthorizationToken(req);

  if (!token) {
    return null;
  }

  return decryptAuthToken(env.INTEGRATION_CLIENT_SECRET, token);
}

function getBearerAuthorizationToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^bearer (.+)$/i);

  if (!match) {
    return null;
  }

  return match[1];
}

function decryptAuthToken(clientSecret: string, token: string): string {
  const [hexIv, hexCipherText] = token.split(".");
  const iv = Buffer.from(hexIv, "hex");
  const decipher = createDecipheriv(
    "aes-192-cbc",
    Buffer.from(clientSecret),
    iv
  );

  return decipher.update(hexCipherText, "hex", "utf8") + decipher.final("utf8");
}

class AuthError extends Error {}
