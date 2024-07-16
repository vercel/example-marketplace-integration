import { getInstallation } from "../partner";

export async function fetchVercelApi(
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
