import { z } from "zod";

// Account and Installation

export const installIntegrationRequestSchema = z.object({
  accountId: z.string().min(1),
  scopes: z.array(z.string()),
  acceptedPolicies: z.record(z.string().datetime()),
  credentials: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    token_type: z.string().min(1),
    expires_in: z.number(),
  }),
});

export type InstallIntegrationRequest = z.infer<
  typeof installIntegrationRequestSchema
>;

// Product

const metadataSchema = z.record(z.unknown());

export const resourceSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  billingPlan: z.string().min(1),
  name: z.string().min(1),
  metadata: metadataSchema,
  customerEmail: z.string().email().optional(),
  status: z.enum(["ready", "pending", "suspended", "uninstalled"]),
});

export type Resource = z.infer<typeof resourceSchema>;

export const provisionResourceRequestSchema = resourceSchema
  .pick({
    productId: true,
    billingPlan: true,
    name: true,
    metadata: true,
  })
  .extend({
    acceptedPolicies: z.record(z.string().datetime()),
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
    billingPlan: true,
    metadata: true,
  })
  .extend({
    status: z.enum(["suspended", "resumed"]),
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

// Billing

export const billingPlanSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["prepayment", "invoice"]),
  name: z.string().min(1),
  description: z.string().min(1),
  quote: z.object({
    line: z.string().min(1),
    amount: z.string().min(1),
  }),
  maxProducts: z.number(),
  requiredPolicies: z.array(z.string()),
});

export type BillingPlan = z.infer<typeof billingPlanSchema>;

export const getBillingPlansResponseSchema = z.object({
  plans: z.array(billingPlanSchema),
});

export type GetBillingPlansResponse = z.infer<
  typeof getBillingPlansResponseSchema
>;
