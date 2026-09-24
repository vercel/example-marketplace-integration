import {
  type ResourceTokenPresentation,
  listResourceTokenPresentations,
} from "@/lib/partner/resource-tokens";
import {
  RESOURCE_TOKEN_CLAIM_GUIDE,
  type ResourceTokenCheck,
  resourceTokenCustomClaims,
  resourceTokenDiscoveryUri,
  resourceTokenIssuer,
  resourceTokenJwksUri,
} from "@/lib/vercel/resource-token";
import { headers } from "next/headers";
import { getSession } from "../auth";
import { FormButton } from "../components/form-button";
import { Section } from "../components/section";
import { clearPresentations } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  await getSession();

  const [presentations, headerList] = await Promise.all([
    listResourceTokenPresentations(),
    headers(),
  ]);

  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const endpoint = `${protocol}://${host}/oidc/resource-token`;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Resource Tokens</h1>
        <p className="text-gray-600 text-sm">
          Short-lived OIDC tokens that a customer&apos;s Vercel deployment
          minted for one of our resources and presented to us instead of a
          long-lived secret.
        </p>
      </div>

      <Section title="What we accept">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-gray-500">endpoint</dt>
          <dd className="break-all">POST {endpoint}</dd>
          <dt className="text-gray-500">issuer</dt>
          <dd className="break-all">{resourceTokenIssuer}</dd>
          <dt className="text-gray-500">jwks_uri</dt>
          <dd className="break-all">{resourceTokenJwksUri}</dd>
          <dt className="text-gray-500">discovery</dt>
          <dd className="break-all">{resourceTokenDiscoveryUri}</dd>
        </dl>

        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-1 font-medium">Claim</th>
              <th className="pb-1 font-medium">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCE_TOKEN_CLAIM_GUIDE.map((entry) => (
              <tr key={entry.claim} className="border-t border-gray-100">
                <td className="py-1 pr-4 align-top font-mono whitespace-nowrap">
                  {entry.claim}
                </td>
                <td className="py-1 align-top">{entry.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">
          Presentations{" "}
          <span className="text-gray-500 text-sm font-normal">
            ({presentations.length})
          </span>
        </h2>
        {presentations.length > 0 ? (
          <form action={clearPresentations}>
            <FormButton className="text-sm text-gray-600 underline hover:text-gray-900">
              Clear log
            </FormButton>
          </form>
        ) : null}
      </div>

      {presentations.length === 0 ? (
        <div className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-lg bg-white shadow-md">
          <span className="text-slate-500">No tokens presented yet</span>
          <code className="text-slate-400 text-xs">POST {endpoint}</code>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {presentations.map((presentation) => (
            <PresentationCard
              key={presentation.id}
              presentation={presentation}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function PresentationCard({
  presentation,
}: {
  presentation: ResourceTokenPresentation;
}) {
  const { claims, resource, accepted } = presentation;

  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            accepted ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
          }`}
        >
          {accepted ? "accepted" : "rejected"}
        </span>
        <span className="text-gray-500 text-xs">
          {new Date(presentation.presentedAt).toISOString()}
        </span>
      </div>

      {accepted && resource ? (
        <h3 className="mb-2 text-lg font-medium">
          {resource.name}{" "}
          <span className="font-mono text-sm text-gray-500">{resource.id}</span>
        </h3>
      ) : (
        <h3 className="mb-2 text-lg font-medium text-red-700">
          {presentation.error ?? "Rejected"}
        </h3>
      )}

      <Checks checks={presentation.checks} />

      {claims ? <Claims claims={claims} /> : null}

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-gray-600">
          Presented token
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-2 font-mono">
          {presentation.token}
        </pre>
        {presentation.header ? (
          <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2">
            <code>
              {JSON.stringify(
                { header: presentation.header, payload: claims ?? null },
                null,
                2,
              )}
            </code>
          </pre>
        ) : null}
      </details>
    </div>
  );
}

function Checks({ checks }: { checks: ResourceTokenCheck[] }) {
  if (checks.length === 0) return null;

  return (
    <ul className="space-y-1 text-xs">
      {checks.map((check) => (
        <li key={check.name} className="flex gap-2">
          <span
            aria-hidden
            className={check.passed ? "text-green-600" : "text-red-600"}
          >
            {check.passed ? "✓" : "✗"}
          </span>
          <span>
            <span className="font-medium">{check.label}</span>
            <span className="text-gray-500"> — {check.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Claims({
  claims,
}: {
  claims: NonNullable<ResourceTokenPresentation["claims"]>;
}) {
  const rows: [string, string][] = [
    ["iss", claims.iss ?? "—"],
    [
      "aud",
      Array.isArray(claims.aud) ? claims.aud.join(", ") : (claims.aud ?? "—"),
    ],
    ["sub", claims.sub ?? "—"],
    ["resource", claims.resource ?? "—"],
    ["project", claims.project ?? "—"],
    ["environment", claims.environment ?? "—"],
    ["deployment", claims.deployment ?? "—"],
    ["act.sub", claims.act?.sub ?? "—"],
    ...Object.entries(resourceTokenCustomClaims(claims)).map(
      ([name, value]): [string, string] => [name, JSON.stringify(value)],
    ),
    [
      "exp",
      claims.exp
        ? `${new Date(claims.exp * 1000).toISOString()} (${
            claims.iat ? `${claims.exp - claims.iat}s TTL` : "unknown TTL"
          })`
        : "—",
    ],
  ];

  return (
    <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 border-t border-gray-100 pt-3 font-mono text-xs">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-gray-500">{key}</dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
