import { beforeEach, describe, expect, it, vi } from "vitest";
import type { createMemoryKv } from "../test/memory-kv";

vi.mock("@/lib/redis", async () => {
  const { createMemoryKv } = await import("../test/memory-kv");
  return createMemoryKv();
});

import { GET as importResourceUrl } from "@/app/import/route";
import { mockBillingData } from "@/data/mock-billing-data";
import {
  getResource,
  importResourceToVercel,
  installIntegration,
  listResources,
  provisionResource,
  transferResources,
  uninstallInstallation,
} from "@/lib/partner";
import {
  type ProviderResource,
  listProviderResources,
  signInProviderAccount,
} from "@/lib/partner/provider-accounts";
import {
  ResourceImportError,
  completeResourceImport,
  getResourceImport,
} from "@/lib/partner/resource-import";
import * as redis from "@/lib/redis";

const { store } = redis as unknown as ReturnType<typeof createMemoryKv>;

// The values Vercel sends, per
// https://vercel.com/docs/integrations/create-integration/marketplace-flows#start-of-the-import-flow
// and resource-import-start.ts in vercel/api: state is 40 hex chars, return is
// the fixed import-complete endpoint, product_id is the product slug.
const RETURN_URL =
  "https://vercel.com/api/v1/integrations/installations/resources/import/complete";
const STATE = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b";
const INSTALLATION_ID = "icfg_import";
const ACCESS_TOKEN = "installation-access-token";

// What PUT /v1/installations/:id stores, via the route's installIntegration call.
const installRequest = {
  type: "marketplace" as const,
  scopes: ["read-write:integration-resource"],
  acceptedPolicies: { toc: "2024-01-01T00:00:00Z" },
  credentials: { access_token: ACCESS_TOKEN, token_type: "Bearer" },
};

interface VercelCall {
  method: string;
  url: string;
  authorization: string | undefined;
  body: unknown;
}

let vercelCalls: VercelCall[];
let vercelResponse: () => Response;

