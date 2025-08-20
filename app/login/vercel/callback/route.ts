import { cookies as getCookies } from "next/headers";
import { getTokens } from "../issuer";
import { createSession } from "@/app/dashboard/auth";
import { redirect } from "next/navigation";

export async function GET(req: Request) {
  const url = req.url;

  const params = Object.fromEntries(new URL(url).searchParams);
  const { v_deeplink } = params;

  const cookies = await getCookies();
  const expectedState = cookies.get("vercel-oidc-state")?.value || undefined;
  console.log("Callback:", { url, expectedState });

  const { id_token, claims } = (await getTokens(url, expectedState)) || {};
  console.log("OIDC Callback:", { id_token, claims, v_deeplink });

  if (id_token) {
    createSession(id_token);
  }

  const deepLinkParams = new URLSearchParams(v_deeplink || "");

  const resourceId = deepLinkParams.get("resource_id");
  const projectId = deepLinkParams.get("project_id");
  const invoiceId = deepLinkParams.get("invoice_id");
  const checkId = deepLinkParams.get("check_id");

  if (invoiceId) {
    return redirect(`/dashboard/invoices?id=${invoiceId}`);
  }

  if (deepLinkParams.get("support")) {
    return redirect(
      `/dashboard/support${resourceId ? "?resource_id=" + resourceId : ""}`
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
}
