import fs from 'fs';
import path from 'path';
import { Firestore } from '@google-cloud/firestore';

export interface AlgoUpdate {
  id: string;
  title: string;
  date: string;
  rolloutEnd?: string;
  year: number;
  category: string;
  platform: string;
  status: 'Confirmed' | 'Unconfirmed' | 'Observed';
  summary: string;
  html?: string;
  sources: string[];
  originalUrl: string;
  source: string;
  relevance_score?: number;
}

function formatUpdate(u: AlgoUpdate, includeHtml?: boolean): AlgoUpdate {
  if (includeHtml) {
    return u;
  }
  const { html, ...rest } = u;
  return rest;
}

function matchesPlatform(itemPlatform: string, filterPlatform?: string): boolean {
  if (!filterPlatform || filterPlatform.toLowerCase() === 'all') return true;
  const pQuery = filterPlatform.toLowerCase().trim();
  const uPlat = itemPlatform.toLowerCase();
  if (uPlat.includes(pQuery)) return true;
  if ((pQuery.includes('chatgpt') || pQuery.includes('openai')) && (uPlat.includes('chatgpt') || uPlat.includes('openai'))) {
    return true;
  }
  if (pQuery.includes('google') && uPlat.includes('google')) {
    return true;
  }
  return false;
}

const DATA_PATHS = [
  // Full archive (loaded in production if present; excluded from git)
  path.join(process.cwd(), 'data/full-archive.json'),
  path.join(process.cwd(), 'dist/data/full-archive.json'),
  path.join(process.cwd(), 'src/data/full-archive.json'),
  path.join(__dirname, 'data/full-archive.json'),
  path.join(__dirname, '../data/full-archive.json'),
  path.join(__dirname, '../src/data/full-archive.json'),

  // Standard/Sample archive (bundled with open source repo)
  path.join(process.cwd(), 'data/algo-updates.json'),
  path.join(process.cwd(), 'dist/data/algo-updates.json'),
  path.join(process.cwd(), 'src/data/algo-updates.json'),
  path.join(__dirname, 'data/algo-updates.json'),
  path.join(__dirname, '../data/algo-updates.json'),
  path.join(__dirname, '../src/data/algo-updates.json'),
];

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
  console.warn('[Tools] Firestore client initialization skipped:', err);
}

let cachedUpdates: AlgoUpdate[] | null = null;
let lastFirestoreSyncTime = 0;
const FIRESTORE_SYNC_TTL_MS = 60000; // 60 seconds TTL
let isSyncingFirestore = false;

export function cleanSourceUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let url = raw.trim();
  if (url.includes('](')) {
    const parts = url.split('](');
    const dest = parts[parts.length - 1].replace(/^[\(]+/, '').replace(/[\)]+$/, '').trim();
    if (dest.startsWith('http')) {
      url = dest;
    } else {
      url = parts[0];
    }
  }
  const fullMdMatch = url.match(/\[(?:[^\]]*)\]\((https?:\/\/[^\s\)\"\'<>]+)\)/i);
  if (fullMdMatch) {
    url = fullMdMatch[1];
  }
  url = url.replace(/^[\[\(]+/, '');
  url = url.replace(/[.,;:\]\)\>\"\'\s]+$/, '').trim();
  return url;
}

export function loadBaseUpdatesFromDisk(): AlgoUpdate[] {
  for (const p of DATA_PATHS) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed: AlgoUpdate[] = JSON.parse(raw);
        const mapped = parsed.map(u => ({
          ...u,
          source: u.source || 'Marie Haynes Consulting',
          sources: Array.from(new Set((u.sources || []).map(cleanSourceUrl).filter(s => s && s.startsWith('http')))),
          originalUrl: cleanSourceUrl(u.originalUrl || '')
        }));
        console.log(`✅ Loaded ${mapped.length} updates from: ${p}`);
        return mapped;
      } catch (e) {
        console.error(`Error reading ${p}:`, e);
      }
    }
  }
  console.warn('⚠️ Could not find algo-updates.json in any of the search paths:', DATA_PATHS);
  return [];
}

