import Link from "next/link";
import { getSession } from "@/app/dashboard/auth";
import { FormButton } from "@/app/dashboard/components/form-button";
import { Section } from "@/app/dashboard/components/section";
import { getResource } from "@/lib/partner";
import {
  type Check,
  getAccountInfo,
  getProject,
  getProjectChecks,
} from "@/lib/vercel/marketplace-api";
import type { Resource } from "@/lib/vercel/schemas";
import { createCheckFormSubmit } from "./actions";

export default async function ResourcePage({
  params: { resourceId, projectId },
  searchParams: { checkId },
}: {
  params: { resourceId: string; projectId: string };
  searchParams: { checkId: string };
}) {
  const session = await getSession();
  const installationId = session.installation_id;
  const [resource, account, project, checks] = await Promise.all([
    await getResource(installationId, resourceId),
    await getAccountInfo(installationId),
    await getProject(installationId, projectId),
    await getProjectChecks(installationId, projectId),
  ]);

  if (!resource) {
    throw new Error(`Resource ${resourceId} not found`);
  }

  return (
    <main className="space-y-8">
      <h1 className="font-bold text-xl">
        <Link className="text-blue-500 underline" href="/dashboard">
          Dashboard
        </Link>{" "}
        &gt; {resource.name} &gt; {project.name}
      </h1>

      <ResourceCard resource={resource} />

      {checks && (
        <div>
          <h2 className="font-bold text-l">Checks</h2>
          {checks?.map((check) => (
            <CheckCard
              check={check}
              key={check.id}
              selected={check.id === checkId}
            />
          ))}
        </div>
      )}
      <Section title="Create check">
        <form action={createCheckFormSubmit}>
          <input name="resourceId" type="hidden" value={resource.id} />
          <input name="projectId" type="hidden" value={project.id} />
          <div className="space-y-4">
            <div className="flex flex-col">
              <label>Name</label>
              <input
                className="border border-1 border-slate-400"
                name="name"
                type="text"
              />
            </div>
            <div className="flex items-center gap-2">
              <label>Is Rerequestable</label>
              <input name="is-rerequestable" type="checkbox" />
            </div>
            <div className="flex flex-row gap-2">
              <label>Requires</label>
              <select name="requires">
                <option selected value="build-ready">
                  Build ready
                </option>
                <option value="deployment-url">Deployment url</option>
              </select>
            </div>
            <div className="flex flex-row gap-2">
              <label>Blocks</label>
              <select name="blocks">
                <option value="none">None</option>
                <option value="deployment-alias">Deployment alias</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label>Targets</label>
              <input
                className="border border-1 border-slate-400"
                name="target"
                placeholder="Comma-separated list of targets, e.g. preview, production"
                type="text"
                value="preview,production"
              />
            </div>
            <div className="flex flex-col">
              <label>Timeout</label>
              <input
                className="border border-1 border-slate-400"
                name="timeout"
                type="number"
              />
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Create
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

function CheckCard({ check, selected }: { check: Check; selected: boolean }) {
  return (
    <div
      className={`${selected ? "bg-green-100" : "bg-white"} rounded-lg p-4 shadow-md`}
    >
      <span className="text-gray-600 text-sm">ID: {check.id}</span>
      <div className="mb-2 font-medium text-lg">{check.name}</div>
      <details className="mt-4">
        <summary>JSON</summary>
        <pre className="overflow-scroll">
          <code>{JSON.stringify(check, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}
