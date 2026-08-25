import crypto from "node:crypto";
import { env } from "@/lib/env";
import {
  listInstallations,
  storeWebhookEvent,
  uninstallInstallation,
} from "@/lib/partner";
import { fetchVercelApi } from "@/lib/vercel/api";
import {
  type WebhookEvent,
  unknownWebhookEventSchema,
  webhookEventSchema,
} from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const rawBodyBuffer = Buffer.from(rawBody, "utf-8");
  const bodySignature = sha1(rawBodyBuffer, env.INTEGRATION_CLIENT_SECRET);

  if (!signaturesMatch(bodySignature, req.headers.get("x-vercel-signature"))) {
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
          payload,
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
          payload,
        );
        break;
      }

      const data = (await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks`,
        {
          method: "get",
          installationId,
        },
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
        },
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
        },
      );
      break;
    }
    case "deployment.check-rerequested": {
      const deploymentId = payload.deployment.id;
      const installationId = await getInstallationId(payload.installationIds);
      if (!installationId) {
        console.error(
          `No installations found for deployment ${deploymentId}`,
          payload,
        );
        break;
      }

      const data = (await fetchVercelApi(
        `/v1/deployments/${deploymentId}/checks`,
        {
          method: "get",
          installationId,
        },
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
        },
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
        },
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

/**
 * Compare the computed signature with the one on the request in constant time.
 *
 * `===` on strings stops at the first differing byte, so how long the
 * comparison takes depends on how many leading characters were correct. That
 * turns a 40-character search space into a 40-step one, guessed a character at
 * a time. `crypto.timingSafeEqual` always reads both buffers to the end.
 *
 * It throws when the two buffers differ in length, so the length is checked
 * first. That check is not constant time, but the length of a hex digest is
 * fixed and public — it reveals nothing an attacker does not already know.
 */
function signaturesMatch(expected: string, provided: string | null): boolean {
  if (provided === null) return false;
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(provided, "utf-8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getInstallationId(installationIds: string[] | undefined) {
  const installations = await listInstallations();
  const installationId = installationIds?.find((id) =>
    installations.includes(id),
  );
  return installationId;
}