export function mergeFirestoreUpdates(recentUpdates: any[]): void {
  if (!cachedUpdates) {
    cachedUpdates = loadBaseUpdatesFromDisk();
  }
  if (!recentUpdates || !Array.isArray(recentUpdates) || recentUpdates.length === 0) {
    return;
  }

  const map = new Map<string, AlgoUpdate>();
  for (const u of cachedUpdates) {
    map.set(u.id, u);
  }

  for (const item of recentUpdates) {
    if (!item || !item.id) continue;
    const cleanU: AlgoUpdate = {
      id: item.id,
      title: item.title,
      date: item.date,
      year: item.year || (item.date ? parseInt(item.date.split('-')[0], 10) : 2026),
      category: item.category || 'Search Algorithm Update',
      platform: item.platform || 'Google Search',
      status: item.status || 'Confirmed',
      summary: item.summary || '',
      html: item.html || `<strong>${item.date}</strong>: <strong>${item.title}</strong>. ${item.summary || ''}`,
      sources: Array.from(new Set((item.sources || []).map(cleanSourceUrl).filter((s: string) => s && s.startsWith('http')))),
      originalUrl: cleanSourceUrl(item.originalUrl || `https://www.mariehaynes.com/resources/algo-changes-and-more/#${item.id}`),
      source: item.source || 'Marie Haynes Consulting',
      rolloutEnd: item.rolloutEnd
    };
    map.set(item.id, cleanU);
  }

  const combined = Array.from(map.values());
  combined.sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (diff !== 0) return diff;
    return (b.id || '').localeCompare(a.id || '');
  });

  cachedUpdates = combined;
  lastFirestoreSyncTime = Date.now();
}

export async function syncUpdatesFromFirestore(): Promise<boolean> {
  if (!firestoreDb) return false;
  if (isSyncingFirestore) return false;
  isSyncingFirestore = true;
  try {
    const docRef = firestoreDb.collection('system').doc('algo_recent_updates');
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data();
      if (data && Array.isArray(data.updates)) {
        mergeFirestoreUpdates(data.updates);
        return true;
      }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Tools] Dynamic Firestore sync skipped/failed:', err.message || err);
    }
  } finally {
    isSyncingFirestore = false;
  }
  return false;
}

export async function refreshUpdatesCache(): Promise<{ count: number; synced: boolean }> {
  const synced = await syncUpdatesFromFirestore();
  const updates = loadUpdates();
  return { count: updates.length, synced };
}

let periodicSyncTimer: NodeJS.Timeout | null = null;
export function startPeriodicSync(intervalMs: number = 60000): void {
  if (periodicSyncTimer) return;
  syncUpdatesFromFirestore().catch(() => {});
  periodicSyncTimer = setInterval(() => {
    syncUpdatesFromFirestore().catch(() => {});
  }, intervalMs);
  if (periodicSyncTimer && typeof periodicSyncTimer.unref === 'function') {
    periodicSyncTimer.unref();
  }
}

export function loadUpdates(): AlgoUpdate[] {
  if (!cachedUpdates) {
    cachedUpdates = loadBaseUpdatesFromDisk();
    // Trigger background sync if not yet run
    if (Date.now() - lastFirestoreSyncTime > FIRESTORE_SYNC_TTL_MS) {
      syncUpdatesFromFirestore().catch(() => {});
    }
  } else if (Date.now() - lastFirestoreSyncTime > FIRESTORE_SYNC_TTL_MS) {
    // Refresh in background if TTL expired
    syncUpdatesFromFirestore().catch(() => {});
  }
  return cachedUpdates;
}

