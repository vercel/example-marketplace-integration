import type { Balances } from "@vercel/sdk/models/submitprepaymentbalancesop.js";
import { getSession } from "@/app/dashboard/auth";
import { mockBillingData } from "@/data/mock-billing-data";
import {
  getInstallationBalance,
  getResourceBalance,
  listResources,
} from "@/lib/partner";

export const dynamic = "force-dynamic";

/**
 * Preview billing data without submitting (for testing).
 * This is for individual users to preview what billing data
 * would be submitted for their installation from the dashboard.
 */
export const GET = async () => {
  const session = await getSession();
  const installationId = session.installation_id;
  const { resources } = await listResources(installationId);
  const billingData = await mockBillingData(installationId);

  const balances: Balances[] = [];

  const installationBalance = await getInstallationBalance(installationId);
  if (installationBalance) {
    balances.push(installationBalance);
  }

  const resourceBalances = await Promise.all(
    resources.map((resource) => getResourceBalance(installationId, resource.id))
  );

  for (const resourceBalance of resourceBalances) {
    if (resourceBalance) {
      balances.push(resourceBalance);
    }
  }

  return Response.json({ billingData, balances });
};
