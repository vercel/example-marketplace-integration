import { NextRequest, NextResponse } from "next/server";
import jsonwebtoken from "jsonwebtoken";
import jwkToPem from "jwk-to-pem";
import { env } from "../env";

export interface OidcClaims {
  sub: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

export interface NextRequestWithClaims extends NextRequest {
  claims: OidcClaims;
}

export function authMiddleware(
  next: (
    req: NextRequestWithClaims,
    ...rest: any[]
  ) => Promise<Response | NextResponse>,
): (req: NextRequest, ...rest: any[]) => Promise<Response | NextResponse> {
  return async (
    req: NextRequest,
    ...rest: any[]
  ): Promise<Response | NextResponse> => {
    try {
      const reqWithClaims = new NextRequest(req) as NextRequestWithClaims;
      reqWithClaims.claims = await authRequest(req);
      return next(reqWithClaims, ...rest);
    } catch (err) {
      if (err instanceof Error) {
        return new NextResponse(err.message, { status: 401 });
      }
      return new NextResponse("Unauthorized", { status: 401 });
    }
  };
}

const keysCache = new Map<string, string>();
async function getPublicKey(keyId: string): Promise<string> {
  if (keysCache.has(keyId)) {
    return keysCache.get(keyId) as string;
  }
  const res = await fetch(`https://vercel.com/.well-known/jwks`);
  const jwks = await res.json();
  const key = jwks.keys.find((k: { kid: string }) => k.kid === keyId);
  if (!key) {
    throw new Error("Key not found");
  }
  const pem = jwkToPem(key);
  keysCache.set(keyId, pem);
  return pem;
}

async function verifyToken(
  token: string,
): Promise<string | jsonwebtoken.JwtPayload | undefined> {
  return new Promise((resolve, reject) => {
    jsonwebtoken.verify(
      token,
      (header, callback) => {
        if (!header.kid) {
          return callback(new Error("Invalid token"));
        }
        getPublicKey(header.kid)
          .then((publicKey) => {
            callback(null, publicKey);
          })
          .catch((err) => {
            callback(err);
          });
      },
      (err, decoded) => {
        if (err) {
          return reject(err);
        }
        resolve(decoded);
      },
    );
  });
}

function isOidcToken(decoded: unknown): decoded is OidcClaims {
  return (
    typeof decoded === "object" &&
    decoded !== null &&
    "sub" in decoded &&
    "aud" in decoded &&
    "iss" in decoded
  );
}

export async function decodeAuthToken(authToken: string): Promise<OidcClaims> {
  const decoded = await verifyToken(authToken);
  if (isOidcToken(decoded)) {
    return decoded;
  }
  throw new Error("Invalid token");
}

function extractAuthRequest(req: Request): string {
  const authHeader = req.headers.get("Authorization");
  const match = authHeader?.match(/^(?<authType>.*) (?<authToken>.*)$/i);
  if (
    match?.groups?.authType?.toLowerCase() === "bearer" &&
    typeof match?.groups?.authToken === "string"
  ) {
    return match.groups.authToken;
  }
  throw new Error("Invalid Authorization header");
}

export async function authRequest(req: Request): Promise<OidcClaims> {
  const token = extractAuthRequest(req);
  const claims = await decodeAuthToken(token);
  if (claims.aud !== env.INTEGRATION_CLIENT_ID) {
    throw new Error("Invalid audience");
  }
  if (claims.iss !== "https://vercel.com") {
    throw new Error("Invalid issuer");
  }
  return claims;
}
