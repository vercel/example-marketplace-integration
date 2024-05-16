import { getResource } from "@/lib/partner";
import Link from "next/link";
import { rotateCredentialsAction, updateResourceAction } from "./actions";
import { getSession } from "../../auth";
import { getAccountInfo } from "@/lib/vercel/api";
import { FormButton } from "./form-button";

export default async function Home({
  params: { resourceId },
}: {
  params: { resourceId: string };
}) {
  const session = await getSession();
  const [resource, account] = await Promise.all([
    await getResource(session.installation_id, resourceId),
    await getAccountInfo(session.installation_id),
  ]);

  if (!resource) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  return (
    <main className="space-y-8">
      <h1 className="text-xl font-bold">
        <Link href="/dashboard" className="text-blue-500 underline">
          {`${account.name}'s`} Dashboard
        </Link>{" "}
        &gt; {resource.name}
      </h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Edit Resource</h3>
          <form action={updateResourceAction}>
            <input type="hidden" name="resourceId" value={resource.id} />
            <div className="space-y-4">
              <div className="flex flex-col">
                <label>Name</label>
                <input
                  type="text"
                  name="name"
                  className="border border-1 border-slate-400"
                  defaultValue={resource.name}
                />
              </div>
              <div className="flex justify-end">
                <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                  Save
                </FormButton>
              </div>
            </div>
          </form>
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Actions</h3>
          <div>
            <form action={rotateCredentialsAction}>
              <input type="hidden" name="resourceId" value={resource.id} />
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Rotate Credentials
              </FormButton>
            </form>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Resource</h3>
          <pre>
            <code>{JSON.stringify(resource, null, 2)}</code>
          </pre>
        </div>
      </div>
    </main>
  );
}
