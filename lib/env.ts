import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().min(1).optional(),
  INTEGRATION_CLIENT_ID: z.string().min(1),
  INTEGRATION_CLIENT_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error("env validation failed", {
    cause: parsed.error,
  });
}

export const env = parsed.data;
