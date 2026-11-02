"use server";

import {
  createProviderResource,
  createProviderSession,
  deleteProviderSession,
  signInProviderAccount,
} from "@/lib/partner/provider-accounts";
import { completeResourceImport } from "@/lib/partner/resource-import";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  PROVIDER_SESSION_COOKIE,
  getSignedInProviderAccount,
} from "../session";

export async function signInAction(formData: FormData): Promise<void> {
  const importId = formData.get("importId") as string;
  let sessionId: string;
  try {
    const account = await signInProviderAccount(
      (formData.get("email") as string) ?? "",
    );
    sessionId = await createProviderSession(account.id);
  } catch (error) {
    redirectWithError(importId, error);
  }
  (await cookies()).set(PROVIDER_SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect(`/import/${importId}`);
}

export async function signOutAction(formData: FormData): Promise<void> {
  const importId = formData.get("importId") as string;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(PROVIDER_SESSION_COOKIE)?.value;
  if (sessionId) {
    await deleteProviderSession(sessionId);
  }
  cookieStore.delete(PROVIDER_SESSION_COOKIE);
  redirect(`/import/${importId}`);
}

export async function createProviderResourceAction(
  formData: FormData,
): Promise<void> {
  const importId = formData.get("importId") as string;
  const account = await getSignedInProviderAccount();
  const name = ((formData.get("name") as string) ?? "").trim();
  if (!account) redirect(`/import/${importId}`);
  if (name) await createProviderResource(account.id, name);
  revalidatePath(`/import/${importId}`);
}

export async function importResourceAction(formData: FormData): Promise<void> {
  const importId = formData.get("importId") as string;
  const account = await getSignedInProviderAccount();
  if (!account) redirect(`/import/${importId}`);

  let redirectUrl: string;
  try {
    ({ redirectUrl } = await completeResourceImport({
      importId,
      accountId: account.id,
      providerResourceId: (formData.get("resourceId") as string) ?? "",
      productId: (formData.get("productId") as string) ?? undefined,
    }));
  } catch (error) {
    redirectWithError(importId, error);
  }
  // The Import Resource call has completed; Vercel can now find the resource
  // when it handles this redirect.
  redirect(redirectUrl);
}

function redirectWithError(importId: string, error: unknown): never {
  console.error("Resource import failed:", error);
  const message = error instanceof Error ? error.message : String(error);
  redirect(`/import/${importId}?error=${encodeURIComponent(message)}`);
}