function importUrl(params: Record<string, string>): Request {
  const url = new URL("https://partner.example.com/import");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

async function startImport(params: Record<string, string> = {}) {
  const response = await importResourceUrl(
    importUrl({
      installation_id: INSTALLATION_ID,
      product_id: "my-product",
      state: STATE,
      return: RETURN_URL,
      ...params,
    }),
  );
  expect(response.status).toBe(303);
  const location = new URL(response.headers.get("location") ?? "");
  const importId = location.pathname.replace("/import/", "");
  return { response, location, importId };
}

function pendingImportKeys(): string[] {
  return Array.from(store.keys()).filter((key) =>
    key.startsWith("resource-import:"),
  );
}

async function signIn(email: string): Promise<{
  accountId: string;
  resources: ProviderResource[];
}> {
  const account = await signInProviderAccount(email);
  return {
    accountId: account.id,
    resources: await listProviderResources(account.id),
  };
}

beforeEach(async () => {
  store.clear();
  vercelCalls = [];
  vercelResponse = () => Response.json({ name: "imported" }, { status: 200 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    vercelCalls.push({
      method: init.method ?? "GET",
      url,
      authorization: (init.headers as Record<string, string> | undefined)
        ?.Authorization,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return vercelResponse();
  });
  await installIntegration(INSTALLATION_ID, installRequest);
});

describe("Import Resource URL", () => {
  it("stores installation_id, product_id, state, and return unchanged and redirects to resource selection", async () => {
    const { location, importId } = await startImport();

    expect(location.origin).toBe("https://partner.example.com");
    expect(await getResourceImport(importId)).toEqual({
      id: importId,
      installationId: INSTALLATION_ID,
      productId: "my-product",
      state: STATE,
      returnUrl: RETURN_URL,
      createdAt: expect.any(Number),
    });
    expect(vercelCalls).toEqual([]);
  });

  it("omits productId when Vercel did not send product_id", async () => {
    const response = await importResourceUrl(
      importUrl({
        installation_id: INSTALLATION_ID,
        state: STATE,
        return: RETURN_URL,
      }),
    );
    const importId = new URL(
      response.headers.get("location") ?? "",
    ).pathname.replace("/import/", "");

    expect((await getResourceImport(importId))?.productId).toBeUndefined();
  });

  it.each([
    ["missing state", { state: "" }, "invalid_request"],
    ["missing return", { return: "" }, "invalid_request"],
    ["missing installation_id", { installation_id: "" }, "invalid_request"],
    [
      "non-Vercel return",
      { return: "https://evil.com/x" },
      "invalid_return_url",
    ],
    [
      "lookalike return host",
      { return: "https://vercel.com.evil.com/x" },
      "invalid_return_url",
    ],
    ["http return", { return: "http://vercel.com/x" }, "invalid_return_url"],
    [
      "unknown installation",
      { installation_id: "icfg_unknown" },
      "unknown_installation",
    ],
  ])(
    "rejects %s without storing a pending import",
    async (_label, overrides, code) => {
      const response = await importResourceUrl(
        importUrl({
          installation_id: INSTALLATION_ID,
          state: STATE,
          return: RETURN_URL,
          ...overrides,
        }),
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code, message: expect.any(String) },
      });
      expect(pendingImportKeys()).toEqual([]);
    },
  );

  it("rejects an uninstalled installation", async () => {
    await uninstallInstallation(INSTALLATION_ID);

    const response = await importResourceUrl(
      importUrl({
        installation_id: INSTALLATION_ID,
        state: STATE,
        return: RETURN_URL,
      }),
    );

    expect(response.status).toBe(400);
    expect(pendingImportKeys()).toEqual([]);
  });
});

describe("completing an import", () => {
  it("registers the selected resource as linked before returning the redirect to Vercel", async () => {
    const { importId } = await startImport();
    const {
      accountId,
      resources: [selected, unselected],
    } = await signIn("dev@example.com");

    const { redirectUrl } = await completeResourceImport({
      importId,
      accountId,
      providerResourceId: selected.id,
    });

    // The Import Resource request is the product here: exactly one PUT,
    // authenticated as the installation, carrying ownership and secrets and
    // no Vercel billing plan.
    expect(vercelCalls).toEqual([
      {
        method: "PUT",
        url: `https://vercel.com/api/v1/installations/${INSTALLATION_ID}/resources/${selected.id}`,
        authorization: `Bearer ${ACCESS_TOKEN}`,
        body: {
          ownership: "linked",
          productId: "my-product",
          name: selected.name,
          status: "ready",
          metadata: {},
          customClaims: expect.objectContaining({
            defaultRole: "readwrite",
          }),
          secrets: [{ name: "TOP_SECRET", value: selected.secret }],
        },
      },
    ]);

    const redirect = new URL(redirectUrl);
    expect(`${redirect.origin}${redirect.pathname}`).toBe(RETURN_URL);
    expect(Object.fromEntries(redirect.searchParams)).toEqual({
      installation_id: INSTALLATION_ID,
      resource_id: selected.id,
      state: STATE,
    });

    // Vercel's Get Resource sync copies ownership from this response.
    expect(await getResource(INSTALLATION_ID, selected.id)).toEqual({
      id: selected.id,
      productId: "my-product",
      ownership: "linked",
      name: selected.name,
      status: "ready",
      metadata: {},
    });
    expect(await getResource(INSTALLATION_ID, unselected.id)).toBeNull();
    expect(pendingImportKeys()).toEqual([]);
  });

  it("returns an opaque state byte-for-byte", async () => {
    const opaqueState = "a+b/c=d&e f%20";
    const { importId } = await startImport({ state: opaqueState });
    const { accountId, resources } = await signIn("dev@example.com");

    const { redirectUrl } = await completeResourceImport({
      importId,
      accountId,
      providerResourceId: resources[0].id,
    });

    expect(new URL(redirectUrl).searchParams.get("state")).toBe(opaqueState);
  });

  it("is single-use", async () => {
    const { importId } = await startImport();
    const { accountId, resources } = await signIn("dev@example.com");
    await completeResourceImport({
      importId,
      accountId,
      providerResourceId: resources[0].id,
    });

    await expect(
      completeResourceImport({
        importId,
        accountId,
        providerResourceId: resources[1].id,
      }),
    ).rejects.toMatchObject({ code: "expired" });
    expect(vercelCalls).toHaveLength(1);
    expect(await getResource(INSTALLATION_ID, resources[1].id)).toBeNull();
  });

  it("does not redirect, and leaves nothing behind, when Vercel rejects the import; the import can be retried", async () => {
    const { importId } = await startImport();
    const { accountId, resources } = await signIn("dev@example.com");
    vercelResponse = () =>
      new Response("product not found", {
        status: 404,
        statusText: "Not Found",
      });

    await expect(
      completeResourceImport({
        importId,
        accountId,
        providerResourceId: resources[0].id,
      }),
    ).rejects.toThrow("404");

    expect(await getResource(INSTALLATION_ID, resources[0].id)).toBeNull();
    expect((await listResources(INSTALLATION_ID)).resources).toEqual([]);
    expect(await getResourceImport(importId)).not.toBeNull();

    vercelResponse = () => Response.json({ name: resources[0].name });
    const { redirectUrl } = await completeResourceImport({
      importId,
      accountId,
      providerResourceId: resources[0].id,
    });
    expect(new URL(redirectUrl).searchParams.get("resource_id")).toBe(
      resources[0].id,
    );
  });

  it("refuses a resource owned by another provider account", async () => {
    const { importId } = await startImport();
    const { accountId } = await signIn("dev@example.com");
    const { resources: otherResources } = await signIn("other@example.com");

    await expect(
      completeResourceImport({
        importId,
        accountId,
        providerResourceId: otherResources[0].id,
      }),
    ).rejects.toMatchObject({ code: "resource_not_found" });
    expect(vercelCalls).toEqual([]);
    expect(await getResource(INSTALLATION_ID, otherResources[0].id)).toBeNull();
    expect(await getResourceImport(importId)).not.toBeNull();
  });

  it("requires a product when Vercel did not send product_id, and uses it when given", async () => {
    const response = await importResourceUrl(
      importUrl({
        installation_id: INSTALLATION_ID,
        state: STATE,
        return: RETURN_URL,
      }),
    );
    const importId = new URL(
      response.headers.get("location") ?? "",
    ).pathname.replace("/import/", "");
    const { accountId, resources } = await signIn("dev@example.com");

    const missing = completeResourceImport({
      importId,
      accountId,
      providerResourceId: resources[0].id,
    });
    await expect(missing).rejects.toBeInstanceOf(ResourceImportError);
    await expect(missing).rejects.toMatchObject({ code: "product_required" });
    expect(vercelCalls).toEqual([]);

    await completeResourceImport({
      importId,
      accountId,
      providerResourceId: resources[0].id,
      productId: "chosen-product",
    });
    expect(vercelCalls).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({ productId: "chosen-product" }),
      }),
    ]);
  });
});

