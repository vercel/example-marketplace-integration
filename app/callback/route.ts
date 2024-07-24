import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { exchangeCodeForToken } from "@/lib/vercel/marketplace-api";
import { createSession } from "../dashboard/auth";

export async function GET(request: NextRequest) {
  const host = getHost(request);
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return new Response("Missing code", {
      status: 400,
    });
  }

  const token = await exchangeCodeForToken(code);

  createSession(token);

  const resourceId = request.nextUrl.searchParams.get("resource_id");

  if (resourceId) {
    redirect(`/dashboard/resources/${resourceId}`);
  } else {
    redirect("/dashboard");
  }
}

function getHost(request: NextRequest): string {
  return request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get(
        "x-forwarded-host"
      )}`
    : request.nextUrl.host;
}
