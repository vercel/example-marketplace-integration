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
  UnknownWebhookEvent,
} from "@/lib/vercel/schemas";
import { kv } from "@vercel/kv";
import { compact } from "lodash";
import { z } from "zod";

const billingPlans: BillingPlan[] = [
  {
    id: "default",
    name: "Hobby",
    cost: "Free",
    description: "Use all you want up to 20G",
    type: "subscription",
    paymentMethodRequired: false,
    details: [
      { label: "Max storage size", value: "20G" },
      { label: "Max queries per day", value: "100K" },
    ],
    highlightedDetails: [
      { label: "High availability", value: "Single zone" },
      { label: "Dataset size", value: "100Mb" },
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
    cost: "$10 every Gb",
    type: "subscription",
    description: "$10 every Gb",
    paymentMethodRequired: true,
    preauthorizationAmount: 5,
    highlightedDetails: [
      { label: "High availability", value: "Multi zone" },
      { label: "Dataset size", value: "500Mb" },
    ],
    details: [
      { label: "20G storage and 200K queries", value: "$25.00" },
      { label: "Extra storage", value: "$10.00 per 10G" },
      { label: "Unlimited daily Command Limit" },
    ],
    requiredPolicies: [
      { id: "1", name: "Terms of Service", url: "https://partner/toc" },
    ],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
];

const billingPlanMap = new Map(billingPlans.map((plan) => [plan.id, plan]));

export async function installIntegration(
  installationId: string,
  request: InstallIntegrationRequest & { type: "marketplace" | "external" }
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, request);
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.lpush("installations", installationId);
  await pipeline.exec();
}

export async function updateInstallation(
  installationId: string,
  billingPlanId: string
): Promise<void> {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, { ...installation, billingPlanId });
  await pipeline.exec();
}

export async function uninstallInstallation(
  installationId: string
): Promise<{ finalized: boolean } | undefined> {
  const installation = await getInstallation(installationId);
  if (!installation || installation.deletedAt) {
    return undefined;
  }
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, {
    ...installation,
    deletedAt: Date.now(),
  });
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.exec();

  // Installation is finalized immediately if it's on a free plan.
  const billingPlan = billingPlanMap.get(installation.billingPlanId);
  return { finalized: billingPlan?.paymentMethodRequired === false };
}

export async function listInstallations(): Promise<string[]> {
  const installationIds = await kv.lrange("installations", 0, -1);
  return installationIds;
}

export async function provisionResource(
  installationId: string,
  request: ProvisionResourceRequest,
  id: string = nanoid()
): Promise<ProvisionResourceResponse> {
  const billingPlan = billingPlanMap.get(request.billingPlanId);
  if (!billingPlan) {
    throw new Error(`Unknown billing plan ${request.billingPlanId}`);
  }
  const resource = {
    id,
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
  await updateInstallation(installationId, request.billingPlanId);

  return {
    ...resource,

    secrets: [
      {
        name: "TOP_SECRET",
        value: `birds aren't real (${new Date().toISOString()})`,
        prefix: "SUPER",
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
    paymentMethodRequired: false,
  };
  return { ...serializedResource, billingPlan };
}

export async function getAllBillingPlans(
  _installationId: string,
  _experimental_metadata?: Record<string, unknown>
): Promise<GetBillingPlansResponse> {
  return {
    plans: billingPlans,
  };
}

export async function getInstallationtBillingPlans(
  installationId: string,
  _experimental_metadata?: Record<string, unknown>
): Promise<GetBillingPlansResponse> {
  const resources = await listResources(installationId);
  return {
    plans:
      resources.resources.length > 2
        ? billingPlans.filter((p) => p.paymentMethodRequired)
        : billingPlans,
  };
}

export async function getProductBillingPlans(
  _productId: string,
  installationId: string,
  _experimental_metadata?: Record<string, unknown>
): Promise<GetBillingPlansResponse> {
  const resources = await listResources(installationId);
  return {
    plans:
      resources.resources.length > 2
        ? billingPlans.filter((p) => p.paymentMethodRequired)
        : billingPlans,
  };
}

export async function getResourceBillingPlans(
  _installationId: string,
  _resourceId: string
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
}

export async function getInstallation(installationId: string): Promise<
  InstallIntegrationRequest & {
    type: "marketplace" | "external";
    billingPlanId: string;
    deletedAt?: number;
  }
> {
  const installation = await kv.get<
    InstallIntegrationRequest & {
      type: "marketplace" | "external";
      billingPlanId: string;
      deletedAt?: number;
    }
  >(installationId);

  if (!installation) {
    throw new Error(`Installation '${installationId}' not found`);
  }

  return installation;
}

export async function storeWebhookEvent(
  event: WebhookEvent | UnknownWebhookEvent
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.lpush("webhook_events", event);
  await pipeline.ltrim("webhook_events", 0, 100);
  await pipeline.exec();
}

export async function getWebhookEvents(limit = 100): Promise<WebhookEvent[]> {
  return (await kv.lrange<WebhookEvent>("webhook_events", 0, limit)).sort(
    (a, b) => b.createdAt - a.createdAt
  );
}
