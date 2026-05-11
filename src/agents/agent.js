import dotenv from "dotenv";
import OpenAI from "openai";

import {
  createMcpClient,
} from "./mcp-client.js";

dotenv.config();


// =========================
// NVIDIA OPENAI CLIENT
// =========================

const openai = new OpenAI({
  apiKey:
    process.env.NVIDIA_API_KEY,

  baseURL:
    "https://integrate.api.nvidia.com/v1",
});


// =========================
// MODEL
// =========================

const MODEL =
  "qwen/qwen3-coder-480b-a35b-instruct";


// =========================
// SYSTEM PROMPT
// =========================

const SYSTEM_PROMPT = `
You are a production-grade MCP filesystem agent.

Rules:
- Use tools whenever required
- Never hallucinate tool outputs
- Never fake tool execution
- Always wait for real tool results
- Keep responses concise
- Use multiple tools if necessary
- Return valid tool arguments only
- Never output XML
- Never output DSML
`;


// =========================
// SAFE JSON PARSER
// =========================

function safeJsonParse(input) {

  try {

    return JSON.parse(input);

  } catch (error) {

    console.error(
      "\nJSON PARSE ERROR:"
    );

    console.error(error);

    return null;
  }
}


// =========================
// STREAM TEXT
// =========================

async function streamResponse(stream) {

  let finalText = "";

  for await (const chunk of stream) {

    const delta =
      chunk.choices?.[0]?.delta;

    // normal text
    if (delta?.content) {

      process.stdout.write(
        delta.content
      );

      finalText +=
        delta.content;
    }
  }

  return finalText;
}


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

          name:
            tool.name,

          description:
            tool.description || "",

          parameters:
            tool.inputSchema,
        },
      }));


    // =========================
    // USER MESSAGE
    // =========================

    const userMessage =
      "create a file named test-5.txt with content 'Hello World this is new ' ";


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


      // =========================
      // NON-STREAM REQUEST
      // (TOOLS WORK BETTER)
      // =========================

      const completion =
        await openai.chat.completions.create({

          model: MODEL,

          messages,

          tools:
            openAITools,

          tool_choice:
            "auto",

          temperature:
            0.2,

          top_p:
            0.8,

          max_tokens:
            8192,
        });


      const message =
        completion
          .choices[0]
          .message;


      // save assistant response
      messages.push(message);


      // =========================
      // FINAL RESPONSE
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

        // STREAM FINAL TEXT
        const stream =
          await openai.chat.completions.create({

            model: MODEL,

            messages,

            stream: true,

            temperature: 0.2,

            max_tokens: 8192,
          });

        await streamResponse(
          stream
        );

        console.log("\n");

        break;
      }


      // =========================
      // EXECUTE TOOL CALLS
      // =========================

      for (const toolCall of message.tool_calls) {

        const toolName =
          toolCall.function.name;

        const args =
          safeJsonParse(
            toolCall.function.arguments
          );


        if (!args) {

          console.error(
            "\nInvalid tool arguments"
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

        console.log(args);


        // =========================
        // EXECUTE MCP TOOL
        // =========================

        const toolResult =
          await client.callTool({

            name:
              toolName,

            arguments:
              args,
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
        // APPEND TOOL RESULT
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