import { env } from "../env";
import { getInstallation } from "../partner";

// INTEGRATION_CLIENT_ID is the `oac_...` integration ID
const userAgent = `Vercel Example Marketplace Integration/${env.INTEGRATION_CLIENT_ID}`;

export async function fetchVercelApi(
  path: string,
  init?: RequestInit & { installationId?: string; data?: unknown },
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
      "User-Agent": userAgent,
    };
  }

  const url = `https://vercel.com/api${path}`;

  console.log(`>> ${options.method || "GET"} ${url}`);
  const res = await fetch(url, options);

  console.log(
    `<< ${options.method || "GET"} ${url} ${res.status} ${
      res.statusText
    } ${res.headers.get("X-Vercel-Id")}`,
  );

  if (!res.ok) {
    throw new Error(
      `Request to Vercel API failed: ${res.status} ${
        res.statusText
      } ${await res.text()}`,
    );
  }

  if (res.headers.get("content-type")?.includes("application/json")) {
    return await res.json();
  }
}
