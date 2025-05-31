import { env } from "@/lib/env";
import { installIntegration } from "@/lib/partner";
import { exchangeExternalCodeForToken } from "@/lib/vercel/external-api";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams: { code, next },
}: {
  searchParams: { code: string; next: string };
}) {
  if (!env.VERCEL_EXTERNAL_REDIRECT_URI) {
    throw new Error(
      `VERCEL_EXTERNAL_REDIRECT_URI is not set, cannot connect account`,
    );
  }

  const result = await exchangeExternalCodeForToken(
    code,
    env.VERCEL_EXTERNAL_REDIRECT_URI,
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
    <div className="space-y-10 text-center p-10">
      <h1 className="text-lg font-medium">Account is connected. ✅</h1>
      <h3>
        <a className="underline text-blue-500" href={next}>
          Redirect me back to Vercel
        </a>
      </h3>
    </div>
  );
}
