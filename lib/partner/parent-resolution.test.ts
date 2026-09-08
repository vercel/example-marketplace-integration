import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, kvMock } = vi.hoisted(() => {
  const hoistedStore = new Map<string, unknown>();

  function listAt(key: string): unknown[] {
    const existing = hoistedStore.get(key);
    if (!existing) {
      const created: unknown[] = [];
      hoistedStore.set(key, created);
      return created;
    }
    return existing as unknown[];
  }

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
    incrby: async (key: string, amount: number) => {
      const next = Number(hoistedStore.get(key) ?? 0) + amount;
      hoistedStore.set(key, next);
      return next;
    },
    llen: async (key: string) => listAt(key).length,
    lrange: async (key: string, start: number, end: number) => {
      const values = listAt(key);
      return values.slice(start, end === -1 ? undefined : end + 1);
    },
    lpush: async (key: string, value: unknown) => {
      listAt(key).unshift(value);
    },
    lrem: async (key: string, _count: number, value: unknown) => {
      hoistedStore.set(
        key,
        listAt(key).filter((entry) => entry !== value),
      );
    },
    ltrim: async () => {},
    del: async (key: string) => {
      hoistedStore.delete(key);
      return 1;
    },
    pipeline: () => {
      const operations: (() => Promise<unknown>)[] = [];
      const pipeline = {
        get: (key: string) => {
          operations.push(() => hoistedKvMock.get(key));
          return pipeline;
        },
        set: (key: string, value: unknown) => {
          operations.push(() => hoistedKvMock.set(key, value));
          return pipeline;
        },
        lpush: (key: string, value: unknown) => {
          operations.push(() => hoistedKvMock.lpush(key, value));
          return pipeline;
        },
        lrem: (key: string, count: number, value: unknown) => {
          operations.push(() => hoistedKvMock.lrem(key, count, value));
          return pipeline;
        },
        ltrim: () => {
          operations.push(() => hoistedKvMock.ltrim());
          return pipeline;
        },
        del: (key: string) => {
          operations.push(() => hoistedKvMock.del(key));
          return pipeline;
        },
        exec: async () => {
          const results: unknown[] = [];
          for (const operation of operations) {
            results.push(await operation());
          }
          return results;
        },
      };
      return pipeline;
    },
  };

  return { store: hoistedStore, kvMock: hoistedKvMock };
});

vi.mock("@/lib/redis", () => ({ kv: kvMock }));

import {
  getInstallation,
  getProductBillingPlans,
  installIntegration,
  provisionResource,
  resolveParent,
} from "@/lib/partner";
import { ParentRelationUnavailableError } from "@/lib/partner/parent-relations";

const baseInstallRequest = {
  type: "marketplace" as const,
  scopes: [],
  acceptedPolicies: {},
  credentials: { access_token: "token", token_type: "Bearer" },
  billingPlanId: "pro200",
};

async function installChild(
  installationId: string,
  parent: { parentAccountId?: string; parentInstallationId?: string },
) {
  await installIntegration(installationId, baseInstallRequest, {
    accountId: `account-${installationId}`,
    parent,
  });
}

describe("parent relation resolution", () => {
  beforeEach(() => {
    store.clear();
  });

  it("resolves standalone installations as none", async () => {
    await installIntegration("icfg_standalone", baseInstallRequest, {
      accountId: "account-standalone",
    });

    const parent = await resolveParent(
      await getInstallation("icfg_standalone"),
    );
    expect(parent).toEqual({ state: "none" });

    const { plans } = await getProductBillingPlans(
      "product",
      "icfg_standalone",
    );
    expect(plans.map((plan) => plan.id)).toEqual([
      "default",
      "pro200",
      "prepay10",
    ]);
  });

  it("classifies a relation without parentInstallationId as invalid and refuses provisioning", async () => {
    await installChild("icfg_child_no_parent_id", {
      parentAccountId: "parent-account",
    });

    const parent = await resolveParent(
      await getInstallation("icfg_child_no_parent_id"),
    );
    expect(parent).toMatchObject({
      state: "invalid",
      reason: "missing_parent_installation_id",
    });

    const { plans } = await getProductBillingPlans(
      "product",
      "icfg_child_no_parent_id",
    );
    expect(plans).toEqual([]);

    const provisionAttempt = provisionResource("icfg_child_no_parent_id", {
      productId: "product",
      name: "db",
      metadata: {},
      billingPlanId: "pro200",
    });
    await expect(provisionAttempt).rejects.toBeInstanceOf(
      ParentRelationUnavailableError,
    );
    await expect(provisionAttempt).rejects.toMatchObject({
      installationId: "icfg_child_no_parent_id",
      reason: "missing_parent_installation_id",
    });
  });

  it("classifies a missing parent record as invalid and refuses provisioning", async () => {
    await installChild("icfg_child_orphaned", {
      parentAccountId: "parent-account",
      parentInstallationId: "icfg_parent_missing",
    });

    const parent = await resolveParent(
      await getInstallation("icfg_child_orphaned"),
    );
    expect(parent).toMatchObject({
      state: "invalid",
      reason: "parent_record_missing",
    });

    const { plans } = await getProductBillingPlans(
      "product",
      "icfg_child_orphaned",
    );
    expect(plans).toEqual([]);

    await expect(
      provisionResource("icfg_child_orphaned", {
        productId: "product",
        name: "db",
        metadata: {},
        billingPlanId: "pro200",
      }),
    ).rejects.toMatchObject({
      installationId: "icfg_child_orphaned",
      reason: "parent_record_missing",
    });
  });

  it("resolves a valid parent and restricts children to the parent plan", async () => {
    await installIntegration("icfg_parent", baseInstallRequest, {
      accountId: "account-parent",
    });
    await installChild("icfg_child_resolved", {
      parentAccountId: "parent-account",
      parentInstallationId: "icfg_parent",
    });

    const parent = await resolveParent(
      await getInstallation("icfg_child_resolved"),
    );
    expect(parent).toMatchObject({
      state: "resolved",
      parentInstallationId: "icfg_parent",
      parentPlanId: "pro200",
    });

    const { plans } = await getProductBillingPlans(
      "product",
      "icfg_child_resolved",
    );
    expect(plans.map((plan) => plan.id)).toEqual(["pro200"]);

    await expect(
      provisionResource("icfg_child_resolved", {
        productId: "product",
        name: "db",
        metadata: {},
        billingPlanId: "default",
      }),
    ).rejects.toThrow(
      "Billing plan default is not available to child installation",
    );

    const provisioned = await provisionResource("icfg_child_resolved", {
      productId: "product",
      name: "db",
      metadata: {},
      billingPlanId: "pro200",
    });
    expect(provisioned.billingPlan.id).toBe("pro200");
  });
});
