# Vercel Native Integration Database Architecture

This document describes how to configure a Prisma database schema to meet Vercel's expectations for Native Marketplace Integrations.

## Overview

Vercel Native Integrations require partners to maintain a database that tracks:

1. **Installations** - Team-level connections between Vercel and your system
2. **Resources** - Provisioned instances of your products (databases, services, etc.)
3. **Billing Plans** - Pricing tiers and subscription models
4. **Invoices** - Billing records and payment tracking
5. **Claims/Transfers** - Resource ownership transfers between installations
6. **Deployment Actions** - Actions triggered during Vercel deployments
7. **Webhook Events** - Audit log of events received from Vercel

## Core Concepts

### Installation Hierarchy

```
Installation (Team-scoped)
├── Resources (Product instances)
│   ├── Secrets (Environment variables)
│   └── Project Connections
├── Billing Plan
├── Balance (for prepaid plans)
└── Invoices
```

### Key Principles

- **Installations are team-scoped, not user-scoped** - They survive personnel changes
- **One installation per team maximum** - Reinstallation creates a new instance
- **Resources track usage independently** - Each resource has its own billing data
- **Never assume prior state on reinstall** - Treat each installation as fresh

---

## Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// =============================================================================
// INSTALLATIONS
// =============================================================================

model Installation {
  id        String   @id // Vercel's installationId
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // OAuth credentials received during installation
  accessToken String
  tokenType   String @default("Bearer")

  // Installation type
  type InstallationType @default(MARKETPLACE)

  // Scopes granted during installation
  scopes String[] @default([])

  // Policies accepted by the user (policy ID -> accepted timestamp)
  acceptedPolicies Json @default("{}")

  // Current billing plan (for installation-level billing)
  billingPlanId String?
  billingPlan   BillingPlan? @relation(fields: [billingPlanId], references: [id])

  // Prepaid balance (in cents) for prepayment plans
  balanceCents Int @default(0)

  // Installation status
  status InstallationStatus @default(ACTIVE)

  // Soft delete timestamp
  deletedAt DateTime?

  // Active notification shown in Vercel dashboard
  notification Json? // { level: "info"|"warn"|"error", title: string, message?: string, href?: string }

  // Relations
  resources      Resource[]
  invoices       Invoice[]
  webhookEvents  WebhookEvent[]
  transfersFrom  ResourceTransfer[] @relation("TransferSource")
  transfersTo    ResourceTransfer[] @relation("TransferTarget")

  @@index([status])
  @@index([deletedAt])
}

enum InstallationType {
  MARKETPLACE
  EXTERNAL
}

enum InstallationStatus {
  ACTIVE
  SUSPENDED
  UNINSTALLED
}

// =============================================================================
// BILLING PLANS
// =============================================================================

model BillingPlan {
  id        String   @id // Partner-defined ID, e.g., "pro", "enterprise"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Plan type
  type BillingPlanType

  // Plan scope (resource-level is recommended)
  scope BillingPlanScope @default(RESOURCE)

  // Display information
  name        String // e.g., "Pro Plan"
  description String // e.g., "Up to 20GB storage"
  cost        String? // e.g., "$20.00/month"

  // Payment requirements
  paymentMethodRequired  Boolean @default(true)
  preauthorizationAmount Int? // Amount in cents for payment method verification

  // For prepayment plans only
  minimumAmountCents Int?
  maximumAmountCents Int?

  // Feature details (JSON arrays)
  highlightedDetails Json @default("[]") // [{ label: string, value?: string }]
  details            Json @default("[]") // [{ label: string, value?: string }]

  // Required policies to accept
  requiredPolicies Json @default("[]") // [{ id: string, name: string, url: string }]

  // Plan availability
  disabled      Boolean   @default(false)
  effectiveDate DateTime?

  // Relations
  installations Installation[]
  resources     Resource[]
  invoiceItems  InvoiceItem[]

  @@index([type])
  @@index([scope])
  @@index([disabled])
}

enum BillingPlanType {
  PREPAYMENT
  SUBSCRIPTION
}

enum BillingPlanScope {
  INSTALLATION
  RESOURCE
}

// =============================================================================
// PRODUCTS
// =============================================================================

model Product {
  id        String   @id // Partner-defined product ID/slug
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name        String
  description String?

  // Metadata schema (JSON Schema for form fields in Vercel dashboard)
  metadataSchema Json @default("{}")

  // Product visibility
  visibility ProductVisibility @default(PRIVATE)

  // Relations
  resources         Resource[]
  deploymentActions DeploymentAction[]

  @@index([visibility])
}

enum ProductVisibility {
  PUBLIC
  PRIVATE
}

// =============================================================================
// RESOURCES
// =============================================================================

