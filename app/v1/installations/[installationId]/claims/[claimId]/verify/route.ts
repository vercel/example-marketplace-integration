import { getClaim, setClaim } from '@/lib/partner';
import { NextResponse } from 'next/server';
import { Params, validateClaimId } from '../../utils';
import { withAuth } from '@/lib/vercel/auth';

export const POST = withAuth(
    async (oidcClaims, _request, { params }: { params: Params }) => {
        if (!validateClaimId(params.claimId)) {
            return NextResponse.json({ description: 'Bad request - invalid ID' }, { status: 400 });
        }

        const matchingClaim = await getClaim(
            oidcClaims.installation_id,
            params.claimId,
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
    },
);
