import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { exchangeCodeForToken } from "@/lib/vercel/marketplace-api";
import { createSession } from "../dashboard/auth";

/**
 * Main OAuth callback
 * Exchanges auth code for token, creates session and redirects to dashboard
 */
export const GET = async (request: NextRequest) => {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return new Response("Missing code", { status: 400 });
  }

  const token = await exchangeCodeForToken(code, state);

  createSession(token);

  const resourceId = request.nextUrl.searchParams.get("resource_id");
  const projectId = request.nextUrl.searchParams.get("project_id");
  const invoiceId = request.nextUrl.searchParams.get("invoice_id");
  const checkId = request.nextUrl.searchParams.get("check_id");
  const support = request.nextUrl.searchParams.get("support");

  if (invoiceId) {
    return redirect(`/dashboard/invoices?id=${invoiceId}`);
  }

  if (support) {
    return redirect(
      `/dashboard/support${resourceId ? `?resource_id=${resourceId}` : ""}`
    );
  }

  if (!resourceId) {
    return redirect("/dashboard");
  }

  if (!projectId) {
    return redirect(`/dashboard/resources/${resourceId}`);
  }

  if (!checkId) {
    return redirect(`/dashboard/resources/${resourceId}/projects/${projectId}`);
  }

  return redirect(
    `/dashboard/resources/${resourceId}/projects/${projectId}?checkId=${encodeURIComponent(checkId)}`
  );
};
