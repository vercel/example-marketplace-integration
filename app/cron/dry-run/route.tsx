import { mockBillingData } from "@/data/mock-billing-data";
import {
  getInstallationBalance,
  getResourceBalance,
  listResources,
} from "@/lib/partner";
import { withAuth } from "@/lib/vercel/auth";
import { Balance } from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (claims) => {
  const installationId = claims.installation_id;
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
  ).filter((x) => x !== null) as Balance[];
  return Response.json({ billingData, balances });
});
