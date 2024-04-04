import { listResources, provisionResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { authMiddleware } from "@/lib/vercel/auth";
import { provisionResourceRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
}

export const GET = authMiddleware(
  async (_request: Request, { params }: { params: Params }) => {
    const response = await listResources(params.installationId);
    return Response.json(response);
  },
);

export const POST = authMiddleware(
  async (request: Request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      provisionResourceRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    const resource = await provisionResource(
      params.installationId,
      requestBody.data,
    );

    return Response.json(resource, {
      status: 201,
    });
  },
);
