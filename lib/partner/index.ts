import { nanoid } from "nanoid";
import {
  GetBillingPlansResponse,
  GetResourceResponse,
  InstallIntegrationRequest,
  ListResourcesResponse,
  ProvisionResourceRequest,
  ProvisionResourceResponse,
  Resource,
  UpdateResourceRequest,
  UpdateResourceResponse,
} from "@/lib/vercel/schemas";
import { kv } from "@vercel/kv";
import { compact } from "lodash";

export async function installIntegration(
  installationId: string,
  request: InstallIntegrationRequest
): Promise<void> {
  await kv.set(installationId, request);
}

export async function uninstallIntegration(installationId: string) {
  await kv.del(installationId);
}

export async function provisionResource(
  installationId: string,
  request: ProvisionResourceRequest
): Promise<ProvisionResourceResponse> {
  const resource = {
    id: nanoid(),
    status: "ready",
    name: request.name,
    billingPlan: request.billingPlan,
    metadata: request.metadata,
    productId: request.productId,
  } satisfies Resource;

  await kv.set(`${installationId}:resource:${resource.id}`, resource);
  await kv.lpush(`${installationId}:resources`, resource.id);

  return {
    ...resource,

    secrets: [
      {
        name: "TOP_SECRET",
        value: `birds aren't real (${new Date().toISOString()})`,
      },
    ],
  };
}

export async function updateResource(
  installationId: string,
  resourceId: string,
  request: UpdateResourceRequest
): Promise<UpdateResourceResponse> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  const nextResource = {
    ...resource,
    ...request,
    status: "ready" as const,
  };

  await kv.set(`${installationId}:resource:${resourceId}`, nextResource);

  return nextResource;
}

export async function deleteResource(
  installationId: string,
  resourceId: string
): Promise<void> {
  await kv.del(`${installationId}:resource:${resourceId}`);
}

export async function listResources(
  installationId: string
): Promise<ListResourcesResponse> {
  const resourceIds = await kv.lrange(`${installationId}:resources`, 0, -1);

  return {
    resources: compact(
      await Promise.all(
        resourceIds.map((resourceId) =>
          kv.get<Resource>(`${installationId}:resource:${resourceId}`)
        )
      )
    ),
  };
}

export async function getResource(
  installationId: string,
  resourceId: string
): Promise<GetResourceResponse | null> {
  const resource = await kv.get<ProvisionResourceResponse>(
    `${installationId}:resource:${resourceId}`
  );

  if (resource) {
    return resource;
  }

  return null;
}

export async function getBillingPlans(
  productId: string
): Promise<GetBillingPlansResponse> {
  throw new Error("Not implemented");
}

export async function getInstallation(
  installationId: string
): Promise<InstallIntegrationRequest> {
  const installation = await kv.get<InstallIntegrationRequest>(installationId);

  if (!installation) {
    throw new Error(`Installation '${installationId}' not found`);
  }

  return installation;
}
