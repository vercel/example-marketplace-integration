# Example Marketplace Integration

Welcome to the Example Marketplace Integration. This repository contains a reference implementation for a Vercel Marketplace Integration.

## Getting Started

1. Clone the code to your machine with `git clone git@github.com:vercel/example-marketplace-integration.git example-marketplace-integration`.
2. Copy the example env vars file with `cp .env.example .env.local` and fill in the values.
3. Deploy the example Marketplace integration to your Vercel team.

## Environment Variables

You can find your `INTEGRATION_CLIENT_ID` and `INTEGRATION_CLIENT_SECRET` on your Integration in the [Integrations Console](https://vercel.com/dashboard/integrations/console). If you do not have an existing Vercel integration, [please create one](https://vercel.com/docs/integrations/create-integration#creating-an-integration).

You can generate a `CRON_SECRET` with `openssl rand -hex 32`. See [Securing cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs) for more information.

On your Vercel project, visit the Storage tab (Vercel Dashboard > (Your Project) > Storage tab) and create a new Upstash Redis database. You should be prompted to connect your new store to your project, if not, connect it manually. Once connected, you should see the `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` environment variables in your project. This database is used to store state for your example marketplace integration.

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
