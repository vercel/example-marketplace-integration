import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CALLER_INSTALLATION_ID = "icfg_caller";
const VICTIM_INSTALLATION_ID = "icfg_victim";

vi.mock("@/lib/redis", async () => {
  const { createMemoryKv } = await import("@/lib/test/memory-kv");
  return createMemoryKv();
});

vi.mock("jose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jose")>()),
  createRemoteJWKSet: () => async () => {
    throw new Error("JWKS must not be fetched in tests");
  },
  jwtVerify: async () => ({
    payload: {
      sub: "user",
      aud: "oac_test",
      iss: "https://marketplace.vercel.com",
      exp: 0,
      iat: 0,
      account_id: "account-caller",
      installation_id: CALLER_INSTALLATION_ID,
      user_id: "user",
      user_role: "ADMIN",
    },
  }),
}));

const { waitUntil } = vi.hoisted(() => ({ waitUntil: vi.fn() }));
vi.mock("@vercel/functions", () => ({ waitUntil }));

import {
  getResourceCredentials,
  installIntegration,
  provisionResource,
  setCredentialTypesChangeResponse,
} from "@/lib/partner";
import * as redis from "@/lib/redis";
import type { createMemoryKv } from "@/lib/test/memory-kv";
import { POST } from "./route";

const { store } = redis as unknown as ReturnType<typeof createMemoryKv>;

let vercelCalls: string[];

async function install(installationId: string) {
  await installIntegration(installationId, {
    type: "marketplace",
    scopes: ["read-write:integration-resource"],
    acceptedPolicies: { toc: "2024-01-01T00:00:00Z" },
    credentials: {
      access_token: `${installationId}-token`,
      token_type: "Bearer",
    },
  });
  return provisionResource(installationId, {
    productId: "my-product",
    name: "my-resource",
    metadata: {},
    billingPlanId: "default",
    credentialTypes: ["static", "oidc"],
  });
}

function rotate(installationId: string, resourceId: string) {
  return POST(
    new NextRequest(
      `https://provider.example.com/v1/installations/${installationId}/resources/${resourceId}/secrets/rotate?sync=1`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ credentialTypes: ["oidc"] }),
      },
    ),
    { params: { installationId, resourceId } },
  );
}

beforeEach(() => {
  store.clear();
  vercelCalls = [];
  waitUntil.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async (url: string) => {
    vercelCalls.push(url);
    return new Response(null, { status: 204 });
  });
});

describe("POST secrets/rotate", () => {
  it("does not touch a resource under another installation", async () => {
    const victim = await install(VICTIM_INSTALLATION_ID);
    const before = await getResourceCredentials(
      VICTIM_INSTALLATION_ID,
      victim.id,
    );

    const response = await rotate(VICTIM_INSTALLATION_ID, victim.id);

    expect(response.status).toBe(404);
    expect(
      await getResourceCredentials(VICTIM_INSTALLATION_ID, victim.id),
    ).toEqual(before);
    expect(waitUntil).not.toHaveBeenCalled();
    expect(vercelCalls).toEqual([]);
  });

  it("changes a resource under the caller's installation", async () => {
    const resource = await install(CALLER_INSTALLATION_ID);
    await setCredentialTypesChangeResponse(
      CALLER_INSTALLATION_ID,
      resource.id,
      "hold",
    );

    const response = await rotate(CALLER_INSTALLATION_ID, resource.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sync: true,
      secrets: [],
      partial: false,
    });
    expect(
      (await getResourceCredentials(CALLER_INSTALLATION_ID, resource.id))
        ?.credentialTypesChange,
    ).toEqual({ to: ["oidc"], requestedAt: expect.any(Number) });
  });
});
