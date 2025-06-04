import { AuthError, verifyToken } from "@/lib/vercel/auth";
import {
  createMcpHandler,
  experimental_withMcpAuth as withMcpAuth,
} from "@vercel/mcp-adapter";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { z } from "zod";

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
  },
  {
    capabilities: {
      tools: {
        echo: {
          description: "Echo a message",
        },
      },
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
