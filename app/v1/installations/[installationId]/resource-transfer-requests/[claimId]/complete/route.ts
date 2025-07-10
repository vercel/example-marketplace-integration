import { NextResponse } from 'next/server';
import { getTransferRequest, setTransferRequest } from '@/lib/partner';
import { Params, validateTransferId } from '../../utils';
import { withAuth } from '@/lib/vercel/auth';

export const POST = withAuth(
    async (_oidcClaims, _request, { params }: { params: Params }) => {
        if (!validateTransferId(params.transferId)) {
            return NextResponse.json({ description: 'Invalid ID' }, { status: 400 });
        }

        const matchingClaim = await getTransferRequest(
            params.transferId,
        );

        // does claim exist?
        if (!matchingClaim) {
            return NextResponse.json({ description: 'Transfer request not found' }, { status: 404 });
        }
    
        // does the target installation ID match?
        if (matchingClaim.targetInstallationId !== params.installationId) {
            return NextResponse.json({ description: 'Invalid target installation ID' }, { status: 400 });
        }

        // idemoptentcy - no need to re-complete
        if (matchingClaim.status === 'complete') {
            return NextResponse.json({ description: 'Transfer completed successfully' });
        }

        // is the claim in a state that can be completed?
        const now = new Date().getTime();
        if (matchingClaim.status !== 'verified' || matchingClaim.expiration > now) {
            return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
        }

        await setTransferRequest({
            ...matchingClaim,
            status: 'complete',
        })

        return NextResponse.json({ description: 'Transfer completed successfully' }, { status: 200 });
    },
);