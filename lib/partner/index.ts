import {
  GetBillingPlansResponse,
  GetResourceResponse,
  InstallIntegrationRequest,
  ListResourcesResponse,
  ProvisionResourceRequest,
  ProvisionResourceResponse,
  UpdateResourceRequest,
  UpdateResourceResponse,
} from "@/lib/vercel/schemas";

// TODO: declare interface for ease of implementation?

export async function installIntegration(
  installationId: string,
  request: InstallIntegrationRequest
): Promise<void> {
  throw new Error("Not implemented");
}

export async function uninstallIntegration(installationId: string) {
  throw new Error("Not implemented");
}

export async function provisionResource(
  installationId: string,
  request: ProvisionResourceRequest
): Promise<ProvisionResourceResponse> {
  throw new Error("Not implemented");
}

export async function updateResource(
  installationId: string,
  resourceId: string,
  request: UpdateResourceRequest
): Promise<UpdateResourceResponse> {
  throw new Error("Not implemented");
}

export async function deleteResource(
  installationId: string,
  resourceId: string
): Promise<void> {
  throw new Error("Not implemented");
}

export async function listResources(
  installationId: string
): Promise<ListResourcesResponse> {
  throw new Error("Not implemented");
}

export async function getResource(
  installationId: string,
  resourceId: string
): Promise<GetResourceResponse> {
  throw new Error("Not implemented");
}

export async function getBillingPlans(
  productId: string
): Promise<GetBillingPlansResponse> {
  throw new Error("Not implemented");
}
