import fs from "fs/promises";
import path from "path";

import { z } from "zod";

import {
  Server
} from "@modelcontextprotocol/sdk/server/index.js";

import {
  StdioServerTransport
} from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";



const WORKSPACE_DIR =
  path.resolve("./workspace");



function safePath(filepath) {

  const resolved =
    path.resolve(
      WORKSPACE_DIR,
      filepath
    );

  if (
    !resolved.startsWith(WORKSPACE_DIR)
  ) {
    throw new Error(
      "Path traversal blocked"
    );
  }

  return resolved;
}



const server =
  new Server(
    {
      name: "filesystem-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );



// =========================
// TOOL DEFINITIONS
// =========================

const tools = [

  {
    name: "read_file",

    description:
      "Read file content",

    inputSchema: {
      type: "object",

      properties: {
        filepath: {
          type: "string",
        },
      },

      required: ["filepath"],
    },
  },



  {
    name: "write_file",

    description:
      "Write file content",

    inputSchema: {
      type: "object",

      properties: {

        filepath: {
          type: "string",
        },

        content: {
          type: "string",
        },
      },

      required: [
        "filepath",
        "content"
      ],
    },
  },



  {
    name: "delete_file",

    description:
      "Delete file",

    inputSchema: {
      type: "object",

      properties: {
        filepath: {
          type: "string",
        },
      },

      required: ["filepath"],
    },
  },



  {
    name: "list_files",

    description:
      "List workspace files",

    inputSchema: {
      type: "object",

      properties: {},
    },
  },
];



// =========================
// LIST TOOLS
// =========================

server.setRequestHandler(
  ListToolsRequestSchema,

  async () => {

    return {
      tools,
    };
  }
);



// =========================
// CALL TOOL
// =========================

server.setRequestHandler(
  CallToolRequestSchema,

  async (request) => {

    const {
      name,
      arguments: args,
    } = request.params;



    try {

      switch (name) {

        // =====================
        // READ FILE
        // =====================

        case "read_file": {

          const fullPath =
            safePath(
              args.filepath
            );

          const content =
            await fs.readFile(
              fullPath,
              "utf-8"
            );

          return {
            content: [
              {
                type: "text",

                text: content,
              },
            ],
          };
        }



        // =====================
        // WRITE FILE
        // =====================

        case "write_file": {

          const fullPath =
            safePath(
              args.filepath
            );

          await fs.writeFile(
            fullPath,
            args.content
          );

          return {
            content: [
              {
                type: "text",

                text:
                  `File written: ${args.filepath}`,
              },
            ],
          };
        }



        // =====================
        // DELETE FILE
        // =====================

        case "delete_file": {

          const fullPath =
            safePath(
              args.filepath
            );

          await fs.unlink(
            fullPath
          );

          return {
            content: [
              {
                type: "text",

                text:
                  `Deleted ${args.filepath}`,
              },
            ],
          };
        }



        // =====================
        // LIST FILES
        // =====================

        case "list_files": {

          const files =
            await fs.readdir(
              WORKSPACE_DIR
            );

          return {
            content: [
              {
                type: "text",

                text:
                  JSON.stringify(
                    files,
                    null,
                    2
                  ),
              },
            ],
          };
        }



        default:

          throw new Error(
            `Unknown tool: ${name}`
          );
      }

    } catch (error) {

      return {

        content: [
          {
            type: "text",

            text:
              error.message,
          },
        ],

        isError: true,
      };
    }
  }
);



// =========================
// START SERVER
// =========================

const transport =
  new StdioServerTransport();

await server.connect(
  transport
);

console.error(
  "Filesystem MCP running..."
);