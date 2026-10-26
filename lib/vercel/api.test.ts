import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchVercelApi } from "./api";

const mocks = vi.hoisted(() => ({
  env: {
    INTEGRATION_CLIENT_ID: "oac_example",
  },
  installation: vi.fn(),
  token: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("../partner", () => ({ getInstallation: mocks.installation }));
vi.mock("./installation-token", () => ({
  getInstallationAccessToken: mocks.token,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.installation.mockResolvedValue({
    credentials: { access_token: "original" },
  });
  mocks.token.mockResolvedValue("renewed");
  mocks.fetch.mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

it("always obtains an installation token and preserves headers", async () => {
  await fetchVercelApi("/v1/example", {
    installationId: "icfg_one",
    headers: new Headers({ "x-request-id": "one" }),
  });
  const headers = mocks.fetch.mock.calls[0][1].headers as Headers;
  expect(headers.get("authorization")).toBe("Bearer renewed");
  expect(headers.get("x-request-id")).toBe("one");
  expect(mocks.token).toHaveBeenCalledWith("icfg_one", "original");
});

it("rejects unknown installations without obtaining a token or calling the API", async () => {
  mocks.installation.mockResolvedValue(null);
  await expect(
    fetchVercelApi("/v1/example", { installationId: "icfg_one" }),
  ).rejects.toThrow("Unknown installation");
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("allows billing finalization after local uninstall", async () => {
  mocks.installation.mockResolvedValue({
    deletedAt: 123,
    credentials: { access_token: "original" },
  });
  await fetchVercelApi("/v1/installations/icfg_one/billing/finalize", {
    installationId: "icfg_one",
    method: "POST",
    data: {},
  });
  const headers = mocks.fetch.mock.calls[0][1].headers as Headers;
  expect(headers.get("authorization")).toBe("Bearer renewed");
});

it("preserves authentication, caller headers, and the integration user agent on mutations", async () => {
  await fetchVercelApi("/v1/example", {
    method: "POST",
    installationId: "icfg_one",
    data: { name: "example" },
    headers: new Headers({ "x-request-id": "one" }),
  });
  const options = mocks.fetch.mock.calls[0][1] as RequestInit;
  const headers = new Headers(options.headers);
  expect(headers.get("authorization")).toBe("Bearer renewed");
  expect(headers.get("x-request-id")).toBe("one");
  expect(headers.get("content-type")).toBe("application/json");
  expect(headers.get("user-agent")).toBe(
    "Vercel Example Marketplace Integration/oac_example",
  );
  expect(options.body).toBe(JSON.stringify({ name: "example" }));
});

it("propagates renewal failure before making an API mutation", async () => {
  mocks.token.mockRejectedValue(new Error("Renewal unavailable"));
  await expect(
    fetchVercelApi("/v1/example", {
      method: "POST",
      installationId: "icfg_one",
    }),
  ).rejects.toThrow("Renewal unavailable");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
