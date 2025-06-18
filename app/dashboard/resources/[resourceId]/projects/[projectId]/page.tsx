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
import Link from "next/link";
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
      <h1 className="text-xl font-bold">
        <Link href="/dashboard" className="text-blue-500 underline">
          Dashboard
        </Link>{" "}
        &gt; {resource.name} &gt; {project.name}
      </h1>

      <ResourceCard resource={resource} />

      {checks && (
        <div>
          <h2 className="text-l font-bold">Checks</h2>
          {checks?.map((check) => (
            <CheckCard
              key={check.id}
              check={check}
              selected={check.id === checkId}
            />
          ))}
        </div>
      )}
      <Section title="Create check">
        <form action={createCheckFormSubmit}>
          <input type="hidden" name="resourceId" value={resource.id} />
          <input type="hidden" name="projectId" value={project.id} />
          <div className="space-y-4">
            <div className="flex flex-col">
              <label>Name</label>
              <input
                type="text"
                name="name"
                className="border border-1 border-slate-400"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label>Is Rerequestable</label>
              <input type="checkbox" name="is-rerequestable" />
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
                type="text"
                name="target"
                className="border border-1 border-slate-400"
                placeholder="Comma-separated list of targets, e.g. preview, production"
                value="preview,production"
              />
            </div>
            <div className="flex flex-col">
              <label>Timeout</label>
              <input
                type="number"
                name="timeout"
                className="border border-1 border-slate-400"
              />
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
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

function CheckCard({ check, selected }: { check: Check; selected: boolean }) {
  return (
    <div
      className={`${selected ? "bg-green-100" : "bg-white"} rounded-lg shadow-md p-4`}
    >
      <span className="text-gray-600 text-sm">ID: {check.id}</span>
      <div className="text-lg font-medium mb-2">{check.name}</div>
      <details className="mt-4">
        <summary>JSON</summary>
        <pre className="overflow-scroll">
          <code>{JSON.stringify(check, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}
