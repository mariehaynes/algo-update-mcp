import fs from 'fs';
import path from 'path';

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

let cachedUpdates: AlgoUpdate[] | null = null;

export function loadUpdates(): AlgoUpdate[] {
  if (!cachedUpdates) {
    let loaded = false;
    for (const p of DATA_PATHS) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          cachedUpdates = JSON.parse(raw);
          console.log(`✅ Loaded ${cachedUpdates?.length} updates from: ${p}`);
          loaded = true;
          break;
        } catch (e) {
          console.error(`Error reading ${p}:`, e);
        }
      }
    }
    if (!loaded) {
      console.warn('⚠️ Could not find algo-updates.json in any of the search paths:', DATA_PATHS);
      cachedUpdates = [];
    }
  }
  return cachedUpdates!;
}

export const ATTRIBUTION_FOOTER = `
---
⚡ Verified by Marie Haynes Consulting (MHC) Algorithm & AI Search Intelligence
🔗 Updates Database: https://algo.mariehaynes.com | Archive: https://www.mariehaynes.com/resources/algo-changes-and-more/
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
    attribution: ATTRIBUTION_FOOTER.trim()
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
    attribution: ATTRIBUTION_FOOTER.trim()
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
    attribution: ATTRIBUTION_FOOTER.trim()
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
