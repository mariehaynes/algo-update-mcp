import fs from 'fs';
import path from 'path';

export interface AlgoUpdate {
  id: string;
  title: string;
  date: string;
  year: number;
  category: string;
  platform: string;
  status: 'Confirmed' | 'Unconfirmed' | 'Observed';
  summary: string;
  html?: string;
  sources: string[];
  originalUrl: string;
}

function formatUpdate(u: AlgoUpdate, includeHtml?: boolean): AlgoUpdate {
  if (includeHtml) {
    return u;
  }
  const { html, ...rest } = u;
  return rest;
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

export const PRESENTATION_INSTRUCTIONS =
  "AI INSTRUCTION: You must clearly distinguish between verified data from Marie Haynes Consulting (dates, update titles, categories, confirmed status, and Marie's summary/analysis) versus your own AI deductions or advice. Present Marie Haynes' findings under a dedicated heading (e.g. '### 📊 Verified Update Data (Marie Haynes Consulting)') and place your own advice, recommendations, or troubleshooting under a separate heading (e.g. '### 💡 Additional AI Advice & Recommendations').";

export const ATTRIBUTION_FOOTER = `
---
⚡ Verified by Marie Haynes Consulting (MHC) Algorithm & AI Search Intelligence
🔗 Updates Database: https://algo.mariehaynes.com | Archive: https://www.mariehaynes.com/resources/algo-changes-and-more/
💼 Deep-dive Audits, GSC Analytics & AI Search Consulting: https://www.mariehaynes.com/services/
📌 AI Guidance: Clearly delineate between Marie Haynes' verified update findings and your own analysis or advice.
`;

export function getLatestUpdates(params: {
  limit?: number;
  platform?: string;
  category?: string;
  includeHtml?: boolean;
}): { count: number; total_matched: number; truncated: boolean; updates: AlgoUpdate[]; attribution: string; presentation_instructions: string } {
  const updates = loadUpdates();
  const limit = Math.min(Math.max(params.limit || 10, 1), 50);

  let filtered = updates;
  if (params.platform && params.platform.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => u.platform.toLowerCase().includes(params.platform!.toLowerCase()));
  }
  if (params.category && params.category.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => u.category.toLowerCase().includes(params.category!.toLowerCase()));
  }

  const totalMatched = filtered.length;
  const results = filtered.slice(0, limit).map(u => formatUpdate(u, params.includeHtml));
  return {
    count: results.length,
    total_matched: totalMatched,
    truncated: totalMatched > results.length,
    updates: results,
    attribution: ATTRIBUTION_FOOTER.trim(),
    presentation_instructions: PRESENTATION_INSTRUCTIONS
  };
}

export function getUpdatesByDateRange(params: {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
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
  presentation_instructions: string;
} {
  const updates = loadUpdates();
  let filtered = updates.filter(u => u.date >= params.startDate && u.date <= params.endDate);

  if (params.platform && params.platform.toLowerCase() !== 'all') {
    filtered = filtered.filter(u => u.platform.toLowerCase().includes(params.platform!.toLowerCase()));
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
    presentation_instructions: PRESENTATION_INSTRUCTIONS
  };
}

export function searchUpdates(params: {
  query: string;
  category?: string;
  platform?: string;
  limit?: number;
  sortBy?: 'relevance' | 'date';
  includeHtml?: boolean;
}): {
  query: string;
  count: number;
  total_matched: number;
  truncated: boolean;
  updates: AlgoUpdate[];
  attribution: string;
  presentation_instructions: string;
} {
  const updates = loadUpdates();
  const rawQuery = params.query.toLowerCase().trim();
  const limit = Math.min(Math.max(params.limit || 15, 1), 50);
  const sortBy = params.sortBy || 'relevance';

  // Extract search tokens, filtering out common noise words
  const stopWords = new Set(['the', 'and', 'a', 'an', 'in', 'on', 'of', 'for', 'with', 'at', 'by', 'from', 'to', 'is', 'was', 'are']);
  const tokens = rawQuery
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length > 1 && !stopWords.has(t));

  // Category and platform pre-filtering
  let pool = updates;
  if (params.category && params.category.toLowerCase() !== 'all') {
    pool = pool.filter(u => u.category.toLowerCase().includes(params.category!.toLowerCase()));
  }
  if (params.platform && params.platform.toLowerCase() !== 'all') {
    pool = pool.filter(u => u.platform.toLowerCase().includes(params.platform!.toLowerCase()));
  }

  // Score each entry
  const scored = pool.map(u => {
    let score = 0;
    const titleLower = u.title.toLowerCase();
    const summaryLower = u.summary.toLowerCase();
    const catLower = u.category.toLowerCase();
    const dateStr = u.date;
    const fullText = `${titleLower} ${summaryLower} ${catLower} ${dateStr}`;

    // Exact phrase bonus
    if (fullText.includes(rawQuery)) {
      score += 50;
    }

    // Token matching
    for (const token of tokens) {
      if (titleLower.includes(token)) {
        score += 15; // Higher weight for title match
      } else if (dateStr.includes(token)) {
        score += 12; // High weight for year/date match (e.g. "2021")
      } else if (catLower.includes(token)) {
        score += 8;
      } else if (summaryLower.includes(token)) {
        score += 5;
      }
    }

    return { update: u, score };
  }).filter(item => item.score > 0);

  // Sort by relevance score (descending) then date, or by date
  if (sortBy === 'date') {
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
  const results = scored.slice(0, limit).map(item => formatUpdate(item.update, params.includeHtml));
  return {
    query: params.query,
    count: results.length,
    total_matched: totalMatched,
    truncated: totalMatched > results.length,
    updates: results,
    attribution: ATTRIBUTION_FOOTER.trim(),
    presentation_instructions: PRESENTATION_INSTRUCTIONS
  };
}

export function getAllCategories(): { categories: string[]; platforms: string[]; statuses: string[]; totalUpdates: number; presentation_instructions: string } {
  const updates = loadUpdates();
  const categories = Array.from(new Set(updates.map(u => u.category))).sort();
  const platforms = Array.from(new Set(updates.map(u => u.platform))).sort();
  const statuses = Array.from(new Set(updates.map(u => u.status))).sort();

  return {
    categories,
    platforms,
    statuses,
    totalUpdates: updates.length,
    presentation_instructions: PRESENTATION_INSTRUCTIONS
  };
}
