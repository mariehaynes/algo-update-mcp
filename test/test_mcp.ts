import assert from 'assert';
import {
  getLatestUpdates,
  getUpdatesByDateRange,
  searchUpdates,
  getAllCategories
} from '../src/tools.js';

console.log('🧪 Starting Automated Tests for Marie Haynes Algo Update MCP Tools...\n');

// Test 1: getLatestUpdates
console.log('Test 1: getLatestUpdates({ limit: 5 })');
const latest = getLatestUpdates({ limit: 5 });
assert.strictEqual(latest.count, 5, 'Should return 5 updates');
assert.ok(latest.updates.length === 5, 'Updates array length should be 5');
assert.ok(latest.attribution.includes('Marie Haynes Consulting'), 'Attribution footer must be present');
assert.ok(latest.presentation_instructions.includes('Marie Haynes Consulting'), 'Presentation instructions must be present');
assert.ok(latest.presentation_instructions.includes('clearly distinguish'), 'Instructions must require distinguishing verified data from AI advice');
console.log(`  Top updates: ${latest.updates.slice(0, 2).map(u => u.date + ': ' + u.title).join(' | ')}`);
assert.strictEqual(latest.updates[0].date, '2026-09-02', 'Latest update date should be today (2026-09-02)');
assert.ok(latest.updates.slice(0, 2).some(u => u.title.includes('Gemini 3.8 Flash')), 'Top updates must include Gemini 3.8 Flash');
console.log('  ✅ Test 1 Passed!\n');

// Test 2: getUpdatesByDateRange
console.log('Test 2: getUpdatesByDateRange for August 2026 (traffic drop correlation)');
const augRange = getUpdatesByDateRange({
  startDate: '2026-08-01',
  endDate: '2026-08-31'
});
console.log(`  Found ${augRange.count} updates in August 2026`);
assert.ok(augRange.count >= 3, 'Should find updates in August 2026');
const titles = augRange.updates.map(u => u.title).join(' | ');
assert.ok(titles.includes('Spam Update'), 'Must contain August Spam Update');
assert.ok(titles.includes('Gemini 3.7 Flash') || titles.includes('Reddit'), 'Must contain August updates');
console.log('  ✅ Test 2 Passed!\n');

// Test 3: searchUpdates for historical 2018 Medic update
console.log('Test 3: searchUpdates({ query: "Medic" })');
const medicSearch = searchUpdates({ query: 'Medic' });
console.log(`  Found ${medicSearch.count} updates matching "Medic"`);
assert.ok(medicSearch.count >= 1, 'Should find Medic updates');
console.log(`  Matched: ${medicSearch.updates[0].date} - ${medicSearch.updates[0].title}`);
console.log('  ✅ Test 3 Passed!\n');

// Test 4: searchUpdates for modern AI Mode query
console.log('Test 4: searchUpdates({ query: "Reddit" })');
const redditSearch = searchUpdates({ query: 'Reddit' });
console.log(`  Found ${redditSearch.count} updates matching "Reddit"`);
assert.ok(redditSearch.count >= 1, 'Should find Reddit citations drop update');
console.log(`  Matched: ${redditSearch.updates[0].date} - ${redditSearch.updates[0].title}`);
console.log('  ✅ Test 4 Passed!\n');

// Test 5: getAllCategories
console.log('Test 5: getAllCategories()');
const meta = getAllCategories();
console.log(`  Total historical updates in database: ${meta.totalUpdates}`);
console.log(`  Categories (${meta.categories.length}): ${meta.categories.slice(0, 5).join(', ')}...`);
console.log(`  Platforms (${meta.platforms.length}): ${meta.platforms.join(', ')}`);
assert.ok(meta.totalUpdates >= 5, 'Should have updates in the archive');
assert.ok(meta.categories.includes('Google Core Update'), 'Categories must include Core Updates');
assert.ok(meta.categories.includes('AI Mode & Gemini'), 'Categories must include AI Mode');
console.log('  ✅ Test 5 Passed!\n');

console.log('🎉 ALL 5 TEST SUITES PASSED FLAWLESSLY!');
