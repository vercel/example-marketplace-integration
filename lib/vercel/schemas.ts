import { z } from "zod";

// Types

export const datetimeSchema = z.string().datetime();

export const resourceStateSchema = z.enum([
  "ready",
  "pending",
  "suspended",
  "resumed",
  "uninstalled",
]);

export const currencySchema = z.string().min(1);

export const unitsSchema = z.string().min(1);

export const usageTypeSchema = z.enum(["total", "interval", "rate"]);

export type UsageType = z.infer<typeof usageTypeSchema>;

// Account and Installation

export const installIntegrationRequestSchema = z.object({
  scopes: z.array(z.string()),
  acceptedPolicies: z.record(datetimeSchema),
  credentials: z.object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
  }),
});

export type InstallIntegrationRequest = z.infer<
  typeof installIntegrationRequestSchema
>;

// Billing

export const billingPlanSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["prepayment", "invoice"]),
  name: z.string().min(1),
  description: z.string().min(1),
  quote: z
    .array(
      z.object({
        line: z.string().min(1),
        amount: z.string().min(1),
      })
    )
    .optional(),
  maxResources: z.number().optional(),
  requiredPolicies: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().min(1),
      })
    )
    .optional(),
  effectiveDate: datetimeSchema.optional(),
});

export type BillingPlan = z.infer<typeof billingPlanSchema>;

export const getBillingPlansResponseSchema = z.object({
  plans: z.array(billingPlanSchema),
});

export type GetBillingPlansResponse = z.infer<
  typeof getBillingPlansResponseSchema
>;

// Product

const metadataSchema = z.record(z.unknown());

const notificationSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  title: z.string().max(100),
  message: z.string().optional(),
  href: z.string().url().optional(),
});

export const resourceSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  billingPlan: billingPlanSchema,
  name: z.string().min(1),
  metadata: metadataSchema,
  customerEmail: z.string().email().optional(),
  status: resourceStateSchema,
  notification: notificationSchema.optional(),
});

export type Resource = z.infer<typeof resourceSchema>;

export const provisionResourceRequestSchema = resourceSchema
  .pick({
    productId: true,
    name: true,
    metadata: true,
  })
  .extend({
    billingPlanId: z.string().min(1),
    acceptedPolicies: z.record(datetimeSchema),
  });

export type ProvisionResourceRequest = z.infer<
  typeof provisionResourceRequestSchema
>;

export const provisionResourceResponseSchema = resourceSchema.extend({
  secrets: z.array(z.object({ name: z.string(), value: z.string() })),
});

export type ProvisionResourceResponse = z.infer<
  typeof provisionResourceResponseSchema
>;

export const updateResourceRequestSchema = resourceSchema
  .pick({
    name: true,
    metadata: true,
  })
  .extend({
    billingPlanId: z.string().min(1).optional(),
    status: resourceStateSchema.optional(),
  })
  .partial();

export type UpdateResourceRequest = z.infer<typeof updateResourceRequestSchema>;

export const updateResourceResponseSchema = resourceSchema;

export type UpdateResourceResponse = z.infer<
  typeof updateResourceResponseSchema
>;

export const listResourcesResponseSchema = z.object({
  resources: z.array(resourceSchema),
});

export type ListResourcesResponse = z.infer<typeof listResourcesResponseSchema>;

export const getResourceResponseSchema = resourceSchema;

export type GetResourceResponse = z.infer<typeof getResourceResponseSchema>;

// Billing data.

export const billingItemSchema = z.object({
  billingPlanId: z.string(),
  resourceId: z.string().optional(),
  start: datetimeSchema.optional(),
  end: datetimeSchema.optional(),
  name: z.string(),
  details: z.string().optional(),
  price: currencySchema,
  quantity: z.number(),
  units: unitsSchema,
  total: currencySchema,
});

export type BillingItem = z.infer<typeof billingItemSchema>;

export const resourceUsageSchema = z.object({
  resourceId: z.string(),
  name: z.string(),
  type: usageTypeSchema,
  units: unitsSchema,
  dayValue: z.number(),
  periodValue: z.number(),
  planValue: z.number().optional(),
});

export type ResourceUsage = z.infer<typeof resourceUsageSchema>;

export const billingDataSchema = z.object({
  timestamp: datetimeSchema,
  eod: datetimeSchema,
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),
  billing: z.array(billingItemSchema),
  usage: z.array(resourceUsageSchema),
});

export type BillingData = z.infer<typeof billingDataSchema>;
