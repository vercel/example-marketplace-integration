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

  const parseResult = parseWebhookBody(rawBody);
  if (parseResult.error) {
    return new Response(parseResult.error, { status: 400 });
  }

  const eventResult = await parseWebhookEvent(parseResult.json);
  if (eventResult.error) {
    return new Response(eventResult.error, { status: 400 });
  }

  const event = eventResult.event;
  const { id, type, createdAt, payload } = event;

  console.log("webhook event:", id, type, new Date(createdAt), payload);

  await storeWebhookEvent(event);
  await handleWebhookEvent(event);

  return new Response("", { status: 200 });
};

function parseWebhookBody(
  rawBody: string
): { json: unknown; error?: never } | { json?: never; error: string } {
  try {
    return { json: JSON.parse(rawBody) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const response = `Failed to parse webhook event: ${message}`;
    console.error(response);
    return { error: response };
  }
}

async function parseWebhookEvent(
  json: unknown
): Promise<
  { event: WebhookEvent; error?: never } | { event?: never; error: string }
> {
  try {
    return { event: webhookEventSchema.parse(json) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const response = `Failed to parse webhook event: ${message}`;
    console.error(response);
    await storeWebhookEvent(unknownWebhookEventSchema.parse(json));
    return { error: response };
  }
}

async function handleWebhookEvent(event: WebhookEvent): Promise<void> {
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
}

async function handleDeploymentCreated(payload: {
  deployment: { id: string };
  installationIds?: string[];
}): Promise<void> {
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
}

async function handleDeploymentReady(payload: {
  deployment: { id: string };
  installationIds?: string[];
}): Promise<void> {
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
}

async function handleCheckRerequested(payload: {
  deployment: { id: string };
  installationIds?: string[];
}): Promise<void> {
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
}

async function getVercelClient(
  deploymentId: string,
  installationIds?: string[]
): Promise<Vercel | null> {
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
}

async function getCheckId(
  vercel: Vercel,
  deploymentId: string
): Promise<string | null> {
  const checks = await vercel.checks.getAllChecks({ deploymentId });
  const checkId = checks.checks.at(0)?.id;

  if (!checkId) {
    console.error(`No Check found for deployment ${deploymentId}`, checks);
    return null;
  }

  return checkId;
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
