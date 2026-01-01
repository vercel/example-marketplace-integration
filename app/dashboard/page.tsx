import { getResourceBalance, listResources } from "@/lib/partner";
import type { Resource } from "@/lib/vercel/schemas";
import { getSession } from "./auth";

export default async function DashboardPage() {
  return (
    <main className="space-y-8">
      <Resources />
    </main>
  );
}

async function Resources() {
  const session = await getSession();
  const installationId = session.installation_id;
  const { resources } = await listResources(installationId);

  // {/* grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 */}
  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-4 font-bold text-2xl">Resources</h1>

      {resources.length === 0 ? (
        <div className="flex h-[100px] items-center justify-center">
          <span className="text-slate-500">No resources</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {resources.map((resource) => (
            <ResourceCard
              installationId={installationId}
              key={resource.id}
              resource={resource}
            />
          ))}
        </div>
      )}
    </div>
  );
}

async function ResourceCard({
  installationId,
  resource,
}: {
  installationId: string;
  resource: Resource;
}) {
  const balance = await getResourceBalance(installationId, resource.id);
  return (
    <a
      className="rounded-lg bg-white p-4 shadow-md"
      href={`/dashboard/resources/${resource.id}`}
    >
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
      {balance ? (
        <p className="text-gray-600 text-sm">
          Balance: {balance.currencyValueInCents} cents
        </p>
      ) : null}
    </a>
  );
}
