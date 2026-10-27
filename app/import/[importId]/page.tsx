import { FormButton } from "@/app/dashboard/components/form-button";
import { Section } from "@/app/dashboard/components/section";
import { getResource } from "@/lib/partner";
import { listProviderResources } from "@/lib/partner/provider-accounts";
import { getResourceImport } from "@/lib/partner/resource-import";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { getSignedInProviderAccount } from "../session";
import {
  createProviderResourceAction,
  importResourceAction,
  signInAction,
  signOutAction,
} from "./actions";

export const dynamic = "force-dynamic";

const buttonClassName =
  "rounded bg-blue-500 text-white px-2 py-1 disabled:opacity-50";
const inputClassName = "border border-gray-300 rounded px-2 py-1";

export default async function ImportResourcePage({
  params: { importId },
  searchParams: { error },
}: {
  params: { importId: string };
  searchParams: { error?: string };
}) {
  const importRequest = await getResourceImport(importId);

  if (!importRequest) {
    return (
      <main className="max-w-2xl mx-auto p-10 space-y-4">
        <h1 className="text-xl font-bold">Import expired</h1>
        <p className="text-gray-600">
          This import has expired or was already completed. Start again from
          Import Existing on Vercel.
        </p>
      </main>
    );
  }

  const [vercelAccount, providerAccount] = await Promise.all([
    getAccountInfo(importRequest.installationId).catch(() => null),
    getSignedInProviderAccount(),
  ]);

  return (
    <main className="max-w-2xl mx-auto p-10 space-y-6">
      <h1 className="text-xl font-bold">Import an existing resource</h1>

      {error ? (
        <div className="rounded bg-red-100 text-red-800 p-3 text-sm">
          {error}
        </div>
      ) : null}

      <Section title="Destination">
        <dl className="grid grid-cols-[160px_1fr] gap-2 p-2">
          <dt>Vercel team</dt>
          <dd>{vercelAccount?.name ?? "Unknown"}</dd>
          <dt>Installation</dt>
          <dd className="font-mono">{importRequest.installationId}</dd>
          <dt>Product</dt>
          <dd className="font-mono">
            {importRequest.productId ?? "Not selected"}
          </dd>
        </dl>
      </Section>

      {providerAccount ? (
        <>
          <Section title="Your account">
            <form action={signOutAction} className="flex justify-between p-2">
              <input type="hidden" name="importId" value={importId} />
              <span>
                Signed in as <strong>{providerAccount.email}</strong>
              </span>
              <FormButton className="text-blue-500 underline">
                Sign out
              </FormButton>
            </form>
          </Section>
          <SelectResource
            importId={importId}
            installationId={importRequest.installationId}
            accountId={providerAccount.id}
            productId={importRequest.productId}
            vercelTeamName={vercelAccount?.name}
          />
        </>
      ) : (
        <Section title="Sign in">
          <p className="p-2">
            Sign in to the account that owns the resource you want to import.
            This example creates an account for any email address.
          </p>
          <form action={signInAction} className="flex gap-2 p-2">
            <input type="hidden" name="importId" value={importId} />
            <input
              className={`${inputClassName} flex-1`}
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
            <FormButton className={buttonClassName}>Sign in</FormButton>
          </form>
        </Section>
      )}
    </main>
  );
}

async function SelectResource({
  importId,
  installationId,
  accountId,
  productId,
  vercelTeamName,
}: {
  importId: string;
  installationId: string;
  accountId: string;
  productId?: string;
  vercelTeamName?: string;
}) {
  const resources = await listProviderResources(accountId);
  const imported = await Promise.all(
    resources.map(
      async (resource) =>
        (await getResource(installationId, resource.id)) !== null,
    ),
  );

  return (
    <Section title="Choose a resource">
      {resources.length === 0 ? (
        <p className="p-2">This account has no resources.</p>
      ) : (
        <form action={importResourceAction} className="space-y-4 p-2">
          <input type="hidden" name="importId" value={importId} />
          <ul className="space-y-2">
            {resources.map((resource, index) => (
              <li key={resource.id}>
                <label className="flex gap-2 items-center">
                  <input
                    type="radio"
                    name="resourceId"
                    value={resource.id}
                    defaultChecked={index === 0}
                    required
                  />
                  <span className="font-medium">{resource.name}</span>
                  <span className="font-mono text-xs">{resource.id}</span>
                  <span className="text-xs">{resource.region}</span>
                  {imported[index] ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200">
                      Already imported
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
          {productId ? null : (
            <label className="flex gap-2 items-center">
              <span>Product slug</span>
              <input
                className={`${inputClassName} flex-1`}
                name="productId"
                placeholder="your-product-slug"
                required
              />
            </label>
          )}
          <p>
            Importing links this resource to{" "}
            <strong>{vercelTeamName ?? installationId}</strong> and shares its
            credentials with projects connected to it there. It stays billed by
            this provider, not by Vercel.
          </p>
          <FormButton className={buttonClassName}>
            Import and return to Vercel
          </FormButton>
        </form>
      )}
      <form action={createProviderResourceAction} className="flex gap-2 p-2">
        <input type="hidden" name="importId" value={importId} />
        <input
          className={`${inputClassName} flex-1`}
          name="name"
          placeholder="new-resource-name"
          required
        />
        <FormButton className="rounded border border-blue-500 text-blue-500 px-2 py-1 disabled:opacity-50">
          Create resource
        </FormButton>
      </form>
    </Section>
  );
}
