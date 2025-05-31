import { listResources, provisionResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { provisionResourceRequestSchema } from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (claims, request) => {
  const ids = request.nextUrl.searchParams.getAll("ids");
  const resources = await listResources(claims.installation_id, ids);
  return Response.json(resources);
});

export const POST = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    provisionResourceRequestSchema,
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  if (requestBody.data.name === "validation_error") {
    return Response.json(
      {
        error: {
          code: "validation_error",
          fields: [
            {
              key: "region",
              message: "Invalid region",
            },
          ],
          message:
            "Failed to validate metadata: metadata should have valid property 'region'",
        },
      },
      {
        status: 400,
      },
    );
  }
  if (requestBody.data.name === "conflict") {
    return Response.json(
      {
        error: {
          code: "conflict",
          message: "You cannot provision resources for this user",
        },
      },
      {
        status: 409,
      },
    );
  }

  const resource = await provisionResource(
    claims.installation_id,
    requestBody.data,
  );

  return Response.json(resource, {
    status: 201,
  });
});
