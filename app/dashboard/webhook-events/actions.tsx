"use server";

import { DeploymentIntegrationActionStartEvent } from "@/lib/vercel/schemas";
import { getSession } from "../auth";
import {
  updateDeploymentAction,
  getDeployment,
} from "@/lib/vercel/marketplace-api";

export async function succeedAction(
  event: DeploymentIntegrationActionStartEvent,
): Promise<void> {
  await getSession();

  const { payload } = event;

  const deployment = await getDeployment(
    event.payload.installationId,
    event.payload.deployment.id,
  );

  const newSecret = `Value set in action for ${deployment.id}, branch ${deployment.gitSource?.ref}, sha ${deployment.gitSource?.sha}`;

  await updateDeploymentAction({
    deploymentId: payload.deployment.id,
    installationId: payload.installationId,
    resourceId: payload.resourceId,
    action: payload.action,
    status: "succeeded",
    outcomes: [
      {
        kind: "resource-secrets",
        secrets: [
          {
            name: "TOP_SECRET",
            value: newSecret,
          },
        ],
      },
    ],
  });
}

export async function failAction(
  event: DeploymentIntegrationActionStartEvent,
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
