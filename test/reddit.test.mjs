#!/usr/bin/env node
/**
 * Unit tests for reddit.mjs functions
 * Run with: node test/reddit.test.mjs
 */

import assert from "node:assert";
import { describe, test } from "node:test";

// Import the module
const redditModule = await import("../reddit.mjs");
const { compact, flattenComments, markExcludedComments } = redditModule;

// Helper to create mock Reddit comment data
const createMockRedditComment = (
  id,
  author,
  body,
  score = 1,
  parentId = "t3_test123",
) => ({
  data: {
    author,
    body,
    created_utc: Date.now() / 1000 - 1800,
    id,
    parent_id: parentId,
    score,
  },
  kind: "t1",
});

describe("compact() function", () => {
  test("should normalize whitespace and line breaks", () => {
    const input = "Hello   world\n\n\nThis   is   a   test\r\n\r\n";
    const expected = "Hello world\nThis is a test";

    const result = compact(input);
    assert.strictEqual(result, expected);
  });

  test("should handle empty strings", () => {
    const input = "";
    const expected = "";

    const result = compact(input);
    assert.strictEqual(result, expected);
  });

  test("should handle single line text", () => {
    const input = "Single line text";
    const expected = "Single line text";

    const result = compact(input);
    assert.strictEqual(result, expected);
  });

  test("should handle multiple spaces and tabs", () => {
    const input = "Hello\t\t\tworld    with    spaces";
    const expected = "Hello world with spaces";

    const result = compact(input);
    assert.strictEqual(result, expected);
  });

  test("should filter out empty lines", () => {
    const input = "Line 1\n\n\nLine 2\r\n\r\nLine 3";
    const expected = "Line 1\nLine 2\nLine 3";

    const result = compact(input);
    assert.strictEqual(result, expected);
  });

  test("should handle only whitespace", () => {
    const input = "   \n\n\t\t\r\n   ";
    const expected = "";

    const result = compact(input);
    assert.strictEqual(result, expected);
  });
});

describe("flattenComments() function", () => {
  test("should handle empty comment trees", () => {
    const result = flattenComments([], [], new Map(), {});

    assert.strictEqual(result.comments.length, 0);
    assert.strictEqual(result.parentMap.size, 0);
  });

  test("should flatten single comment", () => {
    const comments = [createMockRedditComment("c1", "user1", "Hello world")];
    const result = flattenComments(comments, [], new Map(), {
      created_utc: Date.now() / 1000,
      title: "Test Post",
      url: "https://reddit.com/test",
    });

    assert.strictEqual(result.comments.length, 1);
    assert.strictEqual(result.comments[0].author, "user1");
    assert.strictEqual(result.comments[0].body, "Hello world");
    assert.strictEqual(result.comments[0].id, "c1");
    assert.strictEqual(result.comments[0].postTitle, "Test Post");
  });

  test("should skip non-comment items", () => {
    const items = [
      createMockRedditComment("c1", "user1", "Comment"),
      { data: { id: "not_a_comment" }, kind: "t2" }, // Not a comment
      createMockRedditComment("c2", "user2", "Another comment"),
    ];

    const result = flattenComments(items, [], new Map(), {});

    assert.strictEqual(result.comments.length, 2);
    assert.strictEqual(result.comments[0].id, "c1");
    assert.strictEqual(result.comments[1].id, "c2");
  });

  test("should build parent map correctly", () => {
    const comments = [
      createMockRedditComment("c1", "user1", "Parent comment", 1, "t3_post123"),
      createMockRedditComment("c2", "user2", "Child comment", 1, "t1_c1"),
    ];

    const result = flattenComments(comments, [], new Map(), {});

    assert.strictEqual(result.comments.length, 2);
    assert.ok(result.parentMap.has("post123"));
    assert.ok(result.parentMap.has("c1"));
    assert.strictEqual(result.parentMap.get("post123").length, 1);
    assert.strictEqual(result.parentMap.get("c1").length, 1);
  });

  test("should handle malformed comment data gracefully", () => {
    const malformedComments = [
      { data: null, kind: "t1" }, // Missing data
      {
        data: {
          author: "user",
          body: "test",
          created_utc: Date.now() / 1000,
          id: "test",
          parent_id: "t3_post",
        },
        kind: "t1",
      }, // Missing score but has required fields
      createMockRedditComment("c1", "user1", "Valid comment"),
    ];

    const result = flattenComments(malformedComments, [], new Map(), {});

    // Should process the valid comment and the one with missing score
    assert.strictEqual(result.comments.length, 2);
    assert.strictEqual(result.comments[0].id, "test");
    assert.strictEqual(result.comments[1].id, "c1");
  });

  test("should handle nested replies", () => {
    const comments = [
      createMockRedditComment("c1", "user1", "Parent"),
      {
        data: {
          author: "user2",
          body: "Reply",
          created_utc: Date.now() / 1000 - 1800,
          id: "c2",
          parent_id: "t1_c1",
          replies: {
            data: {
              children: [
                createMockRedditComment(
                  "c3",
                  "user3",
                  "Nested reply",
                  1,
                  "t1_c2",
                ),
              ],
            },
          },
          score: 1,
        },
        kind: "t1",
      },
    ];

    const result = flattenComments(comments, [], new Map(), {});

    assert.strictEqual(result.comments.length, 3);
    assert.strictEqual(result.comments[0].id, "c1");
    assert.strictEqual(result.comments[1].id, "c2");
    assert.strictEqual(result.comments[2].id, "c3");
  });
});

