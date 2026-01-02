import type { Balances } from "@vercel/sdk/models/submitprepaymentbalancesop.js";
import { compact } from "lodash";
import { nanoid } from "nanoid";
import type {
  InstallIntegrationRequest,
  Notification,
  ProvisionPurchaseRequest,
  ProvisionResourceRequest,
  Resource,
  ResourceStatusType,
  Claim as TransferRequest,
  UnknownWebhookEvent,
  UpdateResourceRequest,
  WebhookEvent,
} from "@/lib/vercel/schemas";
import { kv } from "../redis";
import {
  getInvoice,
  importResource as importResourceToVercelApi,
} from "../vercel/marketplace-api";
import { billingPlans } from "./billing";

const billingPlanMap = new Map(billingPlans.map((plan) => [plan.id, plan]));

export const installIntegration = async (
  installationId: string,
  request: InstallIntegrationRequest & { type: "marketplace" | "external" }
) => {
  const pipeline = kv.pipeline();

  pipeline.set(installationId, request);
  pipeline.lrem("installations", 0, installationId);
  pipeline.lpush("installations", installationId);
  pipeline.exec();

  return await Promise.resolve();
};

export const updateInstallation = async (
  installationId: string,
  billingPlanId: string
) => {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();

  pipeline.set(installationId, { ...installation, billingPlanId });
  pipeline.exec();
};

export const uninstallInstallation = async (installationId: string) => {
  const installation = await getInstallation(installationId);
  if (!installation || installation.deletedAt) {
    return undefined;
  }
  const pipeline = kv.pipeline();

  pipeline.set(installationId, {
    ...installation,
    deletedAt: Date.now(),
  });
  pipeline.lrem("installations", 0, installationId);

  await pipeline.exec();

  // Installation is finalized immediately if it's on a free plan.
  const billingPlan = billingPlanMap.get(installation.billingPlanId);
  return { finalized: billingPlan?.paymentMethodRequired === false };
};

export const listInstallations = async () => {
  const installationIds = await kv.lrange("installations", 0, -1);
  return installationIds;
};

export const provisionResource = async (
  installationId: string,
  request: ProvisionResourceRequest,
  opts?: { status?: ResourceStatusType }
) => {
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
    serializeResource(resource)
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
};

export const updateResource = async (
  installationId: string,
  resourceId: string,
  request: UpdateResourceRequest
) => {
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
    serializeResource(nextResource)
  );

  return nextResource;
};

export const transferResource = async (
  installationId: string,
  resourceId: string,
  targetInstallationId: string
) => {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  await kv.set(
    `${targetInstallationId}:resource:${resourceId}`,
    serializeResource(resource)
  );
  await kv.del(`${installationId}:resource:${resourceId}`);
};

export const updateResourceNotification = async (
  installationId: string,
  resourceId: string,
  notification?: Notification
) => {
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
};

export const clearResourceNotification = async (
  installationId: string,
  resourceId: string
) => {
  await updateResourceNotification(installationId, resourceId);
};

export const deleteResource = async (
  installationId: string,
  resourceId: string
) => {
  const pipeline = kv.pipeline();
  pipeline.del(`${installationId}:resource:${resourceId}`);
  pipeline.lrem(`${installationId}:resources`, 0, resourceId);
  await pipeline.exec();
};

export const listResources = async (
  installationId: string,
  targetResourceIds?: string[]
) => {
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
};

export const getResource = async (
  installationId: string,
  resourceId: string
) => {
  const resource = await kv.get<SerializedResource>(
    `${installationId}:resource:${resourceId}`
  );

  if (resource) {
    return deserializeResource(resource);
  }

  return null;
};

export const cloneResource = async (
  installationId: string,
  resourceId: string
) => {
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
};

