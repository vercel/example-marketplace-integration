import { deleteResource, getResource, updateResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { authMiddleware } from "@/lib/vercel/auth";
import { updateResourceRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
  resourceId: string;
}

export const GET = authMiddleware(
  async (_request: Request, { params }: { params: Params }) => {
    const resource = await getResource(
      params.installationId,
      params.resourceId,
    );

    return Response.json(resource);
  },
);

export const PATH = authMiddleware(
  async (request: Request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      updateResourceRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    const updatedResource = await updateResource(
      params.installationId,
      params.resourceId,
      requestBody.data,
    );

    return Response.json(updatedResource, {
      status: 200,
    });
  },
);

export const DELETE = authMiddleware(
  async (_request: Request, { params }: { params: Params }) => {
    await deleteResource(params.installationId, params.resourceId);

    return new Response(null, {
      status: 204,
    });
  },
);
