import { exportRedditDailyComments } from "../../reddit.mjs";

const TOOLS = [
  {
    description:
      "Fetches the latest daily discussion threads from r/BitcoinMarkets or r/ethereum, including recent comments from the last 24 hours. Returns formatted comments with timestamps, authors, scores, and reply chains.",
    inputSchema: {
      properties: {
        intervalHours: {
          default: 24,
          description:
            "Number of hours to look back for recent comments (default: 24)",
          type: "number",
        },
        subreddit: {
          description:
            "The subreddit to fetch from (e.g., 'BitcoinMarkets' or 'ethereum')",
          enum: ["BitcoinMarkets", "ethereum"],
          type: "string",
        },
      },
      required: ["subreddit"],
      type: "object",
    },
    name: "fetch_reddit_daily_threads",
  },
];

const handlers = {
  initialize: () => ({
    jsonrpc: "2.0",
    result: {
      capabilities: { tools: {} },
      protocolVersion: "2024-11-05",
      serverInfo: { name: "reddit-daily-threads-server", version: "1.0.0" },
    },
  }),

  "tools/call": async (params) => {
    if (params.name !== "fetch_reddit_daily_threads") {
      return {
        error: { code: -32_601, message: `Tool not found: ${params.name}` },
        jsonrpc: "2.0",
      };
    }

    try {
      const { content } = await exportRedditDailyComments({
        intervalHours: params.arguments?.intervalHours || 24,
        subreddit: params.arguments?.subreddit || "BitcoinMarkets",
      });

      return {
        jsonrpc: "2.0",
        result: { content: [{ text: content, type: "text" }] },
      };
    } catch (error) {
      return {
        error: {
          code: -32_000,
          message: error.message || "Failed to fetch Reddit threads",
        },
        jsonrpc: "2.0",
      };
    }
  },

  "tools/list": () => ({
    jsonrpc: "2.0",
    result: { tools: TOOLS },
  }),
};

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      headers: { "Content-Type": "text/plain" },
      status: 405,
    });
  }

  try {
    const body = await request.json();

    if (body.jsonrpc !== "2.0") {
      return new Response(
        JSON.stringify({
          error: {
            code: -32_600,
            message: "Invalid Request: jsonrpc must be 2.0",
          },
          jsonrpc: "2.0",
        }),
        { headers: { "Content-Type": "application/json" }, status: 400 }
      );
    }

    const handler = handlers[body.method];
    const result = handler
      ? await handler(body.params)
      : {
          error: { code: -32_601, message: `Method not found: ${body.method}` },
          jsonrpc: "2.0",
        };

    if (body.id !== undefined) result.id = body.id;

    return new Response(JSON.stringify(result), {
      headers: {
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: {
          code: -32_700,
          message: "Parse error: " + (error.message || "Invalid JSON"),
        },
        jsonrpc: "2.0",
      }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }
};

export const config = { path: "/mcp" };
