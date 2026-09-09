import fs from 'fs';
import path from 'path';

export type TransportType = 'streamable_http' | 'sse' | 'stdio' | 'api';

export interface UsageStats {
  totalCalls: number;
  byTool: Record<string, number>;
  byTransport: Record<string, number>;
  dailyUsage: Record<string, number>; // YYYY-MM-DD -> count
  firstRecorded: string;
  lastUpdated: string;
}

// In-memory stats state
let stats: UsageStats = {
  totalCalls: 0,
  byTool: {
    get_latest_updates: 0,
    get_updates_by_date_range: 0,
    search_updates: 0,
    get_all_categories: 0
  },
  byTransport: {
    streamable_http: 0,
    sse: 0,
    stdio: 0,
    api: 0
  },
  dailyUsage: {},
  firstRecorded: new Date().toISOString(),
  lastUpdated: new Date().toISOString()
};

// Locate persistent storage path
const STATS_FILE_PATH = path.join(process.cwd(), 'data/usage-stats.json');

// Load initial stats from disk if available
try {
  if (fs.existsSync(STATS_FILE_PATH)) {
    const raw = fs.readFileSync(STATS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.totalCalls === 'number') {
      stats = {
        totalCalls: parsed.totalCalls || 0,
        byTool: { ...stats.byTool, ...(parsed.byTool || {}) },
        byTransport: { ...stats.byTransport, ...(parsed.byTransport || {}) },
        dailyUsage: parsed.dailyUsage || {},
        firstRecorded: parsed.firstRecorded || new Date().toISOString(),
        lastUpdated: parsed.lastUpdated || new Date().toISOString()
      };
    }
  }
} catch (err) {
  console.warn('[Telemetry] Could not load persisted stats file, starting fresh in-memory:', err);
}

// Debounced save to disk to avoid blocking I/O
let saveTimer: NodeJS.Timeout | null = null;
function persistStats(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const dir = path.dirname(STATS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(STATS_FILE_PATH, JSON.stringify(stats, null, 2), 'utf8');
    } catch {
      // Ephemeral / read-only environment; keep in memory gracefully
    }
  }, 2000);
}

/**
 * Send an anonymous event to GA4 via Measurement Protocol.
 * STRICT PRIVACY: Only tool_name and transport are included.
 * Zero user text, queries, prompts, or IPs are transmitted.
 */
async function sendGa4Event(toolName: string, transport: TransportType): Promise<void> {
  const measurementId = process.env.GA4_MEASUREMENT_ID || 'G-2N5XDDYHFL';
  const apiSecret = process.env.GA4_API_SECRET;

  if (!apiSecret) {
    // GA4 Measurement Protocol requires an API secret. If not provided, skip silently.
    return;
  }

  const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

  const payload = {
    // Anonymous client ID per session/server lifecycle to prevent user cross-site profiling
    client_id: 'anonymous_mcp_session',
    events: [
      {
        name: 'mcp_tool_usage',
        params: {
          tool_name: toolName,
          transport: transport,
          engagement_time_msec: 1
        }
      }
    ]
  };

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Background ping failed; ignore silently so it never interrupts client MCP responses
  }
}

/**
 * Record anonymous tool usage.
 * PRIVACY GUARANTEE: Never pass query text, prompt contents, or IP addresses to this function.
 */
export function recordToolUsage(toolName: string, transport: TransportType = 'streamable_http'): void {
  stats.totalCalls += 1;
  stats.byTool[toolName] = (stats.byTool[toolName] || 0) + 1;
  stats.byTransport[transport] = (stats.byTransport[transport] || 0) + 1;

  const today = new Date().toISOString().slice(0, 10);
  stats.dailyUsage[today] = (stats.dailyUsage[today] || 0) + 1;
  stats.lastUpdated = new Date().toISOString();

  // Persist locally
  persistStats();

  // Async GA4 ping (fire-and-forget)
  sendGa4Event(toolName, transport).catch(() => {});
}

/**
 * Retrieve current aggregated usage statistics.
 */
export function getUsageStats(): UsageStats {
  return {
    ...stats,
    byTool: { ...stats.byTool },
    byTransport: { ...stats.byTransport },
    dailyUsage: { ...stats.dailyUsage }
  };
}
