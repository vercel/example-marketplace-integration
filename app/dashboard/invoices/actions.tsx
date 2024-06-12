"use server";

import { redirect } from "next/navigation";
import { getSession } from "../auth";
import { submitInvoice } from "@/lib/vercel/api";

export async function submitInvoiceAction(formData: FormData): Promise<void> {
  const session = await getSession();

  const test = formData.get("test") === "on";

  let invoiceId: string;
  try {
    const { invoiceId: resultInvoiceId } = await submitInvoice(
      session.installation_id,
      test
    );
    invoiceId = resultInvoiceId;
  } catch (e) {
    redirect(
      `/dashboard/invoices?submitError=${encodeURIComponent(
        e instanceof Error ? e.message : String(e)
      )}`
    );
  }
  redirect(`/dashboard/invoices?id=${encodeURIComponent(invoiceId)}`);
}
