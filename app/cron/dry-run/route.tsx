import type { Balances } from "@vercel/sdk/models/submitprepaymentbalancesop.js";
import { getSession } from "@/app/dashboard/auth";
import { mockBillingData } from "@/data/mock-billing-data";
import {
  getInstallationBalance,
  getResourceBalance,
  listResources,
} from "@/lib/partner";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const session = await getSession();
  const installationId = session.installation_id;
  const { resources } = await listResources(installationId);
  const billingData = await mockBillingData(installationId);
  const balances = (
    await Promise.all(
      [
        getInstallationBalance(installationId),
        ...resources.map((resource) =>
          getResourceBalance(installationId, resource.id)
        ),
      ].filter((x) => x !== null)
    )
  ).filter((x) => x !== null) as Balances[];
  return Response.json({ billingData, balances });
};
