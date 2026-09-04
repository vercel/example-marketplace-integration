import { kv } from "@/lib/redis";
import type { OidcClaims } from "@/lib/vercel/auth";
import type { AccountInfo } from "@/lib/vercel/schemas";

export interface OrganizationRelation {
  parentAccountId?: string;
  parentInstallationId?: string;
  parentAccount?: AccountInfo;
}

export interface OrganizationAttributionIssue {
  type: "missing" | "mismatch";
  operation: string;
  observedAt: string;
  expectedParentAccountId?: string;
  expectedParentInstallationId?: string;
  receivedParentAccountId?: string;
  receivedParentInstallationId?: string | null;
}

export interface OrganizationAttributionStatus {
  missingCount: number;
  mismatchCount: number;
  lastIssue: OrganizationAttributionIssue | null;
}

interface StoredInstallationSummary {
  accountId?: string;
  account?: AccountInfo;
  organization?: OrganizationRelation;
  billingPlanId?: string;
  deletedAt?: number;
}

export function getOrganizationRelation(
  claims: OidcClaims,
  parentAccount?: AccountInfo,
): OrganizationRelation | undefined {
  if (
    !claims.parent_account_id &&
    !claims.parent_installation_id &&
    !parentAccount
  ) {
    return undefined;
  }

  return {
    parentAccountId: claims.parent_account_id,
    parentInstallationId: claims.parent_installation_id ?? undefined,
    parentAccount,
  };
}

export async function updateParentChildIndex(
  childInstallationId: string,
  previous: OrganizationRelation | undefined,
  next: OrganizationRelation | undefined,
): Promise<void> {
  const pipeline = kv.pipeline();
  if (previous?.parentInstallationId) {
    pipeline.lrem(
      `${previous.parentInstallationId}:child-installations`,
      0,
      childInstallationId,
    );
  }
  if (next?.parentInstallationId) {
    pipeline.lrem(
      `${next.parentInstallationId}:child-installations`,
      0,
      childInstallationId,
    );
    pipeline.lpush(
      `${next.parentInstallationId}:child-installations`,
      childInstallationId,
    );
  }
  await pipeline.exec();
}

export async function recordOrganizationAttribution(
  claims: OidcClaims,
  operation: string,
): Promise<void> {
  const installation = await kv.get<StoredInstallationSummary>(
    claims.installation_id,
  );
  if (installation?.deletedAt) return;
  const expected = installation?.organization;
  if (!expected) return;

  const missing = !claims.parent_account_id || !claims.parent_installation_id;
  const mismatch =
    !missing &&
    (claims.parent_account_id !== expected.parentAccountId ||
      claims.parent_installation_id !== expected.parentInstallationId);
  if (!missing && !mismatch) return;

  const type = missing ? "missing" : "mismatch";
  const issue: OrganizationAttributionIssue = {
    type,
    operation,
    observedAt: new Date().toISOString(),
    expectedParentAccountId: expected.parentAccountId,
    expectedParentInstallationId: expected.parentInstallationId,
    receivedParentAccountId: claims.parent_account_id,
    receivedParentInstallationId: claims.parent_installation_id,
  };
  await Promise.all([
    kv.incr(`${claims.installation_id}:organization-attribution:${type}`),
    kv.set(
      `${claims.installation_id}:organization-attribution:last-issue`,
      issue,
    ),
  ]);
  console.warn("Organization attribution issue", {
    installationId: claims.installation_id,
    ...issue,
  });
}

export async function getOrganizationAttributionStatus(
  installationId: string,
): Promise<OrganizationAttributionStatus> {
  const [missingCount, mismatchCount, lastIssue] = await Promise.all([
    kv.get<number>(`${installationId}:organization-attribution:missing`),
    kv.get<number>(`${installationId}:organization-attribution:mismatch`),
    kv.get<OrganizationAttributionIssue>(
      `${installationId}:organization-attribution:last-issue`,
    ),
  ]);
  return {
    missingCount: missingCount ?? 0,
    mismatchCount: mismatchCount ?? 0,
    lastIssue,
  };
}

export async function listChildInstallations(parentInstallationId: string) {
  const [ids, parentInstallation] = await Promise.all([
    kv.lrange<string>(`${parentInstallationId}:child-installations`, 0, -1),
    kv.get<StoredInstallationSummary>(parentInstallationId),
  ]);
  const children = await Promise.all(
    ids.map(async (installationId) => {
      const [installation, resourceCount, attribution] = await Promise.all([
        kv.get<StoredInstallationSummary>(installationId),
        kv.llen(`${installationId}:resources`),
        getOrganizationAttributionStatus(installationId),
      ]);
      if (
        !installation ||
        installation.deletedAt ||
        installation.organization?.parentInstallationId !== parentInstallationId
      ) {
        await kv.lrem(
          `${parentInstallationId}:child-installations`,
          0,
          installationId,
        );
        return undefined;
      }
      return {
        installationId,
        accountId: installation.accountId,
        accountName: installation.account?.name,
        billingPlanId: parentInstallation?.billingPlanId,
        resourceCount,
        attribution,
      };
    }),
  );
  return children.filter((child) => child !== undefined);
}
