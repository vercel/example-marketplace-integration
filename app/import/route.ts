import {
  ResourceImportError,
  startResourceImport,
} from "@/lib/partner/resource-import";

export const dynamic = "force-dynamic";

// Import Resource URL. Configure it in the Integrations Console as
// https://<your-host>/import.
export async function GET(request: Request): Promise<Response> {
  try {
    const importRequest = await startResourceImport(
      new URL(request.url).searchParams,
    );
    return Response.redirect(
      new URL(`/import/${importRequest.id}`, request.url),
      303,
    );
  } catch (error) {
    if (error instanceof ResourceImportError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: 400 },
      );
    }
    throw error;
  }
}
