import { NextResponse } from 'next/server';
import { getTransferRequest, setTransferRequest } from '@/lib/partner';
import { Params, validateTransferId } from '../../utils';
import { withAuth } from '@/lib/vercel/auth';
import { kv } from '@vercel/kv';
import { Resource } from '@/lib/vercel/schemas';
import { buildError } from '@/lib/utils';

export const POST = withAuth(
    async (_oidcClaims, _request, { params }: { params: Params }) => {
        if (!validateTransferId(params.transferId)) {
            return NextResponse.json(buildError('bad_request', 'Invalid ID'), { status: 400 });
        }

        const matchingClaim = await getTransferRequest(
            params.transferId,
        );

        // does claim exist?
        if (!matchingClaim) {
            return NextResponse.json(buildError('not_found', 'Transfer request not found'), { status: 404 });
        }
    
        // does the target installation ID match?
        if (!matchingClaim.targetInstallationIds.some(id => id === params.installationId)) {
            return NextResponse.json(buildError('bad_request', 'Invalid target installation ID'), { status: 400 });
        }

        // idemoptentcy - no need to re-complete
        if (matchingClaim.status === 'complete' && params.installationId === matchingClaim.claimedByInstallationId) {
            return new NextResponse( null, { status: 200 });
        }

        // is the claim in a state that can be completed?
        const now = new Date().getTime();
        if (matchingClaim.status !== 'verified' || matchingClaim.expiration > now) {
            return NextResponse.json(buildError('conflict', 'Operation failed because of a conflict with the current state of the resource'), { status: 409 });
        }

        const getPipeline = kv.pipeline();

        for (const resourceId of matchingClaim.resourceIds) {
        getPipeline.get(`${matchingClaim.sourceInstallationId}:resource:${resourceId}`);
        }

        const resources = await getPipeline.exec<Resource[]>();

        const setPipeline = kv.pipeline();

        for (const resource of resources) {
            setPipeline.del(`${matchingClaim.sourceInstallationId}:resource:${resource.id}`);
            setPipeline.set(`${params.installationId}:resource:${resource.id}`, resource);
        }

        await setPipeline.exec();

        await setTransferRequest({
            ...matchingClaim,
            status: 'complete',
            claimedByInstallationId: params.installationId,
        })

        return new NextResponse(null, { status: 200 });
    },
);
