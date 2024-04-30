import { getInstallation, getResource } from "../partner";
import { env } from "../env";
import { z } from "zod";

export async function dispatchEvent(
  installationId: string,
  event: any
): Promise<void> {
  await fetchVercelApi(
    `/v1/integrations/marketplace/installations/${installationId}/events`,
    {
      installationId,
      method: "POST",
      data: { event },
    }
  );
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
    `/v1/integrations/marketplace/installations/${installationId}/products/${resource.productId}/resources/${resource.id}/secrets`,
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

  const res = await fetch(`https://vercel.com/api${path}`, options);

  if (!res.ok) {
    throw new Error(
      `Request to Vercel API failed: ${res.status} ${
        res.statusText
      } ${await res.text()}`
    );
  }

  return await res.json();
}
