import { getInvoice } from "@/lib/vercel/marketplace-api";
import { getSession } from "../auth";
import { FormButton } from "../components/form-button";
import { Section } from "../components/section";
import { refundInvoiceAction, submitInvoiceAction } from "./actions";

const InvoicesPage = async (props: PageProps<"/dashboard/invoices">) => {
  const { id, submitError } = await props.searchParams;
  const session = await getSession();

  let invoice: Awaited<ReturnType<typeof getInvoice>> | null = null;
  let invoiceError: string | undefined;
  try {
    invoice =
      typeof id === "string"
        ? await getInvoice(session.installation_id, id)
        : null;
  } catch (err) {
    invoiceError = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="space-y-8">
      <Section title="Submit Invoice">
        <form action={submitInvoiceAction}>
          <div className="space-y-4">
            <label className="flex gap-2">
              <span>Test</span>
              <input defaultChecked={true} name="test" type="checkbox" />
            </label>
            <label className="flex gap-2">
              <span>Max amount</span>
              <input
                className="border"
                defaultValue="5"
                name="maxAmount"
                type="text"
              />
            </label>
            <div className="flex justify-end">
              <FormButton className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50">
                Submit Invoice
              </FormButton>
            </div>
          </div>
        </form>

        {submitError ? (
          <div
            className="relative mt-4 rounded border border-destructive bg-destructive/10 px-4 py-3 text-destructive"
            role="alert"
          >
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{submitError}</span>
          </div>
        ) : null}
      </Section>

      <Section title="Get Invoice">
        <form>
          Look up by ID:{" "}
          <input
            className="border"
            defaultValue={id ?? ""}
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
            className="relative mt-4 rounded border border-destructive bg-destructive/10 px-4 py-3 text-destructive"
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
            defaultValue={id ?? ""}
            name="id"
            type="text"
          />
          <label className="flex gap-2">
            <span>Refund amount</span>
            <input className="border" name="refundAmount" type="text" />
          </label>
          <label className="flex gap-2">
            <span>Refund reason</span>
            <input className="border" name="refundReason" type="text" />
          </label>
          <div className="flex justify-end">
            <FormButton className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50">
              Refund Invoice
            </FormButton>
          </div>
        </form>
      </Section>
    </main>
  );
};

export default InvoicesPage;
