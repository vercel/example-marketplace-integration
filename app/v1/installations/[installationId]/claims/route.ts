import { withAuth } from "@/lib/vercel/auth";
import { getClaim, setClaim } from '@/lib/partner';
import { Claim } from "@/lib/vercel/schemas";
import { NextRequest, NextResponse } from "next/server";
import { validateInstallationId, validateNewClaimBodyId, validateClaimId } from "./utils";

// NOTE - overload #1 to create a claim - this route doesn't have a claimID in the path and gets it from the request body
export async function POST(request: NextRequest, { params }: { params: Promise<{ installationId: string }> }) {
    const { installationId } = await params;
    const data = await request.json();

    if (!validateInstallationId(installationId) || !validateNewClaimBodyId(data) || !validateClaimIdInBody(data)) {
        return NextResponse.json({ description: 'Input has failed validation' }, { status: 400 });
    }

    const matchingClaim = await getClaim(
        installationId, // TODO - get this from the auth claim
        data.claimId,
    );

    if (matchingClaim) {
        return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
    }

    var expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    const newClaim: Claim = {
        claimId: data.claimId,
        installationId, 
        status: 'unclaimed',
        sourceInstallationId: data.sourceInstallationId,
        expiration: data.expiration,
        resourceIds: data.resourceIds,
    }
    await setClaim(newClaim);

    return NextResponse.json({ description: 'Claim created successfully' });
}

function validateClaimIdInBody(data: any): boolean {
    if (!Object.hasOwn(data, 'claimId')) return false;
    if (!validateClaimId(data.claimId)) return false;

    return true;
}
