import { installIntegration, uninstallIntegration } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { authMiddleware } from "@/lib/vercel/auth";
import { installIntegrationRequestSchema } from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
}

export const PUT = authMiddleware(
  async (request: Request, { params }: { params: Params }) => {
    const requestBody = await readRequestBodyWithSchema(
      request,
      installIntegrationRequestSchema,
    );

    if (!requestBody.success) {
      return new Response(null, { status: 400 });
    }

    await installIntegration(params.installationId, requestBody.data);

    return new Response(null, { status: 201 });
  },
);

export const DELETE = authMiddleware(
  async (_request: Request, { params }: { params: Params }) => {
    await uninstallIntegration(params.installationId);
    return new Response(null, { status: 204 });
  },
);
