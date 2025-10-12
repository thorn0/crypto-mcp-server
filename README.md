# Reddit Daily Threads MCP Server

MCP server for ChatGPT Developer Mode that fetches daily discussion threads from crypto subreddits (r/BitcoinMarkets, r/ethereum).

## Features

- Fetches latest daily threads with filtered comments
- Excludes low-quality (score ≤ -10) and bot comments
- Includes comment chains with parent references
- Deployed as cost-effective Netlify Edge Function

## Quick Setup

### 1. Install & Configure

```bash
npm install
cp .env.example .env
# Edit .env with your Reddit API credentials
```

Get credentials at: https://www.reddit.com/prefs/apps (create "script" type app)

### 2. Test Locally

```bash
npm run dev          # Start server at http://localhost:8888
npm test             # Run tests
```

### 3. Deploy to Netlify

**Option A: Netlify CLI**

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set REDDIT_CLIENT_ID "your_value"
netlify env:set REDDIT_CLIENT_SECRET "your_value"
netlify env:set REDDIT_USERNAME "your_value"
netlify env:set REDDIT_PASSWORD "your_value"
npm run deploy
```

**Option B: GitHub Integration**

1. Push to GitHub
2. [Import to Netlify](https://app.netlify.com)
3. Set environment variables in Site Settings
4. Deploy

### 4. Connect to ChatGPT

1. **Settings → Connectors → Advanced** → Enable **Developer Mode**
2. **Settings → Connectors → Create**
   - Name: `Reddit Daily Threads`
   - URL: `https://your-site.netlify.app/mcp`
3. Use in chat: "Fetch the latest daily discussion from r/BitcoinMarkets"

## How It Works

The server:

1. Authenticates with Reddit OAuth2
2. Fetches 2 most recent daily discussion posts
3. Retrieves comments (up to 500 per thread)
4. Filters by score, author, and time interval
5. Formats with labels, timestamps, and reply chains

Credentials are auto-detected:

- **Local dev**: Uses `.env` file
- **Production**: Uses Netlify environment variables

## Available Tools

### `fetch_reddit_daily_threads`

**Parameters:**

- `subreddit` (required): `"BitcoinMarkets"` or `"ethereum"`
- `intervalHours` (optional): Hours to look back (default: 24)

**Example:**

```
Fetch r/ethereum daily discussion for the last 12 hours
```

## Cost

**Netlify Edge Functions** - 3 million free requests/month, then $2/million

- 100 queries/day: FREE
- 1,000 queries/day: FREE
- 10,000 queries/day: FREE

You need 100,000+ queries/day to exceed free tier!

## Project Structure

```
.
├── reddit.mjs                      # Core Reddit fetcher (Node & Deno)
├── netlify/edge-functions/mcp.mjs  # MCP server (JSON-RPC 2.0)
├── test-mcp.mjs                    # Test script
├── netlify.toml                    # Netlify config
└── .env                            # Environment variables (gitignored)
```

## CLI Usage

You can also use `reddit.mjs` directly from command line:

```bash
node reddit.mjs              # Export last 24h to file
node reddit.mjs 12           # Export last 12h to file
```

## Troubleshooting

**Auth failed**: Check credentials in `.env` file

**Can't connect**: Ensure URL ends with `/mcp` and Developer Mode is enabled

**Timeout**: Reduce `intervalHours` parameter for large threads

## Contributing

1. Fork the repo
2. Make changes
3. Test locally: `npm run dev && npm test`
4. Submit PR

## License

MIT