model Resource {
  id        String   @id @default(cuid()) // Partner's resource ID
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Parent installation
  installationId String
  installation   Installation @relation(fields: [installationId], references: [id], onDelete: Cascade)

  // Product this resource belongs to
  productId String
  product   Product @relation(fields: [productId], references: [id])

  // Billing plan for this resource
  billingPlanId String
  billingPlan   BillingPlan @relation(fields: [billingPlanId], references: [id])

  // Resource configuration
  name     String
  metadata Json   @default("{}") // User-provided metadata matching product's metadataSchema
  status   ResourceStatus @default(PENDING)

  // Prepaid balance (in cents) for resource-level prepayment
  balanceCents Int @default(0)

  // Active notification shown in Vercel dashboard
  notification Json? // { level: "info"|"warn"|"error", title: string, message?: string, href?: string }

  // Relations
  secrets            ResourceSecret[]
  projectConnections ResourceProjectConnection[]
  invoiceItems       InvoiceItem[]
  usageRecords       ResourceUsage[]
  deploymentActions  DeploymentActionExecution[]
  transfersFrom      ResourceTransfer[]          @relation("ResourceTransferSource")

  @@index([installationId])
  @@index([productId])
  @@index([status])
}

enum ResourceStatus {
  PENDING
  ONBOARDING
  READY
  SUSPENDED
  RESUMED
  UNINSTALLED
  ERROR
}

// =============================================================================
// RESOURCE SECRETS
// =============================================================================

model ResourceSecret {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  resourceId String
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  // Secret name (environment variable name)
  name String

  // Encrypted secret value (use application-level encryption)
  value String

  // Environment-specific overrides
  developmentValue String?
  previewValue     String?
  productionValue  String?

  // For secrets rotation
  expiresAt DateTime?
  rotatedAt DateTime?

  @@unique([resourceId, name])
  @@index([resourceId])
  @@index([expiresAt])
}

// =============================================================================
// PROJECT CONNECTIONS
// =============================================================================

model ResourceProjectConnection {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  resourceId String
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  // Vercel project ID
  vercelProjectId String

  // Which environments this connection applies to
  environments Environment[] @default([PRODUCTION, PREVIEW, DEVELOPMENT])

  // Connection status
  status ConnectionStatus @default(ACTIVE)

  @@unique([resourceId, vercelProjectId])
  @@index([resourceId])
  @@index([vercelProjectId])
}

enum Environment {
  PRODUCTION
  PREVIEW
  DEVELOPMENT
}

enum ConnectionStatus {
  ACTIVE
  DISCONNECTED
}

// =============================================================================
// INVOICES
// =============================================================================

model Invoice {
  id        String   @id @default(cuid()) // Partner's invoice ID
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  installationId String
  installation   Installation @relation(fields: [installationId], references: [id], onDelete: Cascade)

  // Vercel's invoice ID (received after submission)
  vercelInvoiceId String? @unique

  // External/partner invoice ID for reference
  externalId String?

  // Invoice dates
  invoiceDate DateTime

  // Billing period
  periodStart DateTime
  periodEnd   DateTime

  // Invoice state
  state InvoiceState @default(PENDING)

  // Amounts in cents
  totalCents       Int
  refundTotalCents Int?
  refundReason     String?

  // Additional notes
  memo String?

  // Test mode flags
  isTest       Boolean @default(false)
  testValidate Boolean @default(false)
  testResult   InvoiceTestResult?

  // Relations
  items     InvoiceItem[]
  discounts InvoiceDiscount[]

  @@index([installationId])
  @@index([state])
  @@index([vercelInvoiceId])
  @@index([periodStart, periodEnd])
}

enum InvoiceState {
  PENDING
  SCHEDULED
  ISSUED
  PAID
  NOTPAID
  REFUND_REQUESTED
  REFUNDED
}

enum InvoiceTestResult {
  PAID
  NOTPAID
}

model InvoiceItem {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  // Optional resource association
  resourceId String?
  resource   Resource? @relation(fields: [resourceId], references: [id])

  // Billing plan reference
  billingPlanId String
  billingPlan   BillingPlan @relation(fields: [billingPlanId], references: [id])

  // Item details
  name     String
  details  String?
  priceCents Int // Price per unit in cents
  quantity Float
  units    String // e.g., "GB", "hours", "requests"
  totalCents Int

  // Custom period (if different from invoice period)
  periodStart DateTime?
  periodEnd   DateTime?

  @@index([invoiceId])
  @@index([resourceId])
}

