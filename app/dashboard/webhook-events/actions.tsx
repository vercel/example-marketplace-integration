"use server";

import {
  getDeployment,
  updateCheckRun,
  updateDeploymentAction,
} from "@/lib/vercel/marketplace-api";
import type {
  DeploymentCheckrunStartEventSchema,
  DeploymentIntegrationActionStartEvent,
} from "@/lib/vercel/schemas";
import { getSession } from "../auth";

export async function succeedAction(
  event: DeploymentIntegrationActionStartEvent
): Promise<void> {
  await getSession();

  const { payload } = event;

  const deployment = await getDeployment(
    event.payload.installationId,
    event.payload.deployment.id
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

export async function succeedCheck(
  event: DeploymentCheckrunStartEventSchema
): Promise<void> {
  await getSession();

  const { payload } = event;
  const { checkRun } = payload;
  const installationId = checkRun.source.integrationConfigurationId;

  const deployment = await getDeployment(installationId, payload.deployment.id);

  await updateCheckRun(installationId, checkRun.id, payload.deployment.id, {
    status: "completed",
    conclusion: "succeeded",
    externalUrl: `sso:/checks/${checkRun.id}`,
  });
}

export async function failCheck(
  event: DeploymentCheckrunStartEventSchema
): Promise<void> {
  await getSession();

  const { payload } = event;
  const { checkRun } = payload;
  const installationId = checkRun.source.integrationConfigurationId;

  await updateCheckRun(installationId, checkRun.id, payload.deployment.id, {
    status: "completed",
    conclusion: "failed",
    externalUrl: `sso:/checks/${checkRun.id}`,
  });
}
