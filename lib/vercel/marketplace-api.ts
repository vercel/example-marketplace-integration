import { Vercel } from "@vercel/sdk";
import type { ImportResourceRequestBody } from "@vercel/sdk/models/importresourceop.js";
import type {
  Billing1,
  SubmitBillingDataRequestBody,
} from "@vercel/sdk/models/submitbillingdataop.js";
import type {
  SubmitInvoiceDiscounts,
  SubmitInvoiceRequestBody,
} from "@vercel/sdk/models/submitinvoiceop.js";
import type { Balances } from "@vercel/sdk/models/submitprepaymentbalancesop.js";
import type { Outcomes } from "@vercel/sdk/models/updateintegrationdeploymentactionop.js";
import { mockBillingData } from "@/data/mock-billing-data";
import { env } from "../env";
import { getInstallation, getResource } from "../partner";

interface InstallationUpdatedEvent {
  type: "installation.updated";
  billingPlanId?: string;
}

interface ResourceUpdatedEvent {
  type: "resource.updated";
  productId: string;
  resourceId: string;
}

type IntegrationEvent = InstallationUpdatedEvent | ResourceUpdatedEvent;

export const dispatchEvent = async (
  installationId: string,
  event: IntegrationEvent
) => {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  await vercel.marketplace.createEvent({
    integrationConfigurationId: installationId,
    requestBody: {
      event,
    },
  });
};

export const getAccountInfo = async (installationId: string) => {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.marketplace.getAccountInfo({
    integrationConfigurationId: installationId,
  });
};

export interface Project {
  id: string;
  name: string;
  accountId: string;
}

