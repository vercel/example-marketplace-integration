#!/usr/bin/env node

const required = [
  "VERCEL_TOKEN",
  "ROOT_TEAM_ID",
  "ORGANIZATION_ID",
  "PARENT_INSTALLATION_ID",
  "INTEGRATION_SLUG",
  "PRODUCT_SLUG",
  "BILLING_PLAN_ID",
  "PRODUCT_METADATA_JSON",
  "PROVIDER_BASE_URL",
  "ORGANIZATION_VALIDATION_SECRET",
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const apiBase = process.env.API_BASE ?? "https://api.vercel.com";
const source = process.env.SOURCE ?? "external";
const runId = `${new Date().toISOString().replaceAll(/[-:.TZ]/g, "")}-${process.pid}`;
const metadata = JSON.parse(process.env.PRODUCT_METADATA_JSON);
assert(
  typeof metadata.region === "string" && metadata.region.length > 0,
  "PRODUCT_METADATA_JSON.region is required",
);
let childTeamId = process.env.CHILD_TEAM_ID;
if (!childTeamId) {
  const child = await vercelRequest(
    "POST",
    `/v1/organizations/${process.env.ORGANIZATION_ID}/teams?teamId=${process.env.ROOT_TEAM_ID}`,
    {
      mode: "create",
      billingPlan: "platform",
      slug: process.env.CHILD_TEAM_SLUG ?? `marketplace-org-${runId}`,
      name: process.env.CHILD_TEAM_NAME ?? `Marketplace Org ${runId}`,
    },
  );
  childTeamId = requiredString(child.teamId, "child.teamId");
  checkpoint({ childTeamId });
}

const organizationTeams = await listOrganizationTeams();
const childLink = organizationTeams.find((team) => team.teamId === childTeamId);
assert(childLink?.billingPlan === "platform", "child must be a platform link");

const parentInstallation = await vercelRequest(
  "GET",
  `/v1/integrations/configuration/${process.env.PARENT_INSTALLATION_ID}?teamId=${process.env.ROOT_TEAM_ID}`,
);
assert(
  parentInstallation.ownerId === process.env.ROOT_TEAM_ID,
  "parent installation owner",
);
assert(
  parentInstallation.installationType === "marketplace",
  "parent installation type",
);
const parentDiagnostics = await providerRequest(
  `/validation/organization/${process.env.PARENT_INSTALLATION_ID}`,
);
assert(
  parentDiagnostics.installation?.installationId ===
    process.env.PARENT_INSTALLATION_ID,
  "provider parent installation observation",
);
assert(
  Object.keys(parentDiagnostics.installation.acceptedPolicies).length > 0,
  "parent installation must record at least one accepted policy",
);
assert(
  parentDiagnostics.installation.account,
  "provider parent account observation",
);

let childInstallationId = process.env.CHILD_INSTALLATION_ID;
if (!childInstallationId) {
  const installation = await vercelRequest(
    "POST",
    `/v1/integrations/integration/${process.env.INTEGRATION_SLUG}/marketplace/install?teamId=${childTeamId}`,
    { source },
  );
  childInstallationId = requiredString(installation.id, "installation.id");
  checkpoint({ childTeamId, childInstallationId });
}

const childInstallation = await vercelRequest(
  "GET",
  `/v1/integrations/configuration/${childInstallationId}?teamId=${childTeamId}`,
);
assert(childInstallation.ownerId === childTeamId, "child installation owner");

const productResponse = await vercelRequest(
  "GET",
  `/v1/integrations/configuration/${childInstallationId}/products?teamId=${childTeamId}`,
);
const product = (productResponse.products ?? []).find(
  (candidate) => candidate.slug === process.env.PRODUCT_SLUG,
);
assert(product, `product ${process.env.PRODUCT_SLUG} must exist`);

const planQuery = new URLSearchParams({
  teamId: childTeamId,
  integrationConfigurationId: childInstallationId,
  metadata: JSON.stringify(metadata),
  source,
});
const planResponse = await vercelRequest(
  "GET",
  `/v1/integrations/integration/${process.env.INTEGRATION_SLUG}/products/${process.env.PRODUCT_SLUG}/plans?${planQuery}`,
);
const plan = (planResponse.plans ?? []).find(
  (candidate) => candidate.id === process.env.BILLING_PLAN_ID,
);
assert(plan?.type === "subscription", "selected plan must be a subscription");
assert(plan?.scope === "resource", "selected plan must be resource-scoped");

const authorizationResponse = await vercelRequest(
  "POST",
  `/v1/integrations/billing/authorization?teamId=${childTeamId}`,
  {
    integrationIdOrSlug: process.env.INTEGRATION_SLUG,
    integrationConfigurationId: childInstallationId,
    productId: process.env.PRODUCT_SLUG,
    billingPlanId: process.env.BILLING_PLAN_ID,
    metadata: JSON.stringify(metadata),
    source,
  },
);
const authorization = authorizationResponse.authorization;
assert(authorization?.status === "succeeded", "authorization must succeed");
assert(authorization?.ownerId === childTeamId, "authorization owner");
assert(authorization?.amountCent === 0, "authorization must be zero-dollar");
assert(
  !authorization?.paymentIntent,
  "authorization must not create a payment intent",
);

const resourceResponse = await vercelRequest(
  "POST",
  `/v1/storage/stores/integration?teamId=${childTeamId}`,
  {
    name: process.env.RESOURCE_NAME ?? `organization-resource-${runId}`,
    integrationConfigurationId: childInstallationId,
    integrationProductIdOrSlug: process.env.PRODUCT_SLUG,
    billingPlanId: process.env.BILLING_PLAN_ID,
    authorizationId: authorization.id,
    metadata,
    source,
  },
);
const resource = resourceResponse.store;
assert(resource?.ownerId === childTeamId, "resource owner");
assert(
  resource?.product?.integrationConfigurationId === childInstallationId,
  "resource installation",
);

const authorizationRead = await vercelRequest(
  "GET",
  `/v1/integrations/billing/authorization/${authorization.id}?teamId=${childTeamId}`,
);
assert(authorizationRead.id === authorization.id, "authorization read id");
assert(authorizationRead.status === "succeeded", "authorization read status");
assert(authorizationRead.ownerId === childTeamId, "authorization read owner");
assert(
  authorizationRead.integrationConfigurationId === childInstallationId,
  "authorization read installation",
);
assert(
  authorizationRead.billingPlanId === process.env.BILLING_PLAN_ID,
  "authorization read plan",
);

const resourceRead = await vercelRequest(
  "GET",
  `/v1/storage/stores/${resource.id}?teamId=${childTeamId}`,
);
assert(resourceRead.store?.id === resource.id, "resource point read");
assert(resourceRead.store?.ownerId === childTeamId, "resource read owner");
assert(
  resourceRead.store?.product?.integrationConfigurationId ===
    childInstallationId,
  "resource read installation",
);
checkpoint({
  childTeamId,
  childInstallationId,
  authorizationId: authorization.id,
  storeId: resource.id,
  externalResourceId: resource.externalResourceId,
});

const diagnostics = await providerRequest(
  `/validation/organization/${childInstallationId}`,
);
assert(
  diagnostics.installation?.installationId === childInstallationId,
  "provider installation observation",
);
assert(
  diagnostics.installation?.parentAccount,
  "provider parentAccount payload",
);
assert(
  deepEqual(
    diagnostics.installation.parentAccount,
    parentDiagnostics.installation.account,
  ),
  "provider parentAccount payload must match the parent installation account",
);
assert(
  diagnostics.installation?.parentInstallationId ===
    process.env.PARENT_INSTALLATION_ID,
  "provider parent installation claim",
);
assert(
  diagnostics.installation?.parentAccountId,
  "provider parent account claim",
);
assert(
  diagnostics.installation.parentAccountId ===
    parentDiagnostics.installation.accountId,
  "child parent account claim must match the parent account",
);
assert(
  deepEqual(
    diagnostics.installation.acceptedPolicies,
    parentDiagnostics.installation.acceptedPolicies,
  ),
  "child accepted policies must exactly match the parent",
);
assert(
  diagnostics.plan?.metadata?.region === metadata.region,
  "provider plan region",
);
assert(
  diagnostics.plan?.accountId === diagnostics.installation.accountId,
  "plan child account",
);
assert(
  diagnostics.plan?.installationId === childInstallationId,
  "plan child installation",
);
assert(
  diagnostics.plan?.parentAccountId ===
    diagnostics.installation.parentAccountId,
  "plan parent account",
);
assert(
  diagnostics.plan?.parentInstallationId === process.env.PARENT_INSTALLATION_ID,
  "plan parent installation",
);
assert(
  diagnostics.plan?.productId === process.env.PRODUCT_SLUG,
  "plan product",
);
assert(
  diagnostics.plan?.returnedPlanIds.includes(process.env.BILLING_PLAN_ID),
  "provider returned selected plan",
);
const resourceObservation = diagnostics.resources.find(
  (candidate) => candidate.resourceId === resource.externalResourceId,
);
assert(resourceObservation, "provider resource observation");
assert(
  resourceObservation.accountId === diagnostics.installation.accountId,
  "resource child account",
);
assert(
  resourceObservation.installationId === childInstallationId,
  "resource child installation",
);
assert(
  resourceObservation.parentAccountId ===
    diagnostics.installation.parentAccountId,
  "resource parent account claim",
);
assert(
  resourceObservation.parentInstallationId ===
    process.env.PARENT_INSTALLATION_ID,
  "resource parent installation",
);
assert(
  resourceObservation.productId === process.env.PRODUCT_SLUG,
  "resource product",
);
assert(
  resourceObservation.billingPlanId === process.env.BILLING_PLAN_ID,
  "resource billing plan",
);
assert(
  resourceObservation.metadata?.region === metadata.region,
  "provider resource region",
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      organizationId: process.env.ORGANIZATION_ID,
      rootTeamId: process.env.ROOT_TEAM_ID,
      childTeamId,
      childInstallationId,
      authorizationId: authorization.id,
      storeId: resource.id,
      externalResourceId: resource.externalResourceId,
    },
    null,
    2,
  ),
);

async function listOrganizationTeams() {
  const teams = [];
  let cursor;
  do {
    const query = new URLSearchParams({ teamId: process.env.ROOT_TEAM_ID });
    if (cursor) query.set("cursor", cursor);
    const response = await vercelRequest(
      "GET",
      `/v1/organizations/${process.env.ORGANIZATION_ID}/teams?${query}`,
    );
    teams.push(...(response.teams ?? []));
    cursor = response.cursor;
  } while (cursor);
  return teams;
}

function vercelRequest(method, path, body) {
  return jsonRequest(apiBase, process.env.VERCEL_TOKEN, method, path, body);
}

function providerRequest(path) {
  return jsonRequest(
    process.env.PROVIDER_BASE_URL,
    process.env.ORGANIZATION_VALIDATION_SECRET,
    "GET",
    path,
  );
}

async function jsonRequest(base, token, method, path, body) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
  }
  return json;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function requiredString(value, name) {
  assert(typeof value === "string" && value.length > 0, name);
  return value;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function checkpoint(ids) {
  console.error(`checkpoint ${JSON.stringify(ids)}`);
}
