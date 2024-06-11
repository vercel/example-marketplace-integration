import { getInstallation } from "@/lib/partner";
import { getSession } from "../auth";
import { getAccountInfo } from "@/lib/vercel/api";
import { Section } from "../components/section";

export default async function IntallationPage() {
  const session = await getSession();

  const [installation, account] = await Promise.all([
    getInstallation(session.installation_id),
    getAccountInfo(session.installation_id),
  ]);

  return (
    <main className="space-y-8">
      <Section title="Session">
        <pre className="overflow-scroll">
          <code>{JSON.stringify(session, null, 2)}</code>
        </pre>
      </Section>
      <Section title="Installation">
        <pre className="overflow-scroll">
          <code>{JSON.stringify(installation, null, 2)}</code>
        </pre>
      </Section>
      <Section title="Account">
        <pre className="overflow-scroll">
          <code>{JSON.stringify(account, null, 2)}</code>
        </pre>
      </Section>
    </main>
  );
}
