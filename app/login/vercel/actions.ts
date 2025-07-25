"use server";

import { cookies as getCookies, headers as getHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { createAuthorizationUrl, OIDC_ISSUER } from "./issuer";

export async function maybeStartAuthorizationAuto(
  params: Record<string, string>
) {
  // See https://openid.net/specs/openid-connect-core-1_0.html#ThirdPartyInitiatedLogin
  const { iss, login_hint, target_link_uri, v_deeplink } = params;
  if (iss !== OIDC_ISSUER || !login_hint) {
    return;
  }

  const headers = getHeaders();
  const cookies = getCookies();

  const host = headers.get("host");

  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/login/vercel/callback`;

  const { redirectTo, state } = await createAuthorizationUrl({
    callbackUrl,
    login_hint,
    v_deeplink,
  });

  cookies.set("vercel-oidc-state", state, { httpOnly: true });
  return redirect(redirectTo);
}

export async function startAuthorization(formData: FormData) {
  console.log("startAuthorization:", Object.fromEntries(formData));
  const headers = getHeaders();
  const cookies = getCookies();

  const host = headers.get("host");

  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const callbackUrl = `${protocol}://${host}/login/vercel/callback`;
  const { redirectTo, state } = await createAuthorizationUrl({
    callbackUrl,
  });
  console.log("Redirecting to authorization URL:", {
    redirectTo,
    state,
  });
  cookies.set("vercel-oidc-state", state, { httpOnly: true });
  redirect(redirectTo);
}
