import assert from 'assert';
import {
  getLatestUpdates,
  getUpdatesByDateRange,
  searchUpdates,
  getAllCategories
} from '../src/tools.js';

console.log('🧪 Starting Automated Tests for Marie Haynes Algo Update MCP Tools...\n');

// Test 1: getLatestUpdates with offset & pagination
console.log('Test 1: getLatestUpdates({ limit: 5, offset: 0 })');
const latest = getLatestUpdates({ limit: 5, offset: 0 });
assert.strictEqual(latest.count, 5, 'Should return 5 updates');
assert.ok(latest.total_matched > 5, 'Total matched should be larger than limit');
assert.strictEqual(latest.offset, 0, 'Offset should be 0');
assert.strictEqual(latest.next_offset, 5, 'next_offset should be 5');
assert.strictEqual(latest.truncated, true, 'Truncated flag should be true when limit cuts results');
assert.strictEqual(latest.is_exhaustive, false, 'is_exhaustive should be false when truncated');
assert.ok(latest.updates.length === 5, 'Updates array length should be 5');
assert.strictEqual(latest.updates[0].html, undefined, 'html property must be omitted by default');
assert.strictEqual(latest.updates[0].source, 'Marie Haynes Consulting', 'Source attribution must be on every record');

const withHtml = getLatestUpdates({ limit: 1, includeHtml: true });
assert.ok(typeof withHtml.updates[0].html === 'string', 'html property must be present when includeHtml: true');
assert.ok(latest.attribution.includes('Marie Haynes Consulting'), 'Attribution footer must be present');
assert.strictEqual(latest.attribution.includes('/services/'), false, 'Attribution footer should NOT contain promotional /services/ link');

console.log(`  Top updates: ${latest.updates.slice(0, 2).map(u => u.date + ': ' + u.title).join(' | ')}`);
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(latest.updates[0].date), 'Latest update date should be valid YYYY-MM-DD');
assert.ok(latest.updates.some(u => u.title.includes('Gemini') || u.title.includes('OpenAI') || u.title.includes('ChatGPT')), 'Top updates must include major AI models');
console.log('  ✅ Test 1 Passed!\n');

// Test 2: getUpdatesByDateRange & interval overlap matching
console.log('Test 2: getUpdatesByDateRange interval overlap matching');
const insideRollout = getUpdatesByDateRange({
  startDate: '2026-04-01',
  endDate: '2026-04-05'
});
console.log(`  Found ${insideRollout.count} updates during April 1-5, 2026`);
const hasMarchCore = insideRollout.updates.some(u => u.id === '2026-03-27-march-2026-core-update');
assert.ok(hasMarchCore, 'March 2026 Core Update must be returned when querying inside its active rollout window (April 1-5)');
console.log('  ✅ Overlap matching verified: queries inside a multi-week rollout capture the update!');

// Check August 2026 range
const augRange = getUpdatesByDateRange({
  startDate: '2026-08-01',
  endDate: '2026-08-31'
});
console.log(`  Found ${augRange.count} updates in August 2026`);
assert.ok(augRange.count >= 3, 'Should find updates in August 2026');
assert.strictEqual(augRange.total_matched, augRange.count, 'total_matched must equal count');
assert.strictEqual(augRange.truncated, false, 'Date range must not be truncated');
assert.strictEqual(augRange.is_exhaustive, true, 'is_exhaustive must be true for date range queries');
assert.strictEqual(augRange.offset, 0, 'Default offset should be 0');
assert.strictEqual(augRange.next_offset, null, 'next_offset should be null when not truncated');
assert.ok(augRange.updates[0].date <= augRange.updates[augRange.updates.length - 1].date, 'Default sort must be oldest-first (asc)');

// Test pagination with limit and offset
const page1 = getUpdatesByDateRange({
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  limit: 2
});
assert.strictEqual(page1.count, 2, 'Page 1 count should be 2');
assert.strictEqual(page1.truncated, true, 'Page 1 must be truncated');
assert.strictEqual(page1.next_offset, 2, 'next_offset must point to 2');
const page2 = getUpdatesByDateRange({
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  limit: 2,
  offset: 2
});
assert.strictEqual(page2.offset, 2, 'Page 2 offset should be 2');
assert.notStrictEqual(page1.updates[0].id, page2.updates[0].id, 'Page 1 and Page 2 must have different records');
console.log('  ✅ Test 2 Passed!\n');

// Test 3: Search matching precision, sort consistency, minRelevance, and pagination
console.log('Test 3: searchUpdates consistency across sort modes (HCU test case)');
const hcuRel = searchUpdates({ query: 'helpful content update', sortBy: 'relevance' });
const hcuDate = searchUpdates({ query: 'helpful content update', sortBy: 'date' });
console.log(`  "helpful content update" total matched: ${hcuRel.total_matched} (relevance) vs ${hcuDate.total_matched} (date)`);
assert.strictEqual(hcuRel.total_matched, hcuDate.total_matched, 'sortBy must NOT change the total_matched result set');

// Verify March 2024 Core Update (Incorporation of Helpful Content System) is present in both
const hcuMarchRel = hcuRel.updates.some(u => u.title.includes('March 2024 Core Update'));
const hcuMarchDate = hcuDate.updates.some(u => u.title.includes('March 2024 Core Update'));
assert.ok(hcuMarchRel, 'March 2024 Core Update must be present in relevance sort');
assert.ok(hcuMarchDate, 'March 2024 Core Update must be present in date sort (not pruned!)');

