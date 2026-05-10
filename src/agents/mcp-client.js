import {
  Client
} from "@modelcontextprotocol/sdk/client/index.js";

import {
  StdioClientTransport
} from "@modelcontextprotocol/sdk/client/stdio.js";



export async function createMcpClient() {

  const transport =
    new StdioClientTransport({

      command: "node",

      args: [
        "src/filesystem-mcp/server.js"
      ],
    });



  const client =
    new Client(
      {
        name: "agent-client",
        version: "1.0.0",
      }
    );



  await client.connect(
    transport
  );



  // DYNAMIC TOOL DISCOVERY
  const tools =
    await client.listTools();



  return {
    client,
    tools,
  };
}