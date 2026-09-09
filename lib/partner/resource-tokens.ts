import type {
  ResourceTokenCheck,
  ResourceTokenClaims,
  ResourceTokenStore,
  VerifiedResource,
} from "@/lib/vercel/resource-token";
import type { Resource } from "@/lib/vercel/schemas";
import { nanoid } from "nanoid";
import { kv } from "../redis";
import type { Installation } from "./index";

/** The subset of the stored resource record this file reads. */
type StoredResourceFields = Pick<
  Resource,
  "id" | "name" | "status" | "productId"
>;

const PRESENTATION_LOG_KEY = "oidc_resource_token_presentations";
const PRESENTATION_LOG_LIMIT = 50;

/**
 * The two lookups {@link verifyResourceToken} needs, backed by the same Redis
 * keys the marketplace API handlers write. Read directly rather than through
 * `getInstallation`/`getResource` so an unknown id comes back as `null` instead
 * of throwing, and so an uninstalled installation is still distinguishable from
 * one that never existed.
 */
export const redisResourceTokenStore: ResourceTokenStore = {
  async findInstallation(installationId) {
    const installation = await kv.get<Installation>(installationId);
    if (!installation) return null;
    return { deleted: Boolean(installation.deletedAt) };
  },

  async findResource(installationId, resourceId) {
    const stored = await kv.get<StoredResourceFields>(
      `${installationId}:resource:${resourceId}`,
    );
    if (!stored) return null;
    return {
      id: stored.id,
      name: stored.name,
      status: stored.status,
      productId: stored.productId,
    } satisfies VerifiedResource;
  },
};

export interface ResourceTokenPresentation {
  id: string;
  presentedAt: number;
  accepted: boolean;
  error?: string;
  checks: ResourceTokenCheck[];
  claims?: Partial<ResourceTokenClaims>;
  header?: Record<string, unknown>;
  installationId?: string;
  resource?: VerifiedResource;
  /**
   * Demo affordance. A real integration would never persist a presented
   * credential — it would keep the claims and drop the token. Kept here so the
   * dashboard can show the exact JWT that was presented; it expires in 300s.
   */
  token: string;
}

export async function recordResourceTokenPresentation(
  presentation: Omit<ResourceTokenPresentation, "id" | "presentedAt">,
): Promise<ResourceTokenPresentation> {
  const entry: ResourceTokenPresentation = {
    ...presentation,
    id: nanoid(),
    presentedAt: Date.now(),
  };

  const pipeline = kv.pipeline();
  pipeline.lpush(PRESENTATION_LOG_KEY, entry);
  pipeline.ltrim(PRESENTATION_LOG_KEY, 0, PRESENTATION_LOG_LIMIT - 1);
  await pipeline.exec();

  return entry;
}

export async function listResourceTokenPresentations(
  limit = PRESENTATION_LOG_LIMIT,
): Promise<ResourceTokenPresentation[]> {
  const entries = await kv.lrange<ResourceTokenPresentation>(
    PRESENTATION_LOG_KEY,
    0,
    limit - 1,
  );
  return entries.sort((a, b) => b.presentedAt - a.presentedAt);
}

export async function clearResourceTokenPresentations(): Promise<void> {
  await kv.del(PRESENTATION_LOG_KEY);
}
