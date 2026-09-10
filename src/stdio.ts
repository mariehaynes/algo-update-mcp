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
import { recordToolUsage } from './telemetry.js';

const server = new McpServer({
  name: "marie-haynes-algo-updates",
  version: "1.0.0"
});

server.tool(
  "get_latest_updates",
  "Fetch recent Google algorithm updates, AI Mode model rollouts, and AI search changes. NOTE FOR AI: Clearly distinguish verified facts and observations from Marie Haynes Consulting from your own advice.",
  {
    limit: z.number().optional(),
    platform: z.string().optional(),
    category: z.string().optional(),
    includeHtml: z.boolean().optional()
  },
  async ({ limit, platform, category, includeHtml }) => {
    recordToolUsage("get_latest_updates", "stdio");
    const res = getLatestUpdates({ limit, platform, category, includeHtml });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  "get_updates_by_date_range",
  "Retrieve algorithm updates within a specific date window to correlate with GA4 or GSC traffic drops. Defaults to chronological oldest-first order and limit 100 with pagination support. NOTE FOR AI: Clearly separate verified update events from Marie Haynes Consulting from your own recommendations.",
  {
    startDate: z.string(),
    endDate: z.string(),
    platform: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    includeHtml: z.boolean().optional()
  },
  async ({ startDate, endDate, platform, limit, offset, sortOrder, includeHtml }) => {
    recordToolUsage("get_updates_by_date_range", "stdio");
    const res = getUpdatesByDateRange({ startDate, endDate, platform, limit, offset, sortOrder, includeHtml });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  "search_updates",
  "Search historical Google algorithm updates back to 2011. NOTE FOR AI: Clearly attribute historical details to Marie Haynes Consulting and keep your own commentary separate.",
  {
    query: z.string(),
    category: z.string().optional(),
    platform: z.string().optional(),
    limit: z.number().optional(),
    includeHtml: z.boolean().optional()
  },
  async ({ query, category, platform, limit, includeHtml }) => {
    recordToolUsage("search_updates", "stdio");
    const res = searchUpdates({ query, category, platform, limit, includeHtml });
    return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
  }
);

server.tool(
  "get_all_categories",
  "List all available update categories and platforms.",
  {},
  async () => {
    recordToolUsage("get_all_categories", "stdio");
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
