import { uninstallIntegration } from "@/lib/partner";
import { z } from "zod";

const IntegrationConfigurationRemovedWebhookEvent = z.object({
  type: z.literal("integration-configuration.removed"),
  payload: z.object({
    configuration: z.object({
      id: z.string(),
    }),
  }),
});

const WebhookEvent = z.discriminatedUnion("type", [
  IntegrationConfigurationRemovedWebhookEvent,
]);

export async function POST(request: Request) {
  const webhookEvent = WebhookEvent.parse(await request.json());

  switch (webhookEvent.type) {
    case "integration-configuration.removed":
      await uninstallIntegration(webhookEvent.payload.configuration.id);
  }

  return new Response("OK");
}
