import crypto from "node:crypto";
import {
  RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS,
  type ResourceTokenStore,
  resourceTokenIssuer,
  verifyResourceToken,
} from "@/lib/vercel/resource-token";
import { SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { JOSEError } from "jose/errors";
import { describe, expect, it } from "vitest";

/**
 * Signs tokens the way `api-integrations` does — same claim set, same RS256
 * envelope, real RSA — and runs them through the verification path a partner
 * would actually deploy. Nothing here is mocked except the two store lookups,
 * so a change to the claim contract fails these tests.
 *
 * The api-side counterpart is
 * `packages/util-integrations/src/marketplace/resource-token-signature.test.ts`
 * in `vercel/api`.
 */

const KEY_ID = "arn:aws:kms:us-east-1:000000000000:key/test";
const INSTALLATION_ID = "icfg_d5746caf3c00c0628a53316b";
const PROJECT_ID = "prj_storefront";
const RESOURCE_ID = "young-pine-52426100";
const ACT = "owner:acme:project:storefront:environment:production";
const TTL_SECONDS = 300;

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const otherKeyPair = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

async function publishedJwks(key: crypto.KeyObject = publicKey) {
  const jwk = await exportJWK(key);
  return createLocalJWKSet({ keys: [{ ...jwk, kid: KEY_ID, alg: "RS256" }] });
}

/** Mirrors `buildResourceTokenClaims` plus the signer-owned time claims. */
async function mint(
  overrides: {
    iss?: string;
    aud?: string | string[];
    sub?: string;
    resource?: string;
    act?: { sub: string } | undefined;
    issuedAt?: number;
    signingKey?: crypto.KeyObject;
  } = {},
): Promise<string> {
  const issuedAt = overrides.issuedAt ?? Math.floor(Date.now() / 1000);
  // `"act" in overrides` rather than a truthiness check, so a test can mint a
  // token that carries no actor at all by passing `act: undefined`.
  const act = "act" in overrides ? overrides.act : { sub: ACT };

  const jwt = new SignJWT({
    resource: overrides.resource ?? RESOURCE_ID,
    ...(act ? { act } : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
    .setIssuer(overrides.iss ?? resourceTokenIssuer)
    .setAudience(overrides.aud ?? INSTALLATION_ID)
    .setSubject(overrides.sub ?? PROJECT_ID)
    .setIssuedAt(issuedAt)
    .setNotBefore(issuedAt)
    .setExpirationTime(issuedAt + TTL_SECONDS);

  return jwt.sign(overrides.signingKey ?? privateKey);
}

function storeWith(
  overrides: Partial<ResourceTokenStore> = {},
): ResourceTokenStore {
  return {
    findInstallation: async (installationId) =>
      installationId === INSTALLATION_ID ? { deleted: false } : null,
    findResource: async (installationId, resourceId) =>
      installationId === INSTALLATION_ID && resourceId === RESOURCE_ID
        ? {
            id: RESOURCE_ID,
            name: "acme-production",
            status: "ready",
            productId: "storage",
          }
        : null,
    ...overrides,
  };
}

async function verify(
  token: string,
  store: ResourceTokenStore = storeWith(),
  key?: crypto.KeyObject,
) {
  return verifyResourceToken(token, store, { jwks: await publishedJwks(key) });
}

function failedCheckNames(checks: { name: string; passed: boolean }[]) {
  return checks.filter((check) => !check.passed).map((check) => check.name);
}

describe("verifyResourceToken", () => {
  it("accepts a token minted for a resource on an installation we hold", async () => {
    const result = await verify(await mint());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.installationId).toEqual(INSTALLATION_ID);
    expect(result.resource).toMatchObject({
      id: RESOURCE_ID,
      name: "acme-production",
      status: "ready",
    });
    expect(result.claims.sub).toEqual(PROJECT_ID);
    expect(result.claims.act?.sub).toEqual(ACT);
    expect(result.claims.exp - result.claims.iat).toEqual(TTL_SECONDS);
    expect(result.header.kid).toEqual(KEY_ID);
    expect(failedCheckNames(result.checks)).toEqual([]);
    expect(result.checks.map((check) => check.name)).toEqual([
      "signature",
      "issuer",
      "lifetime",
      "audience",
      "resource",
      "subject",
      "actor",
    ]);
  });

  it("rejects a token minted for a different integration", async () => {
    // One Vercel key signs every integration's resource tokens, so this token's
    // signature is genuine — only the pinned `iss` separates it from ours.
    const result = await verify(
      await mint({ iss: "https://integrations.vercel.com/oac_someone_else" }),
    );

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["issuer"]);
    if (result.ok) return;
    expect(result.error).toContain(resourceTokenIssuer);
  });

  it("rejects a token signed by a key that is not in the published JWKS", async () => {
    const result = await verify(
      await mint({ signingKey: otherKeyPair.privateKey }),
    );

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["signature"]);
  });

  it("rejects an expired token but reports signature and issuer as sound", async () => {
    const result = await verify(
      await mint({
        issuedAt:
          Math.floor(Date.now() / 1000) -
          TTL_SECONDS -
          RESOURCE_TOKEN_CLOCK_TOLERANCE_SECONDS -
          10,
      }),
    );

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["lifetime"]);
    expect(
      result.checks.filter((check) => check.passed).map((check) => check.name),
    ).toEqual(["signature", "issuer"]);
  });

  it("accepts a token that expired within the clock tolerance", async () => {
    const result = await verify(
      await mint({
        issuedAt: Math.floor(Date.now() / 1000) - TTL_SECONDS - 5,
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("rejects an audience that is not an installation we hold", async () => {
    const result = await verify(await mint({ aud: "icfg_not_ours" }));

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["audience"]);
    if (result.ok) return;
    expect(result.error).toContain("unknown to this integration");
  });

  it("rejects an audience whose installation has been uninstalled", async () => {
    const result = await verify(
      await mint(),
      storeWith({ findInstallation: async () => ({ deleted: true }) }),
    );

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["audience"]);
    if (result.ok) return;
    expect(result.error).toContain("uninstalled");
  });

  it("rejects multiple audiences", async () => {
    const result = await verify(
      await mint({ aud: [INSTALLATION_ID, "icfg_other"] }),
    );

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["audience"]);
  });

  it("rejects a resource that does not exist under that installation", async () => {
    const result = await verify(await mint({ resource: "not-our-resource" }));

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["resource"]);
    if (result.ok) return;
    expect(result.error).toContain("not-our-resource");
  });

  it("scopes the resource lookup to the token's installation", async () => {
    const calls: [string, string][] = [];
    const result = await verify(
      await mint(),
      storeWith({
        findResource: async (installationId, resourceId) => {
          calls.push([installationId, resourceId]);
          return {
            id: resourceId,
            name: "acme-production",
            status: "ready",
            productId: "storage",
          };
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual([[INSTALLATION_ID, RESOURCE_ID]]);
  });

  it("reports an unreachable key set as an availability problem, not a bad signature", async () => {
    const result = await verifyResourceToken(await mint(), storeWith(), {
      // What `createRemoteJWKSet` throws on a non-200 from the JWKS endpoint.
      jwks: async () => {
        throw new JOSEError(
          "Expected 200 OK from the JSON Web Key Set HTTP response",
        );
      },
    });

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["signature"]);
    if (result.ok) return;
    expect(result.error).toContain("Could not read the key set");
    expect(result.error).toContain("not a bad signature");
  });

  it("rejects a token with no actor, so a mint can always be attributed", async () => {
    const result = await verify(await mint({ act: undefined }));

    expect(result.ok).toBe(false);
    expect(failedCheckNames(result.checks)).toEqual(["actor"]);
  });
});
