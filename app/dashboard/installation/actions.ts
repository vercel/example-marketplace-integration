"use server";

import { addInstallationBalanceInternal } from "@/lib/partner";
import { getSession } from "../auth";
import { revalidatePath } from "next/cache";

export async function addInstallationBalance(formData: FormData) {
  const session = await getSession();

  await addInstallationBalanceInternal(
    session.installation_id,
    Number(formData.get("currencyValueInCents") as string)
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/installation`);
}
