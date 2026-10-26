import { expect, it, vi } from "vitest";
import { fetchVercelApi } from "./api";
import { exchangeExternalCodeForToken } from "./external-api";

vi.mock("./api", () => ({ fetchVercelApi: vi.fn() }));

it.each([undefined, "user_legacy"])(
  "accepts authorization-code responses with an optional legacy user ID (%s)",
  async (userId) => {
    const response = {
      token_type: "Bearer",
      access_token: "access-token",
      installation_id: "icfg_installation",
      team_id: "team_example",
      expires_in: 3600,
    };
    vi.mocked(fetchVercelApi).mockResolvedValue({
      ...response,
      ...(userId === undefined ? {} : { user_id: userId }),
    });

    await expect(
      exchangeExternalCodeForToken("code", "https://example.com/callback"),
    ).resolves.toMatchObject(response);
  },
);
