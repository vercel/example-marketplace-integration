import {
  getInstallation,
  getInstallationBalance,
  resolveParent,
} from "@/lib/partner";
import {
  getParentAttributionStatus,
  getParentRelationFailureCounts,
  listChildInstallations,
} from "@/lib/partner/parent-relations";
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

  const installation = await getInstallation(session.installation_id);
  const [account, children, parentAttribution, parent, relationFailures] =
    await Promise.all([
      getAccountInfo(session.installation_id),
      listChildInstallations(session.installation_id),
      getParentAttributionStatus(session.installation_id),
      resolveParent(installation),
      getParentRelationFailureCounts(session.installation_id),
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

      {parent.state !== "none" ? (
        <Section title="Organization Parent">
          <dl className="grid grid-cols-[180px_1fr] gap-2 p-2">
            <dt>Relation state</dt>
            <dd>
              {parent.state === "resolved"
                ? "Resolved"
                : parent.reason === "missing_parent_installation_id"
                  ? "Invalid: parent relation has no parent installation ID"
                  : "Invalid: parent installation record is missing"}
            </dd>
            <dt>Parent account ID</dt>
            <dd>{parent.relation.parentAccountId ?? "Missing"}</dd>
            <dt>Parent installation ID</dt>
            <dd>{parent.relation.parentInstallationId ?? "Missing"}</dd>
            <dt>Parent account</dt>
            <dd>{parent.relation.parentAccount?.name ?? "Not provided"}</dd>
            <dt>Parent-selected plan</dt>
            <dd>
              {parent.state === "resolved"
                ? (parent.parentPlanId ?? "No plan selected")
                : "Unavailable"}
            </dd>
            <dt>Missing attribution</dt>
            <dd>{parentAttribution.missingCount} requests</dd>
            <dt>Mismatched attribution</dt>
            <dd>{parentAttribution.mismatchCount} requests</dd>
            <dt>Refused: no parent installation ID</dt>
            <dd>{relationFailures.missing_parent_installation_id} requests</dd>
            <dt>Refused: parent record missing</dt>
            <dd>{relationFailures.parent_record_missing} requests</dd>
          </dl>
          {parentAttribution.lastIssue ? (
            <pre className="overflow-scroll p-2">
              <code>
                {JSON.stringify(parentAttribution.lastIssue, null, 2)}
              </code>
            </pre>
          ) : null}
        </Section>
      ) : null}

      {children.length > 0 ? (
        <Section title={`Organization Children (${children.length})`}>
          <div className="divide-y">
            {children.map((child) => (
              <div
                className="grid grid-cols-[1fr_auto] gap-4 p-2"
                key={child.installationId}
              >
                <div>
                  <div className="font-medium">
                    {child.accountName ?? child.accountId ?? "Unknown account"}
                  </div>
                  <div className="text-sm text-slate-600">
                    {child.installationId}
                    {child.billingPlanId
                      ? ` · plan ${child.billingPlanId}`
                      : ""}
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  {child.resourceCount} resource
                  {child.resourceCount === 1 ? "" : "s"}
                  {child.attribution.missingCount > 0 ||
                  child.attribution.mismatchCount > 0
                    ? ` · ${child.attribution.missingCount} missing, ${child.attribution.mismatchCount} mismatched attribution requests`
                    : " · attribution healthy"}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

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

      <Section title="Submit Billing Data">
        <form action={sendBillingDataAction} className="p-2">
          <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
            Submit
          </FormButton>
        </form>
      </Section>

      <Section title="Notification">
        <div>
          <div className="flex gap-2">
            <form action={setExampleNotificationAction}>
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Example
              </FormButton>
            </form>
            <form action={clearResourceNotificationAction}>
              <FormButton
                className="rounded bg-red-500 text-white px-2 py-1 disabled:opacity-50"
                disabled={!installation.notification}
              >
                Clear
              </FormButton>
            </form>
          </div>
        </div>

        <form action={updateNotificationAction}>
          <div className="space-y-4">
            <div className="flex flex-col">
              <label>Title</label>
              <input
                type="text"
                name="title"
                className="border border-1 border-slate-400"
                defaultValue={installation.notification?.title}
                required
              />
            </div>
            <div className="flex flex-col">
              <label>Message</label>
              <input
                type="text"
                name="message"
                className="border border-1 border-slate-400"
                defaultValue={installation.notification?.message}
              />
            </div>
            <div className="flex flex-col">
              <label>
                URL (<code>href</code>)
              </label>
              <input
                type="text"
                name="href"
                className="border border-1 border-slate-400"
                defaultValue={installation.notification?.href}
              />
            </div>
            <div>
              <label>Level:</label>
              <select
                name="level"
                defaultValue={installation.notification?.level}
              >
                <option value="info">info</option>
                <option value="warn">warn</option>
                <option value="error">error</option>
              </select>
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Save
              </FormButton>
            </div>
          </div>
        </form>
      </Section>
    </main>
  );
}
