import crypto from "crypto";
import { env } from "@/lib/env";
import { type WebhookEvent, webhookEventSchema } from "@/lib/vercel/schemas";
import { storeWebhookEvent, uninstallIntegration } from "@/lib/partner";

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

  let event: WebhookEvent | undefined;
  try {
    const json = JSON.parse(rawBody);
    event = webhookEventSchema.parse(json);
  } catch (e) {
    console.error("Failed to parse webhook event:", rawBody, e);
  }
  if (event) {
    const { id, type, createdAt, payload } = event;
    console.log("webhook event:", id, type, new Date(createdAt), payload);
    await storeWebhookEvent(event);

    switch (type) {
      case "integration-configuration.removed": {
        await uninstallIntegration(payload.configuration.id);
      }
    }
  }
  return new Response("", { status: 200 });
}

function sha1(data: Buffer, secret: string): string {
  return crypto.createHmac("sha1", secret).update(data).digest("hex");
}
