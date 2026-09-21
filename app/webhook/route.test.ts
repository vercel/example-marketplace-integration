import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { kvMock } = vi.hoisted(() => {
  const installation = {
    type: "marketplace",
    scopes: [],
    acceptedPolicies: {},
    credentials: { access_token: "token", token_type: "Bearer" },
  };
  const pipeline = {
    lpush: vi.fn(),
    ltrim: vi.fn(),
    exec: vi.fn().mockResolvedValue([]),
  };

  return {
    kvMock: {
      get: vi.fn().mockResolvedValue(installation),
      lrange: vi.fn().mockResolvedValue(["icfg_test"]),
      pipeline: vi.fn(() => pipeline),
    },
  };
});

vi.mock("@/lib/redis", () => ({ kv: kvMock }));

import { POST } from "./route";

const event = {
  id: "event_1",
  type: "deployment.created",
  createdAt: 1_700_000_000_000,
  payload: {
    installationIds: ["icfg_test"],
    deployment: { id: "dpl_test" },
  },
};

function webhookRequest() {
  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac("sha1", "test-secret")
    .update(body)
    .digest("hex");
  return new Request("https://example.com/webhook", {
    method: "POST",
    body,
    headers: { "x-vercel-signature": signature },
  });
}

describe("webhook acknowledgments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("acknowledges a successfully handled event", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("acknowledges an event when downstream handling fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Forbidden", {
        status: 403,
        statusText: "Forbidden",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(
      "Failed to handle webhook event",
      expect.any(Error),
    );
  });
});
