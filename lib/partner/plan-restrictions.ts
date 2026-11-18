import type { BillingPlan } from "@/lib/vercel/schemas";

export interface PlanRestriction {
  reason?: string;
}

// Plans a resource can't switch to, keyed by billing plan ID.
export type PlanRestrictions = Record<string, PlanRestriction>;

export class PlanRestrictedError extends Error {
  constructor(
    readonly planId: string,
    readonly reason: string | undefined,
  ) {
    super(`Billing plan ${planId} is not available for this resource`);
  }
}

export function applyPlanRestrictions(
  plans: BillingPlan[],
  restrictions: PlanRestrictions | undefined,
  currentPlanId: string | undefined,
): BillingPlan[] {
  return plans.map((plan) => {
    const restriction = restrictions?.[plan.id];
    if (!restriction || plan.id === currentPlanId) {
      return plan;
    }
    return {
      ...plan,
      disabled: true,
      ...(restriction.reason ? { disabledReason: restriction.reason } : {}),
    };
  });
}

export function assertPlanAllowed(
  restrictions: PlanRestrictions | undefined,
  planId: string,
  currentPlanId: string | undefined,
): void {
  const restriction = restrictions?.[planId];
  if (restriction && planId !== currentPlanId) {
    throw new PlanRestrictedError(planId, restriction.reason);
  }
}
