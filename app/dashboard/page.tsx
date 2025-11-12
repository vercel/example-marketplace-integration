import { getResourceBalance, listResources } from "@/lib/partner";
import { getSession } from "./auth";
import { Resource } from "@/lib/vercel/schemas";

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
      <h1 className="text-2xl font-bold mb-4">Resources</h1>

      {resources.length === 0 ? (
        <div className="flex justify-center items-center h-[100px]">
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
      className="bg-white rounded-lg shadow-md p-4"
      href={`/dashboard/resources/${resource.id}`}
    >
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
      {balance ? (
        <p className="text-gray-600 text-sm">
          Balance: {balance.currencyValueInCents} in cents
        </p>
      ) : null}
    </a>
  );
}
