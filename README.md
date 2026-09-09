# Example Marketplace Integration

Welcome to the Example Marketplace Integration. This repository contains a reference implementation for a Vercel Marketplace Integration.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fexample-marketplace-integration&env=INTEGRATION_CLIENT_ID,INTEGRATION_CLIENT_SECRET,CRON_SECRET&envDescription=Integration%20credentials%20from%20the%20Vercel%20Integrations%20Console&envLink=https%3A%2F%2Fvercel.com%2Fdocs%2Fintegrations%2Fcreate-integration)

## Getting Started

1. Clone the code to your machine.

```sh
$ git clone git@github.com:vercel/example-marketplace-integration.git example-marketplace-integration
Cloning into 'example-marketplace-integration'...
remote: Enumerating objects: 318, done.
remote: Counting objects: 100% (81/81), done.
remote: Compressing objects: 100% (57/57), done.
remote: Total 318 (delta 29), reused 53 (delta 15), pack-reused 237
Receiving objects: 100% (318/318), 120.25 KiB | 552.00 KiB/s, done.
Resolving deltas: 100% (120/120), done.
```

2. Deploy the example Marketplace integration to your Vercel team.

```sh
$ cd example-marketplace-integration
$ vc link
Vercel CLI 33.5.5
? Set up “~/src/example-marketplace-integration”? [Y/n] y
? Which scope should contain your project? My Team
? Link to existing project? [y/N] n
? What’s your project’s name? example-marketplace-integration
? In which directory is your code located? ./
Local settings detected in vercel.json:
Auto-detected Project Settings (Next.js):
- Build Command: next build
- Development Command: next dev --port $PORT
- Install Command: `yarn install`, `pnpm install`, `npm install`, or `bun install`
- Output Directory: Next.js default
? Want to modify these settings? [y/N] n
✅  Linked to my-team-name/example-marketplace-integration (created .vercel)
```

