import { listResources, provisionResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { Resource, provisionResourceRequestSchema } from "@/lib/vercel/schemas";

export const dynamic = "force-dynamic";

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

export const GET = withAuth(async (claims, request) => {
  const ids = request.nextUrl.searchParams.getAll("ids");
  const resources = await listResources(claims.installation_id, ids);
  if (resources.resources[0]) {
    resources.resources[0].notification = notificationsMock[0];
  }
  if (resources.resources[1]) {
    resources.resources[1].notification = notificationsMock[1];
  }
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

  const resource = await provisionResource(
    claims.installation_id,
    requestBody.data
  );

  return Response.json(resource, {
    status: 201,
  });
});
