import Link from "next/link";
import { getResource } from "@/lib/partner";
import { getSession } from "../auth";
import { FormButton } from "../components/form-button";
import { Section } from "../components/section";

const SupportPage = async (props: PageProps<"/dashboard/support">) => {
  const { resourceId } = await props.searchParams;
  let resourceName = "";
  const session = await getSession();

  if (typeof resourceId === "string") {
    const resource = await getResource(session.installation_id, resourceId);
    if (resource) {
      resourceName = resource.name;
    }
  }

  return (
    <main className="space-y-8">
      <h1 className="font-bold text-xl">
        <Link className="text-primary underline" href="/dashboard">
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
                className="border"
                name="name"
                rows={10}
              />
            </label>

            <div className="flex justify-end">
              <FormButton className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50">
                Submit
              </FormButton>
            </div>
          </div>
        </form>
      </Section>
    </main>
  );
};

export default SupportPage;
