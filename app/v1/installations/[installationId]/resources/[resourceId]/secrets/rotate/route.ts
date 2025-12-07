import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { updateSecrets } from "@/lib/vercel/marketplace-api";
import {
  RequestSecretsRotationRequestSchema,
  RequestSecretsRotationResponse,
} from "@/lib/vercel/schemas";
import { waitUntil } from "@vercel/functions";

interface Params {
  installationId: string;
  resourceId: string;
}

export const POST = withAuth(
  async (_claims, request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      RequestSecretsRotationRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    console.log(
      "Accepting secret rotation request for resourceId:",
      params.installationId,
      params.resourceId,
      "with body:",
      requestBody.data,
    );

    // Toggle via ?sync=1 / ?async=1 for testing (Vercel doesn't send these)
    const url = new URL(request.url);
    const forceSync = url.searchParams.get("sync") === "1";

    if (forceSync) {
      // Sync: return new secrets immediately
      const currentDate = new Date().toISOString();
      return Response.json(
        {
          sync: true,
          secrets: [
            {
              name: "TOP_SECRET",
              value: `updated for rotation (${currentDate})`,
            },
          ],
          partial: false,
        } satisfies RequestSecretsRotationResponse,
        {
          status: 200,
        },
      );
    }

    // Async: simulate asynchronous secret rotation process.
    waitUntil(rotateSecretsAsync(params.installationId, params.resourceId));

    return Response.json(
      {
        sync: false,
      } satisfies RequestSecretsRotationResponse,
      {
        status: 202,
      },
    );
  },
);

async function rotateSecretsAsync(installationId: string, resourceId: string) {
  const delayMs = 5000 + Math.random() * 5000;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  console.log(
    "Asynchronous secret rotation completed for installationId:",
    installationId,
    "resourceId:",
    resourceId,
  );

  const currentDate = new Date().toISOString();

  await updateSecrets(installationId, resourceId, [
    {
      name: "TOP_SECRET",
      value: `updated for rotation (${currentDate})`,
    },
  ]);
}