3. Add your `INTEGRATION_CLIENT_ID` and `INTEGRATION_CLIENT_SECRET` to your Vercel project. You can find these values on your Integration in the [Integrations Console](https://vercel.com/dashboard/integrations/console). If you do not have an existing Vercel integration, [please create one](https://vercel.com/docs/integrations/create-integration#creating-an-integration).

```sh
$ vercel env add INTEGRATION_CLIENT_ID
Vercel CLI 33.5.5
? What’s the value of INTEGRATION_CLIENT_ID? my-client-id
? Add INTEGRATION_CLIENT_ID to which Environments (select multiple)? Production, Preview, Development
✅  Added Environment Variable INTEGRATION_CLIENT_ID to Project example-marketplace-integration [234ms]
$ vercel env add INTEGRATION_CLIENT_SECRET
Vercel CLI 33.5.5
? What’s the value of INTEGRATION_CLIENT_SECRET? my-secret
? Add INTEGRATION_CLIENT_SECRET to which Environments (select multiple)? Production, Preview, Development
✅  Added Environment Variable INTEGRATION_CLIENT_SECRET to Project example-marketplace-integration [211ms]
```

4. Secure cron jobs with `CRON_SECRET`

```sh
$ vercel env add CRON_SECRET
Vercel CLI 41.6.2
? What’s the value of CRON_SECRET? my-cron-secret
? Add CRON_SECRET to which Environments (select multiple)? Production, Preview,Development
✅  Added Environment Variable CRON_SECRET to Project example-marketplace-integration [103ms]
```

See [Securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) for more information.

5. On your Vercel project, visit the Storage tab (Vercel Dashboard > (Your Project) > Storage tab) and create a new Upstash Redis database. You should be prompted to connect your new store to your project, if not, connect it manually. Once connected, you should see the `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` environment variables in your project. This database is used to store state for your example marketplace integration.

![](/docs/assets/storage-upstash-redis.png)

6. Return to your Vercel Integration in the [Integrations Console](https://vercel.com/dashboard/integrations/console) and update the Marketplace Integration Settings (near the bottom of the page).

- Set the "Base URL" to your deployed project's URL e.g. https://example-marketplace-integration.vercel.app
- Set the "Redirect Login URL" to your deployed projects URL with the path `/callback` e.g. https://example-marketplace-integration.vercel.app/callback
- Click the "Update" button at the bottom to save your changes.

7. In the same Marketplace Integration Settings, create a product for your Vercel Integration using the "Create Product" button. A "product" maps to your own products you want to sell on Vercel. Depending on the product type (e.g. storage), the Vercel dashboard will understand how to interact with your product.

- Fill out relevant metadata for your product like product name and logo.

8. If you created a "storage" product type, you should be able to:

- Create a database for your product in the Storage tab via the "Create Store" button.
- View and manage your new database for your product.;
- When you've created a database, you should be able to click the "Open in <Product Name>" button on the store detail page to open the database on your integration's dashboard.

## Platform Organizations

When Vercel sends parent organization context, the example integration stores the parent account and installation relationship on child installations and resources. Child dashboards show the received parent context, while parent dashboards show a count and compact list of child installations with resource counts.

The integration records requests whose parent claims are missing or disagree with the stored child relationship. Child plan listings return only the plan selected on the parent installation, and resource provisioning enforces that selection. Every installation submits its own manual invoices. Parent installation invoices include aggregate lines for the current number of child installations and child resources.

Child parent relations resolve to one of three states: no parent, resolved, or invalid. A relation is invalid when it has no parent installation ID or when the referenced parent record is missing. Invalid relations still fail closed—plan listings are empty and provisioning-shaped writes are refused—but the refusal is a structured `parent_relation_unavailable` error instead of an unhandled failure, each invalid reason is counted separately, and the installation dashboard shows the relation state and refusal counts.

## Marketplace Resource Tokens (OIDC)

A customer's Vercel deployment can mint a short-lived, resource-scoped OIDC token
for one of our resources and present it to us instead of a long-lived secret. The
token is Vercel-signed, expires in 300s, and names the resource it is good for —
so nothing durable has to sit in the customer's environment variables.

The customer side of this demo lives in
[`vercel/vercel-marketplace-oidc-client-demo`](https://github.com/vercel/vercel-marketplace-oidc-client-demo).

### The two hops

```
customer deployment ──1── POST api.vercel.com/v1/integrations/marketplace/resources/<store id>/token
                     │         Authorization: Bearer $VERCEL_OIDC_TOKEN
                     │     → { token, tokenType, expiresIn: 300, expiresAt }
                     │
                     └──2── POST <this integration>/oidc/resource-token
                               Authorization: Bearer <minted resource token>
                           → { accepted: true, identity: { … }, checks: [ … ], claims: { … } }
```

Hop 1 is Vercel's; we never see the deployment's own OIDC token. Hop 2 is ours:
[`app/oidc/resource-token/route.ts`](app/oidc/resource-token/route.ts) stands in
for this integration's data plane, taking the token exactly the way a database
would take a password. `GET` on the same path returns the issuer, JWKS URL, and
claim guide.

### What we verify

[`lib/vercel/resource-token.ts`](lib/vercel/resource-token.ts) does the checking.
One Vercel key signs resource tokens for **every** integration, so a valid
signature proves nothing about who the token was minted for — isolation comes
entirely from three claim checks:

| Claim      | Check                                                          |
| ---------- | -------------------------------------------------------------- |
| `iss`      | pinned to `https://integrations.vercel.com/$INTEGRATION_CLIENT_ID` |
| `aud`      | must be an installation this integration holds, not uninstalled |
| `resource` | must name a resource **under that installation**                |

`sub` (the calling Vercel project) and `act.sub` (the deployment identity that
asked Vercel to mint) do not gate access — they are the audit trail, and are
recorded and displayed.

`INTEGRATION_CLIENT_ID` is already our integration id — it is what Vercel puts in
`aud` on SSO tokens — so the issuer needs no new configuration. Set
`VERCEL_INTEGRATIONS_ISSUER_BASE` only to point verification at a non-production
Vercel.

### Seeing it

Presented tokens — accepted and rejected — are logged to Redis and rendered at
**Dashboard → Resource Tokens** with each claim, each check and its outcome, and
the raw JWT. Persisting the token is a demo affordance; a real integration would
keep the claims and drop the credential.

`lib/vercel/resource-token.test.ts` signs tokens with a real RSA key the same way
`api-integrations` does and runs them through the real verification path, so the
claim contract is covered without a deployment. It is the partner-side mirror of
`packages/util-integrations/src/marketplace/resource-token-signature.test.ts` in
`vercel/api`.

### Prerequisites for a live end-to-end run

Minting is gated, and both gates are Vercel-internal:

1. `resourceTokenMintEnabled: true` in the integration's admin settings
   (backoffice → `update-integration-admin-settings`).
2. The `marketplace-resource-token-mint-team` flag enabled for the customer's team.

With either off, hop 1 returns `404` by design — a stealth 404, so rollout state
does not leak. The resource must also be connected to the calling project in the
environment the deployment is running in.
