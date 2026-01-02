"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addResourceBalanceInternal,
  clearResourceNotification,
  cloneResource,
  getResource,
  importResourceToVercel,
  updateResource,
  updateResourceNotification,
} from "@/lib/partner";
import { dispatchEvent, updateSecrets } from "@/lib/vercel/marketplace-api";
import type { Notification, Resource } from "@/lib/vercel/schemas";
import { getSession } from "../../auth";

export const updateResourceAction = async (formData: FormData) => {
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
};

export const rotateCredentialsAction = async (formData: FormData) => {
  const session = await getSession();
  const resource = await getResource(
    session.installation_id,
    formData.get("resourceId") as string
  );

  if (!resource) {
    throw new Error(`Unknown resource '${formData.get("resourceId")}`);
  }

  const currentDate = new Date().toISOString();

  await updateSecrets(session.installation_id, resource.id, [
    {
      name: "TOP_SECRET",
      value: `birds aren't real (${currentDate})`,
      environmentOverrides:
        resource.productId === "with-env-override"
          ? {
              production: `birds ARE real (${currentDate})`,
              preview: `birds might be real (${currentDate})`,
            }
          : undefined,
    },
  ]);
};

export const clearResourceNotificationAction = async (formData: FormData) => {
  const session = await getSession();

  const resourceId = formData.get("resourceId") as string;
  const resource = await getResource(session.installation_id, resourceId);
  if (!resource) {
    throw new Error(`Unknown resource '${resourceId}'`);
  }

  await clearResourceNotification(session.installation_id, resource.id);
  await dispatchEvent(session.installation_id, {
    type: "resource.updated",
    resourceId: resource.id,
    productId: resource.productId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${resource.id}`);
};

export const updateResourceNotificationAction = async (
  formData: FormData
) => {
  const session = await getSession();

  const resourceId = formData.get("resourceId") as string;
  const resource = await getResource(session.installation_id, resourceId);
  if (!resource) {
    throw new Error(`Unknown resource '${resourceId}'`);
  }

  await updateResourceNotification(session.installation_id, resource.id, {
    level: formData.get("level") as Notification["level"],
    title: formData.get("title") as string,
    message: formData.get("message") as string,
    href: formData.get("href") as string,
  });
  await dispatchEvent(session.installation_id, {
    type: "resource.updated",
    resourceId: resource.id,
    productId: resource.productId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${resource.id}`);
};

export const setExampleNotificationAction = async (formData: FormData) => {
  const session = await getSession();

  const resourceId = formData.get("resourceId") as string;
  const resource = await getResource(session.installation_id, resourceId);
  if (!resource) {
    throw new Error(`Unknown resource '${resourceId}'`);
  }

  await updateResourceNotification(session.installation_id, resource.id, {
    level: "error",
    title: "Resource failed to provision",
    message:
      "Your resource failed to provision because of complicated technical reasons. Please reach out to help@acmecorp.com",
    href: "https://acmecorp.com/help",
  });
  await dispatchEvent(session.installation_id, {
    type: "resource.updated",
    resourceId: resource.id,
    productId: resource.productId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${resource.id}`);
};

export const cloneResourceAction = async (formData: FormData) => {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;
  const clonedResource = await cloneResource(
    session.installation_id,
    resourceId
  );
  revalidatePath("/dashboard");
  redirect(`/dashboard/resources/${clonedResource.id}`);
};

export const importResourceToVercelAction = async (formData: FormData) => {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;
  await importResourceToVercel(session.installation_id, resourceId);
};

export const addResourceBalance = async (formData: FormData) => {
  const session = await getSession();

  await addResourceBalanceInternal(
    session.installation_id,
    formData.get("resourceId") as string,
    Number(formData.get("currencyValueInCents") as string)
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${formData.get("resourceId")}`);
};
