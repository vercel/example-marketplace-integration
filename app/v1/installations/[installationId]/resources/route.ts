import { listResources, provisionResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { provisionResourceRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
}

export const GET = withAuth(async (claims) => {
  const response = await listResources(claims.installation_id);

  return Response.json(response);
});

export const POST = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    provisionResourceRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  const resource = await provisionResource(
    claims.installation_id,
    requestBody.data
  );

  return Response.json(resource, {
    status: 201,
  });
});