model InvoiceDiscount {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  invoiceId String
  invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  // Optional resource association
  resourceId String?

  // Billing plan reference
  billingPlanId String

  // Discount details
  name       String
  details    String?
  amountCents Int // Discount amount in cents

  // Custom period
  periodStart DateTime?
  periodEnd   DateTime?

  @@index([invoiceId])
}

// =============================================================================
// RESOURCE USAGE
// =============================================================================

model ResourceUsage {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  // Optional resource (null = installation-level usage)
  resourceId String?
  resource   Resource? @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  // For installation-level usage
  installationId String?

  // Metric information
  name  String    // e.g., "Database size", "API requests"
  type  UsageType
  units String    // e.g., "GB", "requests"

  // Values
  dayValue    Float // Value for the day
  periodValue Float // Value for the billing period
  planValue   Float? // Limit defined by the plan

  // Timestamp for this usage record
  timestamp DateTime
  endOfDay  DateTime

  // Billing period
  periodStart DateTime
  periodEnd   DateTime

  @@index([resourceId])
  @@index([installationId])
  @@index([timestamp])
  @@index([periodStart, periodEnd])
}

enum UsageType {
  TOTAL    // Measured total (e.g., database size)
  INTERVAL // Usage during period (e.g., I/O, queries)
  RATE     // Rate of usage (e.g., QPS)
}

// =============================================================================
// RESOURCE TRANSFERS (Claims)
// =============================================================================

model ResourceTransfer {
  id        String   @id @default(cuid()) // transferId / claimId
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Source installation
  sourceInstallationId String
  sourceInstallation   Installation @relation("TransferSource", fields: [sourceInstallationId], references: [id])

  // Target installation (set when transfer is verified/completed)
  targetInstallationId String?
  targetInstallation   Installation? @relation("TransferTarget", fields: [targetInstallationId], references: [id])

  // Resources being transferred
  resources Resource[] @relation("ResourceTransferSource")

  // Transfer status
  status TransferStatus @default(UNCLAIMED)

  // Claim expiration
  expiresAt DateTime

  // Claimed by (installation ID that claimed this transfer)
  claimedByInstallationId String?

  @@index([sourceInstallationId])
  @@index([targetInstallationId])
  @@index([status])
  @@index([expiresAt])
}

enum TransferStatus {
  UNCLAIMED
  VERIFIED
  COMPLETE
  EXPIRED
  CANCELLED
}

// =============================================================================
// DEPLOYMENT ACTIONS
// =============================================================================

model DeploymentAction {
  id        String   @id // Action slug defined in Integration Console
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  productId String
  product   Product @relation(fields: [productId], references: [id])

  // Display name for the action
  name String

  // Default configuration suggestions
  defaultConfig Json @default("{}")

  // Relations
  executions DeploymentActionExecution[]

  @@index([productId])
}

model DeploymentActionExecution {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Deployment action definition
  actionId String
  action   DeploymentAction @relation(fields: [actionId], references: [id])

  // Resource this action runs on
  resourceId String
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)

  // Vercel identifiers
  vercelDeploymentId    String
  vercelConfigurationId String

  // Execution status
  status     DeploymentActionStatus @default(PENDING)
  statusText String?

  // Resulting secrets (encrypted JSON)
  resultSecrets Json? // [{ name: string, value: string }]

  // Completion timestamp
  completedAt DateTime?

  @@index([resourceId])
  @@index([vercelDeploymentId])
  @@index([status])
}

enum DeploymentActionStatus {
  PENDING
  SUCCEEDED
  FAILED
  CANCELLED
}

// =============================================================================
// WEBHOOK EVENTS (Audit Log)
// =============================================================================

