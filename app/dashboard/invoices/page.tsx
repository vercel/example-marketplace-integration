import { getSession } from "../auth";
import { getAccountInfo, getInvoice } from "@/lib/vercel/api";
import { Section } from "../components/section";
import { submitInvoiceAction } from "./actions";
import { FormButton } from "../components/form-button";

export default async function Page({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const session = await getSession();

  let invoice;
  let invoiceError;
  try {
    invoice = searchParams.id
      ? await getInvoice(session.installation_id, searchParams.id)
      : null;
  } catch (err) {
    invoiceError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="space-y-8">
      <Section title="Submit Invoice">
        <form action={submitInvoiceAction}>
          <div className="space-y-4">
            <div className="flex gap-2">
              <label>Test</label>
              <input type="checkbox" name="test" defaultChecked={true} />
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Submit Invoice
              </FormButton>
            </div>
          </div>
        </form>
      </Section>

      <Section title="Invoices">
        <form>
          Look up by ID:{" "}
          <input
            className="border"
            type="text"
            name="id"
            defaultValue={searchParams.id ?? ""}
          />
        </form>
        {invoice ? (
          <div>
            <h2 className="text-xl font-bold">Invoice</h2>
            <pre className="overflow-scroll">
              <code>{JSON.stringify(invoice, null, 2)}</code>
            </pre>
          </div>
        ) : null}
        {invoiceError ? (
          <div
            className="bg-pink-100 border border-pink-400 text-pink-700 px-4 py-3 rounded relative"
            role="alert"
          >
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{invoiceError}</span>
          </div>
        ) : null}
      </Section>
    </main>
  );
}
