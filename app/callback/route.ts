import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { exchangeCodeForToken } from "@/lib/vercel/marketplace-api";
import { createSession } from "../dashboard/auth";

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

  if (invoiceId) {
    return redirect(`/dashboard/invoices?id=${invoiceId}`);
  }

  if (request.nextUrl.searchParams.get("support")) {
    return redirect(
      `/dashboard/support${resourceId ? `?resource_id=${resourceId}` : ""}`
    );
  }

  if (resourceId) {
    if (projectId) {
      if (checkId) {
        return redirect(
          `/dashboard/resources/${resourceId}/projects/${projectId}?checkId=${encodeURIComponent(checkId)}`
        );
      }

      return redirect(
        `/dashboard/resources/${resourceId}/projects/${projectId}`
      );
    }

    return redirect(`/dashboard/resources/${resourceId}`);
  }

  redirect("/dashboard");
};