model WebhookEvent {
  id        String   @id // Vercel's event ID
  createdAt DateTime @default(now())

  // Event type
  type String // e.g., "marketplace.invoice.paid", "deployment.created"

  // Associated installation (if applicable)
  installationId String?
  installation   Installation? @relation(fields: [installationId], references: [id], onDelete: SetNull)

  // Full event payload (for debugging/auditing)
  payload Json

  // Processing status
  processed   Boolean   @default(false)
  processedAt DateTime?
  error       String?

  @@index([type])
  @@index([installationId])
  @@index([createdAt])
  @@index([processed])
}
```

---

## Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INSTALLATION                                    │
│  (One per Vercel team - represents the integration installation)            │
└─────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ 1:N                │ 1:N                │ 1:N
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    RESOURCE     │  │     INVOICE     │  │  WEBHOOK_EVENT  │
│  (Provisioned   │  │  (Billing       │  │  (Audit log)    │
│   instances)    │  │   records)      │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │
         │ 1:N                │ 1:N
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ RESOURCE_SECRET │  │  INVOICE_ITEM   │
│ (Env variables) │  │  (Line items)   │
└─────────────────┘  └─────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PROJECT_CONNECTION                                       │
│  (Links resources to Vercel projects with environment targeting)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Required API Endpoint Mappings

| Vercel Endpoint | Database Operation |
|-----------------|-------------------|
| `POST /install` | Create `Installation` |
| `DELETE /install` | Soft delete `Installation` (set `deletedAt`) |
| `GET /billing-plans` | Query `BillingPlan` table |
| `POST /resources` | Create `Resource` with `ResourceSecret` records |
| `PATCH /resources/:id` | Update `Resource` |
| `DELETE /resources/:id` | Delete `Resource` (cascade deletes secrets) |
| `GET /resources` | List `Resource` by installation |
| `GET /resources/:id` | Get single `Resource` with secrets |
| `POST /billing-data` | Create `ResourceUsage` records |
| `POST /invoices` | Create `Invoice` with `InvoiceItem` records |
| `POST /claims` | Create `ResourceTransfer` |
| `POST /claims/:id/verify` | Update `ResourceTransfer` status to VERIFIED |
| `POST /claims/:id/complete` | Update `ResourceTransfer` status to COMPLETE |
| `POST /webhooks` | Create `WebhookEvent` record |

---

## Security Considerations

### Secrets Encryption

Always encrypt sensitive data at rest:

```typescript
// Example: Encrypt secrets before storing
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### Access Token Storage

- Store `accessToken` encrypted in the database
- Implement token refresh logic if using OAuth
- Never log or expose access tokens

### Webhook Verification

Always verify webhook signatures using your Integration Secret:

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## Best Practices

### 1. Installation Handling

- Always fetch fresh team info via Vercel's API - don't cache user details
- Treat reinstallations as completely new installations
- Implement proper cleanup on uninstall (soft delete, not hard delete)

### 2. Resource Provisioning

- Use idempotent resource creation
- Generate unique resource IDs on your side (don't rely on external IDs)
- Track resource status through its lifecycle

### 3. Billing

- Default to resource-level billing for better transparency
- Store all amounts in cents to avoid floating-point issues
- Keep detailed audit trails of billing changes

### 4. Secrets Management

- Support per-environment secret overrides
- Implement secrets rotation with grace periods
- Never return secrets in list operations (only in get/create)

### 5. Webhook Processing

- Store all webhook events for auditing
- Process webhooks idempotently (use event ID for deduplication)
- Implement retry logic for failed webhook processing

---

## Migration from Redis (Current Implementation)

The current example uses Redis KV for storage. To migrate to Prisma:

| Redis Key Pattern | Prisma Model |
|-------------------|--------------|
| `{installationId}` | `Installation` |
| `{installationId}:resources` | `Resource` (query by installationId) |
| `{installationId}:resource:{resourceId}` | `Resource` |
| `{installationId}:balance` | `Installation.balanceCents` |
| `{installationId}:{resourceId}:balance` | `Resource.balanceCents` |
| `installations` (list) | `Installation` (query all active) |
| `webhook_events` | `WebhookEvent` |
| `transfer-request:{transferId}` | `ResourceTransfer` |

---

## Example Queries

### Get Installation with Resources

```typescript
const installation = await prisma.installation.findUnique({
  where: { id: installationId },
  include: {
    resources: {
      include: {
        secrets: true,
        billingPlan: true,
      },
    },
    billingPlan: true,
  },
});
```

### Create Resource with Secrets

```typescript
const resource = await prisma.resource.create({
  data: {
    installationId,
    productId,
    billingPlanId,
    name,
    metadata,
    status: 'READY',
    secrets: {
      create: [
        {
          name: 'DATABASE_URL',
          value: encrypt(connectionString),
          productionValue: encrypt(productionConnectionString),
        },
      ],
    },
  },
  include: {
    secrets: true,
    billingPlan: true,
  },
});
```

### Get Billing Data for Period

```typescript
const usage = await prisma.resourceUsage.findMany({
  where: {
    installationId,
    periodStart: { gte: startDate },
    periodEnd: { lte: endDate },
  },
  orderBy: { timestamp: 'desc' },
});
```

---

## References

- [Vercel Native Integration Concepts](https://vercel.com/docs/integrations/create-integration/native-integration)
- [Marketplace Product Guide](https://vercel.com/docs/integrations/create-integration/marketplace-product)
- [Marketplace Flows](https://vercel.com/docs/integrations/create-integration/marketplace-flows)
- [Deployment Integration Actions](https://vercel.com/docs/integrations/create-integration/deployment-integration-action)
- [Integrations API Reference](https://vercel.com/docs/integrations/create-integration/marketplace-api/reference)
- [Integration Approval Checklist](https://vercel.com/docs/integrations/create-integration/approval-checklist)
