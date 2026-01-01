import { Vercel } from "@vercel/sdk";
import { mockBillingData } from "@/data/mock-billing-data";
import { env } from "../env";
import { getInstallation, getResource } from "../partner";
import { fetchVercelApi } from "./api";
import type {
  Balance,
  BillingData,
  CreateInvoiceRequest,
  DeploymentActionOutcome,
  ImportResourceRequest,
  InvoiceDiscount,
} from "./schemas";

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

export async function dispatchEvent(
  installationId: string,
  event: IntegrationEvent
) {
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
}

export async function getAccountInfo(installationId: string) {
  const installation = await getInstallation(installationId);

  const vercel = new Vercel({
    bearerToken: installation.credentials.access_token,
  });

  return await vercel.marketplace.getAccountInfo({
    integrationConfigurationId: installationId,
  });
}

export interface Project {
  id: string;
  name: string;
  accountId: string;
}

export async function getProject(installationId: string, projectId: string) {
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
}

export interface Check {
  name: string;
  id: string;
  isRerequestable: boolean;
  requires: "build-ready" | "deployment-url" | "none";
  targets?: ("preview" | "production" | string)[];
  blocks?:
    | "build-start"
    | `deployment-start`
    | "deployment-alias"
    | "deployment-promotion"
    | "none";
  timeout?: number; // default to 5 mins
}

export async function createCheck(
  installation_id: string,
  resource_id: string,
  projectId: string,
  name: string,
  isRerequestable: string,
  requires: string,
  blocks: string,
  targets: string,
  timeout: number
) {
  // Is this the correct endpoint?
  await fetchVercelApi(`/v2/projects/${projectId}/checks`, {
    method: "POST",
    installationId: installation_id,
    data: {
      source: { kind: "integration", externalResourceId: resource_id },
      name,
      isRerequestable: isRerequestable === "on",
      requires,
      blocks,
      targets: targets.split(",").map((target) => target.trim()),
      timeout,
    },
  });
}

export async function updateCheckRun(
  installation_id: string,
  checkRunId: string,
  deploymentId: string,
  updates: {
    status: "queued" | "running" | "completed";
    conclusion?:
      | "canceled"
      | "skipped"
      | "timeout"
      | "failed"
      | "neutral"
      | "succeeded";
    externalId?: string;
    externalUrl?: string;
    output?: unknown;
  }
) {
  // Is this the correct endpoint?
  await fetchVercelApi(
    `/v2/deployments/${deploymentId}/check-runs/${checkRunId}`,
    {
      method: "PATCH",
      installationId: installation_id,
      data: updates,
    }
  );
}

export async function getProjectChecks(
  installationId: string,
  projectId: string
): Promise<Check[]> {
  // Is this the correct endpoint?
  return (
    (await fetchVercelApi(`/v2/projects/${projectId}/checks`, {
      installationId,
    })) as { checks: Check[] }
  ).checks;
}

export async function updateSecrets(
  installationId: string,
  resourceId: string,
  secrets: {
    name: string;
    value: string;
    environmentOverrides?: Record<string, string>;
  }[]
) {
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
}

export async function exchangeCodeForToken(
  code: string,
  state: string | null | undefined
) {
  const vercel = new Vercel();

  const result = await vercel.marketplace.exchangeSsoToken({
    code,
    state: state ?? undefined,
    clientId: env.INTEGRATION_CLIENT_ID,
    clientSecret: env.INTEGRATION_CLIENT_SECRET,
  });

  return result.idToken;
}

export async function importResource(
  installationId: string,
  resourceId: string,
  request: ImportResourceRequest
) {
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
}

export async function submitPrepaymentBalances(
  installationId: string,
  balances: Balance[]
) {
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
}

export async function sendBillingData(
  installationId: string,
  data: BillingData
) {
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
}

export async function getInvoice(installationId: string, invoiceId: string) {
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
}

export async function submitInvoice(
  installationId: string,
  opts?: { test?: boolean; maxAmount?: number; discountPercent?: number }
): Promise<{ invoiceId: string }> {
  const test = opts?.test ?? false;
  const maxAmount = opts?.maxAmount ?? undefined;

  const billingData = await mockBillingData(installationId);

  let items = billingData.billing.filter((item) => Boolean(item.resourceId));
  if (maxAmount !== undefined) {
    const total = items.reduce(
      (acc, item) => acc + Number.parseFloat(item.total),
      0
    );
    if (total > maxAmount) {
      const ratio = maxAmount / total;
      items = items.map((item) => ({
        ...item,
        quantity: item.quantity * ratio,
        total: (Number.parseFloat(item.total) * ratio).toFixed(2),
      }));
    }
  }

  const discounts: InvoiceDiscount[] = [];
  if (opts?.discountPercent !== undefined && opts.discountPercent > 0) {
    const total = items.reduce(
      (acc, item) => acc + Number.parseFloat(item.total),
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

  const invoiceRequest: CreateInvoiceRequest = {
    test: test ? { result: "paid", validate: false } : undefined,
    externalId: new Date().toISOString().replace(/[^0-9]/g, ""),
    invoiceDate: new Date().toISOString(),
    period: billingData.period,
    items:
      items.length > 0
        ? items.map((item) => ({
            resourceId: item.resourceId!,
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
      resourceId: discount.resourceId!,
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
}

export async function refundInvoice(
  installationId: string,
  invoiceId: string,
  total: string,
  reason: string
) {
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
}

export async function updateDeploymentAction({
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
  outcomes?: DeploymentActionOutcome[];
}) {
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
}

export async function getDeployment(
  installationId: string,
  deploymentId: string
) {
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
}
