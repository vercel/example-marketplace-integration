"use server";

import {
  getBillingContext,
  getInvoiceBillingInstallation,
  recordInvoiceBillingInstallation,
} from "@/lib/partner";
import { refundInvoice, submitInvoice } from "@/lib/vercel/marketplace-api";
import { redirect } from "next/navigation";
import { getSession } from "../auth";

export async function submitInvoiceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const { billingInstallationId, billingPlanId } = await getBillingContext(
    session.installation_id,
  );

  const test = formData.get("test") === "on";
  const maxAmount = formData.get("maxAmount")
    ? Number(formData.get("maxAmount"))
    : undefined;

  let invoiceId: string;
  try {
    const { invoiceId: resultInvoiceId } = await submitInvoice(
      billingInstallationId,
      {
        test,
        maxAmount,
        discountPercent: 0.2,
        usageInstallationId: session.installation_id,
        billingPlanId,
      },
    );
    invoiceId = resultInvoiceId;
    try {
      await recordInvoiceBillingInstallation(
        session.installation_id,
        invoiceId,
        billingInstallationId,
      );
    } catch (error) {
      console.warn("Failed to record invoice billing installation", error);
    }
  } catch (e) {
    redirect(
      `/dashboard/invoices?submitError=${encodeURIComponent(
        e instanceof Error ? e.message : String(e),
      )}`,
    );
  }
  redirect(`/dashboard/invoices?id=${encodeURIComponent(invoiceId)}`);
}

export async function refundInvoiceAction(formData: FormData) {
  const session = await getSession();
  const invoiceId = formData.get("id") as string;
  const billingInstallationId = await getInvoiceBillingInstallation(
    session.installation_id,
    invoiceId,
  );
  const refundAmount = formData.get("refundAmount") as string;
  const refundReason = formData.get("refundReason") as string;

  await refundInvoice(
    billingInstallationId,
    invoiceId,
    refundAmount,
    refundReason,
  );
  redirect(`/dashboard/invoices?id=${encodeURIComponent(invoiceId)}`);
}
