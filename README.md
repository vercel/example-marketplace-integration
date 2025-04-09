# Example Marketplace Integration

Welcome to the Example Marketplace Integration. This repository contains a reference implementation for a Vercel Marketplace Integration.

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

4. On your Vercel project, visit the Storage tab (Vercel Dashboard > (Your Project) > Storage tab) and create a new Vercel KV database. You should be prompted to connect your new store to your project, if not, connect it manually. Once connected, you should see the `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` environment variables in your project. This database is used to store state for your example marketplace integration.

![](/docs/assets/example-integration-kv.png)

5. Return to your Vercel Integration in the [Integrations Console](https://vercel.com/dashboard/integrations/console) and update the Marketplace Integration Settings (near the bottom of the page).

- Set the "Base URL" to your deployed project's URL e.g. https://example-marketplace-integration.vercel.app
- Set the "Redirect Login URL" to your deployed projects URL with the path `/callback` e.g. https://example-marketplace-integration.vercel.app/callback
- Click the "Update" button at the bottom to save your changes.
-

6. In the same Marketplace Integration Settings, create a product for your Vercel Integration using the "Create Product" button. A "product" maps to your own products you want to sell on Vercel. Depending on the product type (e.g. storage), the Vercel dashboard will understand how to interact with your product.

- Fill out relevant metadata for your product like product name and logo.

7. If you created a "storage" product type, you should be able to:

- Create a database for your product in the Storage tab via the "Create Store" button.
- View and manage your new database for your product.;
- When you've created a database, you should be able to click the "Open in <Product Name>" button on the store detail page to open the database on your integration's dashboard.
