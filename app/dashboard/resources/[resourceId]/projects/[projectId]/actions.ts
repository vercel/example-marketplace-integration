"use server";

import { getSession } from "@/app/dashboard/auth";
import { fetchVercelApi } from "@/lib/vercel/api";

export async function createCheck(formData: FormData): Promise<void> {
  const session = await getSession();
  const projectId = formData.get("projectId") as string;

  const name = formData.get("name") as string;
  const isRerequestable = formData.get("is-rerequestable");
  const requires = formData.get("requires") as string;
  const blocks = formData.get("blocks") as string;
  const target = formData.get("target") as string;
  const timeout = formData.get("timeout") as string;

  console.log({ name, isRerequestable, requires, blocks, target, timeout });
  await fetchVercelApi(`/v2/projects/${projectId}/checks`, {
    method: "POST",
    installationId: session.installation_id,
    data: {
      name,
      isRerequestable: isRerequestable === "on",
      requires,
      blocks,
      timeout,
    },
  });
}
