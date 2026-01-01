import crypto from "node:crypto";
import { Vercel } from "@vercel/sdk";
import { env } from "@/lib/env";
import {
  getInstallation,
  listInstallations,
  storeWebhookEvent,
  uninstallInstallation,
} from "@/lib/partner";
import {
  unknownWebhookEventSchema,
  type WebhookEvent,
  webhookEventSchema,
} from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

export const POST = async (req: Request): Promise<Response> => {
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

      const installation = await getInstallation(installationId);

      if (!installation) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload
        );
        break;
      }

      const vercel = new Vercel({
        bearerToken: installation.credentials.access_token,
      });

      await vercel.checks.createCheck({
        deploymentId,
        requestBody: {
          blocking: true,
          rerequestable: true,
          name: "Test Check",
        },
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

      const installation = await getInstallation(installationId);

      if (!installation) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload
        );
        break;
      }

      const vercel = new Vercel({
        bearerToken: installation.credentials.access_token,
      });

      const checks = await vercel.checks.getAllChecks({
        deploymentId,
      });

      const checkId = checks.checks.at(0)?.id;

      if (!checkId) {
        console.error(`No Check found for deployment ${deploymentId}`, checks);
        break;
      }

      await vercel.checks.updateCheck({
        deploymentId,
        checkId,
        requestBody: {
          status: "running",
        },
      });

      await delay(8000); // Wait for 8 seconds

      await vercel.checks.updateCheck({
        deploymentId,
        checkId,
        requestBody: {
          conclusion: "failed",
          status: "completed",
        },
      });

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

      const installation = await getInstallation(installationId);

      if (!installation) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload
        );
        break;
      }

      const vercel = new Vercel({
        bearerToken: installation.credentials.access_token,
      });

      const checks = await vercel.checks.getAllChecks({
        deploymentId,
      });

      const checkId = checks.checks.at(0)?.id;

      if (!checkId) {
        console.error(`No Check found for deployment ${deploymentId}`, checks);
        break;
      }

      await vercel.checks.updateCheck({
        deploymentId,
        checkId,
        requestBody: {
          status: "running",
        },
      });

      await delay(8000); // Wait for 8 seconds

      await vercel.checks.updateCheck({
        deploymentId,
        checkId,
        requestBody: {
          conclusion: "succeeded",
          status: "completed",
        },
      });

      break;
    }
    default: {
      console.error("Unknown webhook event:", type, payload);
      break;
    }
  }

  return new Response("", { status: 200 });
};

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
