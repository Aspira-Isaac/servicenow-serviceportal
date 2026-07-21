/**
 * Integration tests for deploy/14-nexgen-import-dev.js
 *
 * Verifies the dev customer KB after the 2026-07-09 content reset:
 *   • KB renamed "Rainger" → "Next Gen" (same sys_id, dev only)
 *   • Seeded/demo articles removed; the 5 prod-authored articles imported
 *   • Imported articles published and categorized (How To / General)
 *   • Old seeded categories deactivated
 *   • "Rainger (Internal)" KB left untouched
 *
 * READ-ONLY — no POST/PATCH/DELETE.
 * Run against dev: node tests/15-nexgen-import.test.js
 * Expected before import: fails. Expected after import: all pass.
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

async function get(table, query, fields, limit = 100) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

const DEV_KB_ID = '3902d2f793994f50408cbf3b6aba103f'; // customer KB (was "Rainger")

// Expected content mirrors prod as of 2026-07-09 (see deploy/14-nexgen-import-dev.js)
// Single "Getting Started" category for now, per 2026-07-09 request.
const EXPECTED_ARTICLES = {
  'Next Gen - FAQs':                        'Getting Started',
  'Next Gen - Glossary of Terms':           'Getting Started',
  'How To - Creating a Resource':           'Getting Started',
  'How To - Creating a Product':            'Getting Started',
  'Navigating the Sandbox - Tips & Tricks': 'Getting Started'
};
const EXPECTED_CATS = ['Getting Started'];

// ─── tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n─── KB Rename ───');

  await test('customer KB is renamed to "Next Gen" (same sys_id)', async () => {
    const kbs = await get('kb_knowledge_base', `sys_id=${DEV_KB_ID}`, 'sys_id,title,active', 1);
    assert.strictEqual(kbs.length, 1, 'customer KB not found by sys_id');
    assert.strictEqual(kbs[0].title, 'Next Gen', `expected title "Next Gen", got "${kbs[0].title}"`);
    assert.strictEqual(kbs[0].active, 'true', 'KB should be active');
  });

  await test('no KB titled "Rainger" remains in dev (no duplicate created)', async () => {
    const kbs = await get('kb_knowledge_base', 'title=Rainger', 'sys_id');
    assert.strictEqual(kbs.length, 0, `found ${kbs.length} KB(s) still titled "Rainger"`);
  });

  console.log('\n─── Imported Articles ───');

  await test('KB contains the 5 prod-imported articles (plus optional "TEST - " fixtures)', async () => {
    const articles = await get('kb_knowledge', `kb_knowledge_base=${DEV_KB_ID}`, 'sys_id,short_description');
    // Dev-only fixtures (guide reference article etc.) are allowed and kept by the import
    const titles = articles.map(a => a.short_description).filter(t => !t.startsWith('TEST - ')).sort();
    assert.deepStrictEqual(titles, Object.keys(EXPECTED_ARTICLES).sort(), `article mismatch: ${titles.join(' | ')}`);
  });

  await test('all imported articles are published and active', async () => {
    const notLive = await get(
      'kb_knowledge',
      `kb_knowledge_base=${DEV_KB_ID}^workflow_state!=published^ORactive=false`,
      'sys_id,number,short_description,workflow_state'
    );
    assert.strictEqual(
      notLive.length, 0,
      `not published/active: ${notLive.map(a => `${a.number} (${a.workflow_state})`).join(', ')}`
    );
  });

  await test('each article is in its expected category', async () => {
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${DEV_KB_ID}`,
      'sys_id,short_description,kb_category.label'
    );
    const wrong = articles.filter(a =>
      !a.short_description.startsWith('TEST - ') &&
      EXPECTED_ARTICLES[a.short_description] !== a['kb_category.label']);
    assert.strictEqual(
      wrong.length, 0,
      `miscategorized: ${wrong.map(a => `"${a.short_description}" → ${a['kb_category.label'] || '(none)'}`).join(', ')}`
    );
  });

  console.log('\n─── Categories ───');

  await test('the only active picker category is Getting Started', async () => {
    const cats = await get('kb_category', `parent_id=${DEV_KB_ID}^active=true`, 'sys_id,label');
    const labels = cats.map(c => c.label).sort();
    assert.deepStrictEqual(labels, EXPECTED_CATS, `got: ${labels.join(', ')}`);
  });

  await test('retired categories are deactivated, not deleted', async () => {
    const inactive = await get('kb_category', `parent_id=${DEV_KB_ID}^active=false`, 'sys_id,label');
    const labels = inactive.map(c => c.label);
    for (const expected of ['Account & Settings', 'Payments & Billing', 'Reservations', 'Troubleshooting', 'How To', 'General']) {
      assert.ok(labels.includes(expected), `category "${expected}" missing from inactive set: ${labels.join(', ')}`);
    }
  });

  console.log('\n─── Template CSS Scoping ───');

  // The prod authors embed a standalone page template in some articles. The
  // design must render as authored (2026-07-09 request), but its <style> block
  // uses global selectors (*, body, table…) that would leak into the portal —
  // import scopes every selector under .ahc-embedded-tpl instead of stripping.
  await test('embedded template styles are fully scoped (design kept, no CSS leaks)', async () => {
    const articles = await get('kb_knowledge', `kb_knowledge_base=${DEV_KB_ID}`, 'number,short_description,text');
    const problems = [];
    let templated = 0;
    for (const a of articles) {
      const text = a.text || '';
      if (text.includes('margin-right: 400px')) problems.push(`${a.number}: HubSpot margin wrapper not stripped`);
      const styles = text.match(/<style>([\s\S]*?)<\/style>/gi) || [];
      if (!styles.length) continue;
      templated++;
      // Two safe conventions: import-scoped (.ahc-embedded-tpl) or authored-safe (.nx-article)
      const SCOPES = ['.ahc-embedded-tpl', '.nx-article'];
      const wrapper = SCOPES.find(s => text.includes(`class="${s.slice(1)}"`));
      if (!wrapper) problems.push(`${a.number}: has <style> but no scope wrapper`);
      for (const block of styles) {
        const css = block.replace(/<\/?style>/gi, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const selectorChunks = css.match(/[^{}]+\{/g) || [];
        for (const chunk of selectorChunks) {
          for (const sel of chunk.slice(0, -1).split(',')) {
            const s = sel.trim();
            if (!s || s.startsWith('@') || /^(\d+%|from|to)$/i.test(s)) continue;
            if (!SCOPES.some(scope => s.startsWith(scope))) {
              problems.push(`${a.number}: unscoped selector "${s}"`);
            }
          }
        }
      }
    }
    assert.ok(templated >= 2, `expected at least 2 templated articles, found ${templated} with <style>`);
    assert.strictEqual(problems.length, 0, `\n      ${problems.join('\n      ')}`);
  });

  await test('template design markup is preserved (banner, sections, tips)', async () => {
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${DEV_KB_ID}^short_descriptionINHow To - Creating a Resource,Navigating the Sandbox - Tips & Tricks`,
      'number,short_description,text'
    );
    assert.strictEqual(articles.length, 2, 'templated articles not found');
    for (const a of articles) {
      for (const marker of ['<header>', 'class="section"', 'class="tip"']) {
        assert.ok((a.text || '').includes(marker), `${a.number} lost template markup: ${marker}`);
      }
    }
  });

  console.log('\n─── Internal KB Untouched ───');

  await test('"Rainger (Internal)" keeps its 7 published [AGENT] articles', async () => {
    const kbs = await get('kb_knowledge_base', 'title=Rainger (Internal)', 'sys_id', 1);
    assert.strictEqual(kbs.length, 1, 'internal KB not found');
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${kbs[0].sys_id}^workflow_state=published`,
      'sys_id,short_description'
    );
    assert.strictEqual(articles.length, 7, `expected 7 published internal articles, got ${articles.length}`);
  });

  // ─── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
