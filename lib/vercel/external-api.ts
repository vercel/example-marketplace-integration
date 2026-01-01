import { stringify } from "node:querystring";
import { z } from "zod";
import { env } from "../env";
import { fetchVercelApi } from "./api";

const IntegrationsExternalTokenResponse = z.object({
  token_type: z.string(),
  access_token: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
});

export async function exchangeExternalCodeForToken(
  code: string,
  redirectUri: string
): Promise<z.TypeOf<typeof IntegrationsExternalTokenResponse>> {
  return IntegrationsExternalTokenResponse.parse(
    await fetchVercelApi("/v2/oauth/access_token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: stringify({
        code,
        client_id: env.INTEGRATION_CLIENT_ID,
        client_secret: env.INTEGRATION_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    })
  );
}
