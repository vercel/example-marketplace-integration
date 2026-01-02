import { notFound } from "next/navigation";

/**
 * Configure page for the connect integration.
 * This page is used when the user presses "Configure" on the Vercel integration page.
 */
const Page = async (props: PageProps<"/connect/configure">) => {
  const { configurationId } = await props.searchParams;

  if (typeof configurationId !== "string") {
    return notFound();
  }

  return (
    <div className="space-y-10 p-10 text-center">
      <h1 className="font-medium text-lg">Nothing to configure here. 👀</h1>
      <h3 className="font-mono">{configurationId}</h3>
    </div>
  );
};

export default Page;
