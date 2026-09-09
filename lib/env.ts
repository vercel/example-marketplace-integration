import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().min(1).optional(),
  INTEGRATION_CLIENT_ID: z.string().min(1),
  INTEGRATION_CLIENT_SECRET: z.string().min(1),
  CRON_SECRET: z.string().optional(),
  VERCEL_EXTERNAL_REDIRECT_URI: z.string().min(1).optional(),
  // Override only to point resource-token verification at a non-production
  // Vercel (the OIDC issuer host is derived from it). Defaults to
  // https://integrations.vercel.com.
  VERCEL_INTEGRATIONS_ISSUER_BASE: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error("env validation failed", {
    cause: parsed.error,
  });
}

export const env = parsed.data;
