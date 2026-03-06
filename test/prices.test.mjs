#!/usr/bin/env node
import assert from "node:assert";
import { describe, test } from "node:test";

const { exportBinanceKlines } = await import("../prices.mjs");

describe("exportBinanceKlines()", () => {
  test("should return CSV with OHLCV data and ATR for 15m interval", async () => {
    const result = await exportBinanceKlines({
      interval: "15m",
      periodHours: 1,
    });

    assert.ok(result.content, "should have content");
    assert.ok(!result.file, "should not write file by default");

    const lines = result.content.split("\n");
    assert.ok(lines.length > 1, "should have header + data rows");

    const header = lines[0];
    assert.ok(
      header.includes("Time (UTC)"),
      "header should include Time (UTC)",
    );
    assert.ok(
      header.includes("Close (USDT)"),
      "header should include Close (USDT)",
    );
    assert.ok(
      header.includes("15m-ATR14"),
      "header should include 15m-ATR14",
    );
  });

  test("should return CSV with 1h interval", async () => {
    const result = await exportBinanceKlines({
      interval: "1h",
      periodHours: 2,
    });

    const lines = result.content.split("\n");
    const header = lines[0];
    assert.ok(header.includes("1h-ATR14"), "header should include 1h-ATR14");
    // 2 hours = ~2 candles for 1h interval (plus potentially partial)
    assert.ok(lines.length >= 2, "should have at least header + 1 data row");
  });

  test("should reject unsupported intervals", async () => {
    await assert.rejects(
      () => exportBinanceKlines({ interval: "5m" }),
      /Unsupported interval/,
    );
  });

  test("should have consistent column count", async () => {
    const result = await exportBinanceKlines({
      interval: "15m",
      periodHours: 1,
    });
    const lines = result.content.split("\n");
    const headerColCount = lines[0].split(",").length;

    for (let i = 1; i < lines.length; i++) {
      assert.strictEqual(
        lines[i].split(",").length,
        headerColCount,
        `row ${i} should have ${headerColCount} columns`,
      );
    }
  });
});
