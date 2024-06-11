"use server";

import { redirect } from "next/navigation";
import { getSession } from "../auth";
import { submitInvoice } from "@/lib/vercel/api";

export async function submitInvoiceAction(formData: FormData): Promise<void> {
  const session = await getSession();

  const test = formData.get("test") === "on";

  const { invoiceId } = await submitInvoice(session.installation_id, test);

  redirect(`/dashboard/invoices?id=${encodeURIComponent(invoiceId)}`);
}
