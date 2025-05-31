import { installIntegration } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { transferInstallationFromMarketplaceRequestSchema } from "@/lib/vercel/schemas";

export const POST = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    transferInstallationFromMarketplaceRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  await installIntegration(claims.installation_id, {
    type: "external",
    scopes: requestBody.data.scopes,
    credentials: requestBody.data.credentials,
    acceptedPolicies: {},
  });

  return Response.json({});
});
