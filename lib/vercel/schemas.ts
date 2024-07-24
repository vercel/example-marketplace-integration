import { z } from "zod";

// Types

export const datetimeSchema = z.string().datetime();

export const resourceStateSchema = z.enum([
  "ready",
  "pending",
  "suspended",
  "resumed",
  "uninstalled",
  "error",
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
  // Partner-defined ID.
  // Ex: "pro200"
  id: z.string().min(1),

  type: z.enum(["prepayment", "subscription"]),

  // Ex: "Hobby"
  name: z.string().min(1),

  // Ex: "Use all you want up to 20G"
  description: z.string().min(1),

  // Set this field to `false` if this plan is completely free.
  // Defaults to `true`.
  paymentMethodRequired: z.boolean().optional().default(true),

  // Plan's cost, if available. Only relevant for fixed-cost plans.
  // Ex: "$20.00/month"
  cost: z.string().min(1).optional(),

  // Plan's details.
  // Ex: [
  //   { label: "SOC2 Compliant" },
  //   { label: "SLA", value: "99.999%" },
  //   { label: "Maximum database size", value: "20G" },
  //   { label: "Cost per extra 100K queries", value: "$0.10"},
  // ]
  details: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1).optional(),
      })
    )
    .optional(),

  // Max number of that can be installed on this plan.
  // Ex: `maxResources: 1` for "Hobby" plan.
  maxResources: z.number().optional(),

  // Policies to be accepted by the customer.
  // Ex: [{ id: 'toc', name: 'ACME Terms of Service', url: 'https://partner/toc' }]
  requiredPolicies: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().min(1),
      })
    )
    .optional(),

  // Date/time when the plan becomes effective. Important for billing plan changes.
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

export type Notification = z.infer<typeof notificationSchema>;

export const resourceSchema = z.object({
  // Partner's resource ID.
  id: z.string().min(1),

  // Partner's product ID/slug.
  productId: z.string().min(1),

  // Billing plan details.
  billingPlan: billingPlanSchema,

  // Resource's name. Normally set by the user.
  name: z.string().min(1),

  // Resource's metadata. Normally set/selected by the user.
  // Based on the registered metadata schema.
  metadata: metadataSchema,

  // Resource's status.
  status: resourceStateSchema,

  // Resource's active notification,
  // Ex: { level: 'warn', title: 'Database is nearing maximum planned size' }
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
  // Partner's billing plan ID.
  billingPlanId: z.string(),

  // Partner's resource ID.
  resourceId: z.string().optional(),

  // Start and end are only needed if different from the period's start/end.
  // E.g. in case of a plan change.
  start: datetimeSchema.optional(),
  end: datetimeSchema.optional(),

  // Line item name and details.
  name: z.string(),
  details: z.string().optional(),

  // Price per unit.
  price: currencySchema,

  // Quantity of units.
  quantity: z.number(),

  // Units of the quantity.
  units: unitsSchema,

  // Total amount.
  total: currencySchema,
});

export type BillingItem = z.infer<typeof billingItemSchema>;

export const resourceUsageSchema = z.object({
  // Partner's resource ID.
  resourceId: z.string(),

  // Metric name.
  // Ex: "Database size"
  name: z.string(),

  // Type of the metric.
  // - total: measured total value, such as Database size
  // - interval: usage during the period, such as i/o or number of queries.
  // - rate: rate of usage, such as queries per second.
  type: usageTypeSchema,

  // Metric units.
  // Ex: "GB".
  units: unitsSchema,

  // Metric value for the day. Could be a final or an interim value for the day.
  dayValue: z.number(),

  // Metric value for the billing period. Could be a final or an interim value for the period.
  periodValue: z.number(),

  // The limit value of the metric for a billing period, if a limit is defined by the plan.
  planValue: z.number().optional(),
});

export type ResourceUsage = z.infer<typeof resourceUsageSchema>;

