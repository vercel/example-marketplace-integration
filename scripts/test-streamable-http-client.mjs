import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const origin = process.argv[2] || "http://localhost:3000/mcp";

async function main() {
  const transport = new StreamableHTTPClientTransport(
    new URL(`${origin}/mcp`),
    {
      requestInit: {
        headers: {
          ...(process.env.VERCEL_OIDC_TOKEN
            ? {
                authorization: `Bearer ${process.env.VERCEL_OIDC_TOKEN}`,
              }
            : null),
        },
      },
    }
  );

  const client = new Client(
    {
      name: "example-client",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    }
  );

  await client.connect(transport);

  console.log("Connected", client.getServerCapabilities());

  const { tools } = await client.listTools();
  console.log(tools);

  const greet = tools.find((tool) => tool.name === "greet");
  if (!greet) {
    throw new Error("Echo tool not found");
  }
  console.log("Using tool:", greet, greet.inputSchema.properties);

  const result = await client.callTool(
    {
      name: greet.name,
      arguments: {
        name: "Mr",
      },
    },
    undefined,
    {}
  );
  console.log("Tool call result:", result);
}

main();
