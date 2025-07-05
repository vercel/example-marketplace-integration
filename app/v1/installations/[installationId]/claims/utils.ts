export interface Params {
  installationId: string;
  claimId: string;
}

export function validateClaimId(installationId: string): boolean {
    // TODO: could add a simple reg-ex here if we have a specific claim ID format in mind
    if (installationId.length < 3) return false;
    return true;
}
