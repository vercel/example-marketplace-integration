"use server";

import { requestTransferToMarketplace } from "@/lib/vercel/marketplace-api";
import { billingPlans } from "@/lib/partner";

export async function requestTransferToVercelAction(formData: FormData) {
  const installationId = formData.get("installationId") as string;
  const transferId = Math.random().toString(36).substring(2);
  const requester = "Vanessa";
  const billingPlan = billingPlans[0];
  const result = await requestTransferToMarketplace(
    installationId,
    transferId,
    requester,
    billingPlan
  );
  return result;
}
