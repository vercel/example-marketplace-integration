import { getBillingPlans } from "@/lib/partner";
import { authMiddleware } from "@/lib/vercel/auth";

interface Params {
  productId: string;
}

export const GET = authMiddleware(
  async (_request: Request, { params }: { params: Params }) => {
    const response = await getBillingPlans(params.productId);
    return Response.json(response);
  },
);
