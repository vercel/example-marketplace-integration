import { withAuth } from "@/lib/vercel/auth";
import { getClaim, setClaim } from '@/lib/partner';
import { Claim } from "@/lib/vercel/schemas";
import { NextResponse } from "next/server";
import { validateNewClaimBodyId, validateClaimId } from "./utils";

// NOTE - overload #1 to create a claim - this route doesn't have a claimID in the path and gets it from the request body
export const POST = withAuth(
    async (oidcClaims, request) => {        
        const data = await request.json();
        if (!validateNewClaimBodyId(data) || !validateClaimIdInBody(data)) { // TODO: should use the readRequestBodyWithSchema() helper
            return NextResponse.json({ description: 'Input has failed validation' }, { status: 400 });
        }

        const matchingClaim = await getClaim(
            oidcClaims.installation_id,
            data.claimId,
        );
        
        if (matchingClaim) {
            return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
        }

        var expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        const newClaim: Claim = {
            claimId: data.claimId,
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

function validateClaimIdInBody(data: any): boolean {
    if (!Object.hasOwn(data, 'claimId')) return false;
    if (!validateClaimId(data.claimId)) return false;

    return true;
}

interface Params {
  installationId: string;
}
