"use server";

import {
  clearResourceNotification,
  getResource,
  updateResource,
  updateResourceNotification,
} from "@/lib/partner";
import { Notification, Resource } from "@/lib/vercel/schemas";
import { dispatchEvent, updateSecrets } from "@/lib/vercel/marketplace-api";
import { getSession } from "../../auth";
import { revalidatePath } from "next/cache";

export async function updateResourceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const resource = await getResource(
    session.installation_id,
    formData.get("resourceId") as string
  );

  if (!resource) {
    throw new Error(`Unknown resource '${formData.get("resourceId")}`);
  }

  await updateResource(session.installation_id, resource.id, {
    name: formData.get("name") as string,
    status: formData.get("status") as Resource["status"],
  });

  await dispatchEvent(session.installation_id, {
    type: "resource.updated",
    productId: resource.productId,
    resourceId: resource.id,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${resource.id}`);
}

export async function rotateCredentialsAction(
  formData: FormData
): Promise<void> {
  const session = await getSession();
  const resource = await getResource(
    session.installation_id,
    formData.get("resourceId") as string
  );

  if (!resource) {
    throw new Error(`Unknown resource '${formData.get("resourceId")}`);
  }

  await updateSecrets(session.installation_id, resource.id, [
    {
      name: "TOP_SECRET",
      value: `birds aren't real (${new Date().toISOString()})`,
    },
  ]);
}

export async function clearResourceNotificationAction(
  formData: FormData
): Promise<void> {
  const session = await getSession();

  await clearResourceNotification(
    session.installation_id,
    formData.get("resourceId") as string
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${formData.get("resourceId")}`);
}

export async function updateResourceNotificationAction(formData: FormData) {
  const session = await getSession();

  await updateResourceNotification(
    session.installation_id,
    formData.get("resourceId") as string,
    {
      level: formData.get("level") as Notification["level"],
      title: formData.get("title") as string,
      message: formData.get("message") as string,
      href: formData.get("href") as string,
    }
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${formData.get("resourceId")}`);
}

export async function setExampleNotificationAction(formData: FormData) {
  const session = await getSession();

  await updateResourceNotification(
    session.installation_id,
    formData.get("resourceId") as string,
    {
      level: "error",
      title: "Resource failed to provision",
      message:
        "Your resource failed to provision because of complicated technical reasons. Please reach out to help@acmecorp.com",
      href: "https://acmecorp.com/help",
    }
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${formData.get("resourceId")}`);
}
