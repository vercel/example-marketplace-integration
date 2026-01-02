import { NextResponse } from "next/server";
import {
  deleteTransferRequest,
  getTransferRequest,
  setTransferRequest,
} from "@/lib/partner";
import { buildError, readRequestBodyWithSchema } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { type Claim, createClaimRequestSchema } from "@/lib/vercel/schemas";
import type { Params } from "../utils";

/**
 * Create a new resource transfer request
 */
export const PUT = withAuth(async (oidcClaims, request, ...rest: unknown[]) => {
  const [{ params }] = rest as [{ params: Params }];
  const matchingClaim = await getTransferRequest(params.transferId);

  if (matchingClaim) {
    return NextResponse.json(
      buildError(
        "conflict",
        "Operation failed because of a conflict with the current state of the resource"
      ),
      { status: 409 }
    );
  }

  const requestBody = await readRequestBodyWithSchema(
    request,
    createClaimRequestSchema
  );

  const { data } = requestBody;

  if (!(requestBody.success && data)) {
    return NextResponse.json(
      buildError("bad_request", "Input has failed validation"),
      { status: 400 }
    );
  }

  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 7);
  const newClaim: Claim = {
    transferId: params.transferId,
    status: "unclaimed",
    sourceInstallationId: oidcClaims.installation_id,
    expiration: data.expiration,
    resourceIds: data.resourceIds,
    targetInstallationIds: [],
  };
  await setTransferRequest(newClaim);

  return new NextResponse(null, { status: 204 });
});

// NOTE - this GET is not part of the spec but makes it much easier to test
export const GET = withAuth(
  async (_oidcClaims, _request, ...rest: unknown[]) => {
    const [{ params }] = rest as [{ params: Params }];
    const matchingClaim = await getTransferRequest(params.transferId);

    if (matchingClaim) {
      return NextResponse.json(matchingClaim);
    }

    return NextResponse.json(
      buildError("not_found", "Transfer request not found"),
      { status: 404 }
    );
  }
);

// NOTE - this DELETE is not part of the spec, it exists to allow us to clean up test data
export const DELETE = withAuth(
  async (_oidcClaims, _request, ...rest: unknown[]) => {
    const [{ params }] = rest as [{ params: Params }];
    const matchingClaim = await getTransferRequest(params.transferId);

    if (!matchingClaim) {
      return NextResponse.json(
        buildError("not_found", "Transfer request not found"),
        { status: 404 }
      );
    }

    await deleteTransferRequest(matchingClaim);

    return new NextResponse(null, { status: 204 });
  }
);
