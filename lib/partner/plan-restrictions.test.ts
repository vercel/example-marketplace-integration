import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async () => {
  const { createMemoryKv } = await import("../test/memory-kv");
  return createMemoryKv();
});

import {
  getResource,
  getResourceBillingPlans,
  installIntegration,
  provisionResource,
  setResourcePlanRestrictions,
  updateResource,
} from "@/lib/partner";
import { PlanRestrictedError } from "@/lib/partner/plan-restrictions";
import * as redis from "@/lib/redis";
import type { createMemoryKv } from "@/lib/test/memory-kv";

const { store } = redis as unknown as ReturnType<typeof createMemoryKv>;

const INSTALLATION_ID = "icfg_plan_restrictions";

beforeEach(async () => {
  store.clear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async () => new Response(null, { status: 204 }));
  await installIntegration(INSTALLATION_ID, {
    type: "marketplace",
    scopes: ["read-write:integration-resource"],
    acceptedPolicies: { toc: "2024-01-01T00:00:00Z" },
    credentials: { access_token: "token", token_type: "Bearer" },
  });
});

async function provisionOnPro() {
  return provisionResource(INSTALLATION_ID, {
    productId: "my-product",
    name: "my-resource",
    metadata: {},
    billingPlanId: "pro200",
  });
}

async function getPlan(resourceId: string, planId: string) {
  const { plans } = await getResourceBillingPlans(INSTALLATION_ID, resourceId);
  return plans.find((plan) => plan.id === planId);
}

describe("resource plan restrictions", () => {
  it("returns a restricted plan as disabled with its reason", async () => {
    const resource = await provisionOnPro();
    await setResourcePlanRestrictions(INSTALLATION_ID, resource.id, {
      default: { reason: "Delete your read replicas before downgrading." },
    });

    expect(await getPlan(resource.id, "default")).toMatchObject({
      disabled: true,
      disabledReason: "Delete your read replicas before downgrading.",
    });
    expect(await getPlan(resource.id, "prepay10")).not.toHaveProperty(
      "disabled",
    );
  });

  it("returns a restricted plan without a reason as disabled only", async () => {
    const resource = await provisionOnPro();
    await setResourcePlanRestrictions(INSTALLATION_ID, resource.id, {
      default: {},
    });

    const plan = await getPlan(resource.id, "default");
    expect(plan?.disabled).toBe(true);
    expect(plan).not.toHaveProperty("disabledReason");
  });

  it("never disables the resource's current plan", async () => {
    const resource = await provisionOnPro();
    await setResourcePlanRestrictions(INSTALLATION_ID, resource.id, {
      pro200: { reason: "Not applicable" },
    });

    expect(await getPlan(resource.id, "pro200")).not.toHaveProperty("disabled");
  });

  it("rejects switching to a restricted plan and keeps the current plan", async () => {
    const resource = await provisionOnPro();
    await setResourcePlanRestrictions(INSTALLATION_ID, resource.id, {
      default: { reason: "Delete your read replicas before downgrading." },
    });

    await expect(
      updateResource(INSTALLATION_ID, resource.id, {
        billingPlanId: "default",
      }),
    ).rejects.toThrow(PlanRestrictedError);
    expect(
      (await getResource(INSTALLATION_ID, resource.id))?.billingPlan?.id,
    ).toBe("pro200");
  });

  it("keeps a restriction saved while a resource edit is in flight", async () => {
    const resource = await provisionOnPro();

    await Promise.all([
      updateResource(INSTALLATION_ID, resource.id, { name: "renamed" }),
      setResourcePlanRestrictions(INSTALLATION_ID, resource.id, {
        default: { reason: "Delete your read replicas before downgrading." },
      }),
    ]);

    expect((await getPlan(resource.id, "default"))?.disabled).toBe(true);
    expect((await getResource(INSTALLATION_ID, resource.id))?.name).toBe(
      "renamed",
    );
  });

  it("keeps plan restrictions out of Get Resource", async () => {
    const resource = await provisionOnPro();
    await setResourcePlanRestrictions(INSTALLATION_ID, resource.id, {
      default: {},
    });

    expect(await getResource(INSTALLATION_ID, resource.id)).not.toHaveProperty(
      "planRestrictions",
    );
  });
});
