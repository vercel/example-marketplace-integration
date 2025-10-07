import { z } from "zod";

// Types

export const datetimeSchema = z.string().datetime();

export type ResourceStatusType = z.infer<typeof resourceStatusSchema>;

export const resourceStatusSchema = z.enum([
  "ready",
  "pending",
  "onboarding",
  "suspended",
  "resumed",
  "uninstalled",
  "error",
]);

export const currencySchema = z.string().min(1);

export const unitsSchema = z.string().min(1);

export const usageTypeSchema = z.enum(["total", "interval", "rate"]);

export type UsageType = z.infer<typeof usageTypeSchema>;

const metadataSchema = z.record(z.unknown());

const notificationSchema = z.object({
  level: z.enum(["info", "warn", "error"]),
  title: z.string().max(100),
  message: z.string().optional(),
  href: z.string().url().optional(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const billingPlanSchema = z.object({
  // Partner-defined ID.
  // Ex: "pro200"
  id: z.string().min(1),

  type: z.enum(["prepayment", "subscription"]),

  // Ex: "Hobby"
  name: z.string().min(1),

  // Ex: "Use all you want up to 20G"
  description: z.string().min(1),

  // Plan scope. To use `installation` level billing plans,
  // Installation-level Billing Plans must be enabled on your integration.
  scope: z.enum(["installation", "resource"]).optional().default("resource"),

  // Set this field to `false` if this plan is completely free.
  // Defaults to `true`.
  paymentMethodRequired: z.boolean().optional().default(true),

  // Use when payment method is required. The amount will be used to
  // test if the user's payment method can handle the charge.
  // Can only be used with "subscription" plans.
  preauthorizationAmount: z.number().optional(),

  // Optional, ignored unless plan type is `prepayment`. The minimum amount of credits
  // a user can purchase at a time. The value is a decimal string representation of
  // the USD amount, e.g. "4.39" for $4.39 USD as the minumum amount.
  minimumAmount: currencySchema.optional(),

  // Optional, ignored unless plan type is `prepayment`. The maximum amount of credits
  // a user can purchase at a time. The value is a decimal string representation of
  // the USD amount, e.g. "86.82" for $86.82 USD as the maximum amount.
  maximumAmount: currencySchema.optional(),

  // Plan's cost, if available. Only relevant for fixed-cost plans.
  // Ex: "$20.00/month"
  cost: z.string().min(1).optional(),

  // Plan's details always expanded.
  // Ex: [
  //   { label: "SOC2 Compliant" },
  //   { label: "SLA", value: "99.999%" },
  //   { label: "Maximum database size", value: "20G" },
  //   { label: "Cost per extra 100K queries", value: "$0.10"},
  // ]
  highlightedDetails: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1).optional(),
      }),
    )
    .optional()
    .describe("Highlighted plan's details"),

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
      }),
    )
    .optional(),

  // Deprecated.
  maxResources: z.number().optional(),

  // Policies to be accepted by the customer.
  // Ex: [{ id: 'toc', name: 'ACME Terms of Service', url: 'https://partner/toc' }]
  requiredPolicies: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        url: z.string().min(1),
      }),
    )
    .optional(),

  // Date/time when the plan becomes effective. Important for billing plan changes.
  effectiveDate: datetimeSchema.optional(),

  // If true, the plan is disabled and cannot be selected. Example: "disabled": true` for "Hobby" plan.
  disabled: z.boolean().optional(),
});

export type BillingPlan = z.infer<typeof billingPlanSchema>;

// Account and Installation

export const installIntegrationRequestSchema = z.object({
  scopes: z.array(z.string()),
  acceptedPolicies: z.record(datetimeSchema),
  credentials: z.object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
  }),
});

export const updateInstallationRequestSchema = z.object({
  billingPlanId: z.string(),
});

export type InstallIntegrationRequest = z.infer<
  typeof installIntegrationRequestSchema
>;

export const installationResponseSchema = z.object({
  // For installation-level billing only.
  billingPlan: billingPlanSchema.optional(),
  notification: notificationSchema.optional(),
});

export type InstallationResponse = z.infer<typeof installationResponseSchema>;

// Billing

export const getBillingPlansResponseSchema = z.object({
  plans: z.array(billingPlanSchema),
});

export type GetBillingPlansResponse = z.infer<
  typeof getBillingPlansResponseSchema
