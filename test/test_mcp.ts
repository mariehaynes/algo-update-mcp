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
// March 2026 Core Update started 2026-03-27 with rolloutEnd: 2026-04-08.
// A query for 2026-04-01 to 2026-04-05 sits strictly inside the rollout!
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
// Oldest-first chronological check
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

const titles = augRange.updates.map(u => u.title).join(' | ');
assert.ok(titles.includes('Spam Update'), 'Must contain August Spam Update');
assert.ok(titles.includes('Gemini') || titles.includes('Reddit') || titles.includes('UCP'), 'Must contain August updates');
console.log('  ✅ Test 2 Passed!\n');

// Test 3: Date Consistency check (Sept 2 volatility record)
console.log('Test 3: Date consistency for September 2, 2026 volatility');
const septVol = searchUpdates({ query: 'volatility September 2' });
assert.ok(septVol.count >= 1, 'Should find September 2 volatility');
assert.strictEqual(septVol.updates[0].date, '2026-09-02', 'Volatility event date must be 2026-09-02, not publication date');
console.log('  ✅ Test 3 Passed!\n');

// Test 4: Category and Platform Taxonomy
console.log('Test 4: Category & platform taxonomy');
const oaiCategory = searchUpdates({ query: 'Astra', category: 'ChatGPT & OpenAI' });
assert.ok(oaiCategory.count >= 1, 'Should find GPT-6 Astra under "ChatGPT & OpenAI" category');
assert.strictEqual(oaiCategory.updates[0].category, 'ChatGPT & OpenAI', 'Category must be "ChatGPT & OpenAI"');

// Cross platform search
const redditChatGpt = searchUpdates({ query: 'Reddit', platform: 'ChatGPT / OpenAI' });
assert.ok(redditChatGpt.count >= 1, 'Cross-platform Reddit update must match platform "ChatGPT / OpenAI"');
const redditGoogle = searchUpdates({ query: 'Reddit', platform: 'Google Search' });
assert.ok(redditGoogle.count >= 1, 'Cross-platform Reddit update must match platform "Google Search"');
console.log('  ✅ Test 4 Passed!\n');

// Test 5: getAllCategories
console.log('Test 5: getAllCategories()');
const meta = getAllCategories();
console.log(`  Total historical updates in database: ${meta.totalUpdates}`);
console.log(`  Categories (${meta.categories.length}): ${meta.categories.slice(0, 6).join(', ')}...`);
console.log(`  Platforms (${meta.platforms.length}): ${meta.platforms.join(', ')}`);
assert.ok(meta.totalUpdates >= 5, 'Should have updates in the archive');
assert.ok(meta.categories.includes('Google Core Update'), 'Categories must include Core Updates');
assert.ok(meta.categories.includes('AI Mode & Gemini'), 'Categories must include AI Mode');
assert.ok(meta.categories.includes('ChatGPT & OpenAI'), 'Categories must include ChatGPT & OpenAI');
console.log('  ✅ Test 5 Passed!\n');

console.log('🎉 ALL TEST SUITES PASSED FLAWLESSLY!');
