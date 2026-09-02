import { kv } from "@/lib/redis";
import type { OidcClaims } from "@/lib/vercel/auth";
import type {
  GetBillingPlansResponse,
  InstallIntegrationRequest,
  ProvisionResourceRequest,
  ProvisionResourceResponse,
} from "@/lib/vercel/schemas";

interface ClaimObservation {
  accountId: string;
  installationId: string;
  parentAccountId?: string;
  parentInstallationId?: string | null;
}

interface InstallationObservation extends ClaimObservation {
  acceptedPolicies: Record<string, string>;
  account?: { name?: string; url: string };
  parentAccount?: { name?: string; url: string };
  observedAt: string;
}

interface PlanObservation extends ClaimObservation {
  productId: string;
  metadata: Record<string, unknown>;
  returnedPlanIds: string[];
  observedAt: string;
}

interface ResourceObservation extends ClaimObservation {
  resourceId: string;
  productId: string;
  billingPlanId: string;
  metadata: Record<string, unknown>;
  observedAt: string;
}

interface OrganizationValidationRecord {
  installationId: string;
  installation: InstallationObservation | null;
  plan: PlanObservation | null;
  resources: ResourceObservation[];
}

const VALIDATION_TTL_SECONDS = 60 * 60;
const validationKey = (installationId: string, stage: string) =>
  `organization-validation:${installationId}:${stage}`;

const observeClaims = (claims: OidcClaims): ClaimObservation => ({
  accountId: claims.account_id,
  installationId: claims.installation_id,
  parentAccountId: claims.parent_account_id,
  parentInstallationId: claims.parent_installation_id,
});

const validationMetadata = (metadata: Record<string, unknown>) => ({
  region: metadata.region,
});

export async function recordValidationBestEffort(
  stage: string,
  callback: () => Promise<void>,
): Promise<void> {
  try {
    await callback();
  } catch {
    console.warn(`organization validation recording failed at ${stage}`);
  }
}

export async function recordInstallationValidation(
  claims: OidcClaims,
  request: InstallIntegrationRequest,
): Promise<void> {
  const observation: InstallationObservation = {
    ...observeClaims(claims),
    acceptedPolicies: request.acceptedPolicies,
    account: request.account
      ? { name: request.account.name, url: request.account.url }
      : undefined,
    parentAccount: request.parentAccount
      ? { name: request.parentAccount.name, url: request.parentAccount.url }
      : undefined,
    observedAt: new Date().toISOString(),
  };
  await kv.set(
    validationKey(claims.installation_id, "installation"),
    observation,
    {
      ex: VALIDATION_TTL_SECONDS,
    },
  );
}

export async function recordPlanValidation(
  claims: OidcClaims,
  productId: string,
  metadata: Record<string, unknown>,
  response: GetBillingPlansResponse,
): Promise<void> {
  const observation: PlanObservation = {
    ...observeClaims(claims),
    productId,
    metadata: validationMetadata(metadata),
    returnedPlanIds: response.plans.map((plan) => plan.id),
    observedAt: new Date().toISOString(),
  };
  await kv.set(validationKey(claims.installation_id, "plan"), observation, {
    ex: VALIDATION_TTL_SECONDS,
  });
}

export async function recordResourceValidation(
  claims: OidcClaims,
  request: ProvisionResourceRequest,
  response: ProvisionResourceResponse,
): Promise<void> {
  const resource: ResourceObservation = {
    ...observeClaims(claims),
    resourceId: response.id,
    productId: request.productId,
    billingPlanId: request.billingPlanId,
    metadata: validationMetadata(request.metadata),
    observedAt: new Date().toISOString(),
  };
  await kv.set(validationKey(claims.installation_id, "resource"), resource, {
    ex: VALIDATION_TTL_SECONDS,
  });
}

export async function getOrganizationValidation(
  installationId: string,
): Promise<OrganizationValidationRecord> {
  const [installation, plan, resource] = await Promise.all([
    kv.get<InstallationObservation>(
      validationKey(installationId, "installation"),
    ),
    kv.get<PlanObservation>(validationKey(installationId, "plan")),
    kv.get<ResourceObservation>(validationKey(installationId, "resource")),
  ]);
  return {
    installationId,
    installation,
    plan,
    resources: resource ? [resource] : [],
  };
}
