"use server";

import { cookies as getCookies } from "next/headers";
import { validateImplicitAuthorization } from "../issuer";

export async function validateImplicitAuthorizationAction(
  oidcParams: Record<string, string>
) {
  const { id_token, state } = oidcParams;

  const cookies = await getCookies();
  const expectedState = cookies.get("vercel-oidc-state")?.value || undefined;

  const claims = await validateImplicitAuthorization({
    id_token,
    state,
    expectedState,
  });

  return { claims };
}
