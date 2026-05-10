 
import fs from "fs/promises";
import path from "path";

import {
  Server,
} from "@modelcontextprotocol/sdk/server/index.js";

import {
  StdioServerTransport,
} from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";


// =========================
// WORKSPACE SETUP
// =========================

const WORKSPACE_DIR =
  path.resolve("./workspace");


// auto create workspace
await fs.mkdir(
  WORKSPACE_DIR,
  {
    recursive: true,
  }
);


// =========================
// SAFE PATH
// =========================

function safePath(filepath) {

  if (!filepath) {
    throw new Error(
      "filepath is required"
    );
  }

  // block dangerous paths
  const blockedPaths = [
    ".",
    "/",
    "../",
    "..",
  ];

  if (
    blockedPaths.includes(filepath)
  ) {
    throw new Error(
      "Dangerous path blocked"
    );
  }

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


// =========================
// RECURSIVE FILE LISTING
// =========================

async function getAllFiles(dir) {

  const entries =
    await fs.readdir(
      dir,
      {
        withFileTypes: true,
      }
    );

  const files = [];

  for (const entry of entries) {

    const fullPath =
      path.join(
        dir,
        entry.name
      );

    if (entry.isDirectory()) {

      const nestedFiles =
        await getAllFiles(
          fullPath
        );

      files.push(
        ...nestedFiles
      );

    } else {

      files.push(
        path.relative(
          WORKSPACE_DIR,
          fullPath
        )
      );
    }
  }

  return files;
}


// =========================
// MCP SERVER
// =========================

const server =
  new Server(
    {
      name: "filesystem-mcp",
      version: "2.0.0",
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
      "Write content to a file",

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
        "content",
      ],
    },
  },


  {
    name: "append_file",

    description:
      "Append content to an existing file",

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
        "content",
      ],
    },
  },


  {
    name: "delete_file",

    description:
      "Delete a file",

    inputSchema: {
      type: "object",

      properties: {
        filepath: {
          type: "string",
        },

        confirm: {
          type: "boolean",

          description:
            "Must be true to delete the file",
        },
      },

      required: [
        "filepath",
        "confirm",
      ],
    },
  },


  {
    name: "list_files",

    description:
      "List all files in workspace recursively",

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

      console.error(
        `\n[TOOL EXECUTION] ${name}`
      );

      console.error(
        "Arguments:",
        args
      );


      switch (name) {


        // =====================
        // READ FILE
        // =====================

        case "read_file": {

          if (!args?.filepath) {
            throw new Error(
              "filepath required"
            );
          }

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

          if (!args?.filepath) {
            throw new Error(
              "filepath required"
            );
          }

          if (
            typeof args.content !==
            "string"
          ) {
            throw new Error(
              "content must be string"
            );
          }

          const fullPath =
            safePath(
              args.filepath
            );

          // auto create folders
          await fs.mkdir(
            path.dirname(fullPath),
            {
              recursive: true,
            }
          );

          await fs.writeFile(
            fullPath,
            args.content,
            "utf-8"
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
        // APPEND FILE
        // =====================

        case "append_file": {

          if (!args?.filepath) {
            throw new Error(
              "filepath required"
            );
          }

          if (
            typeof args.content !==
            "string"
          ) {
            throw new Error(
              "content must be string"
            );
          }

          const fullPath =
            safePath(
              args.filepath
            );

          await fs.appendFile(
            fullPath,
            args.content,
            "utf-8"
          );

          return {
            content: [
              {
                type: "text",

                text:
                  `Updated file: ${args.filepath}`,
              },
            ],
          };
        }


        // =====================
        // DELETE FILE
        // =====================

        case "delete_file": {

          if (!args?.filepath) {
            throw new Error(
              "filepath required"
            );
          }

          // guardrail protection
          if (!args.confirm) {
            throw new Error(
              "Deletion blocked. confirm=true required"
            );
          }

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
            await getAllFiles(
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


        // =====================
        // UNKNOWN TOOL
        // =====================

        default:

          throw new Error(
            `Unknown tool: ${name}`
          );
      }

    } catch (error) {

      console.error(
        "\n[TOOL ERROR]",
        error
      );

      return {

        content: [
          {
            type: "text",

            text:
              `Tool Error: ${error.message}`,
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
