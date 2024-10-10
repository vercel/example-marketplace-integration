import crypto from "crypto";
import { env } from "@/lib/env";
import {
  unknownWebhookEventSchema,
  type WebhookEvent,
  webhookEventSchema,
} from "@/lib/vercel/schemas";
import { storeWebhookEvent, uninstallInstallation } from "@/lib/partner";

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
