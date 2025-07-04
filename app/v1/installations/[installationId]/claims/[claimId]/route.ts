import { NextResponse } from 'next/server';
import { deleteClaim, getClaim, setClaim } from '@/lib/partner';
import { Claim } from '@/lib/vercel/schemas';
import { Params, validateNewClaimBodyId } from '../utils';
import { withAuth } from '@/lib/vercel/auth';

// NOTE - overload #2 to create a claim - this route gets the claimID from the path
export const POST = withAuth(
    async (oidcClaims, request, { params }: { params: Params }) => {
        const matchingClaim = await getClaim(
            oidcClaims.installation_id,
            params.claimId,
        );
        
        if (matchingClaim) {
            return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
        }
        
        const data = await request.json();
        if (!validateNewClaimBodyId(data)) { // TODO: should use the readRequestBodyWithSchema() helper
            return NextResponse.json({ description: 'Input has failed validation' }, { status: 400 });
        }

        var expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        const newClaim: Claim = {
            claimId: params.claimId,
            installationId: oidcClaims.installation_id, 
            status: 'unclaimed',
            sourceInstallationId: data.sourceInstallationId,
            expiration: data.expiration,
            resourceIds: data.resourceIds,
        }
        await setClaim(newClaim);

        return NextResponse.json({ description: 'Claim created successfully' });
    },
);

// NOTE - this GET is not part of the spec but makes it much easier to test
export const GET = withAuth(
    async (oidcClaims, _request, { params }: { params: Params }) => {
        const matchingClaim = await getClaim(
            oidcClaims.installation_id,
            params.claimId,
        );

        if (matchingClaim) {
            return NextResponse.json(matchingClaim);
        }

        return NextResponse.json({ description: 'Claim not found' }, { status: 404 });
    },
);

// NOTE - this DELETE is not part of the spec, it exists to allow us to clean up test data
export const DELETE = withAuth(
    async (oidcClaims, _request, { params }: { params: Params }) => {
        const matchingClaim = await getClaim(
            oidcClaims.installation_id,
            params.claimId,
        );

        if (!matchingClaim) {
            return NextResponse.json({ description: 'Claim not found' }, { status: 404 });
        }

        await deleteClaim(matchingClaim);

        return NextResponse.json({ description: 'Claim deleted successfully' });
    },
);
