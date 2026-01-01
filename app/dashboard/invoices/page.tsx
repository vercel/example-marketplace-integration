import { getInvoice } from "@/lib/vercel/marketplace-api";
import { getSession } from "../auth";
import { FormButton } from "../components/form-button";
import { Section } from "../components/section";
import { refundInvoiceAction, submitInvoiceAction } from "./actions";

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
              <input defaultChecked={true} name="test" type="checkbox" />
            </div>
            <div className="flex gap-2">
              <label>Max amount</label>
              <input
                className="border"
                defaultValue="5"
                name="maxAmount"
                type="text"
              />
            </div>
            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Submit Invoice
              </FormButton>
            </div>
          </div>
        </form>

        {searchParams.submitError ? (
          <div
            className="relative mt-4 rounded border border-pink-400 bg-pink-100 px-4 py-3 text-pink-700"
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
            defaultValue={searchParams.id ?? ""}
            name="id"
            type="text"
          />
        </form>
        {invoice ? (
          <div>
            <h2 className="font-bold text-xl">Invoice</h2>
            <pre className="overflow-scroll">
              <code>{JSON.stringify(invoice, null, 2)}</code>
            </pre>
          </div>
        ) : null}
        {invoiceError ? (
          <div
            className="relative mt-4 rounded border border-pink-400 bg-pink-100 px-4 py-3 text-pink-700"
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
            defaultValue={searchParams.id ?? ""}
            name="id"
            type="text"
          />
          <div className="flex gap-2">
            <label>Refund amount</label>
            <input className="border" name="refundAmount" type="text" />
          </div>
          <div className="flex gap-2">
            <label>Refund reason</label>
            <input className="border" name="refundReason" type="text" />
          </div>
          <div className="flex justify-end">
            <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
              Refund Invoice
            </FormButton>
          </div>
        </form>
      </Section>
    </main>
  );
}