export const DATA_DISCLAIMER = "Compiled and curated by Marie Haynes Consulting Inc. for informational, diagnostic, and educational research. Free for personal, client, and conversational AI analysis with attribution. Automated bulk scraping, commercial redistribution, or resale of this proprietary dataset is strictly prohibited. Update timelines do not constitute guaranteed ranking recovery advice.";
export const TERMS_URL = "https://algo.mariehaynes.com/#terms";

export const ATTRIBUTION_FOOTER = `
---
⚡ Verified by Marie Haynes Consulting (MHC) Algorithm & AI Search Intelligence
🔗 Updates Database: https://algo.mariehaynes.com | Archive: https://www.mariehaynes.com/resources/algo-changes-and-more/
📜 Data Terms & Attribution: Free for conversational AI and client advisory with attribution to Marie Haynes Consulting. Commercial bulk scraping, redistribution, or resale of this proprietary dataset is prohibited.
`;

export function getLatestUpdates(params: {
  limit?: number;
  offset?: number;
  platform?: string;
  category?: string;
  includeHtml?: boolean;
}): {
  count: number;
  total_matched: number;
  offset: number;
  next_offset: number | null;
  truncated: boolean;
  is_exhaustive: boolean;
  updates: AlgoUpdate[];
  attribution: string;
  disclaimer: string;
  terms: string;
} {
  const updates = loadUpdates();
  const limit = Math.min(Math.max(params.limit || 10, 1), 50);
  const offset = Math.max(params.offset || 0, 0);

  let filtered = updates;
  if (params.platform && params.platform.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => matchesPlatform(u.platform, params.platform));
  }
  if (params.category && params.category.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => u.category.toLowerCase().includes(params.category!.toLowerCase()));
  }

  const totalMatched = filtered.length;
  const sliced = filtered.slice(offset, offset + limit);
  const results = sliced.map(u => formatUpdate(u, params.includeHtml));
  const nextOffset = offset + results.length < totalMatched ? offset + results.length : null;

  return {
    count: results.length,
    total_matched: totalMatched,
    offset,
    next_offset: nextOffset,
    truncated: nextOffset !== null,
    is_exhaustive: offset === 0 && totalMatched === results.length,
    updates: results,
    attribution: ATTRIBUTION_FOOTER.trim(),
    disclaimer: DATA_DISCLAIMER,
    terms: TERMS_URL
  };
}

export function getUpdatesByDateRange(params: {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  category?: string;
  platform?: string;
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
  includeHtml?: boolean;
}): {
  count: number;
  total_matched: number;
  offset: number;
  next_offset: number | null;
  truncated: boolean;
  is_exhaustive: boolean;
  dateRange: { start: string; end: string };
  updates: AlgoUpdate[];
  attribution: string;
  disclaimer: string;
  terms: string;
} {
  const updates = loadUpdates();
  // Match by interval overlap: an update overlaps the window if its start <= queryEnd and its effective end (rolloutEnd or date) >= queryStart
  let filtered = updates.filter(u => {
    const effectiveStart = u.date;
    const effectiveEnd = u.rolloutEnd || u.date;
    return effectiveStart <= params.endDate && effectiveEnd >= params.startDate;
  });

  if (params.category && params.category.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => u.category.toLowerCase().includes(params.category!.toLowerCase()));
  }

  if (params.platform && params.platform.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => matchesPlatform(u.platform, params.platform));
  }

  // Sort chronological: default 'asc' (oldest-first) so when diagnosing drops starting at startDate,
  // the earliest, most critical updates are returned first and truncation only cuts the recent tail.
  const sortOrder = params.sortOrder || 'asc';
  filtered.sort((a, b) => {
    return sortOrder === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
  });

  const limit = params.limit ? Math.min(Math.max(params.limit, 1), 200) : 100;
  const offset = Math.max(params.offset || 0, 0);
  const totalMatched = filtered.length;
  const sliced = filtered.slice(offset, offset + limit);
  const results = sliced.map(u => formatUpdate(u, params.includeHtml));
  const nextOffset = offset + results.length < totalMatched ? offset + results.length : null;

  return {
    count: results.length,
    total_matched: totalMatched,
    offset,
    next_offset: nextOffset,
    truncated: nextOffset !== null,
    is_exhaustive: offset === 0 && totalMatched === results.length,
    dateRange: { start: params.startDate, end: params.endDate },
    updates: results,
    attribution: ATTRIBUTION_FOOTER.trim(),
    disclaimer: DATA_DISCLAIMER,
    terms: TERMS_URL
  };
}

