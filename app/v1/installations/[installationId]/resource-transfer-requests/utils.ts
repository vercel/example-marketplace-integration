export interface Params {
  installationId: string;
  transferId: string;
}

export function validateTransferId(transferRequestId: string): boolean {
  // TODO: could add a simple reg-ex here if we have a specific claim ID format in mind
  if (transferRequestId.length < 3) {
    return false;
  }
  return true;
}
