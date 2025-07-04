import { NextRequest, NextResponse } from 'next/server';
import { getClaim, setClaim } from '@/lib/partner';

export async function POST(_: NextRequest, { params }: { params: Promise<{ installationId: string, claimId: string }> }) {
    const { installationId, claimId } = await params;
   
    // if (!validateInstallationId(installationId) || !validateClaimId(claimId)) {
    //     return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
    // }

    const matchingClaim = await getClaim(
        installationId, // TODO - get this from the auth claim
        claimId,
    );

    if (!matchingClaim) {
        return NextResponse.json({ description: 'Claim not found' }, { status: 404 });
    }

    await setClaim({
        ...matchingClaim,
        status: 'complete',
    })

    return NextResponse.json({ description: 'Claim completed successfully' }, { status: 204 });
}
