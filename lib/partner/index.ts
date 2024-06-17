import { nanoid } from "nanoid";
import {
  BillingPlan,
  GetBillingPlansResponse,
  GetResourceResponse,
  InstallIntegrationRequest,
  ListResourcesResponse,
  ProvisionResourceRequest,
  ProvisionResourceResponse,
  Resource,
  UpdateResourceRequest,
  UpdateResourceResponse,
  Notification,
  WebhookEvent,
} from "@/lib/vercel/schemas";
import { kv } from "@vercel/kv";
import { compact } from "lodash";

const billingPlans: BillingPlan[] = [
  {
    id: "default",
    name: "Hobby",
    description: "Use all you want up to 20G",
    type: "subscription",
    quote: [
      { amount: "20.00", line: "20G and 200K queries" },
      { amount: "1.00", line: "per extra 10G storage" },
      { amount: "2.00", line: "per extra 100K queries" },
    ],
    maxResources: 3,
    requiredPolicies: [
      { id: "1", name: "Terms of Service", url: "https://partner/toc" },
    ],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
  {
    id: "pro200",
    name: "Pro",
    type: "subscription",
    description: "10$ every Gb",
    quote: [
      { amount: "200.00", line: "20G and 200K queries" },
      { amount: "10.00", line: "per extra 10G storage" },
      { amount: "Unlimited", line: "Daily Command Limit" },
    ],
    maxResources: 3,
    requiredPolicies: [
      { id: "1", name: "Terms of Service", url: "https://partner/toc" },
    ],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
];

const billingPlanMap = new Map(billingPlans.map((plan) => [plan.id, plan]));

export async function installIntegration(
  installationId: string,
  request: InstallIntegrationRequest
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, request);
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.lpush("installations", installationId);
  await pipeline.exec();
}

export async function uninstallIntegration(installationId: string) {
  const pipeline = kv.pipeline();
  await pipeline.del(installationId);
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.exec();
}

export async function listInstallations(): Promise<string[]> {
  const installationIds = await kv.lrange("installations", 0, -1);
  return installationIds;
}

export async function provisionResource(
  installationId: string,
  request: ProvisionResourceRequest
): Promise<ProvisionResourceResponse> {
  const billingPlan = billingPlanMap.get(request.billingPlanId);
  if (!billingPlan) {
    throw new Error(`Unknown billing plan ${request.billingPlanId}`);
  }
  const resource = {
    id: nanoid(),
    status: "ready",
    name: request.name,
    billingPlan,
    metadata: request.metadata,
    productId: request.productId,
  } satisfies Resource;

  await kv.set(
    `${installationId}:resource:${resource.id}`,
    serializeResource(resource)
  );
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

  const { billingPlanId, ...updatedFields } = request;

  const nextResource = {
    ...resource,
    ...updatedFields,
    billingPlan: billingPlanId
      ? billingPlanMap.get(billingPlanId) ?? resource.billingPlan
      : resource.billingPlan,
  };

  await kv.set(
    `${installationId}:resource:${resourceId}`,
    serializeResource(nextResource)
  );

  return nextResource;
}

export async function updateResourceNotification(
  installationId: string,
  resourceId: string,
  notification?: Notification
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  await kv.set(
    `${installationId}:resource:${resourceId}`,
    serializeResource({
      ...resource,
      notification,
    })
  );
}

export async function clearResourceNotification(
  installationId: string,
  resourceId: string
): Promise<void> {
  await updateResourceNotification(installationId, resourceId);
}

export async function deleteResource(
  installationId: string,
  resourceId: string
): Promise<void> {
  const pipeline = kv.pipeline();
  pipeline.del(`${installationId}:resource:${resourceId}`);
  pipeline.lrem(`${installationId}:resources`, 0, resourceId);
  await pipeline.exec();
}

export async function listResources(
  installationId: string,
  targetResourceIds?: string[]
): Promise<ListResourcesResponse> {
  const resourceIds = targetResourceIds?.length
    ? targetResourceIds
    : await kv.lrange(`${installationId}:resources`, 0, -1);

  if (resourceIds.length === 0) {
    return { resources: [] };
  }

  const pipeline = kv.pipeline();

  for (const resourceId of resourceIds) {
    pipeline.get(`${installationId}:resource:${resourceId}`);
  }

  const resources = await pipeline.exec<SerializedResource[]>();

  return {
    resources: compact(resources).map(deserializeResource),
  };
}

export async function getResource(
  installationId: string,
  resourceId: string
): Promise<GetResourceResponse | null> {
  const resource = await kv.get<SerializedResource>(
    `${installationId}:resource:${resourceId}`
  );

  if (resource) {
    return deserializeResource(resource);
  }

  return null;
}

type SerializedResource = Omit<Resource, "billingPlan"> & {
  billingPlan: string;
};

function serializeResource(resource: Resource): SerializedResource {
  return { ...resource, billingPlan: resource.billingPlan.id };
}

function deserializeResource(serializedResource: SerializedResource): Resource {
  const billingPlan = billingPlanMap.get(serializedResource.billingPlan) ?? {
    id: serializedResource.billingPlan,
    type: "subscription",
    name: "Unknown",
    description: "Unknown",
  };
  return { ...serializedResource, billingPlan };
}

export async function getProductBillingPlans(
  _productId: string
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
}

export async function getResourceBillingPlans(
  _installationId: string,
  _resourceId: string
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
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

export async function storeWebhookEvent(event: WebhookEvent): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.lpush("webhook_events", event);
  await pipeline.ltrim("webhook_events", 0, 100);
  await pipeline.exec();
}

export async function getWebhookEvents(limit = 100): Promise<WebhookEvent[]> {
  return kv.lrange<WebhookEvent>("webhook_events", 0, limit);
}
