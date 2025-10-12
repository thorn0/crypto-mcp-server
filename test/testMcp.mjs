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
    if (expectError) {
      console.log("✅ Expected Error:", data.error.message);
    } else {
      console.log("❌ Error:", data.error.message);
    }
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

  // Test 1: Initialize
  const initResult = await sendRequest(url, {
    id: 1,
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      clientInfo: { name: "test-client", version: "1.0.0" },
      protocolVersion: "2024-11-05",
    },
  });
  showResult("Test 1: Initialize", initResult);

  // Test 2: List Tools
  const listResult = await sendRequest(url, {
    id: 2,
    jsonrpc: "2.0",
    method: "tools/list",
  });
  showResult("Test 2: List Tools", listResult);

  // Test 3: Call Tool (BitcoinMarkets)
  console.log("\nTest 3: Call Tool - BitcoinMarkets");
  console.log("⏳ Fetching (this may take 10-30 seconds)...");
  const btcResult = await sendRequest(url, {
    id: 3,
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      arguments: { intervalHours: 24, subreddit: "BitcoinMarkets" },
      name: "fetch_reddit_daily_threads",
    },
  });
  showResult("", btcResult);

  // Test 4: Call Tool (ethereum)
  console.log("\nTest 4: Call Tool - ethereum");
  console.log("⏳ Fetching (this may take 10-30 seconds)...");
  const ethResult = await sendRequest(url, {
    id: 4,
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      arguments: { intervalHours: 12, subreddit: "ethereum" },
      name: "fetch_reddit_daily_threads",
    },
  });
  showResult("", ethResult);

  // Test 5: Invalid Method
  const invalidResult = await sendRequest(url, {
    id: 5,
    jsonrpc: "2.0",
    method: "invalid/method",
  });
  showResult("Test 5: Invalid Method", invalidResult, true);

  console.log("\n\n🎉 Testing complete!\n");
}

// Run tests
const url = process.argv[2] || DEFAULT_URL;
testMCP(url);
