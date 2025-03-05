"use server";

import { addInstallationBalanceInternal } from "@/lib/partner";
import { getSession } from "../auth";
import { revalidatePath } from "next/cache";
import { mockBillingData } from "@/data/mock-billing-data";
import {
  getInstallationBalance,
  getResourceBalance,
  listResources,
} from "@/lib/partner";
import { Balance } from "@/lib/vercel/schemas";
import {
  sendBillingData,
  submitPrepaymentBalances,
} from "@/lib/vercel/marketplace-api";

export async function addInstallationBalance(formData: FormData) {
  const session = await getSession();

  await addInstallationBalanceInternal(
    session.installation_id,
    Number(formData.get("currencyValueInCents") as string)
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/installation`);
}

export async function sendBillingDataAction() {
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
  ).filter((x) => x !== null) as Balance[];

  console.log("Send balances: ", balances);

  await sendBillingData(installationId, billingData);
  await submitPrepaymentBalances(installationId, balances);
}
