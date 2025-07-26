import { cookies as getCookies } from "next/headers";
import { getTokens } from "../issuer";

export async function GET(req: Request) {
  const url = req.url;

  const params = Object.fromEntries(new URL(url).searchParams);
  const { v_deeplink } = params;

  const cookies = await getCookies();
  const expectedState = cookies.get("vercel-oidc-state")?.value || undefined;
  console.log("Callback:", { url, expectedState });

  const { id_token, claims } = (await getTokens(url, expectedState)) || {};

  if (id_token) {
    cookies.set("id-token", id_token);
  }

  // TODO: redirect to the /dashboard based on v_deeplink.
  return Response.json({ id_token, claims, v_deeplink });
}
