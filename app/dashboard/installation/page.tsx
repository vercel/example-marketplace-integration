import { getInstallation, getInstallationBalance } from "@/lib/partner";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { getSession } from "../auth";
import { FormButton } from "../components/form-button";
import { Section } from "../components/section";
import {
  addInstallationBalance,
  clearResourceNotificationAction,
  sendBillingDataAction,
  setExampleNotificationAction,
  updateNotificationAction,
} from "./actions";

export const dynamic = "force-dynamic";

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

      <Section title="Submit Billing Data">
        <form action={sendBillingDataAction} className="p-2">
          <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
            Submit
          </FormButton>
        </form>
      </Section>

      <Section title="Notification">
        <div>
          <div className="flex gap-2">
            <form action={setExampleNotificationAction}>
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Example
              </FormButton>
            </form>
            <form action={clearResourceNotificationAction}>
              <FormButton
                className="rounded bg-red-500 px-2 py-1 text-white disabled:opacity-50"
                disabled={!installation.notification}
              >
                Clear
              </FormButton>
            </form>
          </div>
        </div>

        <form action={updateNotificationAction}>
          <div className="space-y-4">
            <label className="flex flex-col">
              <span>Title</span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={installation.notification?.title}
                name="title"
                required
                type="text"
              />
            </label>
            <label className="flex flex-col">
              <span>Message</span>
              <input
                className="border border-1 border-slate-400"
                defaultValue={installation.notification?.message}
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
                defaultValue={installation.notification?.href}
                name="href"
                type="text"
              />
            </label>
            <label>
              <span>Level:</span>
              <select
                defaultValue={installation.notification?.level}
                name="level"
              >
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
