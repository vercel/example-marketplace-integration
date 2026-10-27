import { nanoid } from "nanoid";
import { kv } from "../redis";

// A stand-in for the partner's own platform: accounts and resources that
// exist independently of any Vercel installation. The Import Existing
// Resource flow lets a user bring one of these resources into Vercel.
//
// Sign-in is email-only so the example can run without an identity provider.
// A real integration authenticates the user with its existing login.

export interface ProviderAccount {
  id: string;
  email: string;
  createdAt: number;
}

export interface ProviderResource {
  id: string;
  accountId: string;
  name: string;
  region: string;
  // The credential Vercel syncs to connected projects once imported.
  secret: string;
  createdAt: number;
}

const SESSION_TTL_SECONDS = 24 * 60 * 60;

export async function signInProviderAccount(
  email: string,
): Promise<ProviderAccount> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    throw new Error("Enter a valid email address");
  }

  const existingId = await kv.get<string>(
    `provider-account-email:${normalizedEmail}`,
  );
  if (existingId) {
    const existing = await kv.get<ProviderAccount>(
      `provider-account:${existingId}`,
    );
    if (existing) return existing;
  }

  const account: ProviderAccount = {
    id: `acct_${nanoid()}`,
    email: normalizedEmail,
    createdAt: Date.now(),
  };
  await kv.set(`provider-account:${account.id}`, account);
  await kv.set(`provider-account-email:${normalizedEmail}`, account.id);

  // Seed resources so a new account has something to import.
  const handle = normalizedEmail.split("@")[0].replace(/[^a-z0-9-]/g, "-");
  await createProviderResource(account.id, `${handle}-main`, "iad1");
  await createProviderResource(account.id, `${handle}-analytics`, "fra1");

  return account;
}

export async function createProviderResource(
  accountId: string,
  name: string,
  region = "iad1",
): Promise<ProviderResource> {
  const resource: ProviderResource = {
    id: `res_${nanoid()}`,
    accountId,
    name,
    region,
    secret: `example://${accountId}:${nanoid(24)}@${region}.example.com/${name}`,
    createdAt: Date.now(),
  };
  await kv.set(`provider-resource:${resource.id}`, resource);
  await kv.lpush(`provider-account:${accountId}:resources`, resource.id);
  return resource;
}

export async function listProviderResources(
  accountId: string,
): Promise<ProviderResource[]> {
  const ids = await kv.lrange<string>(
    `provider-account:${accountId}:resources`,
    0,
    -1,
  );
  const resources = await Promise.all(
    ids.map((id) => kv.get<ProviderResource>(`provider-resource:${id}`)),
  );
  return resources.filter(
    (resource): resource is ProviderResource =>
      resource?.accountId === accountId,
  );
}

// Returns the resource only when it belongs to the given account, so a
// signed-in user cannot import another account's resource by ID.
export async function getProviderResource(
  accountId: string,
  resourceId: string,
): Promise<ProviderResource | null> {
  const resource = await kv.get<ProviderResource>(
    `provider-resource:${resourceId}`,
  );
  return resource?.accountId === accountId ? resource : null;
}

export async function createProviderSession(
  accountId: string,
): Promise<string> {
  const sessionId = nanoid(32);
  await kv.set(`provider-session:${sessionId}`, accountId, {
    ex: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

export async function getProviderSessionAccount(
  sessionId: string | undefined,
): Promise<ProviderAccount | null> {
  if (!sessionId) return null;
  const accountId = await kv.get<string>(`provider-session:${sessionId}`);
  if (!accountId) return null;
  return kv.get<ProviderAccount>(`provider-account:${accountId}`);
}

export async function deleteProviderSession(sessionId: string): Promise<void> {
  await kv.del(`provider-session:${sessionId}`);
}
