import { deleteResource, getResource, updateResource } from "@/lib/partner";
import { PlanRestrictedError } from "@/lib/partner/plan-restrictions";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { updateResourceRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
  resourceId: string;
}

export const GET = withAuth(
  async (claims, _request, { params }: { params: Params }) => {
    const resource = await getResource(
      claims.installation_id,
      params.resourceId,
    );

    if (!resource) {
      return Response.json(
        {
          error: true,
          code: "not_found",
        },
        { status: 404 },
      );
    }

    return Response.json(resource);
  },
);

export const PATCH = withAuth(
  async (claims, request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      updateResourceRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    try {
      const updatedResource = await updateResource(
        claims.installation_id,
        params.resourceId,
        requestBody.data,
      );

      return Response.json(updatedResource, {
        status: 200,
      });
    } catch (error) {
      if (error instanceof PlanRestrictedError) {
        return Response.json(
          {
            error: {
              code: "conflict",
              message: error.message,
              user: {
                message:
                  error.reason ??
                  "This plan isn't available for this resource.",
              },
            },
          },
          { status: 409 },
        );
      }
      throw error;
    }
  },
);

export const DELETE = withAuth(
  async (claims, _request, { params }: { params: Params }) => {
    await deleteResource(claims.installation_id, params.resourceId);

    return new Response(null, { status: 204 });
  },
);
