import { getProductBillingPlans } from "@/lib/partner";
import { withAuth } from "@/lib/vercel/auth";

interface Params {
  productId: string;
}

export const GET = withAuth(
  async (_claims, _request, { params }: { params: Params }) => {
    const response = await getProductBillingPlans(params.productId);

    return Response.json(response);
  }
);
