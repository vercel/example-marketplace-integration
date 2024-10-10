"use server";

import { DeploymentIntegrationActionStartEvent } from "@/lib/vercel/schemas";
import { getSession } from "../auth";
import { updateDeploymentAction } from "@/lib/vercel/marketplace-api";

export async function succeedAction(
  event: DeploymentIntegrationActionStartEvent
): Promise<void> {
  await getSession();

  const { payload } = event;
  await updateDeploymentAction({
    deploymentId: payload.deployment.id,
    installationId: payload.installationId,
    resourceId: payload.resourceId,
    action: payload.action,
    status: "succeeded",
  });
}

export async function failAction(
  event: DeploymentIntegrationActionStartEvent
): Promise<void> {
  await getSession();

  const { payload } = event;
  await updateDeploymentAction({
    deploymentId: payload.deployment.id,
    installationId: payload.installationId,
    resourceId: payload.resourceId,
    action: payload.action,
    status: "failed",
    statusText: "Failed somehow",
  });
}
