import { installIntegration, uninstallIntegration } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { installIntegrationRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
}

export const PUT = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    installIntegrationRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  await installIntegration(claims.installation_id, {
    type: "marketplace",
    ...requestBody.data,
  });

  return new Response(null, { status: 201 });
});

export const DELETE = withAuth(async (claims) => {
  await uninstallIntegration(claims.installation_id);

  return new Response(null, { status: 204 });
});
