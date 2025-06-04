import { AuthError, verifyToken } from "@/lib/vercel/auth";
import {
  createMcpHandler,
  experimental_withMcpAuth as withMcpAuth,
} from "@vercel/mcp-adapter";
import {
  InvalidTokenError,
  UnauthorizedClientError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { z } from "zod";
import { listResources } from "@/lib/partner";

export const maxDuration = 800;

const _handler = createMcpHandler(
  (server) => {
    server.tool(
      "greet",
      "Greet a person!",
      { name: z.string().describe("The name of a person to greet") },
      {
        title: "Greet tool",
        idempotentHint: true,
      },
      async ({ name }, extra) => {
        return {
          content: [
            {
              type: "text",
              text: `Hello ${name} ${String(
                extra.authInfo?.extra?.user_name || ""
              ).trim()}`,
            },
          ],
        };
      }
    );
    server.tool(
      "getResources",
      "Get installation resources",
      {},
      {
        title: "Get installation resources",
      },
      async (_, extra) => {
        if (!extra.authInfo) {
          throw new UnauthorizedClientError("Not authorized");
        }
        const installationId = extra.authInfo.clientId;
        const { resources } = await listResources(installationId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${resources.length} resources for installation ${installationId}`,
            },
            ...resources.map((resource) => ({
              type: "text" as const,
              text: `Resource: ${resource.name} (${resource.id})`,
            })),
          ],
        };
      }
    );
    server.tool(
      "getResourceById",
      "Get installation resource by ID",
      { id: z.string().describe("The ID of the resource to retrieve") },
      {
        title: "Get installation resource by ID",
        vercel: {
          resourceIdArg: "id",
        },
      },
      async ({ id }, extra) => {
        if (!extra.authInfo) {
          throw new UnauthorizedClientError("Not authorized");
        }
        const installationId = extra.authInfo.clientId;
        const { resources } = await listResources(installationId, [id]);
        const resource = resources.find((r) => r.id === id);
        return {
          content: [
            {
              type: "text" as const,
              text: resource
                ? `Resource found: ${resource.name} (${resource.id})`
                : `Resource with ID ${id} not found`,
            },
          ],
          structuredContent: resource,
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        getResources: {
          description: "Returns a list of resources for the installation",
          vercel: {},
        },
        getResourceById: {
          description: "Returns a specific resource by ID for the installation",
          vercel: {
            resourceIdArg: "id",
          },
        },
      },
      vercel: {},
    },
  },
  {
    redisUrl: process.env.KV_URL,
    basePath: "/mcp",
    verboseLogs: true,
    maxDuration: 60,
  }
);

const handler = withMcpAuth(
  _handler,
  async (_req, bearerToken) => {
    if (!bearerToken) {
      return undefined;
    }
    try {
      const token = await verifyToken(bearerToken);
      return {
        token: bearerToken,
        clientId: token.installation_id,
        scopes: [token.user_role || "USER"],
        extra: token,
      };
    } catch (err) {
      if (err instanceof AuthError) {
        console.error("Auth error:", err);
        throw new InvalidTokenError(err.message);
      }
      throw err;
    }
  },
  { required: false }
);

export { handler as GET, handler as POST, handler as DELETE };
