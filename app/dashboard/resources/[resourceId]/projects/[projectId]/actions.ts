"use server";

import { getSession } from "@/app/dashboard/auth";
import { fetchVercelApi } from "@/lib/vercel/api";
import { createCheck } from "@/lib/vercel/marketplace-api";

export async function createCheckFormSubmit(formData: FormData): Promise<void> {
  const session = await getSession();
  const projectId = formData.get("projectId") as string;

  const name = formData.get("name") as string;
  const isRerequestable = formData.get("is-rerequestable") as string;
  const requires = formData.get("requires") as string;
  const blocks = formData.get("blocks") as string;
  const target = formData.get("target") as string;
  const timeout = formData.get("timeout") as string;

  createCheck(
    session.installation_id,
    projectId,
    name,
    isRerequestable,
    requires,
    blocks,
    target,
    Number(timeout),
  );
}
