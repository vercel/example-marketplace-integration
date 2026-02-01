import { listResources } from "@/lib/partner";
import type {
  BillingData,
  BillingItem,
  BillingPlan,
  ResourceUsage,
} from "@/lib/vercel/schemas";

export async function mockBillingData(
  installationId: string,
): Promise<BillingData> {
  const timestamp = new Date();
  const year = timestamp.getUTCFullYear();
  const month = timestamp.getUTCMonth();
  const day = timestamp.getUTCDate();
  const bod = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const eod = new Date(Date.UTC(year, month, day, 23, 59, 59));
  const startOfMoth = new Date(Date.UTC(year, month, 1));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));

  const { resources } = await listResources(installationId);
  if (resources.length === 0) {
    return {
      timestamp: timestamp.toISOString(),
      eod: eod.toISOString(),
      period: {
        start: startOfMoth.toISOString(),
        end: endOfMonth.toISOString(),
      },
      billing: [],
      usage: [],
    };
  }

  const pricingModel: Record<string, { units: string; price: number }> = {
    Storage: {
      price: 0.1,
      units: "GB",
    },
    Queries: {
      price: 0.01,
      units: "1k",
    },
  } as const;

  const resourceUsage = resources.flatMap((r) =>
    mockUsageData(r, timestamp, startOfMoth, bod),
  );

  const installationUsage = Object.values(
    resourceUsage.reduce(
      (acc, resourceUsage) => {
        let usage: ResourceUsage = acc[resourceUsage.name];
        if (!acc[resourceUsage.name]) {
          usage = {
            ...resourceUsage,
            resourceId: undefined,
            dayValue: 0,
            periodValue: 0,
            planValue: undefined,
          };
          acc[resourceUsage.name] = usage;
        }
        switch (usage.type) {
          case "total":
          case "interval":
            usage.dayValue += resourceUsage.dayValue;
            usage.periodValue += resourceUsage.periodValue;
            break;
          case "rate":
            usage.dayValue = Math.max(usage.dayValue, resourceUsage.dayValue);
            usage.periodValue = Math.max(
              usage.periodValue,
              resourceUsage.periodValue,
            );
            break;
        }
        return acc;
      },
      {} as Record<string, ResourceUsage>,
    ),
  );
  const usage = [...installationUsage, ...resourceUsage];

  const billing = resourceUsage
    .map((u) => {
      const resource = resources.find((r) => r.id === u.resourceId);
      const pricing = pricingModel[u.name];
      if (!resource || !pricing) {
        return undefined;
      }
      return {
        resourceId: resource.id,
        billingPlanId: resource.billingPlan.id,
        name: u.name,
        price: pricing.price.toFixed(2),
        units: u.units,
        quantity: u.periodValue,
        total: (pricing.price * u.periodValue).toFixed(2),
      } satisfies BillingItem;
    })
    .filter(isNotNull);

  return {
    timestamp: timestamp.toISOString(),
    eod: eod.toISOString(),
    period: {
      start: startOfMoth.toISOString(),
      end: endOfMonth.toISOString(),
    },
    billing,
    usage,
  };
}

function isNotNull<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function mockUsageData(
  resource: {
    id: string;
    billingPlan: BillingPlan;
  },
  timestamp: Date,
  periodStart: Date,
  dayStart: Date,
): ResourceUsage[] {
  // May 1, 2024
  const baseTimestamp = Date.UTC(2024, 4, 1);
  const minutesSinceBase = (timestamp.getTime() - baseTimestamp) / 1000 / 60;

  // Since the period start and today.
  const minutesSincePeriod =
    (timestamp.getTime() - periodStart.getTime()) / 1000 / 60;
  const minutesSinceToday =
    (timestamp.getTime() - dayStart.getTime()) / 1000 / 60;

  // Start with 100GB and every day since May 1, 2024 add 1GB.
  const storageTotal = 100 + minutesSinceBase * (1 / 24 / 60);

  // Every 3rd minute we will use either 50, 75 or 100 queries.
  const queriesByMinutes = (minutes: number) =>
    Math.floor(minutes / 3) * 50 +
    Math.floor(Math.max(minutes - 1, 0) / 3) * 75 +
    Math.floor(Math.max(minutes - 2, 0) / 3) * 100;
  const queriesTotal = queriesByMinutes(minutesSincePeriod) / 1000;
  const queriesToday = queriesByMinutes(minutesSinceToday) / 1000;
  return [
    {
      resourceId: resource.id,
      name: "Storage",
      type: "total",
      units: "GB",
      dayValue: storageTotal,
      periodValue: storageTotal,
      planValue: 500,
    },
    {
      resourceId: resource.id,
      name: "Queries",
      type: "interval",
      units: "1k",
      dayValue: queriesToday,
      periodValue: queriesTotal,
      planValue: 2000000,
    },
  ];
}
