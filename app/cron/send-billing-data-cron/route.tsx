import { mockBillingData } from "@/data/mock-billing-data";
import { cronJob } from "@/lib/cron";
import { listInstallations } from "@/lib/partner";
import { sendBillingData } from "@/lib/vercel/api";

export const dynamic = "force-dynamic";

export const GET = cronJob(async (request: Request) => {
  const dryRun = new URL(request.url).searchParams.get("dryrun") === "1";
  const installationIds = await listInstallations();
  const promises = installationIds.map(async (installationId) => {
    const data = await mockBillingData(installationId);
    console.log("Sending billing data: ", installationId, data);
    let error: string | undefined;
    if (!dryRun) {
      try {
        await sendBillingData(installationId, data);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }
    return { installationId, data, error };
  });
  const results = await Promise.all(promises);
  return Response.json(results);
});
