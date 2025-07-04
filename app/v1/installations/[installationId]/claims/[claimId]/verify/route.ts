import { getClaim, setClaim } from '@/lib/partner';
import { NextRequest, NextResponse } from 'next/server';
import { validateInstallationId, validateClaimId } from '../../utils';

export async function POST(_: NextRequest, { params }: { params: Promise<{ installationId: string, claimId: string }> }) {
    const { installationId, claimId } = await params;

    if (!validateInstallationId(installationId) || !validateClaimId(claimId)) {
        return NextResponse.json({ description: 'Bad request - invalid ID' }, { status: 400 });
    }

    const matchingClaim = await getClaim(
        installationId, // TODO - get this from the auth claim
        claimId,
    );

    // does claim exist?
    if (!matchingClaim) {
        return NextResponse.json({ description: 'Claim not found' }, { status: 404 });
    }
   
    // idemoptentcy - no need to re-verify
    if (matchingClaim.status === 'verified') {
        return NextResponse.json({ description: 'Claim verified successfully' });
    }

    // is the claim in a state that can be verified?
    const now = new Date().getTime();
    if (matchingClaim.status !== 'unclaimed' || matchingClaim.expiration > now) {
        return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
    }

    await setClaim({
        ...matchingClaim,
        status: 'verified',
    })

    return NextResponse.json({ description: 'Claim verified successfully' });
}
