import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { exchangeCodeForToken } from "@/lib/vercel/marketplace-api";
import { createSession } from "../dashboard/auth";

export async function GET(request: NextRequest) {
  const host = getHost(request);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return new Response("Missing code", {
      status: 400,
    });
  }

  const token = await exchangeCodeForToken(code, state);

  createSession(token);

  const resourceId = request.nextUrl.searchParams.get("resource_id");
  const invoiceId = request.nextUrl.searchParams.get("invoice_id");

  if (invoiceId) {
    redirect(`/dashboard/invoices?id=${invoiceId}`);
    return;
  }

  if (request.nextUrl.searchParams.get("support")) {
    redirect(
      `/dashboard/support${resourceId ? "?resource_id=" + resourceId : ""}`
    );
    return;
  }

  if (resourceId) {
    redirect(`/dashboard/resources/${resourceId}`);
    return;
  }

  redirect("/dashboard");
}

function getHost(request: NextRequest): string {
  return request.headers.get("x-forwarded-host")
    ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get(
        "x-forwarded-host"
      )}`
    : request.nextUrl.host;
}
