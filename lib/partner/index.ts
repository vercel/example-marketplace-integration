import { nanoid } from "nanoid";
import type {
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
  ProvisionPurchaseRequest,
  ProvisionPurchaseResponse,
  Balance,
  Claim as TransferRequest,
  ResourceStatusType,
} from "@/lib/vercel/schemas";
import { compact } from "lodash";
import { kv } from '../redis';
import {
  getInvoice,
  importResource as importResourceToVercelApi,
} from "../vercel/marketplace-api";

const billingPlans: BillingPlan[] = [
  {
    id: "default",
    scope: "resource",
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
    scope: "resource",
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
  {
    id: "prepay10",
    scope: "resource",
    name: "Prepay 10",
    cost: "$10 for 1,000 tokens",
    type: "prepayment",
    description: "$10 for 1,000 tokens",
    paymentMethodRequired: true,
    minimumAmount: "10.00",
    highlightedDetails: [{ label: "Token types", value: "input/output" }],
    details: [{ label: "Token types", value: "input/output" }],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
];

const billingPlanMap = new Map(billingPlans.map((plan) => [plan.id, plan]));

export async function installIntegration(
  installationId: string,
  request: InstallIntegrationRequest & { type: "marketplace" | "external" },
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, request);
  await pipeline.lrem("installations", 0, installationId);
  await pipeline.lpush("installations", installationId);
  await pipeline.exec();
}

export async function updateInstallation(
  installationId: string,
  billingPlanId: string,
): Promise<void> {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, { ...installation, billingPlanId });
  await pipeline.exec();
}

export async function uninstallInstallation(
  installationId: string,
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
  opts?: { status?: ResourceStatusType },
): Promise<ProvisionResourceResponse> {
  const billingPlan = billingPlanMap.get(request.billingPlanId);
  if (!billingPlan) {
    throw new Error(`Unknown billing plan ${request.billingPlanId}`);
  }
  const resource = {
    id: nanoid(),
    status: opts?.status ?? "ready",
    name: request.name,
    billingPlan,
    metadata: request.metadata,
    productId: request.productId,
  } satisfies Resource;

  await kv.set(
    `${installationId}:resource:${resource.id}`,
    serializeResource(resource),
  );
  await kv.lpush(`${installationId}:resources`, resource.id);
  await updateInstallation(installationId, request.billingPlanId);

  const currentDate = new Date().toISOString();

  return {
    ...resource,

    secrets: [
      {
        name: "TOP_SECRET",
        value: `birds aren't real (${currentDate})`,
        environmentOverrides:
          resource.productId === "with-env-override"
            ? {
                production: `birds ARE real (${currentDate})`,
                preview: `birds ARE real (${currentDate})`,
              }
            : undefined,
      },
    ],
  };
}

export async function updateResource(
  installationId: string,
  resourceId: string,
  request: UpdateResourceRequest,
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
      ? (billingPlanMap.get(billingPlanId) ?? resource.billingPlan)
      : resource.billingPlan,
  };

  await kv.set(
    `${installationId}:resource:${resourceId}`,
    serializeResource(nextResource),
  );

  return nextResource;
}

export async function transferResource(
  installationId: string,
  resourceId: string,
  targetInstallationId: string,
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  await kv.set(
    `${targetInstallationId}:resource:${resourceId}`,
    serializeResource(resource),
  );
  await kv.del(`${installationId}:resource:${resourceId}`);
}

export async function updateResourceNotification(
  installationId: string,
  resourceId: string,
  notification?: Notification,
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
    }),
  );
}

export async function clearResourceNotification(
  installationId: string,
  resourceId: string,
): Promise<void> {
  await updateResourceNotification(installationId, resourceId);
}

export async function deleteResource(
  installationId: string,
  resourceId: string,
): Promise<void> {
  const pipeline = kv.pipeline();
  pipeline.del(`${installationId}:resource:${resourceId}`);
  pipeline.lrem(`${installationId}:resources`, 0, resourceId);
  await pipeline.exec();
}

export async function listResources(
  installationId: string,
  targetResourceIds?: string[],
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
  resourceId: string,
): Promise<GetResourceResponse | null> {
  const resource = await kv.get<SerializedResource>(
    `${installationId}:resource:${resourceId}`,
  );

  if (resource) {
    return deserializeResource(resource);
  }

  return null;
}

export async function cloneResource(
  installationId: string,
  resourceId: string,
) {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  const newName = `${resource.name}-clone`;

  const clonedResource = await provisionResource(installationId, {
    productId: resource.productId,
    name: newName,
    metadata: resource.metadata,
    billingPlanId: resource.billingPlan?.id || "",
  });
  return clonedResource;
}

