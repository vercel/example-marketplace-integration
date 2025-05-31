import { getNewInstallationtBillingPlans } from "@/lib/partner";
import { withAuth } from "@/lib/vercel/auth";

export const GET = withAuth(async () => {
  const billingPlans = await getNewInstallationtBillingPlans();
  return Response.json(billingPlans);
});
