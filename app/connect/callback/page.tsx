import { stringify } from "node:querystring";
import { notFound } from "next/navigation";
import { z } from "zod/v3";
import { env } from "@/lib/env";
import { installIntegration } from "@/lib/partner";

const IntegrationsExternalTokenResponse = z.object({
  token_type: z.string(),
  access_token: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
});

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

  const res = await fetch("https://vercel.com/api/v2/oauth/access_token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: stringify({
      code,
      client_id: env.INTEGRATION_CLIENT_ID,
      client_secret: env.INTEGRATION_CLIENT_SECRET,
      redirect_uri: env.VERCEL_EXTERNAL_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `OAuth token exchange failed: ${res.status} ${res.statusText}`
    );
  }

  const result = IntegrationsExternalTokenResponse.parse(await res.json());

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
