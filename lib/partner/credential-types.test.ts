import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { createMemoryKv } = await import("../test/memory-kv");
  return createMemoryKv();
});

import {
  cloneResource,
  getResource,
  getResourceCredentials,
  importResourceToVercel,
  installIntegration,
  provisionResource,
  recordCredentialTypesChange,
  setCredentialTypesChangeResponse,
  setResourceCredentialTypes,
} from "@/lib/partner";
import * as redis from "@/lib/redis";
import type { createMemoryKv } from "@/lib/test/memory-kv";
import type { ResourceCredentialType } from "@/lib/vercel/schemas";

const { store } = redis as unknown as ReturnType<typeof createMemoryKv>;

const INSTALLATION_ID = "icfg_credential_types";

interface VercelCall {
  method: string;
  url: string;
  body: unknown;
}

let vercelCalls: VercelCall[];
let vercelResponse: () => Response;

beforeEach(async () => {
  store.clear();
  vercelCalls = [];
  vercelResponse = () => new Response(null, { status: 204 });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    vercelCalls.push({
      method: init.method ?? "GET",
      url,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    return vercelResponse();
  });
  await installIntegration(INSTALLATION_ID, {
    type: "marketplace",
    scopes: ["read-write:integration-resource"],
    acceptedPolicies: { toc: "2024-01-01T00:00:00Z" },
    credentials: { access_token: "token", token_type: "Bearer" },
  });
});

function provision(credentialTypes?: ResourceCredentialType[]) {
  return provisionResource(INSTALLATION_ID, {
    productId: "my-product",
    name: "my-resource",
    metadata: {},
    billingPlanId: "default",
    credentialTypes,
  });
}

describe("provisioning", () => {
  it("returns long-lived secrets and leaves credential types unset when Vercel sends none", async () => {
    const resource = await provision();

    expect(resource.secrets.map((secret) => secret.name)).toEqual([
      "TOP_SECRET",
    ]);
    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual(
      {},
    );
  });

  it("returns no long-lived secrets for a resource without static", async () => {
    const resource = await provision(["oidc"]);

    expect(resource.secrets).toEqual([]);
    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual({
      credentialTypes: ["oidc"],
    });
  });

  it("keeps credential types out of Get Resource", async () => {
    const resource = await provision(["static", "oidc"]);
    await recordCredentialTypesChange(INSTALLATION_ID, resource.id, ["oidc"]);
    await setCredentialTypesChangeResponse(
      INSTALLATION_ID,
      resource.id,
      "hold",
    );

    const fetched = await getResource(INSTALLATION_ID, resource.id);

    expect(fetched).not.toHaveProperty("credentialTypes");
    expect(fetched).not.toHaveProperty("credentialTypesChange");
    expect(fetched).not.toHaveProperty("credentialTypesChangeResponse");
  });

  it("clones a resource with its credential types", async () => {
    const resource = await provision(["oidc"]);

    const clone = await cloneResource(INSTALLATION_ID, resource.id);

    expect(clone.secrets).toEqual([]);
    expect(
      (await getResourceCredentials(INSTALLATION_ID, clone.id))
        ?.credentialTypes,
    ).toEqual(["oidc"]);
  });

  it("imports a resource without static with no secrets", async () => {
    const resource = await provision(["oidc"]);

    await importResourceToVercel(INSTALLATION_ID, resource.id);

    expect(vercelCalls.at(-1)).toMatchObject({
      method: "PUT",
      body: { secrets: [] },
    });
  });
});

describe("credential types changes", () => {
  it("records a requested change as pending", async () => {
    const resource = await provision(["static", "oidc"]);

    await recordCredentialTypesChange(INSTALLATION_ID, resource.id, ["oidc"]);

    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual({
      credentialTypes: ["static", "oidc"],
      credentialTypesChange: {
        to: ["oidc"],
        requestedAt: expect.any(Number),
      },
    });
  });

  it("keeps the original request time when Vercel requests the same change again", async () => {
    const resource = await provision();
    await recordCredentialTypesChange(INSTALLATION_ID, resource.id, ["oidc"]);
    const first = await getResourceCredentials(INSTALLATION_ID, resource.id);

    await recordCredentialTypesChange(INSTALLATION_ID, resource.id, ["oidc"]);

    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual(
      first,
    );
  });

  it("confirms a pending change with Update Resource", async () => {
    const resource = await provision();
    await recordCredentialTypesChange(INSTALLATION_ID, resource.id, ["oidc"]);

    await setResourceCredentialTypes(INSTALLATION_ID, resource.id, ["oidc"]);

    expect(vercelCalls.at(-1)).toEqual({
      method: "PATCH",
      url: `https://vercel.com/api/v1/installations/${INSTALLATION_ID}/resources/${resource.id}`,
      body: { credentialTypes: ["oidc"] },
    });
    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual({
      credentialTypes: ["oidc"],
      credentialTypesChange: {
        to: ["oidc"],
        requestedAt: expect.any(Number),
        confirmedAt: expect.any(Number),
      },
    });
  });

  it("backfills an unset resource without completing a change", async () => {
    const resource = await provision();

    await setResourceCredentialTypes(INSTALLATION_ID, resource.id, [
      "oidc",
      "static",
    ]);

    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual({
      credentialTypes: ["oidc", "static"],
    });
  });

  it("keeps the stored credential types when Vercel rejects the update", async () => {
    const resource = await provision(["static", "oidc"]);
    await recordCredentialTypesChange(INSTALLATION_ID, resource.id, ["oidc"]);
    const before = await getResourceCredentials(INSTALLATION_ID, resource.id);
    vercelResponse = () =>
      Response.json({ error: { code: "bad_request" } }, { status: 400 });

    await expect(
      setResourceCredentialTypes(INSTALLATION_ID, resource.id, ["static"]),
    ).rejects.toThrow("400");

    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual(
      before,
    );
  });

  it("stores how to respond to the next change request", async () => {
    const resource = await provision();

    await setCredentialTypesChangeResponse(
      INSTALLATION_ID,
      resource.id,
      "reject",
    );

    expect(await getResourceCredentials(INSTALLATION_ID, resource.id)).toEqual({
      credentialTypesChangeResponse: "reject",
    });
  });
});
