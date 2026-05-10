import dotenv from "dotenv";

import {
  GoogleGenerativeAI
} from "@google/generative-ai";

import {
  createMcpClient
} from "./mcp-client.js";


dotenv.config();


// =========================
// GEMINI SETUP
// =========================

const genAI =
  new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
  );

const model =
  genAI.getGenerativeModel({
    model: "gemini-flash-latest",
  });



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
    // CONVERT MCP TO GEMINI
    // =========================

    const geminiTools =
      tools.tools.map(tool => ({

        name: tool.name,

        description:
          tool.description || "",

        parameters:
          tool.inputSchema,
      }));



    const userMessage =
      "Create notes.txt with content Hello MCP";



    // =========================
    // FIRST LLM CALL
    // =========================

    const response =
      await model.generateContent({

        contents: [
          {
            role: "user",

            parts: [
              {
                text: userMessage,
              },
            ],
          },
        ],

        tools: [
          {
            functionDeclarations:
              geminiTools,
          },
        ],
      });



    // =========================
    // EXTRACT FUNCTION CALL
    // =========================

    const candidate =
      response.response
        .candidates?.[0];



    if (!candidate) {
      throw new Error(
        "No candidate returned"
      );
    }



    const parts =
      candidate.content.parts;



    const functionCall =
      parts.find(
        p => p.functionCall
      )?.functionCall;



    // =========================
    // NO TOOL CALL
    // =========================

    if (!functionCall) {

      console.log(
        "\nNo tool call:\n"
      );

      console.log(
        response.response.text()
      );

      return;
    }



    // =========================
    // TOOL INFO
    // =========================

    const toolName =
      functionCall.name;

    const args =
      functionCall.args;



    console.log(
      "\nExecuting Tool:",
      toolName
    );

    console.log(
      "Arguments:",
      args
    );



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

    console.log(toolResult);



    // =========================
    // SEND TOOL RESULT BACK
    // =========================

  const finalResponse =
  await model.generateContent({

    contents: [

      {
        role: "user",

        parts: [
          {
            text: userMessage,
          },
        ],
      },



      // IMPORTANT
      // reuse ORIGINAL model parts
      {
        role: "model",

        parts,
      },



      {
        role: "user",

        parts: [
          {
            functionResponse: {

              name: toolName,

              response: {
                result:
                  toolResult,
              },
            },
          },
        ],
      },
    ],
  });

    // =========================
    // FINAL RESPONSE
    // =========================

    console.log(
      "\nFINAL RESPONSE:\n"
    );

    console.log(
      finalResponse.response.text()
    );

  } catch (error) {

    console.error(
      "\nERROR:\n",
      error
    );
  }
}



main();