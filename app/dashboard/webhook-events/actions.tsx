"use server";

import {
  getDeployment,
  updateCheck,
  updateDeploymentAction,
} from "@/lib/vercel/marketplace-api";
import type {
  DeploymentCheckrunStartEventSchema,
  DeploymentIntegrationActionStartEvent,
} from "@/lib/vercel/schemas";
import { getSession } from "../auth";

export const succeedAction = async (
  event: DeploymentIntegrationActionStartEvent
): Promise<void> => {
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
};

export const failAction = async (
  event: DeploymentIntegrationActionStartEvent
): Promise<void> => {
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
};

export const succeedCheck = async (
  event: DeploymentCheckrunStartEventSchema
): Promise<void> => {
  await getSession();

  const { payload } = event;
  const { checkRun } = payload;
  const installationId = checkRun.source.integrationConfigurationId;

  const _deployment = await getDeployment(
    installationId,
    payload.deployment.id
  );

  await updateCheck(installationId, payload.deployment.id, checkRun.id, {
    status: "completed",
    conclusion: "succeeded",
    detailsUrl: `sso:/checks/${checkRun.id}`,
  });
};

export const failCheck = async (
  event: DeploymentCheckrunStartEventSchema
): Promise<void> => {
  await getSession();

  const { payload } = event;
  const { checkRun } = payload;
  const installationId = checkRun.source.integrationConfigurationId;

  await updateCheck(installationId, payload.deployment.id, checkRun.id, {
    status: "completed",
    conclusion: "failed",
    detailsUrl: `sso:/checks/${checkRun.id}`,
  });
};
