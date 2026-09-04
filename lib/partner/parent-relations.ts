import { kv } from "@/lib/redis";
import type { OidcClaims } from "@/lib/vercel/auth";
import type { AccountInfo } from "@/lib/vercel/schemas";

export interface ParentRelation {
  parentAccountId?: string;
  parentInstallationId?: string;
  parentAccount?: AccountInfo;
}

export interface ParentAttributionIssue {
  type: "missing" | "mismatch";
  operation: string;
  observedAt: string;
  expectedParentAccountId?: string;
  expectedParentInstallationId?: string;
  receivedParentAccountId?: string;
  receivedParentInstallationId?: string | null;
}

export interface ParentAttributionStatus {
  missingCount: number;
  mismatchCount: number;
  lastIssue: ParentAttributionIssue | null;
}

interface StoredInstallationSummary {
  accountId?: string;
  account?: AccountInfo;
  parent?: ParentRelation;
  billingPlanId?: string;
  deletedAt?: number;
}

export function getParentRelation(
  claims: OidcClaims,
  parentAccount?: AccountInfo,
): ParentRelation | undefined {
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
  previous: ParentRelation | undefined,
  next: ParentRelation | undefined,
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

export async function recordParentAttribution(
  claims: OidcClaims,
  operation: string,
): Promise<void> {
  const installation = await kv.get<StoredInstallationSummary>(
    claims.installation_id,
  );
  if (installation?.deletedAt) return;
  const expected = installation?.parent;
  if (!expected) return;

  const missing = !claims.parent_account_id || !claims.parent_installation_id;
  const mismatch =
    !missing &&
    (claims.parent_account_id !== expected.parentAccountId ||
      claims.parent_installation_id !== expected.parentInstallationId);
  if (!missing && !mismatch) return;

  const type = missing ? "missing" : "mismatch";
  const issue: ParentAttributionIssue = {
    type,
    operation,
    observedAt: new Date().toISOString(),
    expectedParentAccountId: expected.parentAccountId,
    expectedParentInstallationId: expected.parentInstallationId,
    receivedParentAccountId: claims.parent_account_id,
    receivedParentInstallationId: claims.parent_installation_id,
  };
  await Promise.all([
    kv.incr(`${claims.installation_id}:parent-attribution:${type}`),
    kv.set(`${claims.installation_id}:parent-attribution:last-issue`, issue),
  ]);
  console.warn("Parent attribution issue", {
    installationId: claims.installation_id,
    ...issue,
  });
}

export async function getParentAttributionStatus(
  installationId: string,
): Promise<ParentAttributionStatus> {
  const [missingCount, mismatchCount, lastIssue] = await Promise.all([
    kv.get<number>(`${installationId}:parent-attribution:missing`),
    kv.get<number>(`${installationId}:parent-attribution:mismatch`),
    kv.get<ParentAttributionIssue>(
      `${installationId}:parent-attribution:last-issue`,
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
        getParentAttributionStatus(installationId),
      ]);
      if (
        !installation ||
        installation.deletedAt ||
        installation.parent?.parentInstallationId !== parentInstallationId
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
