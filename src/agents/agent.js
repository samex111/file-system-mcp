import dotenv from "dotenv";
import OpenAI from "openai";

import {
  createMcpClient,
} from "./mcp-client.js";

dotenv.config();


// =========================
// OPENAI COMPATIBLE CLIENT
// =========================

const openai = new OpenAI({
  apiKey:
    process.env.NVIDIA_OPEN_AI_API_KEY,

  baseURL:
    "https://integrate.api.nvidia.com/v1",
});


// =========================
// CONFIG
// =========================

const MODEL =
  "mistral-small-4-119b-2603";

const SYSTEM_PROMPT = `
You are a production-grade MCP filesystem agent.

Rules:
- Use tools whenever required
- Never hallucinate tool outputs
- Never output XML
- Never output DSML
- Never fake tool execution
- Always wait for real tool results
- Keep responses concise
- Use multiple tools if necessary
`;


// =========================
// MAIN
// =========================

async function main() {

  try {

    // =========================
    // CONNECT MCP
    // =========================

    const {
      client,
      tools,
    } =
      await createMcpClient();

    console.log(
      "\nDiscovered tools:\n"
    );

    console.log(
      tools.tools.map(
        t => t.name
      )
    );


    // =========================
    // MCP -> OPENAI TOOLS
    // =========================

    const openAITools =
      tools.tools.map(tool => ({

        type: "function",

        function: {
          name: tool.name,

          description:
            tool.description || "",

          parameters:
            tool.inputSchema,
        },
      }));


    // =========================
    // USER REQUEST
    // =========================

    const userMessage =
      "create a file named test.txt with content 'Hello World' and then list all files";


    // =========================
    // CONVERSATION
    // =========================

    const messages = [

      {
        role: "system",

        content:
          SYSTEM_PROMPT,
      },

      {
        role: "user",

        content:
          userMessage,
      },
    ];


    // =========================
    // AGENT LOOP
    // =========================

    while (true) {

      console.log(
        "\n========================="
      );

      console.log(
        "LLM THINKING..."
      );

      console.log(
        "=========================\n"
      );


      const completion =
        await openai.chat.completions.create({

          model: MODEL,

          messages,

          tools:
            openAITools,

          tool_choice: "auto",

          temperature: 0.2,

          max_tokens: 4096,
        });


      const message =
        completion
          .choices[0]
          .message;


      // save assistant response
      messages.push(message);


      // =========================
      // NO TOOL CALLS
      // =========================

      if (!message.tool_calls) {

        console.log(
          "\n========================="
        );

        console.log(
          "FINAL RESPONSE"
        );

        console.log(
          "=========================\n"
        );

        console.log(
          message.content
        );

        break;
      }


      // =========================
      // EXECUTE TOOL CALLS
      // =========================

      for (const toolCall of message.tool_calls) {

        const toolName =
          toolCall.function.name;

        let args = {};

        try {

          args = JSON.parse(
            toolCall
              .function
              .arguments
          );

        } catch {

          console.error(
            "\nInvalid JSON arguments"
          );

          continue;
        }


        console.log(
          "\n========================="
        );

        console.log(
          `EXECUTING TOOL: ${toolName}`
        );

        console.log(
          "=========================\n"
        );

        console.log(
          "Arguments:"
        );

        console.log(args);


        // =========================
        // EXECUTE MCP TOOL
        // =========================

        const toolResult =
          await client.callTool({

            name: toolName,

            arguments: args,
          });


        console.log(
          "\nTool Result:\n"
        );

        console.log(
          JSON.stringify(
            toolResult,
            null,
            2
          )
        );


        // =========================
        // SEND TOOL RESULT
        // =========================

        messages.push({

          role: "tool",

          tool_call_id:
            toolCall.id,

          content:
            JSON.stringify(
              toolResult
            ),
        });
      }
    }

  } catch (error) {

    console.error(
      "\n========================="
    );

    console.error(
      "AGENT ERROR"
    );

    console.error(
      "=========================\n"
    );

    console.error(error);
  }
}

main();