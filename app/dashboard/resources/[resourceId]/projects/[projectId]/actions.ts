"use server";

import { getSession } from "@/app/dashboard/auth";
import { createCheck } from "@/lib/vercel/marketplace-api";

export const createCheckFormSubmit = async (
  formData: FormData
): Promise<void> => {
  const session = await getSession();
  const deploymentId = formData.get("deploymentId") as string;
  const name = formData.get("name") as string;
  const blocking = formData.get("blocking") === "on";
  const rerequestable = formData.get("rerequestable") === "on";

  await createCheck(session.installation_id, deploymentId, name, {
    blocking,
    rerequestable,
  });
};