export function searchUpdates(params: {
  query?: string;
  category?: string;
  platform?: string;
  limit?: number;
  offset?: number;
  minRelevance?: number;
  sortBy?: 'relevance' | 'date';
  includeHtml?: boolean;
}): {
  query: string;
  count: number;
  total_matched: number;
  offset: number;
  next_offset: number | null;
  truncated: boolean;
  is_exhaustive: boolean;
  updates: AlgoUpdate[];
  attribution: string;
  disclaimer: string;
  terms: string;
} {
  const updates = loadUpdates();
  const rawQuery = (params.query || '').toLowerCase().trim();
  const hasQuery = rawQuery.length > 0 && rawQuery !== '*';
  const limit = Math.min(Math.max(params.limit || 15, 1), 50);
  const offset = Math.max(params.offset || 0, 0);
  const sortBy = params.sortBy || 'relevance';

  // Category and platform pre-filtering
  let pool = updates;
  if (params.category && params.category.toLowerCase() !== 'all') {
    pool = pool.filter(u => u.category.toLowerCase().includes(params.category!.toLowerCase()));
  }
  if (params.platform && params.platform.toLowerCase() !== 'all') {
    pool = pool.filter(u => matchesPlatform(u.platform, params.platform));
  }

  let scored: { update: AlgoUpdate; score: number; matchedEffectiveCount: number; qualified: boolean }[];

  if (!hasQuery) {
    // When no query is provided (or query is '*'), all entries in the category/platform pool qualify
    scored = pool.map(u => ({
      update: {
        ...u,
        relevance_score: 100
      },
      score: 100,
      matchedEffectiveCount: 0,
      qualified: true
    }));
  } else {
    // Extract search tokens, distinguishing domain noise words from specific intent terms
    const stopWords = new Set(['the', 'and', 'a', 'an', 'in', 'on', 'of', 'for', 'with', 'at', 'by', 'from', 'to', 'is', 'was', 'are']);
    const genericWords = new Set(['update', 'updates', 'algorithm', 'algo', 'google', 'search']);

    const allTokens = rawQuery
      .split(/[^a-z0-9]+/i)
      .filter(t => t.length > 1 && !stopWords.has(t));

    const specificTokens = allTokens.filter(t => !genericWords.has(t));
    const effectiveTokens = specificTokens.length > 0 ? specificTokens : allTokens;

    // Score each entry
    scored = pool.map(u => {
      let score = 0;
      const titleLower = u.title.toLowerCase();
      const summaryLower = u.summary.toLowerCase();
      const catLower = u.category.toLowerCase();
      const dateStr = u.date;
      const fullText = `${titleLower} ${summaryLower} ${catLower} ${dateStr}`;

      // Exact phrase bonus
      const exactMatch = fullText.includes(rawQuery);
      if (exactMatch) score += 60;
      if (titleLower.includes(rawQuery)) score += 40;

      // Token matching across specific / effective tokens
      let matchedEffectiveCount = 0;
      for (const t of effectiveTokens) {
        let tokenMatched = false;
        if (titleLower.includes(t)) {
          score += 25; // Higher weight for title match
          tokenMatched = true;
        } else if (dateStr.includes(t)) {
          score += 20; // High weight for year/date match (e.g. "2026")
          tokenMatched = true;
        } else if (catLower.includes(t)) {
          score += 15;
          tokenMatched = true;
        } else if (summaryLower.includes(t)) {
          score += 8;
          tokenMatched = true;
        }
        if (tokenMatched) matchedEffectiveCount++;
      }

      // Minor weight for generic words in title (e.g. "Spam Update" vs "Spam")
      for (const t of allTokens) {
        if (genericWords.has(t) && titleLower.includes(t)) {
          score += 3;
        }
      }

      // Qualification threshold:
      // Avoid loose OR-matching on every single word (e.g. "update" matching 480/556 entries)
      let qualified = false;
      if (exactMatch) {
        qualified = true;
      } else if (effectiveTokens.length === 1) {
        qualified = matchedEffectiveCount >= 1;
      } else if (effectiveTokens.length === 2) {
        qualified = matchedEffectiveCount >= 2 || (matchedEffectiveCount >= 1 && score >= 25);
      } else {
        qualified = matchedEffectiveCount >= Math.min(effectiveTokens.length, Math.max(2, Math.ceil(effectiveTokens.length * 0.6)));
      }

      const updateWithScore: AlgoUpdate = {
        ...u,
        relevance_score: score
      };

      return { update: updateWithScore, score, matchedEffectiveCount, qualified };
    }).filter(item => item.qualified && item.score > 0);
  }

  // Optional minRelevance filter (honoured uniformly by all sort modes)
  if (params.minRelevance !== undefined && params.minRelevance > 0) {
    scored = scored.filter(s => s.score >= params.minRelevance!);
  }

  // Sorting:
  if (sortBy === 'date' || !hasQuery) {
    scored.sort((a, b) => b.update.date.localeCompare(a.update.date));
  } else {
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.update.date.localeCompare(a.update.date);
    });
  }

  const totalMatched = scored.length;
  const sliced = scored.slice(offset, offset + limit);
  const results = sliced.map(item => formatUpdate(item.update, params.includeHtml));
  const nextOffset = offset + results.length < totalMatched ? offset + results.length : null;

  return {
    query: params.query || (params.category ? `category:${params.category}` : (params.platform ? `platform:${params.platform}` : 'all')),
    count: results.length,
    total_matched: totalMatched,
    offset,
    next_offset: nextOffset,
    truncated: nextOffset !== null,
    is_exhaustive: offset === 0 && totalMatched === results.length,
    updates: results,
    attribution: ATTRIBUTION_FOOTER.trim(),
    disclaimer: DATA_DISCLAIMER,
    terms: TERMS_URL
  };
}

