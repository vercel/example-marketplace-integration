import type { ResourceCredentialType } from "@/lib/vercel/schemas";
import { z } from "zod";

export const credentialTypesChangeResponseSchema = z.enum([
  "confirm",
  "hold",
  "reject",
]);

export type CredentialTypesChangeResponse = z.infer<
  typeof credentialTypesChangeResponseSchema
>;

export interface CredentialTypesChange {
  to: ResourceCredentialType[];
  requestedAt: number;
  confirmedAt?: number;
}

export interface ResourceCredentials {
  credentialTypes?: ResourceCredentialType[];
  credentialTypesChange?: CredentialTypesChange;
  credentialTypesChangeResponse?: CredentialTypesChangeResponse;
}

export function acceptsCredentialType(
  credentialTypes: readonly ResourceCredentialType[] | undefined,
  type: ResourceCredentialType,
): boolean {
  return credentialTypes?.includes(type) ?? true;
}

export function isSameCredentialTypes(
  a: readonly ResourceCredentialType[],
  b: readonly ResourceCredentialType[],
): boolean {
  return a.length === b.length && a.every((type) => b.includes(type));
}

export function isCredentialTypesChangePending(
  change: CredentialTypesChange | undefined,
): change is CredentialTypesChange {
  return change !== undefined && change.confirmedAt === undefined;
}