>;

// Provisioning of direct purchases

export const balanceSchema = z.object({
  currencyValueInCents: z.number(),
  credit: z.string().optional(),
  nameLabel: z.string().optional(),
  resourceId: z.string().optional(),
});

export type Balance = z.infer<typeof balanceSchema>;

export const submitPrepaymentBalanceRequestSchema = z.object({
  timestamp: datetimeSchema,
  balances: z.array(balanceSchema),
});

export type SubmitPrepaymentBalanceRequest = z.infer<
  typeof submitPrepaymentBalanceRequestSchema
>;

export const provisionPurchaseRequestSchema = z.object({
  invoiceId: z.string().min(1),
});

export type ProvisionPurchaseRequest = z.infer<
  typeof provisionPurchaseRequestSchema
>;

export const provisionPurchaseResponseSchema = z.object({
  timestamp: datetimeSchema,
  balances: z.array(balanceSchema),
});

export type ProvisionPurchaseResponse = z.infer<
  typeof provisionPurchaseResponseSchema
>;

// Product

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
  status: resourceStatusSchema,

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
  });

export type ProvisionResourceRequest = z.infer<
  typeof provisionResourceRequestSchema
>;

const environmentOverrideTargets = z.enum([
  "production",
  "preview",
  "development",
]);

export const provisionResourceResponseSchema = resourceSchema.extend({
  secrets: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      environmentOverrides: z
        .record(environmentOverrideTargets, z.string())
        .optional(),
    }),
  ),
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
    status: resourceStatusSchema.optional(),
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

export const importResourceRequestSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  status: resourceStatusSchema,
  metadata: metadataSchema.optional(),
  billingPlan: billingPlanSchema.optional(),
  notification: notificationSchema.optional(),
  secrets: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
});

export type ImportResourceRequest = z.infer<typeof importResourceRequestSchema>;

export const importResourceResponseSchema = z.object({
  name: z.string().min(1),
});

export type ImportResourceResponse = z.infer<
  typeof importResourceResponseSchema
>;

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
  // An absent value indicates installation-level usage.
  resourceId: z.string().optional(),

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

  items: z
    .array(
      z.object({
        resourceId: z.string().optional(),
        billingPlanId: z.string(),
        name: z.string(),
        price: currencySchema,
        quantity: z.number(),
        units: unitsSchema,
        total: currencySchema,
        details: z.string().optional(),
        start: datetimeSchema.optional(),
        end: datetimeSchema.optional(),
      }),
    )
    .optional(),
  discounts: z
    .array(
      z.object({
        resourceId: z.string().optional(),
        billingPlanId: z.string(),
        name: z.string(),
        amount: currencySchema,
        details: z.string().optional(),
        start: datetimeSchema.optional(),
        end: datetimeSchema.optional(),
      }),
    )
    .optional(),
});

export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceItemSchema = z.object({
  // Partner's billing plan ID.
  billingPlanId: z.string(),

  // Partner's resource ID.
  resourceId: z.string().optional(),

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

export const invoiceDiscountSchema = z.object({
  // Partner's billing plan ID.
  billingPlanId: z.string(),

  // Partner's resource ID.
  resourceId: z.string().optional(),

  // Start and end are only needed if different from the period's start/end.
  start: datetimeSchema.optional(),
  end: datetimeSchema.optional(),

  // Item details.
  name: z.string(),
  details: z.string().optional(),
  amount: currencySchema,
});

export type InvoiceDiscount = z.infer<typeof invoiceDiscountSchema>;

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

  // Invoice discounts.
  discounts: z.array(invoiceDiscountSchema).optional(),
});

export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequest>;

export const refundInvoiceRequestSchema = z.object({
  action: z.enum(["refund"]),
  total: currencySchema,
  reason: z.string(),
});

export type RefundInvoiceRequest = z.infer<typeof refundInvoiceRequestSchema>;

export type UpdateDeploymentActionRequest = z.infer<
  typeof updateDeploymentActionRequestSchema
>;

export type DeploymentActionOutcome = z.infer<
  typeof deploymentActionResourceSecretsOutcomeSchema
>;

export const deploymentActionResourceSecretsOutcomeSchema = z.object({
  kind: z.literal("resource-secrets"),
  secrets: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    }),
  ),
});

