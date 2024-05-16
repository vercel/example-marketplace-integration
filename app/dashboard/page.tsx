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
      <div className="space-y-4">
        <h2 className="text-md">Resources</h2>
        <ul className="list-disc ml-6 space-y-2">
          {resources.map((resource) => (
            <li key={resource.id}>
              <Link href={`/dashboard/resources/${resource.id}`}>
                {resource.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-xl font-bold">Session</h2>
        <code>
          <pre>{JSON.stringify(session, null, 2)}</pre>
        </code>
      </div>
      <div>
        <h2 className="text-xl font-bold">Installation</h2>
        <code>
          <pre>{JSON.stringify(installation, null, 2)}</pre>
        </code>
      </div>
    </main>
  );
}
