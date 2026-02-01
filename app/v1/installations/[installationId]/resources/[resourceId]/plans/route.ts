import { getResourceBillingPlans } from "@/lib/partner";
import { withAuth } from "@/lib/vercel/auth";

interface Params {
  installationId: string;
  resourceId: string;
}

export const GET = withAuth(async (claims, _request, ...rest: unknown[]) => {
  const [{ params }] = rest as [{ params: Params }];
  const response = await getResourceBillingPlans(
    claims.installation_id,
    params.resourceId
  );

  return Response.json(response);
});
