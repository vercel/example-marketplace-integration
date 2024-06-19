import { getProductBillingPlans } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { resourceSchema } from "@/lib/vercel/schemas";

interface Params {
  productId: string;
}

export const GET = withAuth(
  async (_claims, _request, { params }: { params: Params }) => {
    const response = await getProductBillingPlans(params.productId);

    return Response.json(response);
  }
);

// Experimental and unstable API
export const POST = withAuth(
  async (_claims, request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      resourceSchema.pick({
        metadata: true,
      })
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    const response = await getProductBillingPlans(
      params.productId,
      requestBody.data.metadata
    );

    return Response.json(response);
  }
);
