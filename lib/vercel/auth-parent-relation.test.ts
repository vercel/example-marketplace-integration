import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, kvMock } = vi.hoisted(() => {
  const hoistedStore = new Map<string, unknown>();
  const hoistedKvMock = {
    get: async (key: string) => hoistedStore.get(key) ?? null,
    set: async (key: string, value: unknown) => {
      hoistedStore.set(key, value);
      return "OK";
    },
    incr: async (key: string) => {
      const next = Number(hoistedStore.get(key) ?? 0) + 1;
      hoistedStore.set(key, next);
      return next;
    },
  };
  return { store: hoistedStore, kvMock: hoistedKvMock };
});

vi.mock("@/lib/redis", () => ({ kv: kvMock }));

vi.mock("jose", () => ({
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
      account_id: "account-child",
      installation_id: "icfg_child",
      user_id: "user",
      user_role: "ADMIN",
    },
  }),
}));

import { ParentRelationUnavailableError } from "@/lib/partner/parent-relations";
import { withAuth } from "@/lib/vercel/auth";

function buildRequest(): NextRequest {
  return new NextRequest("https://provider.example.com/v1/resources", {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
  });
}

describe("withAuth parent relation failures", () => {
  beforeEach(() => {
    store.clear();
  });

  it("maps ParentRelationUnavailableError to a structured 409 and records the reason", async () => {
    const handler = withAuth(async () => {
      throw new ParentRelationUnavailableError(
        "icfg_child",
        "parent_record_missing",
      );
    });

    const response = await handler(buildRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "parent_relation_unavailable",
        message: "The stored parent installation record is missing",
        user: {
          message:
            "This installation belongs to a platform organization, but its parent installation could not be resolved. Reinstall the parent integration or contact support.",
        },
      },
    });
    expect(
      store.get("icfg_child:parent-relation-failure:parent_record_missing"),
    ).toBe(1);
    expect(
      store.get(
        "icfg_child:parent-relation-failure:missing_parent_installation_id",
      ),
    ).toBeUndefined();
  });

  it("records missing_parent_installation_id separately", async () => {
    const handler = withAuth(async () => {
      throw new ParentRelationUnavailableError(
        "icfg_child",
        "missing_parent_installation_id",
      );
    });

    const response = await handler(buildRequest());

    expect(response.status).toBe(409);
    expect(
      store.get(
        "icfg_child:parent-relation-failure:missing_parent_installation_id",
      ),
    ).toBe(1);
  });

  it("propagates unrelated handler errors unchanged", async () => {
    const handler = withAuth(async () => {
      throw new Error("unrelated failure");
    });

    await expect(handler(buildRequest())).rejects.toThrow("unrelated failure");
    expect(store.size).toBe(0);
  });
});
