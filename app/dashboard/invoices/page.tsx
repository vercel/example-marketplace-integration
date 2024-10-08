import { getSession } from "../auth";
import { getAccountInfo, getInvoice } from "@/lib/vercel/marketplace-api";
import { Section } from "../components/section";
import { refundInvoiceAction, submitInvoiceAction } from "./actions";
import { FormButton } from "../components/form-button";

export default async function Page({
  searchParams,
}: {
  searchParams: { id?: string; submitError?: string };
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
            <div className="flex gap-2">
              <label>Max amount</label>
              <input
                type="text"
                name="maxAmount"
                defaultValue="5"
                className="border"
              />
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Submit Invoice
              </FormButton>
            </div>
          </div>
        </form>

        {searchParams.submitError ? (
          <div
            className="bg-pink-100 border border-pink-400 text-pink-700 px-4 py-3 rounded relative mt-4"
            role="alert"
          >
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{searchParams.submitError}</span>
          </div>
        ) : null}
      </Section>

      <Section title="Get Invoice">
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
            className="bg-pink-100 border border-pink-400 text-pink-700 px-4 py-3 rounded relative mt-4"
            role="alert"
          >
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{invoiceError}</span>
          </div>
        ) : null}
      </Section>

      <Section title="Refund Invoice">
        <form action={refundInvoiceAction}>
          Refund up by ID:{" "}
          <input
            className="border"
            type="text"
            name="id"
            defaultValue={searchParams.id ?? ""}
          />
          <div className="flex gap-2">
            <label>Refund amount</label>
            <input type="text" name="refundAmount" className="border" />
          </div>
          <div className="flex gap-2">
            <label>Refund reason</label>
            <input type="text" name="refundReason" className="border" />
          </div>
          <div className="flex justify-end">
            <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
              Refund Invoice
            </FormButton>
          </div>
        </form>
      </Section>
    </main>
  );
}
