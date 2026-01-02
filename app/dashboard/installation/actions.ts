"use server";

import type { Balances } from "@vercel/sdk/models/submitprepaymentbalancesop.js";
import { revalidatePath } from "next/cache";
import { mockBillingData } from "@/data/mock-billing-data";
import {
  addInstallationBalanceInternal,
  getInstallationBalance,
  getResourceBalance,
  listResources,
  setInstallationNotification,
} from "@/lib/partner";
import {
  dispatchEvent,
  sendBillingData,
  submitPrepaymentBalances,
} from "@/lib/vercel/marketplace-api";
import type { Notification } from "@/lib/vercel/schemas";
import { getSession } from "../auth";

export const addInstallationBalance = async (formData: FormData) => {
  const session = await getSession();

  await addInstallationBalanceInternal(
    session.installation_id,
    Number(formData.get("currencyValueInCents") as string)
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/installation");
};

export const sendBillingDataAction = async () => {
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
  ).filter((x) => x !== null) as Balances[];

  console.log("Send balances: ", balances);

  await sendBillingData(installationId, billingData);
  await submitPrepaymentBalances(installationId, balances);
};

export const setExampleNotificationAction = async (_formData: FormData) => {
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
};

export const clearResourceNotificationAction = async (_formData: FormData) => {
  const session = await getSession();

  await setInstallationNotification(session.installation_id, undefined);
  await dispatchEvent(session.installation_id, {
    type: "installation.updated",
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/installation");
};

export const updateNotificationAction = async (formData: FormData) => {
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
};
