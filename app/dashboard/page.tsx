import { getInstallation, listResources } from "@/lib/partner";
import Link from "next/link";
import { getSession } from "./auth";
import { getAccountInfo } from "@/lib/vercel/api";

export default async function Home() {
  const session = await getSession();

  const [{ resources }, installation, account] = await Promise.all([
    listResources(session.installation_id),
    getInstallation(session.installation_id),
    getAccountInfo(session.installation_id),
  ]);

  return (
    <main className="space-y-8">
      <h1 className="text-xl font-bold">{`${account.name}'s`} Dashboard</h1>
      <div>
        <Link href="/dashboard/invoices" className="text-blue-500 underline">
          Invoices
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Resources</h2>

          {resources.length ? (
            <ul className="list-disc ml-6 space-y-2">
              {resources.map((resource) => (
                <li key={resource.id}>
                  <Link
                    href={`/dashboard/resources/${resource.id}`}
                    className="text-blue-500 underline"
                  >
                    {resource.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex justify-center items-center h-[100px]">
              <span className="text-slate-500">No resources</span>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Account</h2>
          <pre className="overflow-scroll">
            <code>{JSON.stringify(account, null, 2)}</code>
          </pre>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Session</h2>
          <pre className="overflow-scroll">
            <code>{JSON.stringify(session, null, 2)}</code>
          </pre>
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Installation</h2>
          <pre className="overflow-scroll">
            <code>{JSON.stringify(installation, null, 2)}</code>
          </pre>
        </div>
      </div>
    </main>
  );
}