describe("markExcludedComments() function", () => {
  test("should exclude bot author comments", () => {
    const comments = [
      { author: "Bitty_Bot", id: "c1", score: 5 },
      { author: "normal_user", id: "c2", score: 10 },
      { author: "Bitty_Bot", id: "c3", score: 1 },
      { author: "Tricky_Troll", id: "c4", score: 3 },
    ];

    const parentMap = new Map();
    const result = markExcludedComments(comments, parentMap);

    assert.ok(result.has("c1"));
    assert.ok(result.has("c3"));
    assert.ok(result.has("c4"));
    assert.ok(!result.has("c2"));
  });

  test("should exclude low score comments", () => {
    const comments = [
      { author: "user1", id: "c1", score: -15 }, // Below threshold
      { author: "user2", id: "c2", score: -5 }, // Above threshold
      { author: "user3", id: "c3", score: 10 }, // Positive score
    ];

    const parentMap = new Map();
    const result = markExcludedComments(comments, parentMap, -10);

    assert.ok(result.has("c1"));
    assert.ok(!result.has("c2"));
    assert.ok(!result.has("c3"));
  });

  test("should exclude descendants of excluded comments", () => {
    const comments = [
      { author: "Bitty_Bot", id: "c1", score: 1 },
      { author: "user1", id: "c2", score: 5 },
      { author: "user2", id: "c3", score: 3 },
    ];

    const parentMap = new Map([
      ["post123", ["c1"]],
      ["c1", ["c2"]],
      ["c2", ["c3"]],
    ]);

    const result = markExcludedComments(comments, parentMap);

    // All comments should be excluded due to descendant chain
    assert.ok(result.has("c1"));
    assert.ok(result.has("c2"));
    assert.ok(result.has("c3"));
  });

  test("should handle custom score threshold", () => {
    const comments = [
      { author: "user1", id: "c1", score: -5 },
      { author: "user2", id: "c2", score: -25 },
    ];

    const parentMap = new Map();
    const result = markExcludedComments(comments, parentMap, -20);

    // With threshold -20, only scores <= -20 should be excluded
    // c1 (-5) should NOT be excluded, c2 (-25) should be excluded
    assert.ok(!result.has("c1"));
    assert.ok(result.has("c2"));
  });

  test("should handle comments with undefined scores", () => {
    const comments = [
      { author: "user1", id: "c1", score: undefined },
      { author: "user2", id: "c2", score: null },
      { author: "user3", id: "c3", score: -15 },
    ];

    const parentMap = new Map();
    const result = markExcludedComments(comments, parentMap);

    // Only c3 should be excluded (undefined/null scores are not numbers)
    assert.ok(!result.has("c1"));
    assert.ok(!result.has("c2"));
    assert.ok(result.has("c3"));
  });

  test("should handle empty comments array", () => {
    const comments = [];
    const parentMap = new Map();
    const result = markExcludedComments(comments, parentMap);

    assert.strictEqual(result.size, 0);
  });

  test("should handle complex descendant chains", () => {
    const comments = [
      { author: "Bitty_Bot", id: "c1", score: 1 },
      { author: "user1", id: "c2", score: 5 },
      { author: "user2", id: "c3", score: 3 },
      { author: "user3", id: "c4", score: 2 },
      { author: "user4", id: "c5", score: 1 },
    ];

    const parentMap = new Map([
      ["post123", ["c1"]],
      ["c1", ["c2", "c4"]], // c1 has two children
      ["c2", ["c3"]],
      ["c3", ["c5"]],
    ]);

    const result = markExcludedComments(comments, parentMap);

    // All comments should be excluded due to bot author chain
    assert.ok(result.has("c1"));
    assert.ok(result.has("c2"));
    assert.ok(result.has("c3"));
    assert.ok(result.has("c4"));
    assert.ok(result.has("c5"));
  });
});

describe("Integration tests", () => {
  test("should handle complete comment processing workflow", () => {
    // Create a realistic comment tree
    const comments = [
      createMockRedditComment("c1", "user1", "Main comment", 5, "t3_post123"),
      createMockRedditComment("c2", "Bitty_Bot", "Bot comment", 1, "t1_c1"),
      createMockRedditComment("c3", "user2", "Reply to bot", 2, "t1_c2"),
      createMockRedditComment("c4", "user3", "Low score", -15, "t1_c1"),
      createMockRedditComment(
        "c5",
        "Tricky_Troll",
        "Tricky bot comment",
        1,
        "t1_c1",
      ),
    ];

    // Flatten comments
    const flattened = flattenComments(comments, [], new Map(), {
      created_utc: Date.now() / 1000,
      title: "Test Post",
      url: "https://reddit.com/test",
    });

    // Mark excluded comments
    const excluded = markExcludedComments(
      flattened.comments,
      flattened.parentMap,
    );

    // Verify results
    assert.strictEqual(flattened.comments.length, 5);
    assert.ok(excluded.has("c2")); // Bot comment
    assert.ok(excluded.has("c3")); // Child of bot
    assert.ok(excluded.has("c4")); // Low score
    assert.ok(excluded.has("c5")); // Tricky_Troll bot
    assert.ok(!excluded.has("c1")); // Good comment
  });
});
