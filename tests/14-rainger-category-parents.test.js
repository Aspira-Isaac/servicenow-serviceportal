/**
 * Integration tests for deploy/13-rainger-fix-category-parents-dev.js
 *
 * Verifies that every Rainger KB category is properly parented to its KB
 * (parent_id + parent_table) so the native category picker on the Knowledge
 * form shows them, and that no KB has duplicate active category labels.
 *
 * READ-ONLY — no POST/PATCH/DELETE.
 * Run against dev: node tests/14-rainger-category-parents.test.js
 * Expected before fix: fails (seeded categories are orphans, "Getting Started"
 * is duplicated). Expected after fix: all pass.
 */
require('dotenv').config({ path: '.env.dev' });
const assert = require('assert');
const client = require('../lib/client');

// ─── minimal test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

async function get(table, query, fields = 'sys_id,label,active', limit = 100) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

const KBS = [
  {
    // Renamed from "Rainger" + reseeded from prod on 2026-07-09 (deploy/14-nexgen-import-dev.js)
    title: 'Next Gen',
    expectedCats: ['Getting Started']
  },
  {
    title: 'Rainger (Internal)',
    expectedCats: ['Agent Reference', 'Known Issues', 'Escalation Guides']
  }
];

// ─── tests ───────────────────────────────────────────────────────────────────

async function run() {
  for (const kb of KBS) {
    console.log(`\n─── ${kb.title} ───`);

    let kbId;
    await test(`"${kb.title}" KB exists`, async () => {
      const results = await get('kb_knowledge_base', `title=${kb.title}`, 'sys_id');
      assert.strictEqual(results.length, 1, `expected 1 KB, got ${results.length}`);
      kbId = results[0].sys_id;
    });

    await test('every category referenced by its articles is parented to this KB', async () => {
      assert.ok(kbId, 'KB must exist first');
      const articles = await get('kb_knowledge', `kb_knowledge_base=${kbId}`, 'sys_id,kb_category');
      const catIds = [...new Set(articles.map(a => a.kb_category && a.kb_category.value).filter(Boolean))];
      assert.ok(catIds.length > 0, 'expected at least one categorized article');
      const orphans = [];
      for (const catId of catIds) {
        const cat = (await get('kb_category', `sys_id=${catId}`, 'sys_id,label,parent_id,parent_table', 1))[0];
        const parentId = cat.parent_id && cat.parent_id.value;
        if (parentId !== kbId || cat.parent_table !== 'kb_knowledge_base') {
          orphans.push(`"${cat.label}" (parent_id=${parentId || 'empty'})`);
        }
      }
      assert.strictEqual(orphans.length, 0, `categories not parented to KB: ${orphans.join(', ')}`);
    });

    await test(`native picker shows exactly the ${kb.expectedCats.length} expected active categories`, async () => {
      assert.ok(kbId, 'KB must exist first');
      const cats = await get('kb_category', `parent_id=${kbId}^active=true`, 'sys_id,label');
      const labels = cats.map(c => c.label).sort();
      assert.deepStrictEqual(
        labels,
        [...kb.expectedCats].sort(),
        `picker categories mismatch: ${labels.join(', ')}`
      );
    });

    await test('no duplicate active category labels under this KB', async () => {
      assert.ok(kbId, 'KB must exist first');
      const cats = await get('kb_category', `parent_id=${kbId}^active=true`, 'sys_id,label');
      const seen = new Set();
      const dups = [];
      for (const c of cats) {
        if (seen.has(c.label)) dups.push(c.label);
        seen.add(c.label);
      }
      assert.strictEqual(dups.length, 0, `duplicate labels: ${dups.join(', ')}`);
    });

    await test('all published articles are visible under a picker category', async () => {
      assert.ok(kbId, 'KB must exist first');
      const articles = await get(
        'kb_knowledge',
        `kb_knowledge_base=${kbId}^workflow_state=published^active=true`,
        'sys_id,number,short_description,kb_category'
      );
      const pickerCats = await get('kb_category', `parent_id=${kbId}^active=true`, 'sys_id');
      const pickerIds = new Set(pickerCats.map(c => c.sys_id));
      const stranded = articles.filter(a => !a.kb_category || !pickerIds.has(a.kb_category.value));
      assert.strictEqual(
        stranded.length, 0,
        `articles in no picker category: ${stranded.map(a => `${a.number} "${a.short_description}"`).join(', ')}`
      );
    });
  }

  // ─── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
