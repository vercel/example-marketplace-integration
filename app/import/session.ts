import {
  type ProviderAccount,
  getProviderSessionAccount,
} from "@/lib/partner/provider-accounts";
import { cookies } from "next/headers";

// The partner's own login session, independent of the Vercel SSO session
// used by /dashboard.
export const PROVIDER_SESSION_COOKIE = "provider-session";

export async function getSignedInProviderAccount(): Promise<ProviderAccount | null> {
  return getProviderSessionAccount(
    (await cookies()).get(PROVIDER_SESSION_COOKIE)?.value,
  );
}
