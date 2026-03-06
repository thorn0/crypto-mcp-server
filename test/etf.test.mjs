#!/usr/bin/env node
import assert from "node:assert";
import { describe, test } from "node:test";

const { exportFarsideETF } = await import("../etf.mjs");

describe("exportFarsideETF()", () => {
  test("should fetch and return CSV content (or fail gracefully if site is down)", async () => {
    try {
      const result = await exportFarsideETF();

      assert.ok(result.content, "should have content");
      assert.ok(!result.file, "should not write file by default");

      const lines = result.content.split("\n");
      assert.ok(lines.length > 1, "should have header + data rows");

      const header = lines[0];
      assert.ok(header.startsWith("Date,"), "header should start with Date");
      assert.ok(
        header.includes("Total flow"),
        "header should include Total flow",
      );

      // Check a data row has ISO date format
      const firstDataRow = lines[1];
      assert.match(
        firstDataRow,
        /^"\d{4}-\d{2}-\d{2}"/,
        "first column should be ISO date",
      );

      // Verify consistent column count
      const headerColCount = lines[0].split(",").length;
      for (let i = 1; i < lines.length; i++) {
        let cols = 0;
        let inQuote = false;
        for (const ch of lines[i]) {
          if (ch === '"') inQuote = !inQuote;
          if (ch === "," && !inQuote) cols++;
        }
        assert.strictEqual(
          cols + 1,
          headerColCount,
          `row ${i} should have ${headerColCount} columns`,
        );
      }
    } catch (error) {
      // farside.co.uk may block automated requests — accept known failures
      if (error.message?.includes("Fetch failed")) {
        console.log(`  (skipped: farside.co.uk returned error: ${error.message})`);
        return;
      }
      throw error;
    }
  });
});
