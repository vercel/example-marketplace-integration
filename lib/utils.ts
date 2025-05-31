import { z, SafeParseReturnType, ZodSchema } from "zod";

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
