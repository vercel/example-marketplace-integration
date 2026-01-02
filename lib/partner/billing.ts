import type { BillingPlan } from "../vercel/schemas";

export const billingPlans: BillingPlan[] = [
  {
    id: "default",
    scope: "resource",
    name: "Hobby",
    cost: "Free",
    description: "Use all you want up to 20G",
    type: "subscription",
    paymentMethodRequired: false,
    details: [
      { label: "Max storage size", value: "20G" },
      { label: "Max queries per day", value: "100K" },
    ],
    highlightedDetails: [
      { label: "High availability", value: "Single zone" },
      { label: "Dataset size", value: "100Mb" },
    ],
    maxResources: 3,
    requiredPolicies: [
      { id: "1", name: "Terms of Service", url: "https://partner/toc" },
    ],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
  {
    id: "pro200",
    scope: "resource",
    name: "Pro",
    cost: "$10 every Gb",
    type: "subscription",
    description: "$10 every Gb",
    paymentMethodRequired: true,
    preauthorizationAmount: 5,
    highlightedDetails: [
      { label: "High availability", value: "Multi zone" },
      { label: "Dataset size", value: "500Mb" },
    ],
    details: [
      { label: "20G storage and 200K queries", value: "$25.00" },
      { label: "Extra storage", value: "$10.00 per 10G" },
      { label: "Unlimited daily Command Limit" },
    ],
    requiredPolicies: [
      { id: "1", name: "Terms of Service", url: "https://partner/toc" },
    ],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
  {
    id: "prepay10",
    scope: "resource",
    name: "Prepay 10",
    cost: "$10 for 1,000 tokens",
    type: "prepayment",
    description: "$10 for 1,000 tokens",
    paymentMethodRequired: true,
    minimumAmount: "10.00",
    highlightedDetails: [{ label: "Token types", value: "input/output" }],
    details: [{ label: "Token types", value: "input/output" }],
    effectiveDate: "2021-01-01T00:00:00Z",
  },
];
