import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { getOrganizationValidation } from "@/lib/organization-validation";

interface Params {
  installationId: string;
}

export async function GET(
  request: Request,
  { params }: { params: Params },
): Promise<Response> {
  const expected = env.ORGANIZATION_VALIDATION_SECRET;
  if (!expected) return new Response(null, { status: 404 });

  const actual = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!actual || !secretsMatch(actual, expected)) {
    return new Response(null, { status: 403 });
  }

  const validation = await getOrganizationValidation(params.installationId);
  if (!validation.installation) return new Response(null, { status: 404 });
  return Response.json(validation, {
    headers: { "cache-control": "no-store" },
  });
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
