import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';

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
    get_all_categories: 0,
    api_updates: 0
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

// Initialize Firestore client
let firestoreDb: Firestore | null = null;
try {
  const firestoreOpts: any = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'mhc-news-portal'
  };
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      let keyString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (keyString.startsWith("'") && keyString.endsWith("'")) {
        keyString = keyString.slice(1, -1);
      }
      const sa = JSON.parse(keyString);
      firestoreOpts.credentials = {
        client_email: sa.client_email,
        private_key: sa.private_key
      };
    } catch (e) {}
  }
  firestoreDb = new Firestore(firestoreOpts);
} catch (err) {
  console.warn('[Telemetry] Firestore client not initialized, using local fallback:', err);
}

let isInitialized = false;

let lastFetchTime = 0;
const SYNC_INTERVAL_MS = 60000;

// Load initial stats from Firestore (or disk fallback)
export async function initTelemetry(force = false): Promise<void> {
  const now = Date.now();
  if (isInitialized && !force && (now - lastFetchTime < SYNC_INTERVAL_MS)) {
    return;
  }
  if (saveTimer !== null) {
    // A local write is pending debounce, do not overwrite in-memory state with stale remote read
    return;
  }
  lastFetchTime = now;

  if (firestoreDb) {
    try {
      const docRef = firestoreDb.collection('system').doc('algo_mcp_stats');
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data();
        if (data && typeof data.totalCalls === 'number') {
          let byTool = { ...stats.byTool, ...(data.byTool || {}) };
          let byTransport = { ...stats.byTransport, ...(data.byTransport || {}) };
          let totalCalls = data.totalCalls || 0;
          let dailyUsage = { ...(data.dailyUsage || {}) };

          // One-time legacy cleanup: prune pre-patch spotlight widget polling
          if ((byTool.api_updates || 0) > 20) {
            const legacyInflated = byTool.api_updates;
            totalCalls = Math.max(0, totalCalls - legacyInflated);
            byTool.api_updates = 0;
            byTransport.api = 0;
            for (const d of ['2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21']) {
              if (dailyUsage[d] && dailyUsage[d] > 20) {
                dailyUsage[d] = 3;
              }
            }
            persistStats();
          }

          if (isInitialized) {
            // Periodic sync: take max between remote and local to prevent clobbering or duplicating
            for (const k of Object.keys(byTool)) {
              byTool[k] = Math.max(byTool[k] || 0, stats.byTool[k] || 0);
            }
            for (const k of Object.keys(byTransport)) {
              byTransport[k] = Math.max(byTransport[k] || 0, stats.byTransport[k] || 0);
            }
            totalCalls = Math.max(totalCalls, stats.totalCalls);
          } else {
            // First load: merge any in-memory calls that arrived while waiting for Firestore
            for (const [k, v] of Object.entries(stats.byTool)) {
              byTool[k] = (byTool[k] || 0) + (v || 0);
            }
            for (const [k, v] of Object.entries(stats.byTransport)) {
              byTransport[k] = (byTransport[k] || 0) + (v || 0);
            }
            totalCalls += stats.totalCalls;
          }

          stats = {
            totalCalls,
            byTool,
            byTransport,
            dailyUsage,
            firstRecorded: data.firstRecorded || stats.firstRecorded,
            lastUpdated: data.lastUpdated || stats.lastUpdated
          };
          isInitialized = true;
          console.log(`[Telemetry] Loaded ${stats.totalCalls} historical queries from Firestore.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[Telemetry] Error reading stats from Firestore:', err);
    }
  }

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
          firstRecorded: parsed.firstRecorded || stats.firstRecorded,
          lastUpdated: parsed.lastUpdated || stats.lastUpdated
        };
        isInitialized = true;
      }
    }
  } catch (err) {
    console.warn('[Telemetry] Could not load persisted stats file, starting fresh in-memory:', err);
  }
}

// Auto-run init in background on module load
initTelemetry().catch(() => {});

// Debounced save to Firestore and disk to avoid blocking I/O
let saveTimer: NodeJS.Timeout | null = null;
function persistStats(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;

    // 1. Persist to Firestore
    if (firestoreDb) {
      try {
        const docRef = firestoreDb.collection('system').doc('algo_mcp_stats');
        await docRef.set(stats, { merge: true });
      } catch (err) {
        console.warn('[Telemetry] Failed to persist stats to Firestore:', err);
      }
    }

    // 2. Persist to local disk
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
