import Link from "next/link";
import { getResource } from "@/lib/partner";
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
      <h1 className="font-bold text-xl">
        <Link className="text-blue-500 underline" href="/dashboard">
          Dashboard
        </Link>{" "}
        &gt; Support {resourceName}
      </h1>

      <Section title="Suport">
        <form>
          <div className="space-y-4">
            <label className="flex flex-col">
              <span>Message</span>
              <textarea
                className="border border-slate-400"
                name="name"
                rows={10}
              />
            </label>

            <div className="flex justify-end">
              <FormButton className="rounded bg-blue-500 px-2 py-1 text-white disabled:opacity-50">
                Submit
              </FormButton>
            </div>
          </div>
        </form>
      </Section>
    </main>
  );
}
