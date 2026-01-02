import type { SafeParseReturnType, ZodSchema, z } from "zod/v3";

export const readRequestBodyWithSchema = async <
  TRequestBodySchema extends ZodSchema,
>(
  request: Request,
  requestBodySchema: TRequestBodySchema
) => {
  const requestBodyRaw = await request.json();
  return requestBodySchema.safeParse(requestBodyRaw);
};

export const buildError = (
  code: string,
  message: string,
  user?: { message: string; url?: string }
) => ({
  error: {
    code,
    message,
    user,
  },
});
