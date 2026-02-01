import type { SafeParseReturnType, ZodSchema, z } from "zod";

export async function readRequestBodyWithSchema<
  TRequestBodySchema extends ZodSchema,
>(
  request: Request,
  requestBodySchema: TRequestBodySchema,
): Promise<
  SafeParseReturnType<z.infer<TRequestBodySchema>, z.infer<TRequestBodySchema>>
> {
  const requestBodyRaw = await request.json();
  return requestBodySchema.safeParse(requestBodyRaw);
}

export function buildError(
  code: string,
  message: string,
  user?: { message: string; url?: string },
) {
  return {
    error: {
      code,
      message,
      user,
    },
  };
}
