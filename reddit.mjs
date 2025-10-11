const SUBREDDIT = "BitcoinMarkets";
const BOT_AUTHOR = "Bitty_Bot";
const SCORE_THRESHOLD = -10;
const DAILY_REGEX = /^\[daily discussion]/i;
const POSTS_TO_FETCH = 2;

const compact = (s) =>
  s
    .replaceAll(/[\r\n]+/g, "\n")
    .split("\n")
    .map((s) => s.replaceAll(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

async function getCredentials() {
  // Try environment variables first (production/Deno)
  if (typeof Deno !== "undefined") {
    const envCreds = {
      clientId: Deno.env.get("REDDIT_CLIENT_ID"),
      clientSecret: Deno.env.get("REDDIT_CLIENT_SECRET"),
      password: Deno.env.get("REDDIT_PASSWORD"),
      username: Deno.env.get("REDDIT_USERNAME"),
    };
    if (envCreds.clientId) return envCreds;
  }

  // Fall back to credentials file (development/Node)
  try {
    const creds = await import("./reddit-credentials.mjs");
    return {
      clientId: creds.CLIENT_ID,
      clientSecret: creds.CLIENT_SECRET,
      password: creds.PASSWORD,
      username: creds.USERNAME,
    };
  } catch {
    throw new Error(
      "No credentials found. Set REDDIT_* environment variables or create reddit-credentials.mjs"
    );
  }
}

async function getAccessToken() {
  const { clientId, clientSecret, username, password } = await getCredentials();
  const creds =
    typeof btoa === "undefined"
      ? Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
      : btoa(`${clientId}:${clientSecret}`);

  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    body: new URLSearchParams({
      grant_type: "password",
      password,
      username,
    }),
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `RedditMCPServer/1.0 by ${username}`,
    },
    method: "POST",
  });
  if (!response.ok) throw new Error(`Auth failed: HTTP ${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("No access token in response");
  return { token: data.access_token, username };
}

async function getLatestDailyDiscussions(
  token,
  username,
  n = POSTS_TO_FETCH,
  subreddit = SUBREDDIT
) {
  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/new.json?limit=20`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `bearer ${token}`,
        "User-Agent": `RedditMCPServer/1.0 by ${username}`,
      },
    }
  );
  if (!response.ok) throw new Error(`Reddit API: HTTP ${response.status}`);
  const data = await response.json();
  const posts = data.data.children
    .map((x) => x.data)
    .filter((x) => DAILY_REGEX.test(x.title))
    .toSorted((a, b) => b.created_utc - a.created_utc)
    .slice(0, n);
  if (posts.length === 0) {
    throw new Error(`No Daily Discussion posts found in r/${subreddit}`);
  }
  return posts;
}

