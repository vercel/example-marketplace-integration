import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getInstallationAccessToken } from "./installation-token";

const mocks = vi.hoisted(() => ({
  cache: new Map<string, unknown>(),
  fetch: vi.fn(),
}));
vi.mock("../redis", () => ({
  kv: {
    get: vi.fn(async (key: string) => mocks.cache.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      mocks.cache.set(key, value);
    }),
  },
}));
vi.mock("../env", () => ({
  env: {
    INTEGRATION_CLIENT_ID: "oac_example",
    INTEGRATION_CLIENT_SECRET: "example-secret",
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
  mocks.cache.clear();
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockImplementation(async (_url, init: RequestInit) => {
    const params = init.body as URLSearchParams;
    return Response.json({
      access_token: `token-${params.get("installation_id")}`,
      token_type: "Bearer",
      installation_id: params.get("installation_id"),
      expires_in: 3600,
    });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shares concurrent exchanges and caches independently for each installation", async () => {
  const tokens = await Promise.all(
    Array.from({ length: 8 }, () =>
      getInstallationAccessToken("icfg_one", "original-credential"),
    ),
  );
  expect(tokens).toEqual(Array(8).fill("token-icfg_one"));
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(
    await getInstallationAccessToken("icfg_two", "original-credential"),
  ).toBe("token-icfg_two");
  expect(
    await getInstallationAccessToken("icfg_one", "original-credential"),
  ).toBe("token-icfg_one");
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  const params = mocks.fetch.mock.calls[0][1].body as URLSearchParams;
  expect(Object.fromEntries(params)).toEqual({
    grant_type: "client_credentials",
    client_id: "oac_example",
    client_secret: "example-secret",
    installation_id: "icfg_one",
  });
});

it("renews before the one-hour expiry", async () => {
  await getInstallationAccessToken("icfg_one", "original-credential");
  vi.setSystemTime(Date.now() + 3_599_000);
  await getInstallationAccessToken("icfg_one", "original-credential");
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
});

it("does not fall back to an old credential when exchange fails", async () => {
  mocks.fetch.mockResolvedValueOnce(
    new Response("private error details", { status: 503 }),
  );
  await expect(
    getInstallationAccessToken("icfg_one", "original-credential"),
  ).rejects.toThrow("Access-token exchange failed (503)");
  expect(mocks.cache.size).toBe(0);
  await expect(
    getInstallationAccessToken("icfg_one", "original-credential"),
  ).resolves.toBe("token-icfg_one");
});

it.each([
  { installation_id: "icfg_other", expires_in: 3600 },
  { installation_id: "icfg_one", expires_in: 0 },
  { installation_id: "icfg_one", expires_in: 7200 },
])("rejects invalid token binding or lifetime: %j", async (fields) => {
  mocks.fetch.mockResolvedValueOnce(
    Response.json({
      access_token: "wrong-token",
      token_type: "Bearer",
      ...fields,
    }),
  );
  await expect(
    getInstallationAccessToken("icfg_one", "original-credential"),
  ).rejects.toThrow();
  expect(mocks.cache.size).toBe(0);
});

it("renews after installation credentials are replaced", async () => {
  await getInstallationAccessToken("icfg_one", "original-credential");
  await getInstallationAccessToken("icfg_one", "replacement-credential");
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(Array.from(mocks.cache.keys()).join()).not.toContain("credential");
});
