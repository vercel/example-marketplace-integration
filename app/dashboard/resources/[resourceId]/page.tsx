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
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { FormButton } from "../../components/form-button";
import { Resource } from "@/lib/vercel/schemas";
import { Section } from "../../components/section";

export default async function ResourcePage({
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
          Dashboard
        </Link>{" "}
        &gt; {resource.name}
      </h1>

      <ResourceCard resource={resource} />

      <Section title="Edit Resource">
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
            <div className="flex flex-row gap-1">
              <label>Status: </label>

              <select name="status" defaultValue={resource.status}>
                <option selected value="ready">
                  Ready
                </option>
                <option value="error">Error</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Save
              </FormButton>
            </div>
          </div>
        </form>
      </Section>

      <Section title="Actions">
        <form action={rotateCredentialsAction}>
          <input type="hidden" name="resourceId" value={resource.id} />
          <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
            Rotate Credentials
          </FormButton>
        </form>
      </Section>

      <Section title="Notification">
        <div>
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
            <div>
              <label>Level:</label>
              <select name="level" defaultValue={resource.notification?.level}>
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
      </Section>
    </main>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-600 text-sm">ID: {resource.id}</span>
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            resource.status === "ready"
              ? " bg-green-200 text-green-800"
              : " bg-red-200 text-red-800"
          }`}
        >
          {resource.status}
        </span>
      </div>
      <h2 className="text-lg font-medium mb-2">{resource.name}</h2>
      <p className="text-gray-600 text-sm mb-2">
        Product: {resource.productId}
      </p>
      <p className="text-gray-600 text-sm">
        Billing Plan: {resource.billingPlan?.name}
      </p>
      <details className="mt-4">
        <summary>JSON</summary>
        <pre className="overflow-scroll">
          <code>{JSON.stringify(resource, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}
