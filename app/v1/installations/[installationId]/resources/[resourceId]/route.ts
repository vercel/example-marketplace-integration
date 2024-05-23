import { deleteResource, getResource, updateResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { updateResourceRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
  resourceId: string;
}

const notificationsMock: Resource["notification"][] = [
  {
    title: "Account is suspended",
    message:
      "Your account has been suspended due to a billing issue. Please update your payment information to resume service.",
    href: "https://vercel.com/account/billing",
    level: "error",
  },
  {
    title: "Initializing",
    message:
      "Your resource is currently initializing. This may take a few minutes.",
    level: "warn",
  },
];
export const GET = withAuth(
  async (claims, _request, { params }: { params: Params }) => {
    const resource = await getResource(
      claims.installation_id,
      params.resourceId
    );

    if (!resource) {
      return Response.json(
        {
          error: true,
          code: "not_found",
        },
        { status: 404 }
      );
    }

    return Response.json(resource);
  }
);

export const PATCH = withAuth(
  async (claims, request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      updateResourceRequestSchema
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    const updatedResource = await updateResource(
      claims.installation_id,
      params.resourceId,
      requestBody.data
    );

    return Response.json(updatedResource, {
      status: 200,
    });
  }
);

export const DELETE = withAuth(
  async (claims, _request, { params }: { params: Params }) => {
    await deleteResource(claims.installation_id, params.resourceId);

    return new Response(null, { status: 204 });
  }
);
