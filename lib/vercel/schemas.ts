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

  // Set this to `false` if this plan is completely free.
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

// Get Invoice.

export const invoiceSchema = z.object({
  test: z.boolean().optional(),
  invoiceId: z.string(),
  externalId: z.string().optional(),
  invoiceDate: datetimeSchema,
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),
  memo: z.string().optional(),
  state: z.enum([
    "pending",
    "scheduled",
    "issued",
    "paid",
    "notpaid",
    "refund_requested",
    "refunded",
  ]),
  total: currencySchema,
  refundTotal: currencySchema.optional(),
  refundReason: z.string().optional(),
  created: datetimeSchema,
  updated: datetimeSchema,
});

export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceItemSchema = z.object({
  // Resource and billing plan IDs.
  resourceId: z.string(),
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

export const refundInvoiceRequest = z.object({
  action: z.enum(["refund"]),
  total: currencySchema,
  reason: z.string(),
});

export type RefundInvoiceRequest = z.infer<typeof refundInvoiceRequest>;

// Webhooks

export const webhookEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.number(),
  payload: z.unknown(),
}) as unknown as z.ZodType<WebhookEvent>;

export interface WebhookEvent {
  id: string;
  type: string;
  createdAt: number;
  payload: unknown;
}

export const invoiceWebhookPayloadSchema = z.object({
  installationId: z.string().min(1),
  period: z.object({
    start: datetimeSchema,
    end: datetimeSchema,
  }),
  invoiceId: z.string().min(1),
  invoiceDate: datetimeSchema,
  invoiceTotal: currencySchema,
});

export type InvoiceWebhookPayload = z.infer<typeof invoiceWebhookPayloadSchema>;

export interface InvoiceCreatedEvent extends WebhookEvent {
  type: "marketplace.invoice.created";
  payload: InvoiceWebhookPayload;
}

export function isInvoiceCreatedEvent(
  event: WebhookEvent
): event is InvoiceCreatedEvent {
  return event.type === "marketplace.invoice.created";
}

export interface InvoicePaidEvent extends WebhookEvent {
  type: "marketplace.invoice.paid";
  payload: InvoiceWebhookPayload;
}

export function isInvoicePaidEvent(
  event: WebhookEvent
): event is InvoicePaidEvent {
  return event.type === "marketplace.invoice.paid";
}

export interface InvoiceNotPaidEvent extends WebhookEvent {
  type: "marketplace.invoice.notpaid";
  payload: InvoiceWebhookPayload;
}

export function isInvoiceNotPaidEvent(
  event: WebhookEvent
): event is InvoiceNotPaidEvent {
  return event.type === "marketplace.invoice.notpaid";
}
