"use server";

import { requestTransferToMarketplace } from "@/lib/vercel/marketplace-api";
import { billingPlans } from "@/lib/partner";

export async function requestTransferToVercelAction(formData: FormData) {
  const installationId = formData.get("installationId") as string;
  const transferId = Math.random().toString(36).substring(2);
  const requester = "Vanessa";
  const billingPlan = billingPlans.find((plan) => plan.paymentMethodRequired);
  if (!billingPlan) {
    throw new Error("No billing plan found.");
  }
  const result = await requestTransferToMarketplace(
    installationId,
    transferId,
    requester,
    billingPlan
  );
  return result;
}
