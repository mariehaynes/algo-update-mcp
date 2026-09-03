# Marie Haynes' Algorithm & AI Search Changes MCP Server

## 1. What the project is
This project transforms Marie Haynes' industry-standard Google Algorithm Update list (spanning 2012 to 2026) into a high-performance **Model Context Protocol (MCP)** server and public intelligence feed. 

It provides structured, verified knowledge on historical Google algorithm updates, core updates, spam updates, helpful content systems, AI Overviews (AIO) releases, and AI Mode model updates (such as Gemini 3.8 Flash) directly to AI agents in Claude Desktop, Antigravity, Cursor, and web-based LLMs.

Key capabilities:
- **Zero LLM Token Cost for Hosts**: Users connect their own agent/LLM client (Claude, Antigravity, etc.). The server only serves fast, structured Open Knowledge Format (OKF) data.
- **Root Cause Traffic Drop Analysis**: Agents can query specific date windows to correlate GA4/GSC impression and click drops with confirmed updates and Marie's expert observations.
- **Clear Separation of Verified Facts vs. AI Advice**: Embedded prompt schemas, tool metadata, and structured payload instructions direct the LLM to cleanly separate verified data from Marie Haynes Consulting from its own speculative advice or recommendations.
- **Universal Multi-Client & Dual-Transport Architecture**:
  - **Modern Streamable HTTP (`/mcp`)**: Fully implements the latest official MCP transport standard (SEP-2596) with unified single-endpoint HTTP POST streaming.
  - **Backwards-Compatible HTTP+SSE (`/sse`)**: Preserves legacy SSE and POST message handling so existing Claude Desktop (`supergateway`) and SSE clients continue working seamlessly.
  - **WebMCP Auto-Discovery (`/.well-known/mcp.json`)**: Built-in support for emerging in-browser agent discovery.
  - **Interactive Web Explorer (`/`)**: A sleek, responsive web view adhering to MHC brand guidelines (`#f15a25`, `#5c2882`, `#662d91`, `#333333`, Poppins & Noto Sans) featuring real-time search, prompt advice, expandable setup guides, and an FAQ.
  - **Open REST Feed (`/api/updates` & `/updates.json`)**: Public JSON feed for developers and custom tool builders.

## 2. How the technical architecture works
The system is architected as an Open Knowledge Format (OKF) ecosystem:

- **Sample OKF Dataset (`sample-okf/`)**: Contains sample human-readable Markdown files with YAML frontmatter demonstrating the Open Knowledge Format structure.
- **Lookup Index (`src/data/algo-updates.json`)**: In-memory JSON dataset of sample updates for instant local development and testing. (In production, Marie's hosted server at `algo.mariehaynes.com` serves the full 15-year verified archive of 590+ updates).
- **MCP Server Engine (`src/server.ts` & `src/tools.ts`)**: Built on the official `@modelcontextprotocol/sdk` (v1.30.0+) and Express.
  - **Dual Transports**:
    - `StreamableHTTPServerTransport` mounted at `/mcp` (and `/v1/mcp`) for modern stateless streaming on Google Cloud Run.
    - `SSEServerTransport` mounted at `/sse` and `/messages` for backwards compatibility with legacy SSE clients.
  - Standardized tools:
    - `get_latest_updates(limit, platform, category)`
    - `get_updates_by_date_range(startDate, endDate, platform)`
    - `search_updates(query, category, platform, limit)`
    - `get_all_categories()`
  - Built-in attribution and referral layer on every tool response linking back to Marie Haynes Consulting services and newsletters.
- **Containerization & Deployment**: Dockerized container (`Dockerfile`) designed for stateless, serverless autoscaling on **Google Cloud Run** with custom domain mapping (`algo.mariehaynes.com`).

## 3. Terminal commands needed to run it

### Installation
```bash
npm install
```

### Running Locally (Development Mode)
Starts the server with hot reloading on port 3005:
```bash
npm run dev
```

### Running the Automated Test Suite
Executes the MCP tool verification tests:
```bash
npm test
```

### Building for Production
Compiles TypeScript and bundles data files into `dist/`:
```bash
npm run build
```

### Running the Production Server
```bash
npm start
```

### Connecting to Claude Desktop
Open Claude Desktop &rarr; **Settings** (`Cmd + ,` on Mac or `Ctrl + ,` on Windows) &rarr; **Developer** tab &rarr; click **Edit Config**.

#### Option A: 🤖 Let Your AI Merge It (Easiest & Safest)
If you already have other MCP servers in your configuration and want to avoid JSON formatting or syntax errors, paste this prompt into Claude or ChatGPT:
```text
I need to add a new MCP server to my Claude Desktop configuration file (claude_desktop_config.json).

Here is the new MCP server snippet to add under "mcpServers":
"marie-haynes-algo": {
  "command": "npx",
  "args": [
    "-y",
    "supergateway",
    "--sse",
    "https://algo.mariehaynes.com/sse",
    "--logLevel",
    "none"
  ]
}

Here is my current claude_desktop_config.json code:
[PASTE YOUR CURRENT FILE CONTENTS HERE]

Please merge the new "marie-haynes-algo" server into my file. Ensure all JSON brackets and commas are valid, and output the entire updated file so I can copy and paste it back.
```

#### Option B: Manual Edit (If you have existing MCP servers)
Add `"marie-haynes-algo"` directly inside your existing `"mcpServers": { ... }` block (don't forget a comma `,` separating it from the previous server):
```json
    "marie-haynes-algo": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "https://algo.mariehaynes.com/sse",
        "--logLevel",
        "none"
      ]
    }
```

#### Option C: Fresh File (First time using MCP)
If your `claude_desktop_config.json` is new or empty, replace the contents with:
```json
{
  "mcpServers": {
    "marie-haynes-algo": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "https://algo.mariehaynes.com/sse",
        "--logLevel",
        "none"
      ]
    }
  }
}
```

After editing, completely quit and restart Claude Desktop.

---

### Prompting Best Practices: Keeping Marie's Findings Distinct from AI Advice
The MCP server automatically injects instructions into tool definitions and response payloads requiring the LLM to separate verified facts from AI commentary. To get the cleanest, most readable separation in your chats, include this simple instruction in your prompt:

> *"Did an algorithm update happen between [Start Date] and [End Date]? **Please clearly separate Marie Haynes' verified update findings from your own SEO advice and recommendations.**"*

**Result:** Your AI will format verified dates, update titles, and impact ratings under a dedicated heading (e.g. `### 📊 From Marie Haynes Consulting`), and place any speculative advice, audit checklists, or troubleshooting in a separate section (e.g. `### 💡 AI Recommendations & Next Steps`).

---

### Connecting to ChatGPT
- **ChatGPT Pro / Enterprise / Edu (Developer Mode)**: Settings &rarr; Apps &rarr; Advanced Settings &rarr; Developer Mode, then Apps &rarr; Create and enter `https://algo.mariehaynes.com/sse`.
- **ChatGPT Plus & Custom GPTs**: Create a Custom GPT, add an Action, and import the OpenAPI schema: `https://algo.mariehaynes.com/openapi.json`.

### Deploying to Google Cloud Run
```bash
gcloud run deploy algo-update-mcp \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
