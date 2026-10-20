import { nanoid } from "nanoid";
import { deleteResource, findInstallation, storeImportedResource } from ".";
import { kv } from "../redis";
import { importResource } from "../vercel/marketplace-api";
import type { Resource } from "../vercel/schemas";
import { getProviderResource } from "./provider-accounts";
import { exampleResourceCustomClaims } from "./resource-claims";

// Import Existing Resource flow:
// https://vercel.com/docs/integrations/create-integration/marketplace-flows#import-existing-resources-flow
//
// 1. Vercel redirects the browser to the Import Resource URL with
//    installation_id, product_id (optional), state, and return.
// 2. The partner authenticates the user and lets them pick a resource.
// 3. The partner registers it with PUT /v1/installations/:id/resources/:id
//    using ownership "linked", and only then redirects the browser to
//    `return` with installation_id, resource_id, and the unchanged state.

// Vercel's state expires after 12 hours; a pending import cannot outlive it.
const IMPORT_REQUEST_TTL_SECONDS = 12 * 60 * 60;

export interface ResourceImportRequest {
  id: string;
  installationId: string;
  // Product slug. Only present when the user started the import from a
  // specific product.
  productId?: string;
  // Opaque and single-use. Returned to Vercel unchanged.
  state: string;
  returnUrl: string;
  createdAt: number;
}

export type ResourceImportErrorCode =
  | "invalid_request"
  | "invalid_return_url"
  | "unknown_installation"
  | "expired"
  | "resource_not_found"
  | "product_required";

export class ResourceImportError extends Error {
  constructor(
    readonly code: ResourceImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ResourceImportError";
  }
}

// `return` must point at Vercel. Redirecting anywhere else would hand the
// state and resource ID to whoever crafted the link.
export function parseReturnUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ResourceImportError(
      "invalid_return_url",
      "return is not a valid URL",
    );
  }
  const isVercelHost =
    url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com");
  if (url.protocol !== "https:" || !isVercelHost) {
    throw new ResourceImportError(
      "invalid_return_url",
      "return must be an https://vercel.com URL",
    );
  }
  return url;
}

export async function startResourceImport(
  searchParams: URLSearchParams,
): Promise<ResourceImportRequest> {
  const installationId = searchParams.get("installation_id");
  const state = searchParams.get("state");
  const returnValue = searchParams.get("return");
  const productId = searchParams.get("product_id") || undefined;

  if (!installationId || !state || !returnValue) {
    throw new ResourceImportError(
      "invalid_request",
      "installation_id, state, and return are required",
    );
  }

  const returnUrl = parseReturnUrl(returnValue);

  const installation = await findInstallation(installationId);
  if (!installation || installation.deletedAt) {
    throw new ResourceImportError(
      "unknown_installation",
      `Installation ${installationId} is not installed`,
    );
  }

  const request: ResourceImportRequest = {
    id: nanoid(32),
    installationId,
    productId,
    state,
    returnUrl: returnUrl.toString(),
    createdAt: Date.now(),
  };
  await kv.set(`resource-import:${request.id}`, request, {
    ex: IMPORT_REQUEST_TTL_SECONDS,
  });
  return request;
}

export async function getResourceImport(
  importId: string,
): Promise<ResourceImportRequest | null> {
  return kv.get<ResourceImportRequest>(`resource-import:${importId}`);
}

export async function completeResourceImport({
  importId,
  accountId,
  providerResourceId,
  productId: selectedProductId,
}: {
  importId: string;
  accountId: string;
  providerResourceId: string;
  // Used only when Vercel did not send product_id.
  productId?: string;
}): Promise<{ redirectUrl: string; resource: Resource }> {
  const request = await getResourceImport(importId);
  if (!request) {
    throw new ResourceImportError(
      "expired",
      "This import has expired or was already completed. Start again from Vercel.",
    );
  }

  const installation = await findInstallation(request.installationId);
  if (!installation || installation.deletedAt) {
    throw new ResourceImportError(
      "unknown_installation",
      `Installation ${request.installationId} is not installed`,
    );
  }

  const productId = request.productId ?? selectedProductId?.trim();
  if (!productId) {
    throw new ResourceImportError(
      "product_required",
      "Choose the product to import this resource as",
    );
  }

  const providerResource = await getProviderResource(
    accountId,
    providerResourceId,
  );
  if (!providerResource) {
    throw new ResourceImportError(
      "resource_not_found",
      "That resource does not exist in your account",
    );
  }

  // The partner's resource ID becomes the resource ID Vercel stores, so
  // Vercel's later Get Resource and SSO calls reference the same resource.
  // No billingPlan: linked resources are billed by the partner, not Vercel.
  const resource: Resource = {
    id: providerResource.id,
    productId,
    ownership: "linked",
    name: providerResource.name,
    status: "ready",
    metadata: {},
  };
  const customClaims = exampleResourceCustomClaims(resource);

  const { created } = await storeImportedResource(
    request.installationId,
    resource,
    customClaims,
  );

  try {
    await importResource(request.installationId, resource.id, {
      ownership: "linked",
      productId: resource.productId,
      name: resource.name,
      status: resource.status,
      metadata: resource.metadata,
      customClaims,
      secrets: [{ name: "TOP_SECRET", value: providerResource.secret }],
    });
  } catch (error) {
    if (created) {
      await deleteResource(request.installationId, resource.id);
    }
    throw error;
  }

  // Consumed only after Vercel has the resource, so a failed registration
  // can be retried from the same page.
  await kv.del(`resource-import:${request.id}`);

  const redirectUrl = new URL(request.returnUrl);
  redirectUrl.searchParams.set("installation_id", request.installationId);
  redirectUrl.searchParams.set("resource_id", resource.id);
  redirectUrl.searchParams.set("state", request.state);

  return { redirectUrl: redirectUrl.toString(), resource };
}
