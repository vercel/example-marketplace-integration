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

export const POST = async (req: Request) => {
  const rawBody = await req.text();
  const rawBodyBuffer = Buffer.from(rawBody, "utf-8");
  const bodySignature = sha1(rawBodyBuffer, env.INTEGRATION_CLIENT_SECRET);

  if (bodySignature !== req.headers.get("x-vercel-signature")) {
    return Response.json({
      code: "invalid_signature",
      error: "signature didn't match",
    });
  }

  const parseResult = parseWebhookBody(rawBody);

  if (parseResult.error) {
    return new Response(parseResult.error, { status: 400 });
  }

  const eventResult = await parseWebhookEvent(parseResult.json);

  if (eventResult.error) {
    return new Response(eventResult.error, { status: 400 });
  }

  const event = eventResult.event;

  if (!event) {
    return new Response("Invalid webhook event", { status: 400 });
  }

  const { id, type, createdAt, payload } = event;

  console.log("webhook event:", id, type, new Date(createdAt), payload);

  await storeWebhookEvent(event);
  await handleWebhookEvent(event);

  return new Response("", { status: 200 });
};

const parseWebhookBody = (rawBody: string) => {
  try {
    return { json: JSON.parse(rawBody) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const response = `Failed to parse webhook event: ${message}`;
    console.error(response);
    return { error: response };
  }
};

const parseWebhookEvent = async (json: unknown) => {
  try {
    return { event: webhookEventSchema.parse(json) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const response = `Failed to parse webhook event: ${message}`;
    console.error(response);
    await storeWebhookEvent(unknownWebhookEventSchema.parse(json));
    return { error: response };
  }
};

const handleWebhookEvent = async (event: WebhookEvent) => {
  const { type, payload } = event;

  switch (type) {
    case "integration-configuration.removed": {
      await uninstallInstallation(payload.configuration.id);
      break;
    }
    case "deployment.created": {
      await handleDeploymentCreated(payload);
      break;
    }
    case "deployment.ready": {
      await handleDeploymentReady(payload);
      break;
    }
    case "deployment.check-rerequested": {
      await handleCheckRerequested(payload);
      break;
    }
    default: {
      console.error("Unknown webhook event:", type, payload);
      break;
    }
  }
};

const handleDeploymentCreated = async (payload: {
  deployment: { id: string };
  installationIds?: string[];
}) => {
  const deploymentId = payload.deployment.id;
  const vercel = await getVercelClient(deploymentId, payload.installationIds);
  if (!vercel) {
    return;
  }

  await vercel.checks.createCheck({
    deploymentId,
    requestBody: {
      blocking: true,
      rerequestable: true,
      name: "Test Check",
    },
  });
};

const handleDeploymentReady = async (payload: {
  deployment: { id: string };
  installationIds?: string[];
}) => {
  const deploymentId = payload.deployment.id;
  const vercel = await getVercelClient(deploymentId, payload.installationIds);
  if (!vercel) {
    return;
  }

  const checkId = await getCheckId(vercel, deploymentId);
  if (!checkId) {
    return;
  }

  await vercel.checks.updateCheck({
    deploymentId,
    checkId,
    requestBody: { status: "running" },
  });

  await delay(8000);

  await vercel.checks.updateCheck({
    deploymentId,
    checkId,
    requestBody: { conclusion: "failed", status: "completed" },
  });
};

const handleCheckRerequested = async (payload: {
  deployment: { id: string };
  installationIds?: string[];
}) => {
  const deploymentId = payload.deployment.id;
  const vercel = await getVercelClient(deploymentId, payload.installationIds);
  if (!vercel) {
    return;
  }

  const checkId = await getCheckId(vercel, deploymentId);
  if (!checkId) {
    return;
  }

  await vercel.checks.updateCheck({
    deploymentId,
    checkId,
    requestBody: { status: "running" },
  });

  await delay(8000);

  await vercel.checks.updateCheck({
    deploymentId,
    checkId,
    requestBody: { conclusion: "succeeded", status: "completed" },
  });
};

const getVercelClient = async (
  deploymentId: string,
  installationIds?: string[]
) => {
  const installationId = await getInstallationId(installationIds);

  if (!installationId) {
    console.error(`No installations found for deployment ${deploymentId}`);
    return null;
  }

  const installation = await getInstallation(installationId);

  if (!installation) {
    console.error(`No installation found for deployment ${deploymentId}`);
    return null;
  }

  return new Vercel({ bearerToken: installation.credentials.access_token });
};

const getCheckId = async (vercel: Vercel, deploymentId: string) => {
  const checks = await vercel.checks.getAllChecks({ deploymentId });
  const checkId = checks.checks.at(0)?.id;

  if (!checkId) {
    console.error(`No Check found for deployment ${deploymentId}`, checks);
    return null;
  }

  return checkId;
};

const sha1 = (data: Buffer, secret: string) =>
  crypto
    .createHmac("sha1", secret)
    .update(new Uint8Array(data))
    .digest("hex");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getInstallationId = async (installationIds: string[] | undefined) => {
  const installations = await listInstallations();
  const installationId = installationIds?.find((id) =>
    installations.includes(id)
  );
  return installationId;
};
