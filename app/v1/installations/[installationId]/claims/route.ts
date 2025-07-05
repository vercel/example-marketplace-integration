import { withAuth } from "@/lib/vercel/auth";
import { getClaim, setClaim } from '@/lib/partner';
import { Claim, createClaimRequestSchema } from "@/lib/vercel/schemas";
import { NextResponse } from "next/server";
import { readRequestBodyWithSchema } from "@/lib/utils";

// NOTE - overload #1 to create a claim - this route doesn't have a claimID in the path and gets it from the request body
export const POST = withAuth(
    async (oidcClaims, request) => {        
        const requestBody = await readRequestBodyWithSchema(
            request,
            createClaimRequestSchema,
        );

        const {data} = requestBody;
        if (!requestBody.success || !data || !data.claimId) {
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