export const importResourceToVercel = async (
  installationId: string,
  resourceId: string
) => {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Cannot find resource ${resourceId}`);
  }

  await importResourceToVercelApi(installationId, resource.id, {
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
  });
};

export const provisionPurchase = async (
  installationId: string,
  request: ProvisionPurchaseRequest
) => {
  const invoice = await getInvoice(installationId, request.invoiceId);

  if (invoice.state !== "paid") {
    throw new Error(`Invoice ${request.invoiceId} is not paid`);
  }

  const balances: Record<string, Balances> = {};

  for (const item of invoice.items) {
    const amountInCents = Math.floor(Number.parseFloat(item.total) * 100);

    if (item.resourceId) {
      const balance = await addResourceBalanceInternal(
        installationId,
        item.resourceId,
        amountInCents
      );
      balances[item.resourceId] = balance;
    } else {
      const balance = await addInstallationBalanceInternal(
        installationId,
        amountInCents
      );
      balances[""] = balance;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    balances: Object.values(balances),
  };
};

export const addInstallationBalanceInternal = async (
  installationId: string,
  currencyValueInCents: number
) => {
  const result = await kv.incrby(
    `${installationId}:balance`,
    currencyValueInCents
  );
  return {
    currencyValueInCents: result,
    credit: String(result * 1000),
    nameLabel: "Tokens",
  };
};

export const getInstallationBalance = async (installationId: string) => {
  const result = await kv.get<number>(`${installationId}:balance`);
  if (result === null) {
    return null;
  }
  return {
    currencyValueInCents: result,
    credit: String(result * 1000),
    nameLabel: "Tokens",
  };
};

export const addResourceBalanceInternal = async (
  installationId: string,
  resourceId: string,
  currencyValueInCents: number
) => {
  const result = await kv.incrby(
    `${installationId}:${resourceId}:balance`,
    currencyValueInCents
  );
  return {
    currencyValueInCents: result,
    credit: String(result * 1000),
    nameLabel: "Tokens",
    resourceId,
  };
};

export const getResourceBalance = async (
  installationId: string,
  resourceId: string
) => {
  const result = await kv.get<number>(
    `${installationId}:${resourceId}:balance`
  );
  if (result === null) {
    return null;
  }
  return {
    currencyValueInCents: result,
    credit: String(result * 1000),
    nameLabel: "Tokens",
    resourceId,
  };
};

type SerializedResource = Omit<Resource, "billingPlan"> & {
  billingPlan: string;
};

const serializeResource = (resource: Resource) => ({
  ...resource,
  billingPlan: resource.billingPlan.id,
});

const deserializeResource = (serializedResource: SerializedResource) => {
  const billingPlan = billingPlanMap.get(serializedResource.billingPlan) ?? {
    id: serializedResource.billingPlan,
    scope: "resource",
    type: "subscription",
    name: "Unknown",
    description: "Unknown",
    paymentMethodRequired: false,
  };
  return { ...serializedResource, billingPlan };
};

export const getAllBillingPlans = async (
  _installationId: string,
  _experimental_metadata?: Record<string, unknown>
) => {
  return await Promise.resolve({ plans: billingPlans });
};

export const getInstallationBillingPlans = async (
  installationId: string,
  _experimental_metadata?: Record<string, unknown>
) => {
  const resources = await listResources(installationId);
  return {
    plans:
      resources.resources.length > 2
        ? billingPlans.filter((p) => p.paymentMethodRequired)
        : billingPlans,
  };
};

export const getProductBillingPlans = async (
  _productId: string,
  installationId: string,
  _experimental_metadata?: Record<string, unknown>
) => {
  const resources = await listResources(installationId);
  return {
    plans:
      resources.resources.length > 2
        ? billingPlans.filter((p) => p.paymentMethodRequired)
        : billingPlans,
  };
};

export const getResourceBillingPlans = async (
  _installationId: string,
  _resourceId: string
) => {
  return await Promise.resolve({ plans: billingPlans });
};

export const getInstallation = async (installationId: string) => {
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
};

export const setInstallationNotification = async (
  installationId: string,
  notification: Notification | undefined | null
) => {
  const installation = await getInstallation(installationId);
  const pipeline = kv.pipeline();

  pipeline.set(installationId, {
    ...installation,
    notification: notification ?? undefined,
  });

  await pipeline.exec();
};

export const storeWebhookEvent = async (
  event: WebhookEvent | UnknownWebhookEvent
) => {
  const pipeline = kv.pipeline();

  pipeline.lpush("webhook_events", event);
  pipeline.ltrim("webhook_events", 0, 100);

  await pipeline.exec();
};

export const getWebhookEvents = async (limit = 100) => {
  return (await kv.lrange<WebhookEvent>("webhook_events", 0, limit)).sort(
    (a, b) => b.createdAt - a.createdAt
  );
};

export const getTransferRequest = async (transferId: string) => {
  return await kv.get<TransferRequest>(`transfer-request:${transferId}`);
};

export const setTransferRequest = async (transferRequest: TransferRequest) => {
  return await kv.set<TransferRequest>(
    `transfer-request:${transferRequest.transferId}`,
    transferRequest
  );
};

export const deleteTransferRequest = async (
  transferRequest: TransferRequest
) => {
  return await kv.del(`transfer-request:${transferRequest.transferId}`);
};
