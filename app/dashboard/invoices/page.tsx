import { getSession } from "../auth";
import { getAccountInfo, getInvoice } from "@/lib/vercel/api";

export default async function Page({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const session = await getSession();

  const account = await getAccountInfo(session.installation_id);
  const invoice = searchParams.id
    ? await getInvoice(session.installation_id, searchParams.id)
    : null;

  return (
    <main className="space-y-8">
      <h1 className="text-xl font-bold">{`${account.name}'s`} Invoices</h1>
      <form>
        Look up by ID: <input className="border" type="text" name="id" />
      </form>
      {invoice ? (
        <div>
          <h2 className="text-xl font-bold">Invoice</h2>
          <pre className="overflow-scroll">
            <code>{JSON.stringify(invoice, null, 2)}</code>
          </pre>
        </div>
      ) : null}
    </main>
  );
}
