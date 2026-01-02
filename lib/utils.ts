import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ZodSchema } from "zod/v3";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
