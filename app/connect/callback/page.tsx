import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { installIntegration } from "@/lib/partner";
import { exchangeExternalCodeForToken } from "@/lib/vercel/external-api";

export const dynamic = "force-dynamic";

/**
 * Callback page for the connect integration.
 * This page is used to connect the installation to an existing partner account.
 */
const Page = async (props: PageProps<"/connect/callback">) => {
  const { code, next } = await props.searchParams;

  if (typeof code !== "string" || typeof next !== "string") {
    return notFound();
  }

  const result = await exchangeExternalCodeForToken(
    code,
    env.VERCEL_EXTERNAL_REDIRECT_URI
  );

  await installIntegration(result.installation_id, {
    type: "external",
    scopes: [],
    acceptedPolicies: {},
    credentials: {
      access_token: result.access_token,
      token_type: result.token_type,
    },
  });

  return (
    <div className="space-y-10 p-10 text-center">
      <h1 className="font-medium text-lg">Account is connected. ✅</h1>
      <h3>
        <a className="text-blue-500 underline" href={next}>
          Redirect me back to Vercel
        </a>
      </h3>
    </div>
  );
};

export default Page;
