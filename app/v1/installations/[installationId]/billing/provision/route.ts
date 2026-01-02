import { provisionPurchase } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { provisionPurchaseRequestSchema } from "@/lib/vercel/schemas";

/**
 * Provision a new purchase
 */
export const POST = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    provisionPurchaseRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  console.log("provisonPurchase body: ", requestBody.data);

  const response = await provisionPurchase(
    claims.installation_id,
    requestBody.data
  );

  return Response.json(response);
});
