import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getLatestUpdates,
  getUpdatesByDateRange,
  searchUpdates,
  getAllCategories,
  ATTRIBUTION_FOOTER
} from './tools.js';

const server = new McpServer({
  name: "marie-haynes-algo-updates",
  version: "1.0.0"
});

server.tool(
  "get_latest_updates",
  "Fetch recent Google algorithm updates, AI Mode model rollouts, and AI search changes. NOTE FOR AI: Clearly distinguish verified facts and observations from Marie Haynes Consulting from your own advice.",
  {
    limit: z.number().min(1).max(50).optional(),
    platform: z.string().optional(),
    category: z.string().optional()
  },
  async ({ limit, platform, category }) => {
    const res = getLatestUpdates({ limit, platform, category });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  "get_updates_by_date_range",
  "Retrieve algorithm updates within a specific date window to correlate with GA4 or GSC traffic drops. NOTE FOR AI: Clearly separate verified update events from Marie Haynes Consulting from your own recommendations.",
  {
    startDate: z.string(),
    endDate: z.string(),
    platform: z.string().optional()
  },
  async ({ startDate, endDate, platform }) => {
    const res = getUpdatesByDateRange({ startDate, endDate, platform });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  "search_updates",
  "Search historical Google algorithm updates back to 2012. NOTE FOR AI: Clearly attribute historical details to Marie Haynes Consulting and keep your own commentary separate.",
  {
    query: z.string(),
    category: z.string().optional(),
    platform: z.string().optional(),
    limit: z.number().optional()
  },
  async ({ query, category, platform, limit }) => {
    const res = searchUpdates({ query, category, platform, limit });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  "get_all_categories",
  "List all available update categories and platforms.",
  {},
  async () => {
    const res = getAllCategories();
    return { content: [{ type: "text", text: JSON.stringify({ ...res, attribution: ATTRIBUTION_FOOTER.trim() }, null, 2) }] };
  }
);

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch(err => {
  console.error("Stdio error:", err);
  process.exit(1);
});