describe("linked resources after import", () => {
  async function installationWithOwnedAndLinked() {
    const owned = await provisionResource(INSTALLATION_ID, {
      productId: "my-product",
      name: "owned-db",
      metadata: {},
      billingPlanId: "pro200",
    });
    const { importId } = await startImport();
    const { accountId, resources } = await signIn("dev@example.com");
    const { resource: linked } = await completeResourceImport({
      importId,
      accountId,
      providerResourceId: resources[0].id,
    });
    vercelCalls = [];
    return { owned, linked };
  }

  it("excludes linked resources from billing data and keeps owned ones", async () => {
    const { owned } = await installationWithOwnedAndLinked();

    const billingData = await mockBillingData(INSTALLATION_ID);

    expect(new Set(billingData.billing.map((item) => item.resourceId))).toEqual(
      new Set([owned.id]),
    );
    expect(
      new Set(
        billingData.usage
          .map((usage) => usage.resourceId)
          .filter((id) => id !== undefined),
      ),
    ).toEqual(new Set([owned.id]));
  });

  it("keeps each resource's ownership when re-imported from the dashboard", async () => {
    const { owned, linked } = await installationWithOwnedAndLinked();

    await importResourceToVercel(INSTALLATION_ID, owned.id);
    await importResourceToVercel(INSTALLATION_ID, linked.id);

    expect(
      vercelCalls.map((call) => [
        call.url.split("/").at(-1),
        (call.body as { ownership: string }).ownership,
        "billingPlan" in (call.body as object),
      ]),
    ).toEqual([
      [owned.id, "owned", true],
      [linked.id, "linked", false],
    ]);
  });

  it("refuses to transfer a linked resource and leaves it in place", async () => {
    const { linked } = await installationWithOwnedAndLinked();
    await installIntegration("icfg_target", installRequest);

    await expect(
      transferResources(INSTALLATION_ID, [linked.id], "icfg_target"),
    ).rejects.toThrow("not billed through Vercel");
    expect(await getResource(INSTALLATION_ID, linked.id)).not.toBeNull();
    expect(await getResource("icfg_target", linked.id)).toBeNull();
  });
});
