import {
  getResourceCredentials,
  recordCredentialTypesChange,
  setResourceCredentialTypes,
} from "@/lib/partner";
import { acceptsCredentialType } from "@/lib/partner/credential-types";
import { buildError, readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { updateSecrets } from "@/lib/vercel/marketplace-api";
import {
  RequestSecretsRotationRequestSchema,
  type RequestSecretsRotationResponse,
  type ResourceCredentialType,
  type ResourceSecrets,
} from "@/lib/vercel/schemas";
import { waitUntil } from "@vercel/functions";

interface Params {
  resourceId: string;
}

export const POST = withAuth(
  async (claims, request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      RequestSecretsRotationRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    const installationId = claims.installation_id;
    const { resourceId } = params;

    console.log(
      "Accepting secret rotation request for resourceId:",
      installationId,
      resourceId,
      "with body:",
      requestBody.data,
    );

    const credentials = await getResourceCredentials(
      installationId,
      resourceId,
    );

    if (!credentials) {
      return Response.json(
        buildError("not_found", `Unknown resource '${resourceId}'`),
        { status: 404 },
      );
    }

    const { credentialTypes } = requestBody.data;
    const changeResponse = credentials.credentialTypesChangeResponse;

    if (credentialTypes) {
      if (changeResponse === "reject") {
        return Response.json(
          buildError(
            "credential_types_change_rejected",
            `This resource cannot change to accept ${credentialTypes.join(", ")}.`,
          ),
          { status: 400 },
        );
      }
      await recordCredentialTypesChange(
        installationId,
        resourceId,
        credentialTypes,
      );
    } else if (!acceptsCredentialType(credentials.credentialTypes, "static")) {
      return Response.json(
        buildError(
          "no_static_credentials",
          "This resource has no long-lived secrets to rotate.",
        ),
        { status: 400 },
      );
    }

    const secrets = rotatedSecrets(
      credentialTypes ?? credentials.credentialTypes,
    );
    const confirmCredentialTypes =
      changeResponse === "hold" ? undefined : credentialTypes;

    // Toggle sync/async mode for testing (Vercel doesn't send these params)
    // - ?sync=1  → return secrets immediately (200)
    // - ?async=1 → return 202 and rotate in background (default behavior)
    const url = new URL(request.url);
    const forceSync = url.searchParams.get("sync") === "1";
    const forceAsync = url.searchParams.get("async") === "1";

    if (forceSync && !forceAsync) {
      if (confirmCredentialTypes) {
        waitUntil(
          simulateProviderWork().then(() =>
            setResourceCredentialTypes(
              installationId,
              resourceId,
              confirmCredentialTypes,
            ),
          ),
        );
      }
      return Response.json(
        {
          sync: true,
          secrets,
          partial: false,
        } satisfies RequestSecretsRotationResponse,
        {
          status: 200,
        },
      );
    }

    waitUntil(
      rotateSecretsAsync(
        installationId,
        resourceId,
        secrets,
        confirmCredentialTypes,
      ),
    );

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

function rotatedSecrets(
  credentialTypes: ResourceCredentialType[] | undefined,
): ResourceSecrets {
  if (!acceptsCredentialType(credentialTypes, "static")) {
    return [];
  }
  return [
    {
      name: "TOP_SECRET",
      value: `updated for rotation (${new Date().toISOString()})`,
    },
  ];
}

function simulateProviderWork(): Promise<void> {
  const delayMs = 5000 + Math.random() * 5000;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function rotateSecretsAsync(
  installationId: string,
  resourceId: string,
  secrets: ResourceSecrets,
  confirmCredentialTypes: ResourceCredentialType[] | undefined,
) {
  await simulateProviderWork();

  console.log(
    "Asynchronous secret rotation completed for installationId:",
    installationId,
    "resourceId:",
    resourceId,
  );

  await updateSecrets(installationId, resourceId, secrets, { partial: false });

  if (confirmCredentialTypes) {
    await setResourceCredentialTypes(
      installationId,
      resourceId,
      confirmCredentialTypes,
    );
  }
}
