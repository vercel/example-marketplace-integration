import crypto from "node:crypto";
import { env } from "@/lib/env";
import {
  listInstallations,
  storeWebhookEvent,
  uninstallInstallation,
} from "@/lib/partner";
import { fetchVercelApi } from "@/lib/vercel/api";
import {
  unknownWebhookEventSchema,
  type WebhookEvent,
  webhookEventSchema,
} from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const rawBodyBuffer = Buffer.from(rawBody, "utf-8");
  const bodySignature = sha1(rawBodyBuffer, env.INTEGRATION_CLIENT_SECRET);

  if (bodySignature !== req.headers.get("x-vercel-signature")) {
    return Response.json({
      code: "invalid_signature",
      error: "signature didn't match",
    });
  }

  let json: any;
  try {
    json = JSON.parse(rawBody);
  } catch (e) {
    console.error("Failed to parse webhook event: not a json:", rawBody, e);
  }
  if (!json) {
    return new Response("", { status: 200 });
  }

  let event: WebhookEvent | undefined;
  try {
    event = webhookEventSchema.parse(json);
  } catch (e) {
    console.error("Failed to parse webhook event: unknown event:", rawBody, e);
  }
  if (!event) {
    try {
      await storeWebhookEvent(unknownWebhookEventSchema.parse(json));
    } catch (e) {
      console.error("Failed to parse webhook event: not an event:", rawBody, e);
    }
    return new Response("", { status: 200 });
  }

  const { id, type, createdAt, payload } = event;
  console.log("webhook event:", id, type, new Date(createdAt), payload);
  await storeWebhookEvent(event);

  switch (type) {
    case "integration-configuration.removed": {
      await uninstallInstallation(payload.configuration.id);
      break;
    }
    case "deployment.created": {
      const deploymentId = payload.deployment.id;
      const installationId = await getInstallationId(payload.installationIds);
      if (!installationId) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload
        );
        break;
      }
      await fetchVercelApi(`/v1/deployments/${deploymentId}/checks`, {
        data: {
          blocking: true,
          rerequestable: true,
          name: "Test Check",
        },
        method: "POST",
        installationId,
      });
      break;
    }
    case "deployment.ready": {
      const deploymentId = payload.deployment.id;
      const installationId = await getInstallationId(payload.installationIds);
      if (!installationId) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload
        );
        break;
      }

      const data = (await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks`,
        {
          method: "get",
          installationId,
        }
      )) as { checks: { id: string }[] };

      const checkId = data.checks[0]?.id;

      if (!checkId) {
        console.error(`No Check found for deployment ${deploymentId}`, data);
      }

      await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks/${data.checks[0]?.id}`,
        {
          data: {
            status: "running",
          },
          method: "PATCH",
          installationId,
        }
      );

      await delay(8000); // Wait for 8 seconds

      await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks/${data.checks[0]?.id}`,
        {
          data: {
            conclusion: "failed",
            status: "completed",
          },
          method: "PATCH",
          installationId,
        }
      );
      break;
    }
    case "deployment.check-rerequested": {
      const deploymentId = payload.deployment.id;
      const installationId = await getInstallationId(payload.installationIds);
      if (!installationId) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload
        );
        break;
      }

      const data = (await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks`,
        {
          method: "get",
          installationId,
        }
      )) as { checks: { id: string }[] };

      const checkId = data.checks[0]?.id;

      if (!checkId) {
        console.error(`No Check found for deployment ${deploymentId}`, data);
      }

      await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks/${data.checks[0]?.id}`,
        {
          data: {
            status: "running",
          },
          method: "PATCH",
          installationId,
        }
      );

      await delay(8000); // Wait for 8 seconds

      await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks/${data.checks[0]?.id}`,
        {
          data: {
            conclusion: "succeeded",
            status: "completed",
          },
          method: "PATCH",
          installationId,
        }
      );
      break;
    }
  }

  return new Response("", { status: 200 });
}

function sha1(data: Buffer, secret: string): string {
  return crypto
    .createHmac("sha1", secret)
    .update(new Uint8Array(data))
    .digest("hex");
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getInstallationId(installationIds: string[] | undefined) {
  const installations = await listInstallations();
  const installationId = installationIds?.find((id) =>
    installations.includes(id)
  );
  return installationId;
}