async function fetchThreadJson(
  token,
  username,
  threadId,
  subreddit = SUBREDDIT
) {
  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/comments/${threadId}.json?raw_json=1&limit=500`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `bearer ${token}`,
        "User-Agent": `RedditMCPServer/1.0 by ${username}`,
      },
    }
  );
  if (!response.ok) throw new Error(`Reddit API: HTTP ${response.status}`);
  return await response.json();
}

function flattenComments(
  children,
  out = [],
  parentMap = new Map(),
  postMeta = {}
) {
  for (const item of children) {
    if (item.kind !== "t1") continue;
    const d = item.data;
    out.push({
      author: d.author,
      body: d.body,
      id: d.id,
      parent: d.parent_id.replace(/^t\d_/, ""),
      postCreated: postMeta.created_utc,
      postTitle: postMeta.title,
      postUrl: postMeta.url,
      score: d.score,
      utc: d.created_utc,
    });
    if (!parentMap.has(d.parent_id.replace(/^t\d_/, ""))) {
      parentMap.set(d.parent_id.replace(/^t\d_/, ""), []);
    }
    parentMap.get(d.parent_id.replace(/^t\d_/, "")).push(d.id);
    d.replies?.data?.children &&
      flattenComments(d.replies.data.children, out, parentMap, postMeta);
  }
  return { comments: out, parentMap };
}

function markExcludedComments(
  allComments,
  parentMap,
  scoreThreshold = SCORE_THRESHOLD
) {
  const excludedIds = new Set(
    allComments
      .filter(
        (c) =>
          c.author === BOT_AUTHOR ||
          (typeof c.score === "number" && c.score <= scoreThreshold)
      )
      .map((c) => c.id)
  );
  const stack = [...excludedIds];
  while (stack.length) {
    const current = stack.pop();
    const children = parentMap.get(current) || [];
    for (const childId of children) {
      if (!excludedIds.has(childId)) {
        excludedIds.add(childId);
        stack.push(childId);
      }
    }
  }
  return excludedIds;
}

export async function exportRedditDailyComments(params = {}) {
  const subreddit = params.subreddit ?? SUBREDDIT;
  const intervalHours = params.intervalHours ?? 24;
  const scoreThreshold = params.scoreThreshold ?? SCORE_THRESHOLD;
  const writeToFile = params.writeToFile ?? false;

  const thresholdUtc = Date.now() / 1000 - intervalHours * 3600;
  const { token, username } = await getAccessToken();
  const posts = await getLatestDailyDiscussions(
    token,
    username,
    POSTS_TO_FETCH,
    subreddit
  );

  // Gather and flatten comments from all posts with post meta
  const allComments = [];
  const mergedParentMap = new Map();

  for (const post of posts) {
    const data = await fetchThreadJson(token, username, post.id, subreddit);
    const { comments, parentMap } = flattenComments(
      data[1].data.children,
      [],
      new Map(),
      {
        created_utc: post.created_utc,
        title: post.title,
        url: `https://www.reddit.com${post.permalink}`,
      }
    );
    allComments.push(...comments);
    for (const [pid, array] of parentMap) {
      if (!mergedParentMap.has(pid)) mergedParentMap.set(pid, []);
      mergedParentMap.get(pid).push(...array);
    }
  }

  // Exclude Bitty_Bot, -10 and below, and descendants (all posts together)
  const toExclude = markExcludedComments(
    allComments,
    mergedParentMap,
    scoreThreshold
  );

  // Only comments not excluded
  const notExcluded = allComments.filter((c) => !toExclude.has(c.id));
  const notExcludedMap = new Map(notExcluded.map((c) => [c.id, c]));

  // Recent comments and their ancestors, by post
  const thresholded = notExcluded.filter((c) => c.utc >= thresholdUtc);
  const keep = new Set();
  for (const r of thresholded) {
    for (let c = r; c && !keep.has(c.id); c = notExcludedMap.get(c.parent)) {
      keep.add(c.id);
    }
  }

  const included = notExcluded.filter((c) => keep.has(c.id));
  const label = new Map(included.map((c, i) => [c.id, `Comment ${i + 1}`]));

  // Build output
  let body = "";
  for (const post of posts) {
    body += `\n\n## Comments from: "${compact(post.title)}"\n\n`;
    const these = included.filter(
      (c) =>
        c.postTitle === post.title &&
        c.postUrl === `https://www.reddit.com${post.permalink}`
    );
    body += these.length
      ? these
          .map((c) => {
            const time = new Date(c.utc * 1000).toISOString().slice(0, 16);
            const reply = label.get(c.parent)
              ? ` [in reply to ${label.get(c.parent)}]`
              : "";
            return `${label.get(c.id)} (${c.author}, ${time}, ${
              c.score
            } votes)${reply}: ${compact(c.body)}`;
          })
          .join("\n\n")
      : "_No comments in time interval._\n";
  }

  const file = `reddit_${subreddit}_${Date.now()}_daily_${intervalHours}h.md`;

  const content = `# Reddit Comment Export
- Subreddit: r/${subreddit}
- Time interval: last ${intervalHours} hours
- Exported: ${new Date().toISOString()} UTC
- Total comments: ${included.length}
- File name: ${file}
- Posts included:
${posts
  .map(
    (p) =>
      `    - "${compact(p.title)}" [${new Date(p.created_utc * 1000)
        .toISOString()
        .slice(0, 10)}]\n      https://www.reddit.com${p.permalink}`
  )
  .join("\n")}
---
${body}`;

  if (writeToFile) {
    // Only import writeFile when needed (Node.js only)
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, content);
    return { content, file };
  }

  return { content };
}

// --- CLI entry point (Node.js only) ---
if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url.startsWith("file:")
) {
  const { resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const thisFile = resolve(fileURLToPath(import.meta.url));
  const entryFile = resolve(process.argv[1]);
  if (thisFile === entryFile) {
    try {
      const intervalHours = Number.parseFloat(process.argv[2]) || 24;
      const result = await exportRedditDailyComments({
        intervalHours,
        writeToFile: true,
      });
      console.log(`✅  Exported to ${result.file}`);
    } catch (error) {
      console.error("❌  Export failed:", error?.message || error);
      process.exitCode = 1;
    }
  }
}
