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

    // Simulate asynchronous secret rotation process.
    waitUntil(rotateSecretsAsync(params.installationId, params.resourceId));

    return Response.json(
      {
        sync: false,
      } satisfies RequestSecretsRotationResponse,
      {
        status: 200,
      },
    );
  },
);

async function rotateSecretsAsync(installationId: string, resourceId: string) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));

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
