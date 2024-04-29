import { getResource } from "@/lib/partner";
import Link from "next/link";
import { rotateCredentialsAction, updateResourceAction } from "./actions";
import { getSession } from "../../auth";

export default async function Home({
  params: { resourceId },
}: {
  params: { resourceId: string };
}) {
  const session = await getSession();
  const resource = await getResource(session.installation_id, resourceId);

  if (!resource) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  return (
    <main className="space-y-8">
      <h1 className="text-xl font-bold">
        <Link href="/dashboard">My Dashboard</Link> &gt; Resource:{" "}
        {resource.name}
      </h1>
      <form action={updateResourceAction}>
        <input type="hidden" name="resourceId" value={resource.id} />
        <div className="space-y-4 max-w-[200px]">
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
            <button className="rounded bg-blue-500 text-white px-2 py-1">
              Save
            </button>
          </div>
        </div>
      </form>
      <div>
        <h1>Actions</h1>
        <div>
          <form action={rotateCredentialsAction}>
            <button>Rotate Credentials</button>
          </form>
        </div>
      </div>
      <div className="space-y-4">
        <code>
          <pre>{JSON.stringify(resource, null, 2)}</pre>
        </code>
      </div>
    </main>
  );
}
