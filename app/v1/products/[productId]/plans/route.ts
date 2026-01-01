import { getProductBillingPlans } from "@/lib/partner";
import { withAuth } from "@/lib/vercel/auth";

interface Params {
  productId: string;
}

export const GET = withAuth(
  async (claims, request, { params }: { params: Params }) => {
    const response = await getProductBillingPlans(
      params.productId,
      claims.installation_id
    );

    const url = new URL(request.url);
    const metadataQuery = url.searchParams.get("metadata");
    if (metadataQuery) {
      const metadata: Record<string, string> = JSON.parse(metadataQuery);
      if (metadata.primaryRegion === "sfo1") {
        response.plans = response.plans.map((plan) => ({
          ...plan,
          name: `${plan.name} (us-west-1)`,
          description: plan.name === "Pro" ? "$9 every Gb" : plan.description,
        }));
      }
    }
    return Response.json(response);
  }
);