export const getProject = async (installationId: string, projectId: string) => {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  // Vercel SDK doesn't support getting a single project, so we get all projects and find the one we want
  const projects = await vercel.projects.getProjects({});
  const project = projects.projects.find((project) => project.id === projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  return project;
};

export const createCheck = async (
  installationId: string,
  deploymentId: string,
  name: string,
  options?: {
    blocking?: boolean;
    rerequestable?: boolean;
    detailsUrl?: string;
  }
) => {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.checks.createCheck({
    deploymentId,
    requestBody: {
      name,
      blocking: options?.blocking ?? false,
      rerequestable: options?.rerequestable,
      detailsUrl: options?.detailsUrl,
    },
  });
};

export const updateCheck = async (
  installationId: string,
  deploymentId: string,
  checkId: string,
  updates: {
    status?: "running" | "completed";
    conclusion?: "canceled" | "skipped" | "failed" | "neutral" | "succeeded";
    detailsUrl?: string;
  }
) => {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.checks.updateCheck({
    deploymentId,
    checkId,
    requestBody: updates,
  });
};

export const getDeploymentChecks = async (
  installationId: string,
  deploymentId: string
) => {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  const result = await vercel.checks.getAllChecks({
    deploymentId,
  });

  return result.checks;
};

export const updateSecrets = async (
  installationId: string,
  resourceId: string,
  secrets: {
    name: string;
    value: string;
    environmentOverrides?: Record<string, string>;
  }[]
) => {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Unknown resource '${resourceId}'`);
  }

  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  await vercel.marketplace.updateResourceSecretsById({
    integrationConfigurationId: installationId,
    resourceId,
    requestBody: {
      secrets,
    },
  });
};

export const exchangeCodeForToken = async (
  code: string,
  state: string | null | undefined
) => {
  const vercel = new Vercel();

  const result = await vercel.marketplace.exchangeSsoToken({
    code,
    state: state ?? undefined,
    clientId: env.INTEGRATION_CLIENT_ID,
    clientSecret: env.INTEGRATION_CLIENT_SECRET,
  });

  return result.idToken;
};

export const importResource = async (
  installationId: string,
  resourceId: string,
  request: ImportResourceRequestBody
) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.marketplace.importResource({
    integrationConfigurationId: installationId,
    resourceId,
    requestBody: request,
  });
};

export const submitPrepaymentBalances = async (
  installationId: string,
  balances: Balances[]
) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  await vercel.marketplace.submitPrepaymentBalances({
    integrationConfigurationId: installationId,
    requestBody: {
      timestamp: new Date(),
      balances,
    },
  });
};

export const sendBillingData = async (
  installationId: string,
  data: SubmitBillingDataRequestBody
) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  await vercel.marketplace.submitBillingData({
    integrationConfigurationId: installationId,
    requestBody: data,
  });
};

export const getInvoice = async (installationId: string, invoiceId: string) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.marketplace.getInvoice({
    integrationConfigurationId: installationId,
    invoiceId,
  });
};

export const submitInvoice = async (
  installationId: string,
  opts?: { test?: boolean; maxAmount?: number; discountPercent?: number }
) => {
  const test = opts?.test ?? false;
  const maxAmount = opts?.maxAmount ?? undefined;

  const billingData = await mockBillingData(installationId);

  // Normalize billing to always be an array of Billing1
  const billingArray: Billing1[] = Array.isArray(billingData.billing)
    ? billingData.billing
    : billingData.billing.items;

  let items = billingArray.filter((item) => Boolean(item.resourceId));
  if (maxAmount !== undefined) {
    const total = items.reduce(
      (acc: number, item: Billing1) => acc + Number.parseFloat(item.total),
      0
    );
    if (total > maxAmount) {
      const ratio = maxAmount / total;
      items = items.map((item: Billing1) => ({
        ...item,
        quantity: item.quantity * ratio,
        total: (Number.parseFloat(item.total) * ratio).toFixed(2),
      }));
    }
  }

  const discounts: SubmitInvoiceDiscounts[] = [];
  if (opts?.discountPercent !== undefined && opts.discountPercent > 0) {
    const total = items.reduce(
      (acc: number, item: Billing1) => acc + Number.parseFloat(item.total),
      0
    );
    if (total > 0) {
      const discount = total * opts.discountPercent;
      discounts.push({
        resourceId: undefined,
        billingPlanId: items[0].billingPlanId,
        name: "Discount1",
        amount: discount.toFixed(2),
      });
    }
  }

  const invoiceRequest: SubmitInvoiceRequestBody = {
    test: test ? { result: "paid", validate: false } : undefined,
    externalId: new Date().toISOString().replace(/[^0-9]/g, ""),
    invoiceDate: new Date(),
    period: {
      start: new Date(billingData.period.start),
      end: new Date(billingData.period.end),
    },
    items:
      items.length > 0
        ? items.map((item: Billing1) => ({
            resourceId: item.resourceId,
            billingPlanId: item.billingPlanId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            units: item.units,
            total: item.total,
          }))
        : [
            {
              billingPlanId: "pro200",
              name: "Lone item. Maybe final invoice?",
              price: "1.80",
              quantity: 1,
              units: "n/a",
              total: "1.80",
            },
          ],
    discounts: discounts.map((discount) => ({
      resourceId: discount.resourceId,
      billingPlanId: discount.billingPlanId,
      name: discount.name,
      amount: discount.amount,
    })),
  };
  console.log("Submitting invoice:", invoiceRequest);

  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  const invoice = await vercel.marketplace.submitInvoice({
    integrationConfigurationId: installationId,
    requestBody: invoiceRequest,
  });

  return invoice;
};

export const refundInvoice = async (
  installationId: string,
  invoiceId: string,
  total: string,
  reason: string
) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  const invoice = await vercel.marketplace.updateInvoice({
    integrationConfigurationId: installationId,
    invoiceId,
    requestBody: {
      action: "refund",
      total,
      reason,
    },
  });

  return invoice;
};

export const updateDeploymentAction = async ({
  deploymentId,
  installationId,
  resourceId,
  action,
  status,
  statusText,
  outcomes,
}: {
  deploymentId: string;
  installationId: string;
  resourceId: string;
  action: string;
  status: "succeeded" | "failed";
  statusText?: string;
  outcomes?: Outcomes[];
}) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  await vercel.integrations.updateIntegrationDeploymentAction({
    integrationConfigurationId: installationId,
    deploymentId,
    resourceId,
    action,
    requestBody: {
      status,
      statusText,
      outcomes,
    },
  });
};

export const getDeployment = async (
  installationId: string,
  deploymentId: string
) => {
  const installation = await getInstallation(installationId);

  if (!installation) {
    throw new Error(`Unknown installation '${installationId}'`);
  }

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.deployments.getDeployment({
    idOrUrl: deploymentId,
    withGitRepoInfo: "true",
  });
};
