import { getResource } from "@/lib/partner";
import Link from "next/link";
import {
  clearResourceNotificationAction,
  rotateCredentialsAction,
  setExampleNotificationAction,
  updateResourceAction,
  updateResourceNotificationAction,
} from "./actions";
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
          <pre className="overflow-scroll">
            <code>{JSON.stringify(resource, null, 2)}</code>
          </pre>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between">
            <h3 className="text-xl font-bold">Notification</h3>
            <div className="flex gap-2">
              <form action={setExampleNotificationAction}>
                <input type="hidden" name="resourceId" value={resource.id} />
                <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                  Example
                </FormButton>
              </form>
              <form action={clearResourceNotificationAction}>
                <input type="hidden" name="resourceId" value={resource.id} />
                <FormButton
                  className="rounded bg-red-500 text-white px-2 py-1 disabled:opacity-50"
                  disabled={!resource.notification}
                >
                  Clear
                </FormButton>
              </form>
            </div>
          </div>
          <form action={updateResourceNotificationAction}>
            <input type="hidden" name="resourceId" value={resource.id} />
            <div className="space-y-4">
              <div className="flex flex-col">
                <label>Title</label>
                <input
                  type="text"
                  name="title"
                  className="border border-1 border-slate-400"
                  defaultValue={resource.notification?.title}
                  required
                />
              </div>
              <div className="flex flex-col">
                <label>Message</label>
                <input
                  type="text"
                  name="message"
                  className="border border-1 border-slate-400"
                  defaultValue={resource.notification?.message}
                />
              </div>
              <div className="flex flex-col">
                <label>
                  URL (<code>href</code>)
                </label>
                <input
                  type="text"
                  name="href"
                  className="border border-1 border-slate-400"
                  defaultValue={resource.notification?.href}
                />
              </div>
              <div className="flex flex-col">
                <label>Level</label>
                <select
                  name="level"
                  defaultValue={resource.notification?.level}
                >
                  <option value="info">info</option>
                  <option value="warn">warn</option>
                  <option value="error">error</option>
                </select>
              </div>
              <div className="flex justify-end">
                <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                  Save
                </FormButton>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
