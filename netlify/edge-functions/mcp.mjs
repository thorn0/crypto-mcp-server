import { exportRedditDailyComments } from "../../reddit.mjs";
import { exportFarsideETF } from "../../etf.mjs";
import { exportBinanceKlines } from "../../prices.mjs";

const TOOLS = [
  {
    name: "fetch_reddit_daily_threads",
    description:
      "Fetches latest daily discussion threads from r/BitcoinMarkets and r/ethereum with recent comments. Defaults to both subreddits, but can fetch from a single subreddit if specified.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
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
  },
  {
    name: "fetch_btc_etf_flows",
    description:
      "Fetches Bitcoin ETF flow data from farside.co.uk, including daily net flows for all major spot BTC ETFs (IBIT, FBTC, BITB, ARKB, etc.). Returns CSV with dates and flow amounts in millions USD.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      properties: {},
      type: "object",
    },
  },
  {
    name: "fetch_binance_klines",
    description:
      "Fetches historical Binance kline/candlestick data for a trading pair with ATR(14) indicator. Returns CSV with OHLCV data and Average True Range.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      properties: {
        symbol: {
          default: "BTCUSDT",
          description: "Trading pair symbol (default: BTCUSDT)",
          type: "string",
        },
        interval: {
          default: "15m",
          description: "Candle interval",
          enum: ["15m", "1h"],
          type: "string",
        },
        periodHours: {
          default: 12,
          description: "Hours of history to fetch (default: 12)",
          type: "number",
        },
      },
      type: "object",
    },
  },
  {
    name: "fetch_all_crypto_data",
    description:
      "Fetches all crypto data in parallel: Binance 15m and 1h klines with ATR(14), Reddit daily discussion comments, and BTC ETF flows. Returns combined results. Use this for a full market snapshot.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      properties: {
        intervalHours: {
          default: 24,
          description: "Hours to look back for Reddit comments (default: 24)",
          type: "number",
        },
      },
      type: "object",
    },
  },
];

const toolHandlers = {
  fetch_reddit_daily_threads: (args) =>
    exportRedditDailyComments({
      intervalHours: args?.intervalHours || 24,
      subreddit: args?.subreddit || null,
      subreddits: args?.subreddits || ["BitcoinMarkets", "ethereum"],
    }),

  fetch_btc_etf_flows: () => exportFarsideETF(),

  fetch_binance_klines: (args) =>
    exportBinanceKlines({
      symbol: args?.symbol || "BTCUSDT",
      interval: args?.interval || "15m",
      periodHours: args?.periodHours || 12,
    }),

  fetch_all_crypto_data: async (args) => {
    const wrap = async (label, fn) => {
      try {
        return { label, content: (await fn()).content };
      } catch (e) {
        return { label, content: `Error: ${e.message}` };
      }
    };

    const results = await Promise.all([
      wrap("BTCUSDT 15m Klines", () => exportBinanceKlines({ interval: "15m" })),
      wrap("BTCUSDT 1h Klines (48h)", () => exportBinanceKlines({ interval: "1h", periodHours: 48 })),
      wrap("Reddit Daily Discussions", () => exportRedditDailyComments({ intervalHours: args?.intervalHours || 24 })),
      wrap("BTC ETF Flows", () => exportFarsideETF()),
    ]);

    const content = results
      .map((r) => `=== ${r.label} ===\n${r.content}`)
      .join("\n\n");
    return { content };
  },
};

const handlers = {
  initialize: () => ({
    result: {
      capabilities: { tools: {} },
      protocolVersion: "2024-11-05",
      serverInfo: { name: "crypto-mcp-server", version: "2.0.0" },
    },
  }),

  "tools/call": async (params) => {
    const handler = toolHandlers[params.name];
    if (!handler) {
      return {
        error: { code: -32_601, message: `Tool not found: ${params.name}` },
      };
    }

    try {
      const result = await handler(params.arguments);
      return {
        result: { content: [{ text: result.content, type: "text" }] },
      };
    } catch (error) {
      return {
        error: {
          code: -32_000,
          message: error.message || `Failed to execute ${params.name}`,
        },
      };
    }
  },

  "tools/list": () => ({ result: { tools: TOOLS } }),
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
