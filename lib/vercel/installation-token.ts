import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "../env";
import { kv } from "../redis";

const tokenResponse = z.object({
  access_token: z.string().min(1),
  token_type: z.string().regex(/^bearer$/i),
  installation_id: z.string(),
  expires_in: z.number().int().positive().max(3600),
});

interface CachedToken {
  accessToken: string;
  refreshAt: number;
}

const pending = new Map<string, Promise<string>>();

export async function getInstallationAccessToken(
  installationId: string,
  installationCredential: string,
): Promise<string> {
  const version = createHash("sha256")
    .update(
      JSON.stringify([env.INTEGRATION_CLIENT_SECRET, installationCredential]),
    )
    .digest("hex");
  const key = `${env.INTEGRATION_CLIENT_ID}:${installationId}:access-token:${version}`;
  const existing = pending.get(key);
  if (existing) return existing;

  const request = loadOrRenew(key, installationId);
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}

async function loadOrRenew(
  key: string,
  installationId: string,
): Promise<string> {
  const cached = await kv.get<CachedToken>(key);
  if (cached && cached.refreshAt > Date.now()) return cached.accessToken;

  const startedAt = Date.now();
  const response = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.INTEGRATION_CLIENT_ID,
      client_secret: env.INTEGRATION_CLIENT_SECRET,
      installation_id: installationId,
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Access-token exchange failed (${response.status})`);

  const token = tokenResponse.parse(await response.json());
  if (token.installation_id !== installationId)
    throw new Error("Access-token installation mismatch");
  const lifetime = token.expires_in * 1000;
  const renewalMargin = Math.min(lifetime / 2, 60_000 + Math.random() * 30_000);
  const refreshAt = startedAt + lifetime - renewalMargin;
  const remaining = Math.floor((refreshAt - Date.now()) / 1000);
  if (remaining <= 0) throw new Error("Access token expired during exchange");
  await kv.set(
    key,
    { accessToken: token.access_token, refreshAt } satisfies CachedToken,
    { ex: remaining },
  );
  return token.access_token;
}
