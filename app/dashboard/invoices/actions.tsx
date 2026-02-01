"use server";

import { refundInvoice, submitInvoice } from "@/lib/vercel/marketplace-api";
import { redirect } from "next/navigation";
import { getSession } from "../auth";

export async function submitInvoiceAction(formData: FormData): Promise<void> {
  const session = await getSession();

  const test = formData.get("test") === "on";
  const maxAmount = formData.get("maxAmount")
    ? Number(formData.get("maxAmount"))
    : undefined;

  let invoiceId: string;
  try {
    const { invoiceId: resultInvoiceId } = await submitInvoice(
      session.installation_id,
      { test, maxAmount, discountPercent: 0.2 },
    );
    invoiceId = resultInvoiceId;
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
  const refundAmount = formData.get("refundAmount") as string;
  const refundReason = formData.get("refundReason") as string;

  await refundInvoice(
    session.installation_id,
    invoiceId,
    refundAmount,
    refundReason,
  );
  redirect(`/dashboard/invoices?id=${encodeURIComponent(invoiceId)}`);
}
