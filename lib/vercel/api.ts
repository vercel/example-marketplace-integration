import { getInstallation, getResource } from "../partner";
import { env } from "../env";
import { z } from "zod";
import {
  BillingData,
  CreateInvoiceRequest,
  Invoice,
  RefundInvoiceRequest,
} from "./schemas";
import { mockBillingData } from "@/data/mock-billing-data";

interface ResourceUpdatedEvent {
  type: "resource.updated";
  productId: string;
  resourceId: string;
}

type IntegrationEvent = ResourceUpdatedEvent;

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

type AccountInfo = {
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

export async function updateSecrets(
  installationId: string,
  resourceId: string,
  secrets: { name: string; value: string }[]
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

const IntegrationsSsoTokenResponse = z.object({
  id_token: z.string(),
});

export async function exchangeCodeForToken(
  code: string,
  redirectUrl: string
): Promise<string> {
  const { id_token } = IntegrationsSsoTokenResponse.parse(
    await fetchVercelApi("/v1/integrations/sso/token", {
      method: "POST",
      data: {
        code,
        client_id: env.INTEGRATION_CLIENT_ID,
        client_secret: env.INTEGRATION_CLIENT_SECRET,
        redirect_uri: redirectUrl,
      },
    })
  );

  return id_token;
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
  opts?: { test?: boolean; maxAmount?: number }
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

  const invoiceRequest: CreateInvoiceRequest = {
    test: test ? { result: "paid", validate: false } : undefined,
    externalId: new Date().toISOString().replace(/[^0-9]/g, ""),
    invoiceDate: new Date().toISOString(),
    period: billingData.period,
    items: items.map((item) => ({
      resourceId: item.resourceId!,
      billingPlanId: item.billingPlanId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      units: item.units,
      total: item.total,
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

async function fetchVercelApi(
  path: string,
  init?: RequestInit & { installationId?: string; data?: unknown }
): Promise<unknown> {
  const options = init || {};

  if (options.installationId) {
    const installation = await getInstallation(options.installationId);

    if (!installation) {
      throw new Error(`Unknown installation '${options.installationId}'`);
    }

    options.headers = {
      Authorization: `Bearer ${installation.credentials.access_token}`,
    };
  }

  if (options.data) {
    options.body = JSON.stringify(options.data);
    options.headers = {
      ...options.headers,
      "content-type": "application/json",
    };
  }

  const url = `https://vercel.com/api${path}`;

  console.log(`>> ${options.method || "GET"} ${url}`);
  const res = await fetch(url, options);

  console.log(
    `<< ${options.method || "GET"} ${url} ${res.status} ${res.statusText}`
  );

  if (!res.ok) {
    throw new Error(
      `Request to Vercel API failed: ${res.status} ${
        res.statusText
      } ${await res.text()}`
    );
  }

  if (res.headers.get("content-type")?.includes("application/json")) {
    return await res.json();
  }
}