export function getAllCategories(): {
  categories: string[];
  categoryCounts: Record<string, number>;
  platforms: string[];
  platformCounts: Record<string, number>;
  statuses: string[];
  statusCounts: Record<string, number>;
  totalUpdates: number;
} {
  const updates = loadUpdates();
  const categories = Array.from(new Set(updates.map(u => u.category))).sort();
  const platforms = Array.from(new Set(updates.map(u => u.platform))).sort();
  const statuses = Array.from(new Set(updates.map(u => u.status))).sort();

  const categoryCounts: Record<string, number> = {};
  for (const c of categories) categoryCounts[c] = 0;
  for (const u of updates) categoryCounts[u.category] = (categoryCounts[u.category] || 0) + 1;

  const platformCounts: Record<string, number> = {};
  for (const p of platforms) platformCounts[p] = 0;
  for (const u of updates) platformCounts[u.platform] = (platformCounts[u.platform] || 0) + 1;

  const statusCounts: Record<string, number> = {};
  for (const s of statuses) statusCounts[s] = 0;
  for (const u of updates) statusCounts[u.status] = (statusCounts[u.status] || 0) + 1;

  return {
    categories,
    categoryCounts,
    platforms,
    platformCounts,
    statuses,
    statusCounts,
    totalUpdates: updates.length
  };
}
