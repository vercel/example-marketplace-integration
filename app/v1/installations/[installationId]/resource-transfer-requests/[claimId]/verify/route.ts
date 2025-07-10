import { getTransferRequest, setTransferRequest } from '@/lib/partner';
import { NextResponse } from 'next/server';
import { Params, validateTransferId } from '../../utils';
import { withAuth } from '@/lib/vercel/auth';

export const POST = withAuth(
    async (_oidcClaims, _request, { params }: { params: Params }) => {
        if (!validateTransferId(params.transferId)) {
            return NextResponse.json({ description: 'Input has failed validation' }, { status: 400 });
        }

        const matchingClaim = await getTransferRequest(
            params.transferId,
        );

        // does claim exist?
        if (!matchingClaim) {
            return NextResponse.json({ description: 'Transfer request not found' }, { status: 404 });
        }
    
        // idemoptentcy - no need to re-verify
        if (matchingClaim.status === 'verified') {
            return NextResponse.json({ description: 'Transfer request verified successfully' });
        }

        // is the claim in a state that can be verified?
        const now = new Date().getTime();
        if (matchingClaim.status !== 'unclaimed' || matchingClaim.expiration > now) {
            return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
        }

        await setTransferRequest({
            ...matchingClaim,
            status: 'verified',
            targetInstallationId: params.installationId,
        })

        return NextResponse.json({ description: 'Transfer request verified successfully' });
    },
);
