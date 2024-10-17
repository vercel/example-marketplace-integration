import { provisionResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { getBearerAuthorizationToken, withAuth } from "@/lib/vercel/auth";
import { resourceImportRequestSchema } from "@/lib/vercel/schemas";

export const POST = withAuth(
  async (claims, request) => {
    const result = await readRequestBodyWithSchema(
      request,
      resourceImportRequestSchema
    );

    if (!result.success) {
      return Response.json({
        error: {
          type: "validation_error",
          message: "Invalid request body",
        },
      });
    }

    const importedResources = [];

    for (const resource of result.data.resources) {
      const importedResource = await provisionResource(
        claims.installation_id,
        {
          productId: result.data.productId,
          name: resource.name,
          metadata: {},
          billingPlanId: "imported-resource",
        },
        resource.id
      );

      importedResources.push({
        id: importedResource.id,
        secrets: buildSecrets(result.data.productId),
      });
    }

    return Response.json({
      resources: importedResources,
    });
  },
  {
    getAuthorizationToken(request) {
      const bearerToken = getBearerAuthorizationToken(request);

      // TODO: decrypt token using CLIENT_SECRET
      return bearerToken;
    },
  }
);

function buildSecrets(
  productId: string
): { name: string; value: string; prefix?: string }[] {
  switch (productId) {
    case "postgres":
      return [
        {
          name: "URL",
          prefix: "POSTGRES",
          value: "postgres://neon.tech",
        },
        {
          name: "URL_NON_POOLING",
          prefix: "POSTGRES",
          value: "postgres://neon.tech?non-pooling=true",
        },
        {
          name: "URL_NO_SSL",
          prefix: "POSTGRES",
          value: "postgres://neon.tech?no-ssl=true",
        },
        {
          name: "PRISMA_URL",
          prefix: "POSTGRES",
          value: "postgres://neon.tech?prisma=true",
        },
        {
          name: "USER",
          prefix: "POSTGRES",
          value: "foobar",
        },
        {
          name: "USER",
          prefix: "POSTGRES",
          value: "foobar",
        },
        {
          name: "PASSWORD",
          prefix: "POSTGRES",
          value: "password",
        },
        {
          name: "HOST",
          prefix: "POSTGRES",
          value: "neon.tech",
        },
        {
          name: "DATABASE",
          prefix: "POSTGRES",
          value: "verceldb",
        },
        {
          name: "CUSTOM_ENV_VAR",
          value: "my-secret",
        },
      ];
    case "redis":
      return [
        { name: "URL", prefix: "KV", value: "redis://upstash.com" },
        { name: "REST_API_URL", prefix: "KV", value: "https://upstash.com" },
        { name: "REST_API_TOKEN", prefix: "KV", value: "foobar-token" },
        {
          name: "REST_API_READ_ONLY_TOKEN",
          prefix: "KV",
          value: "https://upstash.com/read-only",
        },
        {
          name: "CUSTOM_ENV_VAR",
          value: "my-secret",
        },
      ];
    default:
      throw new Error(`Unsupported product id '${productId}'`);
  }
}
