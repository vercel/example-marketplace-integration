"use server";

import { clearResourceTokenPresentations } from "@/lib/partner/resource-tokens";
import { revalidatePath } from "next/cache";
import { getSession } from "../auth";

export async function clearPresentations(): Promise<void> {
  await getSession();
  await clearResourceTokenPresentations();
  revalidatePath("/dashboard/oidc-tokens");
}
