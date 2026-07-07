/**
 * Integration tests for deploy/10-rainger-seed-dev.js
 *
 * READ-ONLY — no POST/PATCH/DELETE. Verifies what the seed script created.
 * Run against dev: node tests/10-rainger-seed.test.js
 * Expected before seed: all fail. Expected after seed: all pass.
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

async function get(table, query, fields = 'sys_id,name,title,active', limit = 50) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

const DEV_CSM_PORTAL_SYS_ID = '89275a53cb13020000f8d856634c9c51'; // CSM portal on aspiraconnecttest

// ─── tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n─── Rainger KB Structure ───');

  let raingerKbId, internalKbId;

  await test('should have created "Rainger" KB', async () => {
    const results = await get('kb_knowledge_base', 'title=Rainger');
    assert.strictEqual(results.length, 1, `expected 1 Rainger KB, got ${results.length}`);
    assert.strictEqual(results[0].active, 'true', 'Rainger KB should be active');
    raingerKbId = results[0].sys_id;
  });

  await test('should have created "Rainger (Internal)" KB', async () => {
    const results = await get('kb_knowledge_base', 'title=Rainger (Internal)');
    assert.strictEqual(results.length, 1, `expected 1 Rainger (Internal) KB, got ${results.length}`);
    assert.strictEqual(results[0].active, 'true', 'Rainger (Internal) KB should be active');
    internalKbId = results[0].sys_id;
  });

  await test('should have linked Customer Knowledge & Training to Rainger KB', async () => {
    assert.ok(raingerKbId, 'Rainger KB must exist first');
    const links = await get(
      'kb_uc_can_read_mtom',
      `kb_knowledge_base=${raingerKbId}`,
      'sys_id,user_criteria.name'
    );
    const names = links.map(l => l['user_criteria.name']);
    assert.ok(
      names.some(n => n && n.includes('Customer Knowledge')),
      `expected CKT criteria link, found: ${JSON.stringify(names)}`
    );
  });

  await test('should have linked CSR Agents Only to Rainger (Internal) KB', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const links = await get(
      'kb_uc_can_read_mtom',
      `kb_knowledge_base=${internalKbId}`,
      'sys_id,user_criteria.name'
    );
    const names = links.map(l => l['user_criteria.name']);
    assert.ok(
      names.some(n => n && n.includes('CSR Agents Only')),
      `expected CSR Agents Only criteria link, found: ${JSON.stringify(names)}`
    );
  });

  // Note: application=global alone is not enough — the portal also has an explicit M2M allowlist.
  console.log('\n─── Portal Visibility ───');

  await test('Rainger KB should be linked to CSM portal', async () => {
    assert.ok(raingerKbId, 'Rainger KB must exist first');
    const links = await get(
      'm2m_sp_portal_knowledge_base',
      `sp_portal=${DEV_CSM_PORTAL_SYS_ID}^kb_knowledge_base=${raingerKbId}`,
      'sys_id',
      1
    );
    assert.strictEqual(links.length, 1, 'Rainger KB not linked to CSM portal via m2m_sp_portal_knowledge_base');
  });

  await test('Rainger (Internal) KB should NOT be linked to CSM portal', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const links = await get(
      'm2m_sp_portal_knowledge_base',
      `sp_portal=${DEV_CSM_PORTAL_SYS_ID}^kb_knowledge_base=${internalKbId}`,
      'sys_id',
      1
    );
    assert.strictEqual(links.length, 0, 'Rainger (Internal) KB should NOT appear on the customer portal');
  });

  // Note: kb_category has no kb_knowledge_base field in SNOW — categories are global.
  // We verify categories through the articles that reference them.
  console.log('\n─── Categories ───');

  const EXPECTED_CUSTOMER_CATS = ['Getting Started', 'Account & Settings', 'Payments & Billing', 'Reservations', 'Troubleshooting'];
  const EXPECTED_INTERNAL_CATS = ['Agent Reference', 'Known Issues', 'Escalation Guides'];

  await test('customer KB should have 5 distinct categories across its articles', async () => {
    assert.ok(raingerKbId, 'Rainger KB must exist first');
    const articles = await get('kb_knowledge', `kb_knowledge_base=${raingerKbId}`, 'kb_category.label', 50);
    const cats = [...new Set(articles.map(a => a['kb_category.label']).filter(Boolean))];
    assert.strictEqual(cats.length, 5, `expected 5 distinct categories, got ${cats.length}: ${cats.join(', ')}`);
  });

  await test('internal KB should have 3 distinct categories across its articles', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const articles = await get('kb_knowledge', `kb_knowledge_base=${internalKbId}`, 'kb_category.label', 50);
    const cats = [...new Set(articles.map(a => a['kb_category.label']).filter(Boolean))];
    assert.strictEqual(cats.length, 3, `expected 3 distinct categories, got ${cats.length}: ${cats.join(', ')}`);
  });

  await test('customer KB articles should include "Getting Started" category', async () => {
    assert.ok(raingerKbId, 'Rainger KB must exist first');
    const articles = await get('kb_knowledge', `kb_knowledge_base=${raingerKbId}^kb_category.label=Getting Started`, 'sys_id', 1);
    assert.ok(articles.length > 0, 'No articles found with "Getting Started" category');
  });

  await test('internal KB articles should include "Agent Reference" category', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const articles = await get('kb_knowledge', `kb_knowledge_base=${internalKbId}^kb_category.label=Agent Reference`, 'sys_id', 1);
    assert.ok(articles.length > 0, 'No articles found with "Agent Reference" category');
  });

  console.log('\n─── Articles ───');

  await test('customer KB should have 9 published articles', async () => {
    assert.ok(raingerKbId, 'Rainger KB must exist first');
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${raingerKbId}^workflow_state=published`,
      'sys_id,short_description,workflow_state'
    );
    assert.strictEqual(articles.length, 9, `expected 9 published articles, got ${articles.length}`);
  });

  await test('internal KB should have 7 published articles', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${internalKbId}^workflow_state=published`,
      'sys_id,short_description,workflow_state'
    );
    assert.strictEqual(articles.length, 7, `expected 7 published articles, got ${articles.length}`);
  });

  await test('customer KB should have no draft articles', async () => {
    assert.ok(raingerKbId, 'Rainger KB must exist first');
    const drafts = await get(
      'kb_knowledge',
      `kb_knowledge_base=${raingerKbId}^workflow_state=draft`,
      'sys_id,short_description'
    );
    assert.strictEqual(drafts.length, 0, `found ${drafts.length} draft articles: ${drafts.map(a => a.short_description).join(', ')}`);
  });

  await test('internal KB should have no draft articles', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const drafts = await get(
      'kb_knowledge',
      `kb_knowledge_base=${internalKbId}^workflow_state=draft`,
      'sys_id,short_description'
    );
    assert.strictEqual(drafts.length, 0, `found ${drafts.length} draft articles`);
  });

  await test('all internal articles should be prefixed [AGENT]', async () => {
    assert.ok(internalKbId, 'Rainger (Internal) KB must exist first');
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${internalKbId}`,
      'sys_id,short_description'
    );
    const nonAgent = articles.filter(a => !a.short_description.startsWith('[AGENT]'));
    assert.strictEqual(nonAgent.length, 0, `articles missing [AGENT] prefix: ${nonAgent.map(a => a.short_description).join(', ')}`);
  });

  // ─── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