export const updateDeploymentActionRequestSchema = z.object({
  status: z.enum(["succeeded", "failed"]),
  statusText: z.string().optional(),
  outcomes: z.array(deploymentActionResourceSecretsOutcomeSchema).optional(),
});

// Webhooks

const webhookEventBaseSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  unknown: z.boolean().optional(),
});

const webhookEventBasePayloadSchema = z.object({
  user: z
    .object({
      id: z.string(),
    })
    .passthrough()
    .optional(),
  team: z
    .object({
      id: z.string(),
    })
    .passthrough()
    .optional(),
  // Deprecated, use `integrations` instead.
  installationIds: z.string().array().optional().describe("@deprecated"),
  integrations: z
    .object({
      installationId: z.string(),
      resources: z
        .object({
          externalResourceId: z.string(),
        })
        .array()
        .optional(),
    })
    .array()
    .optional(),
});

const invoiceWebhookPayloadSchema = webhookEventBasePayloadSchema.extend({
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
    payload: webhookEventBasePayloadSchema.extend({
      configuration: z.object({
        id: z.string(),
      }),
    }),
  });

export type DeploymentIntegrationActionStartEvent = z.infer<
  typeof deploymentIntegrationActionStartEventSchema
>;

const deploymentWebhookPayloadEventSchema =
  webhookEventBasePayloadSchema.extend({
    deployment: z
      .object({
        id: z.string(),
      })
      .passthrough(),
  });

const deploymentIntegrationActionStartEventSchema =
  webhookEventBaseSchema.extend({
    type: z.literal("deployment.integration.action.start"),
    payload: deploymentWebhookPayloadEventSchema.extend({
      installationId: z.string(),
      action: z.string(),
      resourceId: z.string(),
      configuration: z.object({
        id: z.string(),
      }),
    }),
  });

const deploymentEvent = <T extends string>(eventType: T) => {
  return webhookEventBaseSchema.extend({
    type: z.literal(eventType),
    payload: deploymentWebhookPayloadEventSchema,
  });
};

const deploymentCheckrunStartEventSchema = webhookEventBaseSchema.extend({
  type: z.literal("deployment.checkrun.start"),
  payload: webhookEventBasePayloadSchema.extend({
    checkRun: z
      .object({
        id: z.string(),
        checkId: z.string(),
        source: z
          .object({
            kind: z.literal("integration"),
            integrationConfigurationId: z.string(),
            externalResourceId: z.string().optional(),
          })
          .passthrough(),
        deploymentId: z.string(),
        timeout: z.number().optional(),
      })
      .passthrough(),
    deployment: z
      .object({
        id: z.string(),
      })
      .passthrough(),
  }),
});

export type DeploymentCheckrunStartEventSchema = z.infer<
  typeof deploymentCheckrunStartEventSchema
>;

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export const webhookEventSchema = z.discriminatedUnion("type", [
  invoiceCreatedWebhookEventSchema,
  invoicePaidWebhookEventSchema,
  invoiceNotPaidWebhookEventSchema,
  integrationConfigurationRemovedWebhookEventSchema,
  deploymentIntegrationActionStartEventSchema,
  deploymentCheckrunStartEventSchema,
  deploymentEvent("deployment.created"),
  deploymentEvent("deployment.ready"),
  deploymentEvent("deployment.promoted"),
  deploymentEvent("deployment.succeeded"),
  deploymentEvent("deployment.error"),
  deploymentEvent("deployment.cancelled"),
  deploymentEvent("deployment.check-rerequested"),
]);

export type UnknownWebhookEvent = z.infer<typeof unknownWebhookEventSchema>;
export const unknownWebhookEventSchema = webhookEventBaseSchema.extend({
  type: z.string(),
  payload: z.unknown(),
  unknown: z.boolean().optional().default(true),
});

// Claims

export const createClaimRequestSchema = z.object({
  claimId: z.string().optional(),
  resourceIds: z.array(z.string()),
  expiration: z.number().min(1),
});

export const verifyClaimRequestSchema = z.object({
  targetInstallationId: z.string().min(1),
});

export const completeClaimRequestSchema = z.object({
  targetInstallationId: z.string().min(1),
});

export interface Claim {
  transferId: string;
  claimedByInstallationId?: string;
  targetInstallationIds: string[];
  status: "unclaimed" | "verified" | "complete";
  sourceInstallationId: string;
  resourceIds: string[];
  expiration: number;
}
