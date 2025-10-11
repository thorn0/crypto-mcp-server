#!/usr/bin/env node
/**
 * Test script for MCP server
 * Usage: node test-mcp.mjs [url]
 * Example: node test-mcp.mjs http://localhost:8888/mcp
 */

const DEFAULT_URL = "http://localhost:8888/mcp";

async function testMCP(url) {
  console.log(`\n🧪 Testing MCP Server: ${url}\n`);

  // Test 1: Initialize
  console.log("Test 1: Initialize");
  try {
    const response = await fetch(url, {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
          protocolVersion: "2024-11-05",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json();
    console.log("✅ Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  // Test 2: List Tools
  console.log("\n\nTest 2: List Tools");
  try {
    const response = await fetch(url, {
      body: JSON.stringify({
        id: 2,
        jsonrpc: "2.0",
        method: "tools/list",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json();
    console.log("✅ Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  // Test 3: Call Tool (BitcoinMarkets)
  console.log(
    "\n\nTest 3: Call Tool - fetch_reddit_daily_threads (BitcoinMarkets)"
  );
  try {
    console.log("⏳ Fetching (this may take 10-30 seconds)...");
    const response = await fetch(url, {
      body: JSON.stringify({
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {
            intervalHours: 24,
            subreddit: "BitcoinMarkets",
          },
          name: "fetch_reddit_daily_threads",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json();
    if (data.result) {
      console.log("✅ Success! Preview:");
      const {text} = data.result.content[0];
      const preview = text.split("\n").slice(0, 20).join("\n");
      console.log(preview);
      console.log(`\n... (${text.length} characters total)`);
    } else {
      console.log("❌ Error:", JSON.stringify(data.error, null, 2));
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  // Test 4: Call Tool (ethereum)
  console.log("\n\nTest 4: Call Tool - fetch_reddit_daily_threads (ethereum)");
  try {
    console.log("⏳ Fetching (this may take 10-30 seconds)...");
    const response = await fetch(url, {
      body: JSON.stringify({
        id: 4,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {
            intervalHours: 12,
            subreddit: "ethereum",
          },
          name: "fetch_reddit_daily_threads",
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json();
    if (data.result) {
      console.log("✅ Success! Preview:");
      const {text} = data.result.content[0];
      const preview = text.split("\n").slice(0, 20).join("\n");
      console.log(preview);
      console.log(`\n... (${text.length} characters total)`);
    } else {
      console.log("❌ Error:", JSON.stringify(data.error, null, 2));
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  // Test 5: Invalid Method
  console.log("\n\nTest 5: Invalid Method (should return error)");
  try {
    const response = await fetch(url, {
      body: JSON.stringify({
        id: 5,
        jsonrpc: "2.0",
        method: "invalid/method",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = await response.json();
    console.log("✅ Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  console.log("\n\n🎉 Testing complete!\n");
}

// Run tests
const url = process.argv[2] || DEFAULT_URL;
testMCP(url);
