"use server";

import { getResource, updateResource } from "@/lib/partner";
import { dispatchEvent, updateSecrets } from "@/lib/vercel/api";
import { getSession } from "../../auth";

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
  });

  await dispatchEvent(session.installation_id, {
    type: "resource.updated",
    productId: resource.productId,
    resourceId: resource.id,
  });
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
