import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/app/dashboard/auth";
import { FormButton } from "@/app/dashboard/components/form-button";
import { Section } from "@/app/dashboard/components/section";
import { getResource } from "@/lib/partner";
import { getProject } from "@/lib/vercel/marketplace-api";
import type { Resource } from "@/lib/vercel/schemas";
import { createCheckFormSubmit } from "./actions";

const ResourceProjectPage = async (
  props: PageProps<"/dashboard/resources/[resourceId]/projects/[projectId]">
) => {
  const { resourceId, projectId } = await props.params;
  const session = await getSession();
  const installationId = session.installation_id;
  const [resource, project] = await Promise.all([
    getResource(installationId, resourceId),
    getProject(installationId, projectId),
  ]);

  if (!resource) {
    notFound();
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

      <Section title="Create check on deployment">
        <p className="mb-4 text-gray-600 text-sm">
          Checks are created per deployment. Enter a deployment ID to create a
          check.
        </p>
        <form action={createCheckFormSubmit}>
          <div className="space-y-4">
            <div className="flex flex-col">
              <label htmlFor="deploymentId">Deployment ID</label>
              <input
                className="border border-slate-400"
                id="deploymentId"
                name="deploymentId"
                required
                type="text"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="name">Name</label>
              <input
                className="border border-slate-400"
                id="name"
                name="name"
                required
                type="text"
              />
            </div>
            <div className="flex items-center gap-2">
              <input id="blocking" name="blocking" type="checkbox" />
              <label htmlFor="blocking">Blocking</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="rerequestable" name="rerequestable" type="checkbox" />
              <label htmlFor="rerequestable">Rerequestable</label>
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
};

const ResourceCard = ({ resource }: { resource: Resource }) => (
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
    <p className="mb-2 text-gray-600 text-sm">Product: {resource.productId}</p>
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

export default ResourceProjectPage;
