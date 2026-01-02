import type { Balances } from "@vercel/sdk/models/submitprepaymentbalancesop.js";
import { mockBillingData } from "@/data/mock-billing-data";
import { cronJob } from "@/lib/cron";
import {
  getInstallationBalance,
  getResourceBalance,
  listInstallations,
  listResources,
} from "@/lib/partner";
import {
  sendBillingData,
  submitPrepaymentBalances,
} from "@/lib/vercel/marketplace-api";

export const dynamic = "force-dynamic";

export const GET = cronJob(async (request: Request) => {
  const dryRun = new URL(request.url).searchParams.get("dryrun") === "1";
  const installationIds = await listInstallations();

  const promises = installationIds.map(async (installationId) => {
    const data = await mockBillingData(installationId);
    const { resources } = await listResources(installationId);
    const balances: Balances[] = [];
    const installationBalance = await getInstallationBalance(installationId);

    if (installationBalance) {
      balances.push(installationBalance);
    }

    const resourceBalances = await Promise.all(
      resources.map((resource) =>
        getResourceBalance(installationId, resource.id)
      )
    );

    for (const resourceBalance of resourceBalances) {
      if (resourceBalance) {
        balances.push(resourceBalance);
      }
    }

    console.log("Sending billing data: ", installationId, data);
    console.log("Sending balances: ", installationId, balances);
    let error: string | undefined;

    if (!dryRun) {
      try {
        await sendBillingData(installationId, data);
        await submitPrepaymentBalances(installationId, balances);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    return { installationId, data, error };
  });

  const results = await Promise.all(promises);

  return Response.json(results);
});
