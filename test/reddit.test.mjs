#!/usr/bin/env node
/**
 * Unit tests for reddit.mjs functions
 * Run with: node test/reddit.test.mjs
 */

import assert from "node:assert";
import { describe, test } from "node:test";

const { compact, flattenComments, markExcludedComments } = await import(
  "../reddit.mjs"
);

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
  const testCases = [
    {
      desc: "normalize whitespace and line breaks",
      expected: "Hello world\nThis is a test",
      input: "Hello   world\n\n\nThis   is   a   test\r\n\r\n",
    },
    { desc: "handle empty strings", expected: "", input: "" },
    {
      desc: "handle single line text",
      expected: "Single line text",
      input: "Single line text",
    },
    {
      desc: "handle multiple spaces and tabs",
      expected: "Hello world with spaces",
      input: "Hello\t\t\tworld    with    spaces",
    },
    {
      desc: "filter out empty lines",
      expected: "Line 1\nLine 2\nLine 3",
      input: "Line 1\n\n\nLine 2\r\n\r\nLine 3",
    },
    {
      desc: "handle only whitespace",
      expected: "",
      input: "   \n\n\t\t\r\n   ",
    },
  ];

  for (const { desc, expected, input } of testCases) {
    test(`should ${desc}`, () => {
      assert.strictEqual(compact(input), expected);
    });
  }
});

describe("flattenComments() function", () => {
  const postMeta = {
    created_utc: Date.now() / 1000,
    title: "Test Post",
    url: "https://reddit.com/test",
  };

  test("should handle empty comment trees", () => {
    const result = flattenComments([], [], new Map(), {});
    assert.strictEqual(result.comments.length, 0);
    assert.strictEqual(result.parentMap.size, 0);
  });

  test("should flatten single comment", () => {
    const comments = [createMockRedditComment("c1", "user1", "Hello world")];
    const result = flattenComments(comments, [], new Map(), postMeta);

    assert.strictEqual(result.comments.length, 1);
    assert.strictEqual(result.comments[0].author, "user1");
    assert.strictEqual(result.comments[0].body, "Hello world");
    assert.strictEqual(result.comments[0].id, "c1");
    assert.strictEqual(result.comments[0].postTitle, "Test Post");
  });

  test("should skip non-comment items", () => {
    const items = [
      createMockRedditComment("c1", "user1", "Comment"),
      { data: { id: "not_a_comment" }, kind: "t2" },
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
      { data: null, kind: "t1" },
      {
        data: {
          author: "user",
          body: "test",
          created_utc: Date.now() / 1000,
          id: "test",
          parent_id: "t3_post",
        },
        kind: "t1",
      },
      createMockRedditComment("c1", "user1", "Valid comment"),
    ];

    const result = flattenComments(malformedComments, [], new Map(), {});
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

    const result = markExcludedComments(comments, new Map());
    assert.ok(result.has("c1"));
    assert.ok(result.has("c3"));
    assert.ok(result.has("c4"));
    assert.ok(!result.has("c2"));
  });

  test("should exclude low score comments", () => {
    const comments = [
      { author: "user1", id: "c1", score: -15 },
      { author: "user2", id: "c2", score: -5 },
      { author: "user3", id: "c3", score: 10 },
    ];

    const result = markExcludedComments(comments, new Map(), -10);
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

    assert.ok(result.has("c1"));
    assert.ok(result.has("c2"));
    assert.ok(result.has("c3"));
  });

  test("should handle custom score threshold", () => {
    const comments = [
      { author: "user1", id: "c1", score: -5 },
      { author: "user2", id: "c2", score: -25 },
    ];

    const result = markExcludedComments(comments, new Map(), -20);
    assert.ok(!result.has("c1"));
    assert.ok(result.has("c2"));
  });

  test("should handle comments with undefined scores", () => {
    const comments = [
      { author: "user1", id: "c1", score: undefined },
      { author: "user2", id: "c2", score: null },
      { author: "user3", id: "c3", score: -15 },
    ];

    const result = markExcludedComments(comments, new Map());
    assert.ok(!result.has("c1"));
    assert.ok(!result.has("c2"));
    assert.ok(result.has("c3"));
  });

  test("should handle empty comments array", () => {
    const result = markExcludedComments([], new Map());
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
      ["c1", ["c2", "c4"]],
      ["c2", ["c3"]],
      ["c3", ["c5"]],
    ]);
    const result = markExcludedComments(comments, parentMap);

    assert.ok(result.has("c1"));
    assert.ok(result.has("c2"));
    assert.ok(result.has("c3"));
    assert.ok(result.has("c4"));
    assert.ok(result.has("c5"));
  });
});

describe("Integration tests", () => {
  test("should handle complete comment processing workflow", () => {
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

    const flattened = flattenComments(comments, [], new Map(), {
      created_utc: Date.now() / 1000,
      title: "Test Post",
      url: "https://reddit.com/test",
    });

    const excluded = markExcludedComments(
      flattened.comments,
      flattened.parentMap,
    );

    assert.strictEqual(flattened.comments.length, 5);
    assert.ok(excluded.has("c2"));
    assert.ok(excluded.has("c3"));
    assert.ok(excluded.has("c4"));
    assert.ok(excluded.has("c5"));
    assert.ok(!excluded.has("c1"));
  });
});
