import { getResource } from "@/lib/partner";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { Resource } from "@/lib/vercel/schemas";
import Link from "next/link";
import { getSession } from "../auth";
import { FormButton } from "../components/form-button";
import { Section } from "../components/section";

export default async function SupportPage({
  searchParams: { resourceId },
}: {
  searchParams: { resourceId?: string };
}) {
  let resourceName = "";
  const session = await getSession();
  if (resourceId) {
    const resource = await getResource(session.installation_id, resourceId);
    if (resource) {
      resourceName = resource.name;
    }
  }

  return (
    <main className="space-y-8">
      <h1 className="text-xl font-bold">
        <Link href="/dashboard" className="text-blue-500 underline">
          Dashboard
        </Link>{" "}
        &gt; Support {resourceName}
      </h1>

      <Section title="Suport">
        <form>
          <div className="space-y-4">
            <div className="flex flex-col">
              <label>Message</label>
              <textarea
                name="name"
                className="border border-1 border-slate-400"
                rows={10}
              />
            </div>

            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50">
                Submit
              </FormButton>
            </div>
          </div>
        </form>
      </Section>
    </main>
  );
}
