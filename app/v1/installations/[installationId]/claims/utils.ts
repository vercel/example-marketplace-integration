export interface Params {
  installationId: string;
  claimId: string;
}

export function generateId(prefix: string, length: number): string {
    var result           = `${prefix}_`;
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export function validateInstallationId(installationId: string): boolean {
    if (installationId.length < 8) return false;
    return installationId.startsWith('ifcg_');
}

export function validateClaimId(installationId: string): boolean {
    // TODO: could add a simple reg-ex here if we have a specific claim ID format in mind
    if (installationId.length < 3) return false;
    return true;
}

function validateResourceId(installationId: string): boolean {
    if (installationId.length < 10) return false;
    return installationId.startsWith('ir_');
}

export function validateNewClaimBodyId(data: any): boolean {
    if (!Object.hasOwn(data, 'sourceInstallationId')) return false;
    if (!validateInstallationId(data.sourceInstallationId)) return false;

    if (!Object.hasOwn(data, 'resourceIds')) return false;
    if (!Array.isArray(data.resourceIds)) return false;
    data.resourceIds.forEach((res: any) => {
        if (!validateResourceId(`${res}`)) return false;
    });

    if (!Object.hasOwn(data, 'expiration')) return false;
    if (data.expiration <= 0) return false;

    return true;
}
