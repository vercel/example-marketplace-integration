import { installIntegration } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { TransferInstallationToMarketplaceRequestSchema } from "@/lib/vercel/schemas";

export const POST = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    TransferInstallationToMarketplaceRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  await installIntegration(claims.installation_id, {
    type: "marketplace",
    ...requestBody.data,
  });

  return Response.json({});
});
