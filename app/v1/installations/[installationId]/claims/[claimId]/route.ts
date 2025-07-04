import { NextRequest, NextResponse } from 'next/server';
import { getClaim, setClaim } from '@/lib/partner';
import { Claim } from '@/lib/vercel/schemas';
// import { withAuth } from '@/lib/vercel/auth';

// NOTE - overload #2 to create a claim - this route gets the claimID from the path
export async function POST(request: NextRequest, { params }: { params: Promise<{ installationId: string, claimId: string }> }) {
    const { installationId, claimId } = await params;
    // const data = await request.json();

    const matchingClaim = await getClaim(
        installationId, // TODO - get this from the auth claim
        claimId,
    );

    if (matchingClaim) {
        return NextResponse.json({ description: 'Operation failed because of a conflict with the current state of the resource' }, { status: 409 });
    }

    // if (!validateInstallationId(installationId) || !validateNewClaimBodyId(data)) {
    //     return NextResponse.json({ description: 'Input has failed validation' }, { status: 400 });
    // }

    var expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    const newClaim: Claim = {
        claimId,
        installationId, 
        status: 'unclaimed',
        // HACK - don't merge - these should come from the POST body
        // sourceInstallationId: data.sourceInstallationId,
        // expiration: data.expiration,
        // resourceIds: data.resourceIds,
        sourceInstallationId: 'unknown',
        expiration: new Date().getTime(),
        resourceIds: [],
    }
    await setClaim(newClaim);

    return NextResponse.json({ description: 'Claim created successfully' });
}

// NOTE - this GET is not part of the spec but makes it much easier to test
export async function GET(_: NextRequest, { params }: { params: Promise<{ installationId: string, claimId: string }> }) {
    const { installationId, claimId } = await params;

    const matchingClaim = await getClaim(
        installationId, // TODO - get this from the auth claim
        claimId,
    );

    if (matchingClaim) {
        return NextResponse.json(matchingClaim);
    }

    return NextResponse.json({ description: 'Claim not found' }, { status: 404 });
}

// TODO: Auth! This is how it should actually work, it's just much harder to test locally
// export const GET = withAuth(
//   async (claims, _request, { params }: { params: Params }) => {
//     const claim = await getClaim(
//       claims.installation_id,
//       params.claimId,
//     );

//     if (!claim) {
//       return Response.json(
//         {
//           error: true,
//           code: "not_found",
//         },
//         { status: 404 },
//       );
//     }

//     return Response.json(claim);
//   },
// );

// interface Params {
//   installationId: string;
//   claimId: string;
// }
