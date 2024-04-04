import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { decodeAuthToken } from "@/lib/vercel/auth";

export async function GET(request: NextRequest) {
  const host = request.nextUrl.host;
  const searchParams = request.nextUrl.searchParams;

  const code = searchParams.get("code");
  const resourceId = searchParams.get("resourceId");

  if (!code) {
    return new Response("Missing code", {
      status: 400,
    });
  }

  const res = await fetch("https://vercel.com/api/v1/integrations/sso/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      client_id: env.INTEGRATION_CLIENT_ID,
      client_secret: env.INTEGRATION_CLIENT_SECRET,
      redirect_uri: `${host}/callback`,
    }),
  });

  if (!res.ok) {
    return new Response("Failed to fetch id token", {
      status: 500,
    });
  }
  const { id_token: idToken } = await res.json();

  if (!idToken || typeof idToken !== "string") {
    return new Response("Invalid id token", {
      status: 500,
    });
  }

  const claims = await decodeAuthToken(idToken);

  const result = {
    idToken,
    claims,
  };

  return Response.json(result);
}
