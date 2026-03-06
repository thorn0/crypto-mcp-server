#!/usr/bin/env node
/**
 * Test script for MCP server
 * Usage: node testMcp.mjs [url]
 */

const DEFAULT_URL = "http://localhost:8888/mcp";

const sendRequest = async (url, request) => {
  try {
    const response = await fetch(url, {
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    return await response.json();
  } catch (error) {
    return { error: { message: error.message } };
  }
};

const showResult = (testName, data, expectError = false) => {
  console.log(`\n${testName}`);
  if (data.error) {
    console.log(
      expectError ? "✅ Expected Error:" : "❌ Error:",
      data.error.message,
    );
  } else {
    console.log("✅ Success!");
    if (data.result?.content?.[0]?.text) {
      const { text } = data.result.content[0];
      const preview = text.split("\n").slice(0, 20).join("\n");
      console.log("Preview:", preview);
      console.log(`... (${text.length} characters total)`);
    } else {
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  }
};

async function testMCP(url) {
  console.log(`\n🧪 Testing MCP Server: ${url}\n`);

  const tests = [
    {
      name: "Test 1: Initialize",
      request: {
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          clientInfo: { name: "test-client", version: "1.0.0" },
          protocolVersion: "2024-11-05",
        },
      },
    },
    {
      name: "Test 2: List Tools",
      request: { id: 2, jsonrpc: "2.0", method: "tools/list" },
    },
    {
      loading: true,
      name: "Test 3: Call Tool - BitcoinMarkets",
      request: {
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: { intervalHours: 24, subreddit: "BitcoinMarkets" },
          name: "fetch_reddit_daily_threads",
        },
      },
    },
    {
      loading: true,
      name: "Test 4: Call Tool - ethereum",
      request: {
        id: 4,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: { intervalHours: 12, subreddit: "ethereum" },
          name: "fetch_reddit_daily_threads",
        },
      },
    },
    {
      loading: true,
      name: "Test 5: Call Tool - Both Subreddits (Default)",
      request: {
        id: 5,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: { intervalHours: 24 },
          name: "fetch_reddit_daily_threads",
        },
      },
    },
    {
      loading: true,
      name: "Test 6: Call Tool - BTC ETF Flows",
      request: {
        id: 6,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {},
          name: "fetch_btc_etf_flows",
        },
      },
    },
    {
      loading: true,
      name: "Test 7: Call Tool - Binance Klines (15m, 1h)",
      request: {
        id: 7,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: { symbol: "BTCUSDT", interval: "15m", periodHours: 1 },
          name: "fetch_binance_klines",
        },
      },
    },
    {
      loading: true,
      name: "Test 8: Call Tool - Binance Klines (1h, 24h)",
      request: {
        id: 8,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: { symbol: "BTCUSDT", interval: "1h", periodHours: 24 },
          name: "fetch_binance_klines",
        },
      },
    },
    {
      expectError: true,
      name: "Test 9: Invalid Method",
      request: { id: 9, jsonrpc: "2.0", method: "invalid/method" },
    },
  ];

  for (const test of tests) {
    if (test.loading) {
      console.log(
        `\n${test.name}\n⏳ Fetching (this may take 10-30 seconds)...`,
      );
    }
    const result = await sendRequest(url, test.request);
    showResult(test.name, result, test.expectError);
  }

  console.log("\n\n🎉 Testing complete!\n");
}

// Run tests
const url = process.argv[2] || DEFAULT_URL;
testMCP(url);
