import { NextResponse } from "next/server";
import { getTransferRequest, setTransferRequest } from "@/lib/partner";
import { buildError } from "@/lib/utils";
import { withAuth } from "@/lib/vercel/auth";
import { type Params, validateTransferId } from "../../utils";

export const POST = withAuth(
  async (_oidcClaims, _request, ...rest: unknown[]) => {
    const [{ params }] = rest as [{ params: Params }];
    if (!validateTransferId(params.transferId)) {
      return NextResponse.json(
        buildError("bad_request", "Input has failed validation"),
        { status: 400 }
      );
    }

    const matchingClaim = await getTransferRequest(params.transferId);

    // Check if the claim exists
    if (!matchingClaim) {
      return NextResponse.json(
        buildError("not_found", "Transfer request not found"),
        { status: 404 }
      );
    }

    // Check if the claim is in a state that can be verified
    if (matchingClaim.status === "complete") {
      return NextResponse.json(
        buildError(
          "conflict",
          "The provided transfer request has already been completed"
        ),
        { status: 409 }
      );
    }

    // Check if the claim has expired
    if (matchingClaim.expiration < Date.now()) {
      return NextResponse.json(
        buildError("conflict", "The provided transfer request has expired"),
        { status: 409 }
      );
    }

    // Add the target installation ID to the claim
    const targetInstallations = new Set(matchingClaim.targetInstallationIds);
    targetInstallations.add(params.installationId);

    // Update the claim status to verified
    await setTransferRequest({
      ...matchingClaim,
      status: "verified",
      targetInstallationIds: [...Array.from(targetInstallations)],
    });

    return NextResponse.json({});
  }
);
