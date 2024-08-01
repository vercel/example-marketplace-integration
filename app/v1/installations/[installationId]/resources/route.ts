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
    provisionResourceRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  if (requestBody.data.name === "validation-error") {
    return Response.json(
      {
        error: {
          code: "validation_error",
          fields: [
            {
              dataPath: "",
              keyword: "required",
              message: "should have required property 'foo'",
            },
          ],
          message:
            "Failed to validate metadata: metadata should have required property 'foo'",
        },
      },
      {
        status: 400,
      }
    );
  }
  if (requestBody.data.name === "generic-user-error") {
    return Response.json(
      {
        error: {
          code: "generic_user_error",
          message: "You cannot provision resources for this user",
        },
      },
      {
        status: 400,
      }
    );
  }

  const resource = await provisionResource(
    claims.installation_id,
    requestBody.data
  );

  return Response.json(resource, {
    status: 201,
  });
});
