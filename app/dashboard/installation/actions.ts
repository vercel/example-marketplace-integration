"use server";

import { mockBillingData } from "@/data/mock-billing-data";
import {
  addInstallationBalanceInternal,
  setInstallationNotification,
} from "@/lib/partner";
import {
  getInstallationBalance,
  getResourceBalance,
  listResources,
} from "@/lib/partner";
import {
  dispatchEvent,
  sendBillingData,
  submitPrepaymentBalances,
} from "@/lib/vercel/marketplace-api";
import type { Balance, Notification } from "@/lib/vercel/schemas";
import { revalidatePath } from "next/cache";
import { getSession } from "../auth";

export async function addInstallationBalance(formData: FormData) {
  const session = await getSession();

  await addInstallationBalanceInternal(
    session.installation_id,
    Number(formData.get("currencyValueInCents") as string),
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/installation");
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
          getResourceBalance(installationId, resource.id),
        ),
      ].filter((x) => x !== null),
    )
  ).filter((x) => x !== null) as Balance[];

  console.log("Send balances: ", balances);

  await sendBillingData(installationId, billingData);
  await submitPrepaymentBalances(installationId, balances);
}

export async function setExampleNotificationAction(formData: FormData) {
  const session = await getSession();

  await setInstallationNotification(session.installation_id, {
    level: "error",
    title: "Installation is broken",
    message:
      "Your installation is in a broken state because of complicated technical reasons. Please reach out to help@acmecorp.com",
    href: "https://acmecorp.com/help",
  });
  await dispatchEvent(session.installation_id, {
    type: "installation.updated",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/installation");
}

export async function clearResourceNotificationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();

  await setInstallationNotification(session.installation_id, undefined);
  await dispatchEvent(session.installation_id, {
    type: "installation.updated",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/installation");
}

export async function updateNotificationAction(formData: FormData) {
  const session = await getSession();

  await setInstallationNotification(session.installation_id, {
    level: formData.get("level") as Notification["level"],
    title: formData.get("title") as string,
    message: formData.get("message") as string,
    href: formData.get("href") as string,
  });
  await dispatchEvent(session.installation_id, {
    type: "installation.updated",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/installation");
}
