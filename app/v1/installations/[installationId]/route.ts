import {
  getAllBillingPlans,
  getInstallation,
  getInstallationtBillingPlans,
  installIntegration,
  uninstallIntegration,
  updateInstallation,
} from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import {
  installIntegrationRequestSchema,
  updateInstallationRequestSchema,
} from "@/lib/vercel/schemas";

interface Params {
  installationId: string;
}

export const PUT = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    installIntegrationRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  console.log("installIntegration body: ", requestBody.data);

  await installIntegration(claims.installation_id, {
    type: "marketplace",
    ...requestBody.data,
  });

  return new Response(null, { status: 201 });
});

export const DELETE = withAuth(async (claims) => {
  await uninstallIntegration(claims.installation_id);

  return new Response(null, { status: 204 });
});

export const GET = withAuth(async (claims) => {
  const installation = await getInstallation(claims.installation_id);
  const billingPlans = await getAllBillingPlans(claims.installation_id);
  const billingPlan = billingPlans.plans.find(
    (plan) => plan.id === installation.billingPlanId
  );
  return Response.json({
    billingPlan: {
      ...billingPlan,
      scope: "installation",
    },
  });
});

export const PATCH = withAuth(async (claims, request) => {
  const requestBody = await readRequestBodyWithSchema(
    request,
    updateInstallationRequestSchema
  );

  if (!requestBody.success) {
    return new Response(null, { status: 400 });
  }

  await updateInstallation(
    claims.installation_id,
    requestBody.data.billingPlanId
  );

  return new Response(null, { status: 204 });
});