export const billingDataSchema = z.object({
  // The update timestamp.
  timestamp: datetimeSchema,

  // End of day timestamp for daily usage.
  eod: datetimeSchema,

  // Period for the billing cycle.
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),

  // Billing data (interim invoicing data).
  billing: z.array(billingItemSchema),

  // Usage data.
  usage: z.array(resourceUsageSchema),
});

export type BillingData = z.infer<typeof billingDataSchema>;

// Get Invoice.

export const invoiceSchema = z.object({
  test: z.boolean().optional(),

  // Vercel Marketplace invoice ID.
  invoiceId: z.string(),

  // Partner-defined invoice ID.
  externalId: z.string().optional(),

  // Invoice date.
  invoiceDate: datetimeSchema,

  // Billing cycle period.
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),

  // Invoice's memo.
  memo: z.string().optional(),

  // Invoice's state.
  state: z.enum([
    "pending",
    "scheduled",
    "issued",
    "paid",
    "notpaid",
    "refund_requested",
    "refunded",
  ]),

  // Invoice's total.
  total: currencySchema,

  // Refund amount if refund was requested.
  refundTotal: currencySchema.optional(),

  // Refund reason if refund was requested.
  refundReason: z.string().optional(),

  created: datetimeSchema,
  updated: datetimeSchema,
});

export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceItemSchema = z.object({
  // Partner's resource ID.
  resourceId: z.string(),

  // Partner's billing plan ID.
  billingPlanId: z.string(),

  // Start and end are only needed if different from the period's start/end.
  start: datetimeSchema.optional(),
  end: datetimeSchema.optional(),

  // Item details.
  name: z.string(),
  details: z.string().optional(),
  price: currencySchema,
  quantity: z.number(),
  units: unitsSchema,
  total: currencySchema,
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const createInvoiceRequest = z.object({
  // Test mode.
  test: z
    .object({
      validate: z.boolean().optional(),
      result: z.enum(["paid", "notpaid"]).optional(),
    })
    .optional(),

  // Partner-defined invoice ID.
  externalId: z.string().optional(),

  // Invoice date. Must be within the period's start and end.
  invoiceDate: datetimeSchema,

  // Subscription period for this billing cycle.
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),

  // Additional memo for the invoice.
  memo: z.string().optional(),

  // Invoice items.
  items: z.array(invoiceItemSchema),
});

export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequest>;

export const refundInvoiceRequestSchema = z.object({
  action: z.enum(["refund"]),
  total: currencySchema,
  reason: z.string(),
});

export type RefundInvoiceRequest = z.infer<typeof refundInvoiceRequestSchema>;

// Webhooks

const webhookEventBaseSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
});

const invoiceWebhookPayloadSchema = z.object({
  installationId: z.string().min(1),
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),
  invoiceId: z.string().min(1),
  invoiceDate: datetimeSchema,
  invoiceTotal: currencySchema,
});

const invoiceCreatedWebhookEventSchema = webhookEventBaseSchema.extend({
  type: z.literal("marketplace.invoice.created"),
  payload: invoiceWebhookPayloadSchema,
});

const invoicePaidWebhookEventSchema = webhookEventBaseSchema.extend({
  type: z.literal("marketplace.invoice.paid"),
  payload: invoiceWebhookPayloadSchema,
});

const invoiceNotPaidWebhookEventSchema = webhookEventBaseSchema.extend({
  type: z.literal("marketplace.invoice.notpaid"),
  payload: invoiceWebhookPayloadSchema,
});

const integrationConfigurationRemovedWebhookEventSchema =
  webhookEventBaseSchema.extend({
    type: z.literal("integration-configuration.removed"),
    payload: z.object({
      configuration: z.object({
        id: z.string(),
      }),
    }),
  });

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export const webhookEventSchema = z.discriminatedUnion("type", [
  invoiceCreatedWebhookEventSchema,
  invoicePaidWebhookEventSchema,
  invoiceNotPaidWebhookEventSchema,
  integrationConfigurationRemovedWebhookEventSchema,
]);