// Test minRelevance filter
const hcuFiltered = searchUpdates({ query: 'helpful content update', minRelevance: 50 });
assert.ok(hcuFiltered.total_matched < hcuRel.total_matched, 'minRelevance should filter low-confidence results');
assert.ok(hcuFiltered.updates.every(u => (u.relevance_score || 0) >= 50), 'All results must satisfy minRelevance floor');

// Test pagination on searchUpdates
const searchPage1 = searchUpdates({ query: 'spam', limit: 2, offset: 0 });
assert.strictEqual(searchPage1.count, 2, 'Search page 1 count should be 2');
assert.strictEqual(searchPage1.offset, 0, 'Offset should be 0');
assert.strictEqual(searchPage1.next_offset, 2, 'next_offset should be 2');
assert.strictEqual(searchPage1.truncated, true, 'truncated should be true');
const searchPage2 = searchUpdates({ query: 'spam', limit: 2, offset: 2 });
assert.strictEqual(searchPage2.offset, 2, 'Search page 2 offset should be 2');
assert.notStrictEqual(searchPage1.updates[0].id, searchPage2.updates[0].id, 'Page 1 and 2 must have different updates');
console.log('  ✅ Test 3 Passed!\n');

// Test 4: Date Consistency and Live Anchor Preservation
console.log('Test 4: Date consistency & live WordPress anchor preservation');
const septVol = searchUpdates({ query: 'volatility September 2' });
assert.ok(septVol.count >= 1, 'Should find September 2 volatility');
assert.strictEqual(septVol.updates[0].date, '2026-09-02', 'Volatility event date must be 2026-09-02');
assert.ok(septVol.updates[0].originalUrl.endsWith('#2026-09-08-significant-search-ranking-volatility-detected-on-september-2'), 'Sept 2 originalUrl must target live WordPress anchor');

const france = searchUpdates({ query: 'France AI Overviews' });
assert.ok(france.count >= 1, 'Should find France AI Overviews');
assert.strictEqual(france.updates[0].date, '2026-07-22', 'France AI Overviews official launch date must be 2026-07-22');
assert.ok(france.updates[0].originalUrl.endsWith('#2026-07-21-ai-overviews-rollout-in-france-causes-sharp-click-drops'), 'France originalUrl must target live WordPress anchor');

// Verify historical September records were NOT corrupted by substring matching
const hcu2023 = searchUpdates({ query: 'September 2023 Helpful Content Update' });
assert.ok(hcu2023.updates[0].originalUrl.endsWith('#2023-09-14-september-2023-helpful-content-update'), 'Sept 2023 HCU anchor must NOT be overridden');
const core2022 = searchUpdates({ query: 'September 2022 Core Update' });
assert.ok(core2022.updates[0].originalUrl.endsWith('#2022-09-12-september-2022-core-update-september-12-26'), 'Sept 2022 Core anchor must NOT be overridden');
console.log('  ✅ Test 4 Passed!\n');

// Test 5: Category and Platform Taxonomy
console.log('Test 5: Category & platform taxonomy');
const oaiCategory = searchUpdates({ query: 'Astra', category: 'ChatGPT & OpenAI' });
assert.ok(oaiCategory.count >= 1, 'Should find GPT-6 Astra under "ChatGPT & OpenAI" category');
assert.strictEqual(oaiCategory.updates[0].category, 'ChatGPT & OpenAI', 'Category must be "ChatGPT & OpenAI"');

// Cross platform search
const redditChatGpt = searchUpdates({ query: 'Reddit', platform: 'ChatGPT / OpenAI' });
assert.ok(redditChatGpt.count >= 1, 'Cross-platform Reddit update must match platform "ChatGPT / OpenAI"');
const redditGoogle = searchUpdates({ query: 'Reddit', platform: 'Google Search' });
assert.ok(redditGoogle.count >= 1, 'Cross-platform Reddit update must match platform "Google Search"');
console.log('  ✅ Test 5 Passed!\n');

// Test 6: getAllCategories
console.log('Test 6: getAllCategories()');
const meta = getAllCategories();
console.log(`  Total historical updates in database: ${meta.totalUpdates}`);
console.log(`  Categories (${meta.categories.length}): ${meta.categories.slice(0, 6).join(', ')}...`);
console.log(`  Platforms (${meta.platforms.length}): ${meta.platforms.join(', ')}`);
assert.ok(meta.totalUpdates >= 5, 'Should have updates in the archive');
assert.ok(meta.categories.includes('Google Core Update'), 'Categories must include Core Updates');
assert.ok(meta.categories.includes('AI Mode & Gemini'), 'Categories must include AI Mode');
assert.ok(meta.categories.includes('ChatGPT & OpenAI'), 'Categories must include ChatGPT & OpenAI');
assert.ok(typeof meta.categoryCounts['Google Core Update'] === 'number' && meta.categoryCounts['Google Core Update'] > 0, 'Category counts must be populated');
assert.ok(typeof meta.platformCounts['Google Search'] === 'number' && meta.platformCounts['Google Search'] > 0, 'Platform counts must be populated');
console.log(`  Top category counts: Core Updates (${meta.categoryCounts['Google Core Update']}), AI Mode (${meta.categoryCounts['AI Mode & Gemini']})`);
console.log('  ✅ Test 6 Passed!\n');

console.log('🎉 ALL 6 TEST SUITES PASSED FLAWLESSLY!');
