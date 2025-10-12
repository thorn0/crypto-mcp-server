# Reddit Daily Threads MCP Server

> 🚀 **Fetch crypto market discussions from r/BitcoinMarkets and r/ethereum directly in ChatGPT**

A minimal MCP server that delivers filtered daily discussion threads with high-quality comments, deployed as a cost-effective Netlify Edge Function.

## ✨ Features

- 🔍 **Smart Filtering**: Excludes low-quality comments (score ≤ -10) and bots
- ⚡ **Real-time**: Fetches latest daily threads with recent comments
- 💰 **Cost-effective**: Deployed on Netlify Edge Functions (3M free requests/month)
- 🔗 **Easy Integration**: Simple ChatGPT connector setup

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Reddit account with API access
- Netlify account (free)

### 1. Setup

```bash
# Clone and install
git clone <your-repo-url>
cd crypto-mcp-server
npm install

# Create environment file
cat > .env << 'EOF'
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
EOF
```

**🔑 Get Reddit API credentials:**

1. Go to https://www.reddit.com/prefs/apps
2. Click "Create App" → Choose "script" type
3. Copy client ID and secret to your `.env` file

### 2. Test Locally

```bash
# Start development server
npm run dev
# ✅ Server running at http://localhost:8888

# Test the MCP server
npm test
# ✅ All tests should pass

# Test individual components
npm run test:unit
# ✅ Unit tests should pass
```

### 3. Deploy to Netlify

**Option A: Netlify CLI (Recommended)**

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login and deploy
netlify login
netlify init
netlify env:set REDDIT_CLIENT_ID "your_client_id"
netlify env:set REDDIT_CLIENT_SECRET "your_client_secret"
netlify env:set REDDIT_USERNAME "your_username"
netlify env:set REDDIT_PASSWORD "your_password"
netlify deploy --prod
# ✅ Deployed to https://your-site.netlify.app
```

**Option B: GitHub Integration**

1. Push your code to GitHub
2. [Import to Netlify](https://app.netlify.com)
3. Set environment variables in Site Settings → Environment Variables
4. Deploy automatically on push

### 4. Connect to ChatGPT

1. **Open ChatGPT** → **Settings** → **Connectors** → **Advanced**
2. **Enable Developer Mode** ✅
3. **Create Connector:**
   - Name: `Reddit Daily Threads`
   - URL: `https://your-site.netlify.app/mcp`
4. **Test it:** Ask _"Fetch the latest daily discussion from r/BitcoinMarkets"_

## 📖 Usage

### Tool: `fetch_reddit_daily_threads`

**Parameters:**

- `subreddit` (required): `"BitcoinMarkets"` or `"ethereum"`
- `intervalHours` (optional): Hours to look back (default: 24)

**Example Prompts:**

- `"Fetch r/ethereum daily discussion for the last 12 hours"`
- `"Get BitcoinMarkets daily thread from yesterday"`
- `"Show me the latest crypto market discussion"`

## 🔧 How It Works

1. **🔐 Authenticates** with Reddit OAuth2 using your credentials
2. **📡 Fetches** 2 most recent daily discussion posts from the subreddit
3. **🔍 Filters** comments by score (> -10), excludes known bots
4. **📝 Formats** with timestamps, reply chains, and structured labels
5. **📤 Returns** clean, readable data for ChatGPT

## 💰 Cost Breakdown

**Netlify Edge Functions:** 3 million free requests/month

| Usage Level | Daily Queries | Monthly Cost        |
| ----------- | ------------- | ------------------- |
| Light       | 100           | **FREE**            |
| Moderate    | 1,000         | **FREE**            |
| Heavy       | 10,000        | **FREE**            |
| Enterprise  | 100,000+      | $2/million requests |

_You need 100,000+ queries/day to exceed the free tier!_

## 📁 Project Structure

```
crypto-mcp-server/
├── reddit.mjs                      # Core Reddit fetcher (Node & Deno compatible)
├── netlify/edge-functions/mcp.mjs  # MCP server (JSON-RPC 2.0)
├── test/reddit.test.mjs            # Unit tests
├── test/testMcp.mjs                # MCP integration tests
├── netlify.toml                    # Netlify configuration
└── package.json                    # Dependencies and scripts
```

## 💻 CLI Usage

```bash
# Export to file (Node.js only)
node reddit.mjs        # Export last 24h to file
node reddit.mjs 12     # Export last 12h to file

# Output: reddit_BitcoinMarkets_[timestamp]_daily_24h.md
```

## 🛠️ Troubleshooting

| Issue             | Symptoms                                   | Solution                                                  |
| ----------------- | ------------------------------------------ | --------------------------------------------------------- |
| **Auth Failed**   | `Error: No credentials found`              | Check `.env` file exists and has correct values           |
| **Can't Connect** | ChatGPT shows connection error             | Ensure URL ends with `/mcp` and Developer Mode is enabled |
| **Timeout**       | Request takes too long                     | Reduce `intervalHours` parameter (try 6 or 12)            |
| **No Results**    | Empty response                             | Check if subreddit has recent daily threads               |
| **Rate Limited**  | HTTP 429 errors                            | Wait a few minutes and try again                          |
| **Deploy Failed** | `Deploy directory 'public' does not exist` | Use `netlify deploy --prod` (not `npm run deploy`)        |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Test against production URL
node test/testMcp.mjs https://your-site.netlify.app/mcp
```

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes
4. **Test** locally: `npm run dev && npm test`
5. **Commit** with clear messages: `git commit -m "Add amazing feature"`
6. **Push** to your branch: `git push origin feature/amazing-feature`
7. **Open** a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**🎯 Success Indicators:**

- ✅ `npm test` passes
- ✅ ChatGPT connector shows "Connected" status
- ✅ You can fetch daily threads in ChatGPT
- ✅ No errors in Netlify function logs
