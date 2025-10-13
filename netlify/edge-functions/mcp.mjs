import { exportRedditDailyComments } from "../../reddit.mjs";

const TOOL = {
  description:
    "Fetches latest daily discussion threads from r/BitcoinMarkets and r/ethereum with recent comments. Defaults to both subreddits, but can fetch from a single subreddit if specified.",
  inputSchema: {
    properties: {
      intervalHours: {
        default: 24,
        description: "Hours to look back (default: 24)",
        type: "number",
      },
      subreddit: {
        description:
          "Single subreddit to fetch from (if not provided, fetches from both)",
        enum: ["BitcoinMarkets", "ethereum"],
        type: "string",
      },
      subreddits: {
        description:
          "Multiple subreddits to fetch from (defaults to both BitcoinMarkets and ethereum)",
        items: {
          enum: ["BitcoinMarkets", "ethereum"],
          type: "string",
        },
        type: "array",
      },
    },
    type: "object",
  },
  name: "fetch_reddit_daily_threads",
};

const handlers = {
  initialize: () => ({
    result: {
      capabilities: { tools: {} },
      protocolVersion: "2024-11-05",
      serverInfo: { name: "reddit-daily-threads-server", version: "1.0.0" },
    },
  }),

  "tools/call": async (params) => {
    if (params.name !== TOOL.name) {
      return {
        error: { code: -32_601, message: `Tool not found: ${params.name}` },
      };
    }

    try {
      const result = await exportRedditDailyComments({
        intervalHours: params.arguments?.intervalHours || 24,
        subreddit: params.arguments?.subreddit || null,
        subreddits: params.arguments?.subreddits || [
          "BitcoinMarkets",
          "ethereum",
        ],
      });
      return {
        result: { content: [{ text: result.content, type: "text" }] },
      };
    } catch (error) {
      return {
        error: {
          code: -32_000,
          message: error.message || "Failed to fetch Reddit threads",
        },
      };
    }
  },

  "tools/list": () => ({ result: { tools: [TOOL] } }),
};

const jsonResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    status,
  });

const createErrorResponse = (code, message, id) => ({
  error: { code, message },
  jsonrpc: "2.0",
  ...(id && { id }),
});

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
      return jsonResponse(
        createErrorResponse(
          -32_600,
          "Invalid Request: jsonrpc must be 2.0",
          body.id,
        ),
        400,
      );
    }

    const handler = handlers[body.method];
    const result = handler
      ? await handler(body.params)
      : createErrorResponse(-32_601, `Method not found: ${body.method}`);

    return jsonResponse({ jsonrpc: "2.0", ...result, id: body.id });
  } catch (error) {
    return jsonResponse(
      createErrorResponse(
        -32_700,
        "Parse error: " + (error.message || "Invalid JSON"),
      ),
      400,
    );
  }
};

export const config = { path: "/mcp" };
