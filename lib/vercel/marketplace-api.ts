import { mockBillingData } from "@/data/mock-billing-data";
import { z } from "zod";
import { env } from "../env";
import { getResource } from "../partner";
import { fetchVercelApi } from "./api";
import type {
  Balance,
  BillingData,
  CreateInvoiceRequest,
  DeploymentActionOutcome,
  ImportResourceRequest,
  ImportResourceResponse,
  Invoice,
  InvoiceDiscount,
  RefundInvoiceRequest,
  SubmitPrepaymentBalanceRequest,
  UpdateDeploymentActionRequest,
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
): Promise<void> {
  await fetchVercelApi(`/v1/installations/${installationId}/events`, {
    installationId,
    method: "POST",
    data: { event },
  });
}

export type AccountInfo = {
  name: string;
  contact: {
    email: string;
    name: string;
  };
};

export async function getAccountInfo(
  installationId: string
): Promise<AccountInfo> {
  return (await fetchVercelApi(`/v1/installations/${installationId}/account`, {
    installationId,
  })) as AccountInfo;
}

export type Project = {
  id: string;
  name: string;
  accountId: string;
};

export async function getProject(
  installationId: string,
  projectId: string
): Promise<Project> {
  return (await fetchVercelApi(`/v9/projects/${projectId}`, {
    installationId,
  })) as Project;
}

export type Check = {
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
};

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
): Promise<void> {
  const resource = await getResource(installationId, resourceId);

  if (!resource) {
    throw new Error(`Unknown resource '${resourceId}'`);
  }

  await fetchVercelApi(
    `/v1/installations/${installationId}/products/${resource.productId}/resources/${resource.id}/secrets`,
    {
      installationId,
      method: "PUT",
      data: { secrets },
    }
  );
}

export async function importResource(
  installationId: string,
  resourceId: string,
  request: ImportResourceRequest
): Promise<ImportResourceResponse> {
  return (await fetchVercelApi(
    `/v1/installations/${installationId}/resources/${resourceId}`,
    {
      installationId,
      method: "PUT",
      data: request,
    }
  )) as ImportResourceResponse;
}

export async function submitPrepaymentBalances(
  installationId: string,
  balances: Balance[]
): Promise<void> {
  await fetchVercelApi(`/v1/installations/${installationId}/billing/balance`, {
    installationId,
    method: "POST",
    data: {
      timestamp: new Date().toISOString(),
      balances,
    } satisfies SubmitPrepaymentBalanceRequest,
  });
}

export async function sendBillingData(
  installationId: string,
  data: BillingData
): Promise<void> {
  await fetchVercelApi(`/v1/installations/${installationId}/billing`, {
    installationId,
    method: "POST",
    data,
  });
}

export async function getInvoice(
  installationId: string,
  invoiceId: string
): Promise<Invoice> {
  return (await fetchVercelApi(
    `/v1/installations/${installationId}/billing/invoices/${invoiceId}`,
    {
      installationId,
    }
  )) as Invoice;
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
    const total = items.reduce((acc, item) => acc + parseFloat(item.total), 0);
    if (total > maxAmount) {
      const ratio = maxAmount / total;
      items = items.map((item) => ({
        ...item,
        quantity: item.quantity * ratio,
        total: (parseFloat(item.total) * ratio).toFixed(2),
      }));
    }
  }

  const discounts: InvoiceDiscount[] = [];
  if (opts?.discountPercent !== undefined && opts.discountPercent > 0) {
    const total = items.reduce((acc, item) => acc + parseFloat(item.total), 0);
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
  return (await fetchVercelApi(
    `/v1/installations/${installationId}/billing/invoices`,
    {
      installationId,
      method: "POST",
      data: invoiceRequest,
    }
  )) as { invoiceId: string };
}

export async function refundInvoice(
  installationId: string,
  invoiceId: string,
  total: string,
  reason: string
): Promise<{ invoiceId: string }> {
  return (await fetchVercelApi(
    `/v1/installations/${installationId}/billing/invoices/${invoiceId}/actions`,
    {
      installationId,
      method: "POST",
      data: {
        action: "refund",
        total,
        reason,
      } satisfies RefundInvoiceRequest,
    }
  )) as { invoiceId: string };
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
}): Promise<void> {
  await fetchVercelApi(
    `/v1/deployments/${deploymentId}/integrations/${installationId}/resources/${resourceId}/actions/${action}`,
    {
      installationId,
      method: "PATCH",
      data: {
        status,
        statusText,
        outcomes,
      } satisfies UpdateDeploymentActionRequest,
    }
  );
}

// See https://vercel.com/docs/rest-api/endpoints/deployments#get-a-deployment-by-id-or-url
export async function getDeployment(
  installationId: string,
  deploymentId: string
): Promise<any> {
  return fetchVercelApi(
    `/v13/deployments/${deploymentId}?withGitRepoInfo=true`,
    {
      installationId,
      method: "GET",
    }
  );
}
