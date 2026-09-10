# Marie Haynes' Algorithm & AI Search Changes MCP Server
*Reference Architecture & Starter Blueprint for Knowledge-Based Model Context Protocol (MCP) Servers*

> [!IMPORTANT]
> ### Who is this repository for?
> 
> - **If you just want to use Marie's Google Algorithm Update intelligence in Claude Desktop, Cursor, or ChatGPT:**  
>   **You do NOT need to clone, fork, or run this code!** My live production MCP server is already hosted and running at **`https://algo.mariehaynes.com`**. Jump straight to [Connecting to the Hosted Server](#connecting-to-the-hosted-server) below to connect your AI client in less than 60 seconds.
>
> - **If you are a developer looking to build your own MCP server:**  
>   This repository is an **open reference architecture and educational blueprint** showing how I designed, structured, and deployed a production-grade MCP knowledge server. You can explore the codebase to see how to handle dual transports (Streamable HTTP + SSE), implement Open Knowledge Format (OKF) data structures, build privacy-first telemetry, and prompt LLMs to separate verified facts from AI speculation.
>
> - **Dataset Notice:**  
>   This public repository includes a **sample mock dataset** (`sample-okf/` and `src/data/algo-updates.json` with ~15 sample entries) so you can test the code and see how everything fits together. My complete 15-year proprietary archive of 590+ verified updates (2012–2026) is hosted exclusively on my production server at `algo.mariehaynes.com`. You won't be able to run a duplicate of my full service from this code alone, but you are welcome to use this repository as inspiration to build an MCP server for your own proprietary knowledge or client data!

---

## 1. What the project is

This project is an open-source reference implementation of a **Model Context Protocol (MCP)** knowledge server, modeled on the system I built to deliver Google Algorithm Update intelligence (spanning 2012 to 2026) directly to AI agents.

By connecting an MCP server to tools like Claude Desktop, Antigravity, Cursor, and web-based LLMs, AI agents can query structured, verified historical timelines during conversations—such as diagnosing website traffic drops in Google Analytics 4 (GA4) or Google Search Console (GSC).

### What this codebase demonstrates:
- **Zero LLM Token Cost for Hosts**: The server does not invoke an LLM. It acts as a pure, lightweight API delivering structured data to the user's own AI client.
- **Universal Multi-Client & Dual-Transport Architecture**:
  - **Modern Streamable HTTP (`/mcp`)**: Implements the official MCP transport standard (SEP-2596) with unified single-endpoint HTTP streaming, optimized for serverless platforms like Google Cloud Run.
  - **Backwards-Compatible HTTP+SSE (`/sse`)**: Provides legacy Server-Sent Events (SSE) and `/messages` endpoints for existing clients like Claude Desktop (`supergateway`).
  - **WebMCP Auto-Discovery (`/.well-known/mcp.json`)**: Built-in support for emerging in-browser agent discovery.
- **Clear Separation of Verified Facts vs. AI Advice**: Embedded prompt schemas, tool metadata, and structured payload instructions direct the calling LLM to cleanly distinguish verified human analysis from its own speculative advice.
- **Privacy-First Anonymous Telemetry**: Server-side volume counting that logs only aggregate tool calls and transport types. Zero search queries, user prompts, client IP addresses, or URLs are ever recorded.
- **Interactive Web Explorer (`/`)**: A built-in web dashboard adhering to brand colors (`#f15a25`, `#5c2882`, `#662d91`, `#333333`) featuring live search, prompt guidance, and connection instructions.

---

## 2. How the technical architecture works

The system is designed as a standalone, stateless Node.js / TypeScript microservice:

```text
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│  Claude Desktop  │  Cursor  │  ChatGPT  │  Browser / Agents │
└──────────────┬───────────────────┬──────────────────────────┘
               │ (Streamable HTTP) │ (HTTP + SSE)
               ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express HTTP Server                      │
│   /mcp (Streamable HTTP)          /sse & /messages (SSE)    │
│   /.well-known/mcp.json           /stats (Dashboard)        │
│   /api/updates (REST Feed)        / (Web Explorer)          │
├─────────────────────────────────────────────────────────────┤
│                     MCP Server Engine                       │
│             (@modelcontextprotocol/sdk v1.6+)               │
│                                                             │
│  Tools:                                                     │
│   • get_latest_updates(limit, platform, category)           │
│   • get_updates_by_date_range(startDate, endDate, platform) │
│   • search_updates(query, category, platform, limit)        │
│   • get_all_categories()                                    │
├─────────────────────────────────────────────────────────────┤
│                    Data & Knowledge Layer                   │
│   • sample-okf/                 (Markdown + YAML Frontmatter│
│   • src/data/algo-updates.json  (In-Memory Sample Index)    │
├─────────────────────────────────────────────────────────────┤
│               Anonymous Telemetry & Analytics               │
│   • Aggregate tool & transport counters                     │
│   • Optional Firestore persistence & GA4 Measurement Ping   │
└─────────────────────────────────────────────────────────────┘
```

### Key Components:
- **Sample OKF Dataset (`sample-okf/`)**: Human-readable Markdown files with YAML frontmatter demonstrating the Open Knowledge Format structure.
- **Lookup Index (`src/data/algo-updates.json`)**: An in-memory JSON dataset of sample updates used for fast local development and automated testing.
- **MCP Server Engine (`src/server.ts` & `src/tools.ts`)**: Built on `@modelcontextprotocol/sdk` and Express. It registers standardized MCP tools with Zod schema validation and embeds formatting rules in every response.
- **Anonymous Telemetry (`src/telemetry.ts` & `src/statsHtml.ts`)**: Collects aggregate counters in memory and optionally persists them to Firestore (`system/algo_mcp_stats`) with a local JSON fallback (`data/usage-stats.json`). Includes an optional server-side GA4 Measurement Protocol dispatcher (`mcp_tool_usage`).
- **Containerization (`Dockerfile`)**: Multi-stage build producing an optimized production container ready for stateless, autoscaling deployment on Google Cloud Run.

---

## 3. Terminal commands needed to run it

### Prerequisites
- Node.js 20+ installed
- npm installed

### Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/mariehaynes/algo-update-mcp.git
cd algo-update-mcp
npm install
```

### Running Locally (Development Mode)
Starts the Express and MCP server with hot-reloading on port 3005:
```bash
npm run dev
```
Once running, open [http://localhost:3005](http://localhost:3005) in your browser to view the interactive Web Explorer.

### Running the Automated Test Suite
Executes the test suite verifying MCP tool functionality and HTTP endpoints against the bundled sample data:
```bash
npm test
```

### Building for Production
Compiles TypeScript and copies data files into `dist/`:
```bash
npm run build
```

### Running the Production Build
```bash
npm start
```

### Environment Variables
Copy `.env.example` to `.env` to customize settings (all variables are optional for local development):
```bash
cp .env.example .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Port for the HTTP / MCP server | `3005` (or `8080` in Docker) |
| `GOOGLE_CLOUD_PROJECT` | Google Cloud Project ID for Firestore persistence | _(Optional)_ |
| `GA4_MEASUREMENT_ID` | GA4 Measurement ID for anonymous usage events | `G-2N5XDDYHFL` |
| `GA4_API_SECRET` | GA4 Measurement Protocol API secret | _(Optional)_ |

---

## How to use this codebase for your own MCP server

If you want to build an MCP server for your own company, documentation, or product knowledge, here is how to adapt this project:

1. **Replace the Knowledge Data**:
   - Replace the files in `sample-okf/` with your own Markdown notes or documentation.
   - Replace `src/data/algo-updates.json` with your own structured dataset.
2. **Define Your MCP Tools**:
   - Edit `src/tools.ts` to implement your query logic (e.g., keyword search, category filters, date ranges).
   - In `src/server.ts`, update the tool names, descriptions, and Zod parameter schemas to match your data.
3. **Customize the Web Explorer & Branding**:
   - Update `src/server.ts` and `src/statsHtml.ts` with your own logo, brand colors, and copy.
4. **Deploy**:
   - Deploy the container to Google Cloud Run, Railway, Render, or any Docker-compatible hosting provider.

---

## Connecting to Marie's Hosted Server

If you simply want to access Marie's live, verified Google Algorithm Updates in your AI client, use the endpoints below:

### Connecting to Claude Desktop
Open Claude Desktop &rarr; **Settings** (`Cmd + ,` on Mac or `Ctrl + ,` on Windows) &rarr; **Developer** tab &rarr; click **Edit Config** (`claude_desktop_config.json`):

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
*Save the file and restart Claude Desktop.*

### Connecting to ChatGPT
- **ChatGPT Pro / Enterprise / Edu (Developer Mode)**: Settings &rarr; Apps &rarr; Advanced Settings &rarr; Developer Mode &rarr; Create, and enter `https://algo.mariehaynes.com/sse`.
- **ChatGPT Plus / Custom GPTs**: Create a Custom GPT, add an Action, and import the OpenAPI schema from `https://algo.mariehaynes.com/openapi.json`.

---

## Prompting Best Practices: Keeping Marie's Findings Distinct from AI Advice

The MCP server automatically injects formatting instructions into tool definitions and response payloads, prompting the AI to keep factual updates distinct from AI commentary. For optimal results, include a prompt instruction like:

> *"Did an algorithm update happen between [Start Date] and [End Date]? **Please clearly separate Marie Haynes' verified update findings from your own SEO advice and recommendations.**"*

**Result:** The AI will display confirmed updates and dates under a dedicated section (e.g., `### 📊 From Marie Haynes Consulting`) and place speculative advice, audit checklists, or troubleshooting in a separate section (e.g., `### 💡 AI Recommendations & Next Steps`).

---

## License
MIT License. See [LICENSE](LICENSE) for details.
