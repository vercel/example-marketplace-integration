import Link from "next/link";
import { getResource, getResourceBalance } from "@/lib/partner";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import type { Resource } from "@/lib/vercel/schemas";
import { getSession } from "../../auth";
import { FormButton } from "../../components/form-button";
import { Section } from "../../components/section";
import {
  addResourceBalance,
  clearResourceNotificationAction,
  cloneResourceAction,
  importResourceToVercelAction,
  rotateCredentialsAction,
  setExampleNotificationAction,
  updateResourceAction,
  updateResourceNotificationAction,
} from "./actions";

export default async function ResourcePage({
  params: { resourceId },
}: {
  params: { resourceId: string };
}) {
  const session = await getSession();
  const installationId = session.installation_id;
  const [resource, _account] = await Promise.all([
    await getResource(installationId, resourceId),
    await getAccountInfo(installationId),
  ]);

  if (!resource) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  const balance = await getResourceBalance(installationId, resource.id);

  return (
    <main className="space-y-8">
      <h1 className="font-bold text-xl">
        <Link className="text-blue-500 underline" href="/dashboard">
          Dashboard
        </Link>{" "}
        &gt; {resource.name}
      </h1>

      <ResourceCard resource={resource} />

      <Section title="Edit Resource">
        <form action={updateResourceAction}>
          <input name="resourceId" type="hidden" value={resource.id} />
          <div className="space-y-4">
            <label className="flex flex-col">
              <span>Name</span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={resource.name}
                name="name"
                type="text"
              />
            </label>
            <label className="flex flex-row gap-1">
              <span>Status: </span>
              <select defaultValue={resource.status} name="status">
                <option selected value="ready">
                  Ready
                </option>
                <option value="error">Error</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
                <option value="onboarding">Onboarding</option>
              </select>
            </label>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Save
              </FormButton>
            </div>
          </div>
        </form>
      </Section>

      <Section title="Balance">
        <div className="p-2">
          {balance ? (
            <div className="flex gap-2">
              <span>Balance: {balance.currencyValueInCents}</span>
              <span>Credit: {balance.credit}</span>
              <span>Name: {balance.nameLabel}</span>
            </div>
          ) : (
            <div>No balance</div>
          )}
        </div>
        <form action={addResourceBalance} className="p-2">
          <input name="resourceId" type="hidden" value={resource.id} />
          <div className="space-y-4">
            <label className="flex flex-col">
              <span>Add credit value in cents</span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={1000}
                name="currencyValueInCents"
                type="number"
              />
            </label>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Add Balance
              </FormButton>
            </div>
          </div>
        </form>
      </Section>

      <Section title="Actions">
        <form action={cloneResourceAction} className="p-2">
          <input name="resourceId" type="hidden" value={resource.id} />
          <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
            Clone Resource
          </FormButton>
        </form>
        <form action={rotateCredentialsAction} className="p-2">
          <input name="resourceId" type="hidden" value={resource.id} />
          <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
            Rotate Credentials
          </FormButton>
        </form>
        <form action={importResourceToVercelAction} className="p-2">
          <input name="resourceId" type="hidden" value={resource.id} />
          <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
            Import Resource to Vercel
          </FormButton>
        </form>
      </Section>

      <Section title="Notification">
        <div>
          <div className="flex gap-2">
            <form action={setExampleNotificationAction}>
              <input name="resourceId" type="hidden" value={resource.id} />
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Example
              </FormButton>
            </form>
            <form action={clearResourceNotificationAction}>
              <input name="resourceId" type="hidden" value={resource.id} />
              <FormButton
                className="rounded bg-red-500 px-2 py-1 text-white disabled:opacity-50"
                disabled={!resource.notification}
              >
                Clear
              </FormButton>
            </form>
          </div>
        </div>

        <form action={updateResourceNotificationAction}>
          <input name="resourceId" type="hidden" value={resource.id} />
          <div className="space-y-4">
            <label className="flex flex-col">
              <span>Title</span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={resource.notification?.title}
                name="title"
                required
                type="text"
              />
            </label>
            <label className="flex flex-col">
              <span>Message</span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={resource.notification?.message}
                name="message"
                type="text"
              />
            </label>
            <label className="flex flex-col">
              <span>
                URL (<code>href</code>)
              </span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={resource.notification?.href}
                name="href"
                type="text"
              />
            </label>
            <label>
              <span>Level:</span>
              <select defaultValue={resource.notification?.level} name="level">
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </label>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
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
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-gray-600 text-sm">ID: {resource.id}</span>
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            resource.status === "ready"
              ? "bg-green-200 text-green-800"
              : "bg-red-200 text-red-800"
          }`}
        >
          {resource.status}
        </span>
      </div>
      <h2 className="mb-2 font-medium text-lg">{resource.name}</h2>
      <p className="mb-2 text-gray-600 text-sm">
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
