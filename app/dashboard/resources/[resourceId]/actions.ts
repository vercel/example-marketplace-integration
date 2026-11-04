"use server";

import {
  addResourceBalanceInternal,
  clearResourceNotification,
  cloneResource,
  getResource,
  getResourceCredentials,
  importResourceToVercel,
  setCredentialTypesChangeResponse,
  setResourceCredentialTypes,
  setResourceCustomClaims,
  updateResource,
  updateResourceNotification,
} from "@/lib/partner";
import {
  acceptsCredentialType,
  credentialTypesChangeResponseSchema,
} from "@/lib/partner/credential-types";
import {
  ParentRelationUnavailableError,
  recordParentRelationFailure,
} from "@/lib/partner/parent-relations";
import { exampleResourceCustomClaims } from "@/lib/partner/resource-claims";
import { dispatchEvent, updateSecrets } from "@/lib/vercel/marketplace-api";
import {
  type Notification,
  type Resource,
  resourceCredentialTypesSchema,
  resourceCustomClaimsSchema,
} from "@/lib/vercel/schemas";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "../../auth";

export async function updateResourceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const resource = await getResource(
    session.installation_id,
    formData.get("resourceId") as string,
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
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  const resource = await getResource(
    session.installation_id,
    formData.get("resourceId") as string,
  );

  if (!resource) {
    throw new Error(`Unknown resource '${formData.get("resourceId")}`);
  }

  const credentials = await getResourceCredentials(
    session.installation_id,
    resource.id,
  );
  if (!acceptsCredentialType(credentials?.credentialTypes, "static")) {
    throw new Error(`Resource '${resource.id}' has no long-lived secrets`);
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
}

export async function clearResourceNotificationAction(
  formData: FormData,
): Promise<void> {
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
}

export async function updateResourceNotificationAction(formData: FormData) {
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
}

export async function setExampleNotificationAction(formData: FormData) {
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
}

export async function cloneResourceAction(formData: FormData) {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;
  let clonedResource: Awaited<ReturnType<typeof cloneResource>>;
  try {
    clonedResource = await cloneResource(session.installation_id, resourceId);
  } catch (error) {
    if (error instanceof ParentRelationUnavailableError) {
      try {
        await recordParentRelationFailure(error.installationId, error.reason);
      } catch (recordError) {
        console.warn("Failed to record parent relation failure", recordError);
      }
      throw new Error(
        `Cannot clone this resource: ${error.message.toLowerCase()}.`,
      );
    }
    throw error;
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/resources/${clonedResource.id}`);
}

export async function importResourceToVercelAction(formData: FormData) {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;
  await importResourceToVercel(session.installation_id, resourceId);
}

export async function addResourceBalance(formData: FormData) {
  const session = await getSession();

  await addResourceBalanceInternal(
    session.installation_id,
    formData.get("resourceId") as string,
    Number(formData.get("currencyValueInCents") as string),
  );

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/resources/${formData.get("resourceId")}`);
}

export async function updateResourceCustomClaimsAction(formData: FormData) {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;
  const customClaims = resourceCustomClaimsSchema.parse(
    JSON.parse(formData.get("customClaims") as string),
  );

  await setResourceCustomClaims(
    session.installation_id,
    resourceId,
    customClaims,
  );

  revalidatePath(`/dashboard/resources/${resourceId}`);
}

export async function resetResourceCustomClaimsAction(formData: FormData) {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;
  const resource = await getResource(session.installation_id, resourceId);
  if (!resource) {
    throw new Error(`Unknown resource '${resourceId}'`);
  }

  await setResourceCustomClaims(
    session.installation_id,
    resource.id,
    exampleResourceCustomClaims(resource),
  );

  revalidatePath(`/dashboard/resources/${resource.id}`);
}

export async function sendResourceCredentialTypesAction(formData: FormData) {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;

  await setResourceCredentialTypes(
    session.installation_id,
    resourceId,
    resourceCredentialTypesSchema.parse(formData.getAll("credentialTypes")),
  );

  revalidatePath(`/dashboard/resources/${resourceId}`);
}

export async function setCredentialTypesChangeResponseAction(
  formData: FormData,
) {
  const session = await getSession();
  const resourceId = formData.get("resourceId") as string;

  await setCredentialTypesChangeResponse(
    session.installation_id,
    resourceId,
    credentialTypesChangeResponseSchema.parse(formData.get("response")),
  );

  revalidatePath(`/dashboard/resources/${resourceId}`);
}