export async function importResourceToVercel(
  installationId: string,
  resourceId: string,
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  const response = await importResourceToVercelApi(
    installationId,
    resource.id,
    {
      name: resource.name,
      productId: resource.productId,
      status: resource.status,
      metadata: resource.metadata,
      billingPlan: resource.billingPlan,
      notification: resource.notification,
      secrets: [
        {
          name: "TOP_SECRET",
          value: `birds aren't real (${new Date().toISOString()})`,
        },
        {
          name: "TOP_SECRET_CLONED",
          value: `birds aren't real (${new Date().toISOString()})`,
        },
      ],
    },
  );
}

export async function provisionPurchase(
  installationId: string,
  request: ProvisionPurchaseRequest,
): Promise<ProvisionPurchaseResponse> {
  const invoice = await getInvoice(installationId, request.invoiceId);
  if (invoice.state !== "paid") {
    throw new Error(`Invoice ${request.invoiceId} is not paid`);
  }

  const balances: Record<string, Balance> = {};

  for (const item of invoice.items ?? []) {
    const amountInCents = Math.floor(Number.parseFloat(item.total) * 100);
    if (item.resourceId) {
      const balance = await addResourceBalanceInternal(
        installationId,
        item.resourceId,
        amountInCents,
      );
      balances[item.resourceId] = balance;
    } else {
      const balance = await addInstallationBalanceInternal(
        installationId,
        amountInCents,
      );
      balances[""] = balance;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    balances: Object.values(balances),
  };
}

export async function addInstallationBalanceInternal(
  installationId: string,
  currencyValueInCents: number,
): Promise<Balance> {
  const result = await kv.incrby(
    `${installationId}:balance`,
    currencyValueInCents,
  );
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
  };
}

export async function getInstallationBalance(
  installationId: string,
): Promise<Balance | null> {
  const result = await kv.get<number>(`${installationId}:balance`);
  if (result === null) {
    return null;
  }
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
  };
}

export async function addResourceBalanceInternal(
  installationId: string,
  resourceId: string,
  currencyValueInCents: number,
): Promise<Balance> {
  const result = await kv.incrby(
    `${installationId}:${resourceId}:balance`,
    currencyValueInCents,
  );
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
    resourceId,
  };
}

export async function getResourceBalance(
  installationId: string,
  resourceId: string,
): Promise<Balance | null> {
  const result = await kv.get<number>(
    `${installationId}:${resourceId}:balance`,
  );
  if (result === null) {
    return null;
  }
  return {
    currencyValueInCents: result,
    credit: String(result * 1_000),
    nameLabel: "Tokens",
    resourceId,
  };
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
    scope: "resource",
    type: "subscription",
    name: "Unknown",
    description: "Unknown",
    paymentMethodRequired: false,
  };
  return { ...serializedResource, billingPlan };
}

export async function getAllBillingPlans(
  _installationId: string,
  _experimental_metadata?: Record<string, unknown>,
): Promise<GetBillingPlansResponse> {
  return {
    plans: billingPlans,
  };
}

export async function getInstallationtBillingPlans(
  installationId: string,
  _experimental_metadata?: Record<string, unknown>,
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
  _experimental_metadata?: Record<string, unknown>,
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
  _resourceId: string,
): Promise<GetBillingPlansResponse> {
  return { plans: billingPlans };
}

export async function getInstallation(installationId: string): Promise<
  InstallIntegrationRequest & {
    type: "marketplace" | "external";
    billingPlanId: string;
    deletedAt?: number;
    notification?: Notification;
  }
> {
  const installation = await kv.get<
    InstallIntegrationRequest & {
      type: "marketplace" | "external";
      billingPlanId: string;
      deletedAt?: number;
      notification?: Notification;
    }
  >(installationId);

  if (!installation) {
    throw new Error(`Installation '${installationId}' not found`);
  }

  return installation;
}

export async function setInstallationNotification(
  installationId: string,
  notification: Notification | undefined | null,
): Promise<void> {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();
  await pipeline.set(installationId, {
    ...installation,
    notification: notification ?? undefined,
  });
  await pipeline.exec();
}

export async function storeWebhookEvent(
  event: WebhookEvent | UnknownWebhookEvent,
): Promise<void> {
  const pipeline = kv.pipeline();
  await pipeline.lpush("webhook_events", event);
  await pipeline.ltrim("webhook_events", 0, 100);
  await pipeline.exec();
}

export async function getWebhookEvents(limit = 100): Promise<WebhookEvent[]> {
  return (await kv.lrange<WebhookEvent>("webhook_events", 0, limit)).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

export async function getTransferRequest(
  transferId: string,
): Promise<TransferRequest | null> {
  return await kv.get<TransferRequest>(`transfer-request:${transferId}`);
}

export async function setTransferRequest(
  transferRequest: TransferRequest,
): Promise<"OK" | TransferRequest | null> {
  return kv.set<TransferRequest>(
    `transfer-request:${transferRequest.transferId}`,
    transferRequest,
  );
}

export async function daleteTransferRequest(
  transferRequest: TransferRequest,
): Promise<number> {
  return kv.del(`transfer-request:${transferRequest.transferId}`);
}
