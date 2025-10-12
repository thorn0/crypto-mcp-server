import { exportRedditDailyComments } from "../../reddit.mjs";

const TOOL = {
  description:
    "Fetches latest daily discussion threads from r/BitcoinMarkets or r/ethereum with recent comments",
  inputSchema: {
    properties: {
      intervalHours: {
        default: 24,
        description: "Hours to look back (default: 24)",
        type: "number",
      },
      subreddit: {
        description: "Subreddit to fetch from",
        enum: ["BitcoinMarkets", "ethereum"],
        type: "string",
      },
    },
    required: ["subreddit"],
    type: "object",
  },
  name: "fetch_reddit_daily_threads",
};

const createResponse = (data, id) => ({
  jsonrpc: "2.0",
  ...data,
  ...(id && { id }),
});

const handlers = {
  initialize: () =>
    createResponse({
      result: {
        capabilities: { tools: {} },
        protocolVersion: "2024-11-05",
        serverInfo: { name: "reddit-daily-threads-server", version: "1.0.0" },
      },
    }),

  "tools/call": async (params) => {
    if (params.name !== TOOL.name) {
      return createResponse({
        error: { code: -32_601, message: `Tool not found: ${params.name}` },
      });
    }

    try {
      const { content } = await exportRedditDailyComments({
        intervalHours: params.arguments?.intervalHours || 24,
        subreddit: params.arguments?.subreddit || "BitcoinMarkets",
      });
      return createResponse({
        result: { content: [{ text: content, type: "text" }] },
      });
    } catch (error) {
      return createResponse({
        error: {
          code: -32_000,
          message: error.message || "Failed to fetch Reddit threads",
        },
      });
    }
  },

  "tools/list": () => createResponse({ result: { tools: [TOOL] } }),
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
        createResponse({
          error: {
            code: -32_600,
            message: "Invalid Request: jsonrpc must be 2.0",
          },
        }),
        400,
      );
    }

    const handler = handlers[body.method];
    const result = handler
      ? await handler(body.params)
      : createResponse({
          error: { code: -32_601, message: `Method not found: ${body.method}` },
        });

    return jsonResponse(createResponse(result, body.id));
  } catch (error) {
    return jsonResponse(
      createResponse({
        error: {
          code: -32_700,
          message: "Parse error: " + (error.message || "Invalid JSON"),
        },
      }),
      400,
    );
  }
};

export const config = { path: "/mcp" };
