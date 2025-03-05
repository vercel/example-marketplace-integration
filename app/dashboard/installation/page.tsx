import { getInstallation, getInstallationBalance } from "@/lib/partner";
import { getSession } from "../auth";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { Section } from "../components/section";
import { addInstallationBalance } from "./actions";
import { FormButton } from "../components/form-button";

export default async function IntallationPage() {
  const session = await getSession();

  const [installation, account] = await Promise.all([
    getInstallation(session.installation_id),
    getAccountInfo(session.installation_id),
  ]);

  const balance = await getInstallationBalance(session.installation_id);

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
        <form action={addInstallationBalance} className="p-2">
          <div className="space-y-4">
            <div className="flex flex-col">
              <label>Add credit value in cents</label>
              <input
                type="number"
                name="currencyValueInCents"
                className="border border-1 border-slate-400"
                defaultValue={10_00}
              />
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Add Balance
              </FormButton>
            </div>
          </div>
        </form>
      </Section>
    </main>
  );
}
