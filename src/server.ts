import express from 'express';
import cors from 'cors';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  loadUpdates,
  getLatestUpdates,
  getUpdatesByDateRange,
  searchUpdates,
  getAllCategories,
  ATTRIBUTION_FOOTER
} from './tools.js';
import { MHC_LOGO_BASE64 } from './logoData.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3005;

app.use(cors());
app.use(express.json());

// Factory function to create a new MCP server instance per connection (enables multi-client SSE)
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "marie-haynes-algo-updates",
    version: "1.0.0"
  });

  // Register Tool 1: get_latest_updates
  server.tool(
    "get_latest_updates",
    "Fetch the most recent Google algorithm updates, AI Mode model rollouts (e.g. Gemini 3.8 Flash), and AI search changes with verified dates, impact levels, and Marie Haynes' analysis. NOTE FOR AI: When presenting results, you must clearly distinguish between verified data/analysis from Marie Haynes Consulting versus your own deductions or recommendations.",
    {
      limit: z.number().min(1).max(50).optional().describe("Number of recent updates to return (default: 10, max: 50)"),
      platform: z.string().optional().describe("Filter by platform: 'Google Search', 'ChatGPT / OpenAI', 'Perplexity', or 'all'"),
      category: z.string().optional().describe("Filter by category: e.g. 'Google Core Update', 'Google Spam Update', 'AI Mode & Gemini', 'AI Overviews', or 'all'")
    },
    async ({ limit, platform, category }) => {
      const result = getLatestUpdates({ limit, platform, category });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  // Register Tool 2: get_updates_by_date_range
  server.tool(
    "get_updates_by_date_range",
    "Retrieve all algorithm updates, spam updates, and AI search shifts within a specific date window. Essential for diagnosing website traffic and ranking drops in Google Analytics (GA4) and Google Search Console (GSC). NOTE FOR AI: In your response, clearly separate verified updates from Marie Haynes Consulting from your own strategic advice.",
    {
      startDate: z.string().describe("Start date in YYYY-MM-DD format (e.g. '2026-08-01')"),
      endDate: z.string().describe("End date in YYYY-MM-DD format (e.g. '2026-09-02')"),
      platform: z.string().optional().describe("Optional platform filter: 'Google Search', 'ChatGPT / OpenAI', or 'all'")
    },
    async ({ startDate, endDate, platform }) => {
      const result = getUpdatesByDateRange({ startDate, endDate, platform });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  // Register Tool 3: search_updates
  server.tool(
    "search_updates",
    "Search across the complete 2012–2026 historical algorithm archive (including Core Updates, Helpful Content updates, Spam purges, Panda, Penguin, AI Overviews, and Gemini model releases). NOTE FOR AI: Clearly cite Marie Haynes Consulting for update details and keep your own analysis distinct.",
    {
      query: z.string().describe("Keywords to search for (e.g. 'Gemini 3.8', 'Personal Intelligence', 'Reddit', 'Medic', 'HCU', 'unannounced')"),
      category: z.string().optional().describe("Optional category to filter results"),
      platform: z.string().optional().describe("Optional platform filter"),
      limit: z.number().min(1).max(50).optional().describe("Maximum results to return (default: 15)")
    },
    async ({ query, category, platform, limit }) => {
      const result = searchUpdates({ query, category, platform, limit });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  );

  // Register Tool 4: get_all_categories
  server.tool(
    "get_all_categories",
    "List all available update categories, platforms, and total counts in Marie Haynes' algorithm archive.",
    {},
    async () => {
      const result = getAllCategories();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ...result, attribution: ATTRIBUTION_FOOTER.trim() }, null, 2)
        }]
      };
    }
  );

  // Register Prompt 1: diagnose_traffic_drop
  server.prompt(
    "diagnose_traffic_drop",
    "Correlate a website's GA4 or GSC traffic drop with verified Google algorithm updates, with strict separation between Marie Haynes' data and AI recommendations.",
    {
      startDate: z.string().describe("Start date of traffic drop (YYYY-MM-DD)"),
      endDate: z.string().describe("End date of traffic drop (YYYY-MM-DD)"),
      trafficDetails: z.string().optional().describe("Optional context (e.g. '30% drop in organic clicks in GSC, mainly blog posts')")
    },
    async ({ startDate, endDate, trafficDetails }) => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `I noticed a drop in website traffic${trafficDetails ? ` (${trafficDetails})` : ''} between ${startDate} and ${endDate}.

Please use the 'get_updates_by_date_range' tool to check Marie Haynes' algorithm update archive for that period.

CRITICAL PRESENTATION REQUIREMENT:
You must clearly separate your response into two distinct sections:
1. '### 📊 Verified Update Intelligence (from Marie Haynes Consulting)'
   - Detail every confirmed, unconfirmed, or spam update, their exact dates, impact ratings, and Marie Haynes' analysis/observations.
2. '### 💡 AI Strategic Recommendations & Next Steps'
   - Provide your own strategic advice, diagnostics, and recommended next steps based on those updates.

Do not blend or blur Marie Haynes' verified update facts with your own commentary.`
            }
          }
        ]
      };
    }
  );

  // Register Prompt 2: research_algorithm_update
  server.prompt(
    "research_algorithm_update",
    "Investigate a specific Google update, core update, or AI search shift using Marie Haynes' archive, with clearly delineated AI advice.",
    {
      query: z.string().describe("Name, topic, or keyword (e.g. 'Helpful Content', 'Gemini 3.8', 'Medic', 'Spam', 'Reddit')")
    },
    async ({ query }) => {
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Please use the 'search_updates' tool to look up '${query}' in Marie Haynes' algorithm archive.

CRITICAL PRESENTATION REQUIREMENT:
When presenting your answer:
1. Under '### 📊 Findings from Marie Haynes' Algorithm Intelligence', present the verified dates, update details, impact levels, and Marie Haynes' commentary directly from the MCP.
2. Under '### 💡 AI Analysis & Actionable Advice', provide your own SEO insights, advice, and recommendations.

Do not mix what comes from Marie Haynes Consulting with your own opinions.`
            }
          }
        ]
      };
    }
  );

  return server;
}

// ----------------------------------------------------
// Multi-Client SSE Transport Management
// ----------------------------------------------------
const transports = new Map<string, SSEServerTransport>();

app.get('/sse', async (req, res) => {
  console.log(`[SSE] New connection incoming from ${req.ip}`);
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);

  const server = createMcpServer();

  req.on('close', async () => {
    console.log(`[SSE] Connection closed for session ${transport.sessionId}`);
    transports.delete(transport.sessionId);
    try {
      await server.close();
    } catch {
      // ignore close errors
    }
  });

  await server.connect(transport);
});

app.post(['/messages', '/sse'], async (req, res) => {
  const sessionId = req.query.sessionId as string;
  let transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport && transports.size > 0) {
    // Fallback to the latest active transport if sessionId omitted
    transport = Array.from(transports.values()).pop();
  }

  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(404).json({ error: "Session not found or transport disconnected" });
  }
});

// ----------------------------------------------------
// Modern Streamable HTTP Transport (SEP-2596 Standard)
// ----------------------------------------------------
const streamableTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined // Stateless mode: perfect for serverless Cloud Run
});
const streamableServer = createMcpServer();
streamableServer.connect(streamableTransport).catch(err => {
  console.error("[StreamableHTTP] Error connecting to server:", err);
});

app.all(['/mcp', '/v1/mcp'], async (req, res) => {
  await streamableTransport.handleRequest(req, res, req.body);
});

// ----------------------------------------------------
// WebMCP Auto-Discovery Endpoint
// ----------------------------------------------------
app.get('/.well-known/mcp.json', (req, res) => {
  res.json({
    "$schema": "https://modelcontextprotocol.io/schema/mcp.json",
    "name": "Marie Haynes Algorithm & AI Search Changes Intelligence",
    "description": "Comprehensive knowledge base and diagnostic tools for Google algorithm updates, AI Overviews, AI Mode model rollouts, and AI search shifts spanning 2012 to 2026.",
    "homepage": "https://algo.mariehaynes.com",
    "provider": {
      "name": "Marie Haynes Consulting Inc.",
      "url": "https://www.mariehaynes.com"
    },
    "endpoints": {
      "streamable_http": "/mcp",
      "sse": "/sse",
      "messages": "/messages",
      "updates_json": "/updates.json"
    },
    "tools": [
      {
        "name": "get_latest_updates",
        "description": "Fetch recent search and AI updates (e.g. Gemini 3.8 Flash, Spam Updates, Core Updates)"
      },
      {
        "name": "get_updates_by_date_range",
        "description": "Correlate traffic drops by checking updates in a specific date range"
      },
      {
        "name": "search_updates",
        "description": "Search the complete historical archive back to 2012"
      },
      {
        "name": "get_all_categories",
        "description": "List all update categories and platforms"
      }
    ]
  });
});

// ----------------------------------------------------
// Public REST API & JSON Feeds
// ----------------------------------------------------
app.get('/api/updates', (req, res) => {
  const { limit, platform, category, startDate, endDate, query } = req.query;

  if (query) {
    return res.json(searchUpdates({
      query: String(query),
      category: category ? String(category) : undefined,
      platform: platform ? String(platform) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined
    }));
  }

  if (startDate && endDate) {
    return res.json(getUpdatesByDateRange({
      startDate: String(startDate),
      endDate: String(endDate),
      platform: platform ? String(platform) : undefined
    }));
  }

  return res.json(getLatestUpdates({
    limit: limit ? parseInt(String(limit), 10) : undefined,
    platform: platform ? String(platform) : undefined,
    category: category ? String(category) : undefined
  }));
});

app.get('/updates.json', (req, res) => {
  const updates = loadUpdates();
  res.json(updates);
});

app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "Marie Haynes Google Algorithm Updates & AI Search Changes",
      description: "Real-time, structured intelligence on Google algorithm updates, Core Updates, Spam Updates, AI Overviews, and AI search shifts spanning 2011 to 2026.",
      version: "1.0.0"
    },
    servers: [
      {
        url: "https://algo.mariehaynes.com",
        description: "Production API Server"
      }
    ],
    paths: {
      "/api/updates": {
        get: {
          summary: "Retrieve or search Google algorithm and AI search updates",
          operationId: "getAlgoUpdates",
          description: "Fetch latest updates, search the 15-year archive by keyword (e.g. 'Medic', 'Helpful Content', 'UCP', 'Spam'), or filter by date range.",
          parameters: [
            {
              name: "query",
              in: "query",
              required: false,
              description: "Keyword or topic to search for (e.g. 'Helpful Content', 'Spam', 'AI Overviews', 'Reddit')",
              schema: { type: "string" }
            },
            {
              name: "startDate",
              in: "query",
              required: false,
              description: "Start date for correlation (YYYY-MM-DD)",
              schema: { type: "string" }
            },
            {
              name: "endDate",
              in: "query",
              required: false,
              description: "End date for correlation (YYYY-MM-DD)",
              schema: { type: "string" }
            },
            {
              name: "category",
              in: "query",
              required: false,
              description: "Filter by category (e.g. 'Google Core Update', 'Spam Update', 'AI Mode & Gemini')",
              schema: { type: "string" }
            },
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Number of updates to return (default 10)",
              schema: { type: "integer" }
            }
          ],
          responses: {
            "200": {
              description: "List of algorithm updates with dates, summaries, and impact ratings.",
              content: {
                "application/json": {
                  schema: { type: "object" }
                }
              }
            }
          }
        }
      }
    }
  });
});

app.get('/logo.jpg', (req, res) => {
  const imgBuffer = Buffer.from(MHC_LOGO_BASE64.split(',')[1], 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': imgBuffer.length
  });
  res.end(imgBuffer);
});

// ----------------------------------------------------
// Branded Web Landing Page & Explorer (Poppins & Noto Sans)
// ----------------------------------------------------
app.get('/', (req, res) => {
  const updates = loadUpdates();
  const spotlightUpdates = updates.slice(0, 3);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marie Haynes' Algorithm & AI Search Updates MCP</title>
  <meta name="description" content="Use Marie Haynes' algorithm update list directly in Claude Desktop, Antigravity, Cursor, and AI agents via Model Context Protocol (MCP).">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-N29R7CSGFK"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-N29R7CSGFK');
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --brand-orange: #f15a25;
      --brand-deep-purple: #5c2882;
      --brand-purple: #662d91;
      --brand-charcoal: #333333;
      --bg-light: #faf9fc;
      --card-bg: #ffffff;
      --border-color: #e5dfec;
      --code-bg: #f8f6fb;
      --code-border: #e2d8ea;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--brand-charcoal);
      background-color: var(--bg-light);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4, .brand-font {
      font-family: 'Poppins', sans-serif;
      font-weight: 700;
      color: var(--brand-deep-purple);
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #ede7f4;
      padding: 3.5rem 1.5rem 2.8rem;
      text-align: center;
      box-shadow: 0 2px 14px rgba(92, 40, 130, 0.04);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.6rem;
      width: 100%;
    }
    .logo-container img {
      height: 105px;
      max-height: 120px;
      width: auto;
      max-width: 90%;
      object-fit: contain;
      display: block;
    }
    .badge {
      display: inline-block;
      background-color: var(--brand-orange);
      color: #ffffff;
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 14px;
      border-radius: 999px;
      margin-bottom: 0.75rem;
      box-shadow: 0 2px 8px rgba(241, 90, 37, 0.25);
    }
    header h1 {
      color: var(--brand-deep-purple);
      font-size: 2.3rem;
      margin-bottom: 0.85rem;
      letter-spacing: -0.5px;
    }
    header p {
      font-size: 1.15rem;
      color: #4f4a59;
      max-width: 720px;
      margin: 0 auto;
      line-height: 1.65;
    }
    .container {
      max-width: 1060px;
      margin: 0 auto;
      padding: 2.5rem 1.5rem;
    }
    .setup-box {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-top: 4px solid var(--brand-orange);
      border-radius: 12px;
      padding: 2.2rem;
      margin-bottom: 2.5rem;
      box-shadow: 0 6px 24px rgba(92, 40, 130, 0.05);
    }
    .setup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.2rem;
      flex-wrap: wrap;
      gap: 12px;
    }
    .endpoint-badge {
      background-color: #f7eefc;
      color: var(--brand-purple);
      padding: 6px 14px;
      border-radius: 6px;
      font-family: monospace;
      font-weight: 700;
      font-size: 0.9rem;
      border: 1px solid #e5cfee;
    }
    .setup-expand-btn {
      background-color: var(--brand-orange);
      color: #ffffff;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      font-family: 'Poppins', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(241, 90, 37, 0.25);
    }
    .setup-expand-btn:hover {
      background-color: #df4a16;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(241, 90, 37, 0.35);
    }
    .setup-toggle-bar {
      user-select: none;
      cursor: pointer;
    }
    /* Setup Tabs */
    .tabs-nav {
      display: flex;
      gap: 8px;
      border-bottom: 2px solid #ede7f4;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }
    .tab-btn {
      background: none;
      border: none;
      padding: 10px 18px;
      font-family: 'Poppins', sans-serif;
      font-size: 0.92rem;
      font-weight: 600;
      color: #666;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s ease;
    }
    .tab-btn:hover {
      color: var(--brand-purple);
    }
    .tab-btn.active {
      color: var(--brand-deep-purple);
      border-bottom-color: var(--brand-orange);
      font-weight: 700;
    }
    .tab-pane {
      display: none;
      animation: fadeIn 0.15s ease-in-out;
    }
    .tab-pane.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(3px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .step-list {
      list-style: none;
      margin: 1rem 0;
    }
    .step-list li {
      margin-bottom: 1rem;
      padding-left: 1.8rem;
      position: relative;
      font-size: 0.98rem;
      line-height: 1.6;
    }
    .step-list li::before {
      content: attr(data-step);
      position: absolute;
      left: 0;
      top: 2px;
      width: 22px;
      height: 22px;
      background: #f4ecf8;
      color: var(--brand-purple);
      border-radius: 50%;
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    pre {
      background-color: var(--code-bg);
      color: #2b2536;
      border: 1px solid var(--code-border);
      padding: 1.1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.88rem;
      position: relative;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin: 0.75rem 0;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background-color: var(--brand-orange);
      color: #ffffff;
      border: none;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.78rem;
      transition: background-color 0.2s;
    }
    .copy-btn:hover {
      background-color: #df4a16;
    }
    /* Bridge Banner */
    .archive-banner {
      background: linear-gradient(135deg, #5c2882 0%, #3e1b57 100%);
      color: #ffffff;
      border-radius: 12px;
      padding: 2.2rem;
      margin-bottom: 2.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1.5rem;
      box-shadow: 0 8px 24px rgba(92, 40, 130, 0.15);
    }
    .archive-banner h3 {
      color: #ffffff;
      font-size: 1.35rem;
      margin-bottom: 0.5rem;
    }
    .archive-banner p {
      color: #e3d5ee;
      font-size: 0.95rem;
      max-width: 620px;
      line-height: 1.55;
    }
    .archive-btn {
      background: var(--brand-orange);
      color: #ffffff !important;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: 'Poppins', sans-serif;
      font-size: 0.95rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-block;
      white-space: nowrap;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(241, 90, 37, 0.35);
    }
    .archive-btn:hover {
      background: #e04a16;
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(241, 90, 37, 0.45);
    }
    /* Prompt Cards */
    .prompts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
      margin: 1.2rem 0 2.5rem;
    }
    .prompt-card {
      background: #ffffff;
      border: 1px solid #ebdfee;
      border-radius: 10px;
      padding: 16px 18px;
      font-size: 0.92rem;
      color: #3b3644;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      box-shadow: 0 2px 8px rgba(92, 40, 130, 0.03);
    }
    .prompt-card span {
      color: var(--brand-orange);
      font-size: 1.1rem;
      line-height: 1;
    }
    /* Spotlight Cards */
    .spotlight-card {
      background: #ffffff;
      border: 1px solid #e7e2ee;
      border-radius: 10px;
      padding: 18px 22px;
      margin-bottom: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }
    .spotlight-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .spotlight-date {
      font-weight: 700;
      color: var(--brand-orange);
      font-size: 0.92rem;
      font-family: 'Poppins', sans-serif;
    }
    .spotlight-badge {
      background: #f4ecf8;
      color: var(--brand-purple);
      font-size: 0.72rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #e1cbed;
    }
    .spotlight-title {
      font-size: 1.12rem;
      margin-bottom: 6px;
      color: #1e1b24;
      line-height: 1.35;
    }
    .spotlight-summary {
      font-size: 0.92rem;
      color: #4b4655;
      line-height: 1.55;
    }
    /* FAQ Section */
    .faq-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 1.2rem;
    }
    .faq-item {
      background: #ffffff;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(92, 40, 130, 0.02);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .faq-item:hover {
      border-color: #d8cce4;
      box-shadow: 0 4px 14px rgba(92, 40, 130, 0.05);
    }
    .faq-item details summary {
      padding: 16px 20px;
      font-family: 'Poppins', sans-serif;
      font-size: 1rem;
      font-weight: 600;
      color: var(--brand-deep-purple);
      cursor: pointer;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
      user-select: none;
    }
    .faq-item details summary::-webkit-details-marker {
      display: none;
    }
    .faq-icon {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--brand-orange);
      transition: transform 0.2s ease;
      line-height: 1;
      margin-left: 12px;
    }
    .faq-item details[open] .faq-icon {
      transform: rotate(45deg);
    }
    .faq-answer {
      padding: 0 20px 18px 20px;
      font-size: 0.93rem;
      color: #4b4655;
      line-height: 1.65;
      border-top: 1px solid #f3eff7;
      padding-top: 14px;
    }
    .faq-answer p {
      margin-bottom: 10px;
    }
    .faq-answer p:last-child {
      margin-bottom: 0;
    }
    footer {
      background: #ffffff;
      border-top: 1px solid #ebe5f2;
      color: #615c6d;
      text-align: center;
      padding: 3rem 1.5rem;
      margin-top: 3rem;
    }
    footer a { color: var(--brand-purple); text-decoration: none; font-weight: 600; }
    footer a:hover { color: var(--brand-orange); text-decoration: underline; }
  </style>
</head>
<body>

<header>
  <div class="logo-container">
    <a href="https://www.mariehaynes.com/" target="_blank" rel="noopener" style="display: inline-block;">
      <img src="${MHC_LOGO_BASE64}" alt="Marie Haynes Consulting">
    </a>
  </div>
  <span class="badge">Model Context Protocol (MCP)</span>
  <h1>Algorithm & AI Search Updates</h1>
  <p>You can now use my <a href="https://www.mariehaynes.com/resources/algo-changes-and-more/" target="_blank" rel="noopener" style="color: var(--brand-purple); font-weight: 600; text-decoration: underline;">list of Google algorithm updates and changes to AI Search</a> via MCP so you can access it via any AI system that offers MCP access. <a href="javascript:void(0)" onclick="toggleSetupBox(true)" style="color: var(--brand-orange); font-weight: 600; text-decoration: underline;">Click here to expand the step-by-step setup guides</a> to connect my MCP server to Claude, Antigravity, or wherever you use MCP.</p>
</header>

<div class="container">

  <!-- Setup Section with Tabs (Collapsible / Expandable) -->
  <div class="setup-box" id="setupBox">
    <div class="setup-toggle-bar" onclick="toggleSetupBox()" role="button" tabindex="0" aria-expanded="false" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; gap:16px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:14px;">
        <span style="font-size:1.85rem; line-height:1;">🔌</span>
        <div>
          <h2 style="font-size:1.28rem; margin-bottom:3px; color:var(--brand-deep-purple);">Connect to Your AI Platform (Claude, Cursor, ChatGPT, etc.)</h2>
          <p style="font-size:0.9rem; color:#615c6d; margin:0;">Click here to expand the step-by-step setup guides & configuration snippets</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <span class="endpoint-badge" style="margin:0; background:#f0f8f0; color:#2e7d32; border-color:#c8e6c9;">Streamable HTTP: /mcp</span>
        <span class="endpoint-badge" style="margin:0;">SSE: /sse</span>
        <button type="button" id="setupExpandBtn" class="setup-expand-btn" onclick="event.stopPropagation(); toggleSetupBox();">
          <span id="setupExpandText">Show Setup Instructions</span>
          <span id="setupExpandIcon" style="font-size:0.8rem; transition:transform 0.2s ease;">▼</span>
        </button>
      </div>
    </div>

    <!-- Collapsible Container (Hidden by default) -->
    <div id="setupCollapsibleContent" style="display: none; margin-top: 1.8rem; border-top: 1px solid #ede7f4; padding-top: 1.5rem;">
      <!-- Navigation Tabs -->
      <div class="tabs-nav">
      <button class="tab-btn active" onclick="switchTab('claude')">Claude Desktop</button>
      <button class="tab-btn" onclick="switchTab('antigravity')">Antigravity</button>
      <button class="tab-btn" onclick="switchTab('cursor')">Cursor</button>
      <button class="tab-btn" onclick="switchTab('cli')">Claude Code / CLI</button>
      <button class="tab-btn" onclick="switchTab('chatgpt')">ChatGPT (Custom GPT)</button>
    </div>

    <!-- Tab 1: Claude Desktop -->
    <div id="tab-claude" class="tab-pane active">
      <ol class="step-list">
        <li data-step="1">
          <strong>The Easiest Way:</strong> In Claude Desktop, open <strong>Settings</strong> (press <kbd style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.85rem;">Cmd + ,</kbd> on Mac or <kbd style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.85rem;">Ctrl + ,</kbd> on Windows), select the <strong>Developer</strong> tab in the sidebar, and click <strong>"Edit Config"</strong>.
          <div style="font-size:0.85rem; color:#666; margin-top:6px; line-height:1.5;">
            <em>(Mac Finder shortcut: If you prefer Finder, press <kbd style="background:#eee; padding:1px 5px; border-radius:3px; font-size:0.8rem;">Cmd + Shift + G</kbd> and paste <code>~/Library/Application Support/Claude/</code>)</em>
          </div>
        </li>
        <li data-step="2">
          <strong>Choose the option that works best for you:</strong>

          <!-- Sub Option A: AI Helper Prompt (Solves pasting/JSON confusion) -->
          <div style="margin: 12px 0 16px 0; background: #faf5fd; border: 1.5px solid var(--brand-purple); border-radius: 8px; padding: 16px 18px; box-shadow: 0 3px 12px rgba(92, 40, 130, 0.06);">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; margin-bottom: 6px;">
              <span style="font-weight: 700; color: var(--brand-deep-purple); font-size: 0.95rem;">
                ✨ Option A (Recommended): Let your AI merge it for you!
              </span>
              <span style="background: var(--brand-orange); color:#fff; font-size:0.72rem; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase;">Zero Syntax Errors</span>
            </div>
            <p style="font-size: 0.88rem; color: #444; margin-bottom: 10px; line-height: 1.5;">
              Nervous about JSON commas, brackets, or where to paste? Copy this prompt, paste it into Claude, ChatGPT, or your favorite AI along with your current file, and it will return the complete file ready to replace:
            </p>
            <div style="position: relative;">
              <button class="copy-btn" onclick="copySnippet('claudeAiPrompt')">📋 Copy Prompt for Your AI</button>
              <pre style="white-space: pre-wrap; font-size: 0.84rem; line-height: 1.5;"><code id="claudeAiPrompt">I need to add a new MCP server to my Claude Desktop configuration file (claude_desktop_config.json).

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

Please merge the new "marie-haynes-algo" server into my file. Ensure all JSON brackets and commas are valid, and output the entire updated file so I can copy and paste it back.</code></pre>
            </div>
          </div>

          <!-- Sub Option B: If you already have servers (Manual) -->
          <div style="margin: 12px 0 16px 0; background: #faf8fc; border: 1px solid #ebdfee; border-radius: 8px; padding: 14px 16px;">
            <div style="font-weight: 700; color: var(--brand-purple); font-size: 0.92rem; margin-bottom: 4px;">
              👉 Option B (Manual): If you already have other MCP servers:
            </div>
            <p style="font-size: 0.85rem; color: #555; margin-bottom: 8px;">
              Copy this snippet and paste it inside your existing <code>"mcpServers": { ... }</code> block (remember to add a comma <code>,</code> after the previous server):
            </p>
            <div style="position: relative;">
              <button class="copy-btn" onclick="copySnippet('claudeSnippetOnly')">📋 Copy Snippet Only</button>
              <pre><code id="claudeSnippetOnly">    "marie-haynes-algo": {
      "command": "npx",
      "args": [
        "-y",
        "supergateway",
        "--sse",
        "https://algo.mariehaynes.com/sse",
        "--logLevel",
        "none"
      ]
    }</code></pre>
            </div>
          </div>

          <!-- Sub Option C: If this is your first MCP server -->
          <div style="margin: 12px 0 10px 0; background: #faf8fc; border: 1px solid #ebdfee; border-radius: 8px; padding: 14px 16px;">
            <div style="font-weight: 700; color: var(--brand-deep-purple); font-size: 0.92rem; margin-bottom: 4px;">
              👉 Option C (Fresh File): If this is your FIRST MCP server (empty file):
            </div>
            <p style="font-size: 0.85rem; color: #555; margin-bottom: 8px;">
              Replace your file contents completely with this full configuration:
            </p>
            <div style="position: relative;">
              <button class="copy-btn" onclick="copySnippet('claudeFullConfig')">📋 Copy Full File</button>
              <pre><code id="claudeFullConfig">{
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
}</code></pre>
            </div>
          </div>
        </li>
        <li data-step="3">
          Save the file, then <strong>completely quit and restart Claude Desktop</strong>. You'll see a small hammer icon (🔨) appear in your chat box with Marie's algorithm intelligence tools ready to use!
        </li>
      </ol>
    </div>

    <!-- Tab 2: Antigravity -->
    <div id="tab-antigravity" class="tab-pane">
      <ol class="step-list">
        <li data-step="1">
          Open Antigravity settings or edit your MCP configuration file.
        </li>
        <li data-step="2">
          Add <code>marie-haynes-algo</code> to your <code>mcp_servers</code> (supports modern Streamable HTTP <code>/mcp</code> or legacy <code>/sse</code>):
          <div style="position: relative;">
            <button class="copy-btn" onclick="copySnippet('agyConfig')">Copy JSON</button>
            <pre><code id="agyConfig">{
  "marie-haynes-algo": {
    "url": "https://algo.mariehaynes.com/mcp"
  }
}</code></pre>
          </div>
        </li>
        <li data-step="3">
          Your agents will automatically discover the four algorithm tools to diagnose traffic drops and explain search changes.
        </li>
      </ol>
    </div>

    <!-- Tab 3: Cursor -->
    <div id="tab-cursor" class="tab-pane">
      <ol class="step-list">
        <li data-step="1">
          Open <strong>Cursor Settings</strong> (<code>Cmd + ,</code> on Mac or <code>Ctrl + ,</code> on Windows).
        </li>
        <li data-step="2">
          Navigate to <strong>Features</strong> &rarr; <strong>MCP Servers</strong> in the left sidebar.
        </li>
        <li data-step="3">
          Click <strong>+ Add New MCP Server</strong> and fill in:
          <div style="background:#f4f1f8; padding:10px 14px; border-radius:6px; margin:8px 0; font-size:0.88rem;">
            &bull; <strong>Name:</strong> <code>marie-algo</code><br>
            &bull; <strong>Type:</strong> <code>Streamable HTTP</code> (or <code>SSE</code>)<br>
            &bull; <strong>Server URL:</strong> <code>https://algo.mariehaynes.com/mcp</code> (or <code>https://algo.mariehaynes.com/sse</code>)
          </div>
        </li>
        <li data-step="4">
          Click <strong>Save</strong>. Cursor will display a green status dot indicating that the server is connected.
        </li>
      </ol>
    </div>

    <!-- Tab 4: Claude Code / CLI -->
    <div id="tab-cli" class="tab-pane">
      <ol class="step-list">
        <li data-step="1">
          In your terminal, run this command to register the MCP server with Claude Code:
          <div style="position: relative;">
            <button class="copy-btn" onclick="copySnippet('cliCmd')">Copy Command</button>
            <pre><code id="cliCmd">claude mcp add marie-algo https://algo.mariehaynes.com/mcp</code></pre>
          </div>
        </li>
        <li data-step="2">
          Run <code>claude mcp list</code> to confirm the tools are registered.
        </li>
      </ol>
    </div>

    <!-- Tab 5: ChatGPT -->
    <div id="tab-chatgpt" class="tab-pane">
      <div style="background: #fdfaf6; border-left: 4px solid var(--brand-orange); padding: 12px 16px; margin-bottom: 18px; border-radius: 0 8px 8px 0; font-size: 0.9rem; color: #555;">
        <strong>ChatGPT Account Types:</strong> Direct MCP connections currently require <strong>ChatGPT Pro, Business, Enterprise, or Edu</strong>. ChatGPT Plus users can connect via <strong>Custom GPT Actions</strong>.
      </div>

      <!-- Path 1: Direct MCP for Pro / Business / Enterprise / Edu -->
      <div style="background: #faf8fc; border: 1px solid #ebdfee; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px;">
        <h4 style="color: var(--brand-deep-purple); font-size: 1.05rem; margin-bottom: 8px;">
          ⚡ Direct MCP Connection (ChatGPT Pro, Business, Enterprise, Edu)
        </h4>
        <ol class="step-list" style="margin-top: 10px;">
          <li data-step="1">
            In ChatGPT, go to <strong>Settings</strong> &rarr; <strong>Apps</strong> &rarr; <strong>Advanced Settings</strong> &rarr; enable <strong>Developer Mode</strong>.
          </li>
          <li data-step="2">
            Navigate to <strong>Apps</strong> &rarr; click <strong>Create</strong> (or Add App).
          </li>
          <li data-step="3">
            Enter the MCP SSE endpoint URL:
            <div style="position: relative; margin: 8px 0;">
              <button class="copy-btn" onclick="copySnippet('chatgptMcpUrl')">📋 Copy MCP Endpoint</button>
              <pre><code id="chatgptMcpUrl">https://algo.mariehaynes.com/sse</code></pre>
            </div>
          </li>
          <li data-step="4">
            Save and activate. ChatGPT can now call your algorithm update tools directly in any conversation!
          </li>
        </ol>
      </div>

      <!-- Path 2: Custom GPT Action for Plus users -->
      <div style="background: #ffffff; border: 1px solid #e7e2ee; border-radius: 8px; padding: 16px 18px;">
        <h4 style="color: var(--brand-purple); font-size: 1.02rem; margin-bottom: 8px;">
          🧩 Custom GPT Action (ChatGPT Plus & All Paid Plans)
        </h4>
        <p style="font-size: 0.88rem; color: #555; margin-bottom: 10px;">
          If you are on ChatGPT Plus and don't have direct MCP yet, you can connect Marie's database via an OpenAPI Action:
        </p>
        <ol class="step-list">
          <li data-step="1">
            Click <strong>Explore GPTs</strong> in the left sidebar &rarr; click <strong>+ Create</strong> &rarr; go to the <strong>Configure</strong> tab.
          </li>
          <li data-step="2">
            Scroll down to the bottom &rarr; click <strong>Create new action</strong>.
          </li>
          <li data-step="3">
            Under <strong>Schema</strong>, click <strong>"Import from URL"</strong> and enter:
            <div style="position: relative; margin: 8px 0;">
              <button class="copy-btn" onclick="copySnippet('chatgptOpenApiUrl')">📋 Copy OpenAPI URL</button>
              <pre><code id="chatgptOpenApiUrl">https://algo.mariehaynes.com/openapi.json</code></pre>
            </div>
          </li>
          <li data-step="4">
            Save your Custom GPT. It will automatically call <code>getAlgoUpdates</code> to answer queries on ranking shifts, core updates, and spam rollouts.
          </li>
        </ol>
      </div>
    </div>

    <!-- WebMCP Coming Soon Banner -->
    <div style="margin-top: 22px; background: linear-gradient(135deg, #fbf9fd 0%, #f4ecf8 100%); border: 1px dashed var(--brand-purple); border-radius: 8px; padding: 14px 18px; display: flex; align-items: center; gap: 14px;">
      <span style="font-size: 1.6rem; line-height: 1;">🌐</span>
      <div style="font-size: 0.9rem; color: #444; line-height: 1.5;">
        <strong style="color: var(--brand-deep-purple);">Coming Soon: WebMCP Support</strong><br>
        WebMCP capability is coming soon so your browser agents can use this info right on this site!
      </div>
    </div>

    <div style="border-top:1px solid #ede7f4; padding-top:14px; margin-top:18px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; font-size:0.85rem; color:#777;">
      <span>Direct JSON Feed: <a href="/updates.json" style="color:var(--brand-purple); font-weight:600;">/updates.json</a></span>
      <span>WebMCP Auto-discovery: <code>/.well-known/mcp.json</code></span>
    </div>
    </div> <!-- End #setupCollapsibleContent -->
  </div> <!-- End #setupBox -->

  <!-- Bridge Banner to Full Archive -->
  <div class="archive-banner">
    <div>
      <span style="background:rgba(255,255,255,0.15); font-size:0.75rem; font-weight:700; padding:3px 10px; border-radius:999px; text-transform:uppercase; letter-spacing:0.5px; display:inline-block; margin-bottom:8px;">Full 15-Year Archive</span>
      <h3>Looking for the complete interactive timeline?</h3>
      <p>Browse all 590+ updates from 2011 to 2026 on mariehaynes.com with clickable Panda, Penguin, and Core update filters, year accordions, and real-time keyword search.</p>
    </div>
    <a href="https://www.mariehaynes.com/resources/algo-changes-and-more/" target="_blank" rel="noopener" class="archive-btn">
      View Full Archive on mariehaynes.com ↗
    </a>
  </div>

  <!-- How It Works Section -->
  <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 12px; padding: 2.2rem; margin-bottom: 2.5rem; box-shadow: 0 4px 16px rgba(92, 40, 130, 0.04);">
    <h2 style="margin-bottom: 0.5rem; font-size: 1.35rem;">⚙️ How it works: A combo of Open Knowledge Format + MCP</h2>
    <p style="color:#555; font-size: 0.98rem; margin-bottom: 1.3rem; line-height: 1.6;">I had this idea to turn my algo update list into an MCP. I rambled about it to Antigravity and used the <code style="background:#f4ecf8; color:#662d91; padding:2px 6px; border-radius:4px; font-weight:600;">/goal</code> command and we completely rebuilt my algo update page and created this MCP.</p>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
      <div style="background: #faf8fc; border: 1px solid #ebdfee; border-radius: 8px; padding: 18px 20px; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h4 style="color: var(--brand-purple); font-size: 1.05rem; margin-bottom: 6px;">📖 Open Knowledge Format (OKF)</h4>
          <p style="font-size: 0.92rem; color: #444; line-height: 1.6; margin-bottom: 12px;">
            Every update in my archive is maintained as an independent, transparent Markdown document with structured YAML frontmatter (verified date, category, platform, impact level, and reference links). This deterministic structure lets AI agents retrieve exact chronological facts without hallucinations.
          </p>
        </div>
        <div style="border-top: 1px solid #f0e7f5; padding-top: 10px; margin-top: 6px;">
          <a href="https://www.mariehaynes.com/okf/" target="_blank" rel="noopener" style="color: var(--brand-purple); font-weight: 700; font-size: 0.88rem; text-decoration: none;">See more on how I build with OKF ↗</a>
        </div>
      </div>
      <div style="background: #faf8fc; border: 1px solid #ebdfee; border-radius: 8px; padding: 18px 20px;">
        <h4 style="color: var(--brand-orange); font-size: 1.05rem; margin-bottom: 6px;">🆓 100% Free & Covered by Your AI Account</h4>
        <p style="font-size: 0.92rem; color: #444; line-height: 1.6;">
          Connecting and querying this MCP server is completely free. There are no API keys, paywalls, or fees on Marie's end. The tokens used to retrieve updates and converse with your agent are simply covered under your existing AI subscription (Claude Pro/Team, Antigravity, Cursor, etc.).
        </p>
      </div>
    </div>
  </div>

  <!-- Example Prompts -->
  <div style="margin-bottom: 2.5rem;">
    <h2>💬 Example Prompts to Ask Your AI Agent</h2>
    <p style="color:#666; font-size:0.95rem; margin-top:4px;">Once connected, your agent can access Marie's updates in natural conversation:</p>

    <!-- Tip Box: Separating Marie's Data from AI Advice -->
    <div style="background: #fdfaf7; border: 1px solid #f6dacf; border-left: 5px solid var(--brand-orange); border-radius: 8px; padding: 18px 20px; margin: 16px 0 20px 0;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
        <span style="font-size:1.25rem;">🎯</span>
        <h3 style="color: var(--brand-deep-purple); font-size: 1.05rem; margin:0;">Keeping Marie's Findings Distinct from AI Advice</h3>
      </div>
      <p style="font-size: 0.92rem; color: #444; line-height: 1.6; margin-bottom: 10px;">
        When diagnosing a drop or asking about an update, Claude or ChatGPT accesses my verified timeline, but will also often add its own SEO tips. My MCP server instructs the AI to separate them, but you can get crystal-clear formatting in your chat simply by asking:
      </p>
      <div style="background: #ffffff; border: 1px solid #ebdfee; border-radius: 6px; padding: 12px 16px; font-size: 0.9rem; color: var(--brand-charcoal); line-height: 1.5;">
        <span style="color: var(--brand-purple); font-weight: 700;">Prompt Tip:</span> <em>"Did any Google updates occur between August 10 and August 28, 2026? <strong>Please clearly separate Marie Haynes' verified update data from your own SEO advice and recommendations.</strong>"</em>
      </div>
      <div style="font-size: 0.84rem; color: #666; margin-top: 8px;">
        ✨ <em>Your AI will then neatly format Marie's verified update dates and impact assessments under one heading, and keep its own diagnostic ideas and recommendations under a separate heading!</em>
      </div>
    </div>

    <div class="prompts-grid">
      <div class="prompt-card">
        <span>💡</span>
        <div>"My website had a 25% organic traffic drop between August 15 and August 28, 2026. What happened in Google search? Please clearly separate Marie Haynes' update data from your own SEO recommendations."</div>
      </div>
      <div class="prompt-card">
        <span>💡</span>
        <div>"What Google algorithm updates or spam updates occurred in May 2026? Present Marie's verified findings first, then your own analysis."</div>
      </div>
      <div class="prompt-card">
        <span>💡</span>
        <div>"Explain the latest AI Mode and Gemini model changes. What is confirmed by Marie Haynes vs what is speculative?"</div>
      </div>
      <div class="prompt-card">
        <span>💡</span>
        <div>"When did UCP go live and what did Marie Haynes note about its impact on search results?"</div>
      </div>
      <div class="prompt-card">
        <span>💡</span>
        <div>"Did a Google core update happen in early 2026? Separate verified update notes from recovery advice."</div>
      </div>
      <div class="prompt-card">
        <span>💡</span>
        <div>"What changes to ChatGPT referrals or AI Search citations occurred recently?"</div>
      </div>
    </div>
  </div>

  <!-- Spotlight Recent Updates -->
  <div>
    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:1rem; flex-wrap:wrap;">
      <h2>⚡ Live Feed Spotlight</h2>
      <span style="font-size:0.88rem; color:#777;">Most recent entries delivered by this server</span>
    </div>
    ${spotlightUpdates.map(u => `
      <div class="spotlight-card">
        <div class="spotlight-header">
          <span class="spotlight-date">${u.date}</span>
          <span class="spotlight-badge">${u.category}</span>
        </div>
        <h3 class="spotlight-title">${u.title}</h3>
        <p class="spotlight-summary">${u.summary}</p>
      </div>
    `).join('')}
  </div>

  <!-- Frequently Asked Questions (FAQ) Section -->
  <div style="margin-top: 3.2rem; margin-bottom: 2.5rem;">
    <div style="margin-bottom: 1.5rem;">
      <span class="badge" style="background-color: var(--brand-purple);">Got Questions?</span>
      <h2 style="font-size: 1.7rem; color: var(--brand-deep-purple); margin-top: 4px;">Frequently Asked Questions</h2>
      <p style="color: #615c6d; font-size: 0.95rem;">Everything you need to know about privacy, how this MCP works, and getting the most out of it.</p>
    </div>

    <div class="faq-grid">
      <!-- FAQ 1: Privacy -->
      <div class="faq-item">
        <details open>
          <summary>
            <span>Can Marie see my website data, traffic numbers, or client work?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p><strong>No, absolutely not.</strong> I have zero access to your data, your prompts, your GA4 or Search Console metrics, or your private client conversations.</p>
            <p>This MCP server functions as a <em>read-only reference library</em>. When your AI agent (in Claude Desktop, Antigravity, or Cursor) asks for algorithm updates during a specific date window, it only asks my server for the matching public update facts. All of your proprietary traffic data, audit notes, and agent reasoning remain entirely private within your own AI client session.</p>
          </div>
        </details>
      </div>

      <!-- FAQ 2: Pricing -->
      <div class="faq-item">
        <details>
          <summary>
            <span>Does this cost anything to use?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p><strong>No, it is 100% free.</strong> There are no API keys, paywalls, or fees on my end to connect or query this server. Any AI tokens used to retrieve updates and analyze your site are simply covered under your own existing AI subscription (such as Claude Pro/Team, ChatGPT Plus/Pro, or Antigravity).</p>
          </div>
        </details>
      </div>

      <!-- FAQ 3: Why MCP vs Raw LLM? -->
      <div class="faq-item">
        <details>
          <summary>
            <span>Why use this MCP instead of just asking Claude or ChatGPT directly?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>Standard LLMs have knowledge cutoffs and frequently hallucinate exact Google update dates, confuse rollout timelines (e.g., when an update started vs. finished rolling out), or miss unannounced ranking tremors entirely.</p>
            <p>Connecting to my MCP server provides your agent with deterministic, verified facts directly from my 15-year archive (from the original Panda update in 2011 through today's Gemini 3.8 Flash model rollouts and spam updates), eliminating guesswork and hallucinations.</p>
          </div>
        </details>
      </div>

      <!-- FAQ 4: How to diagnose drops -->
      <div class="faq-item">
        <details>
          <summary>
            <span>How can I use this to diagnose a Google traffic or ranking drop?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>Take the date window where you noticed an impression or click decline in Google Search Console or GA4, and ask your agent:</p>
            <div style="margin: 10px 0; padding: 10px 14px; background: #faf8fc; border-left: 3px solid var(--brand-orange); font-size: 0.9rem; color: #333; border-radius: 0 6px 6px 0;">
              <em>"My site had a 30% traffic drop between August 15 and August 28, 2026. What happened in Google search? Please clearly separate Marie Haynes' update data from your own SEO recommendations."</em>
            </div>
            <p>Your agent will automatically call the <code>get_updates_by_date_range</code> tool, review all confirmed and unconfirmed updates in that exact window, and correlate them with your traffic patterns.</p>
          </div>
        </details>
      </div>

      <!-- FAQ 5: Supported platforms -->
      <div class="faq-item">
        <details>
          <summary>
            <span>What platforms and apps can connect to this MCP?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>Any platform supporting the Model Context Protocol (MCP) or standard SSE streams can connect, including:</p>
            <ul style="margin-left: 1.5rem; margin-top: 6px; line-height: 1.6;">
              <li><strong>Claude Desktop</strong> (Mac and Windows)</li>
              <li><strong>Antigravity</strong> (Google's agentic coding assistant)</li>
              <li><strong>Cursor</strong> (AI code editor)</li>
              <li><strong>Claude Code / CLI</strong></li>
              <li><strong>ChatGPT</strong> (Pro/Enterprise/Edu via direct MCP, or ChatGPT Plus via Custom GPT Actions)</li>
              <li>Custom developer agents via our public SSE stream or JSON REST API</li>
            </ul>
          </div>
        </details>
      </div>

      <!-- FAQ 6: Database updates -->
      <div class="faq-item">
        <details>
          <summary>
            <span>How often is the algorithm database updated?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p>I update the database continuously as new Google core updates, spam updates, search quality system shifts, and AI search changes (like Gemini models and AI Mode updates) are confirmed or observed in the industry.</p>
          </div>
        </details>
      </div>

      <!-- FAQ 6: Streamable HTTP vs SSE -->
      <div class="faq-item">
        <details>
          <summary>
            <span>Does this server support the modern Streamable HTTP specification as well as SSE?</span>
            <span class="faq-icon">+</span>
          </summary>
          <div class="faq-answer">
            <p><strong>Yes, fully!</strong> This server natively implements both the modern official <strong>Streamable HTTP</strong> transport standard (at <code>/mcp</code>) and the legacy <strong>HTTP+SSE</strong> transport (at <code>/sse</code> and <code>/messages</code>).</p>
            <p>Streamable HTTP is the modern MCP standard (SEP-2596), unifying communication into a clean single-endpoint streaming model. Because many existing tools (such as Claude Desktop configurations using <code>supergateway --sse</code>) still use SSE, both transports run simultaneously so your agents will always connect seamlessly.</p>
          </div>
        </details>
      </div>
    </div>
  </div>

</div>

<footer>
  <p style="margin-bottom: 0.75rem; font-weight: 700; color: var(--brand-deep-purple); font-size: 1.05rem;">Maintained by Marie Haynes Consulting Inc.</p>
  <div style="display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin-bottom: 1.2rem; font-size: 0.95rem;">
    <a href="https://mariehaynes.com/newsletter" target="_blank" rel="noopener">📬 Marie's Newsletter</a>
    <a href="https://mariehaynes.com/join" target="_blank" rel="noopener">💬 Join Marie's AI & Search Community</a>
    <a href="https://mariehaynes.com/contact" target="_blank" rel="noopener">✉️ Contact Marie</a>
  </div>
  <p style="font-size: 0.82rem; opacity: 0.75;">Original Article & 15-Year Archive: <a href="https://www.mariehaynes.com/resources/algo-changes-and-more/" target="_blank">mariehaynes.com/resources/algo-changes-and-more/</a></p>
</footer>

<script>
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

  event.target.classList.add('active');
  const activePane = document.getElementById('tab-' + tabId);
  if (activePane) activePane.classList.add('active');
}

function copySnippet(elementId) {
  const code = document.getElementById(elementId).innerText;
  navigator.clipboard.writeText(code).then(() => {
    const btn = event.target;
    const orig = btn.innerText;
    btn.innerText = 'Copied!';
    setTimeout(() => { btn.innerText = orig; }, 2000);
  });
}

function toggleSetupBox(forceOpen) {
  const content = document.getElementById('setupCollapsibleContent');
  const text = document.getElementById('setupExpandText');
  const icon = document.getElementById('setupExpandIcon');
  const bar = document.querySelector('.setup-toggle-bar');
  const isCurrentlyOpen = content.style.display !== 'none';
  const shouldOpen = forceOpen !== undefined ? forceOpen : !isCurrentlyOpen;

  if (shouldOpen) {
    content.style.display = 'block';
    if (text) text.innerText = 'Hide Setup Instructions';
    if (icon) icon.innerText = '▲';
    if (bar) bar.setAttribute('aria-expanded', 'true');
    if (forceOpen) {
      document.getElementById('setupBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else {
    content.style.display = 'none';
    if (text) text.innerText = 'Show Setup Instructions';
    if (icon) icon.innerText = '▼';
    if (bar) bar.setAttribute('aria-expanded', 'false');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.location.hash === '#setup' || window.location.hash === '#connect') {
    toggleSetupBox(true);
  }
});
</script>

</body>
</html>`;

  res.send(html);
});

// Start server unless imported in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Marie Haynes Algo Update MCP Server listening on port ${PORT}`);
    console.log(`👉 Web Portal: http://localhost:${PORT}/`);
    console.log(`👉 MCP SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`👉 WebMCP Spec: http://localhost:${PORT}/.well-known/mcp.json`);
    console.log(`👉 REST API Feed: http://localhost:${PORT}/api/updates`);
  });
}

export default app;
