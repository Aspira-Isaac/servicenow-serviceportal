/**
 * Integration tests for deploy/13-rainger-portal-dev.js
 *
 * READ-ONLY — verifies the Rainger portal and all its pieces were deployed.
 * Run: node tests/13-rainger-portal.test.js
 */
require('dotenv').config({ path: '.env.dev' });
const assert = require('assert');
const client = require('../lib/client');

let passed = 0, failed = 0;

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

async function get(table, query, fields = 'sys_id', limit = 10) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

const RAINGER_KB_ID = '3902d2f793994f50408cbf3b6aba103f';

const EXPECTED_PAGES    = ['ahc_index', 'ahc_submit_ticket', 'ahc_kb_search', 'ticket_list', 'ticket_detail'];
const EXPECTED_WIDGETS  = [
  'ahc-hero', 'ahc-ticket-wizard', 'ahc-cat-item', 'ahc-kb-search-widget',
  'ahc-quick-links', 'ahc-case-list', 'ahc-case-detail', 'ahc-stats', 'ahc-kb-categories'
];

async function run() {
  console.log('\n─── Portal record ───');

  let portal;

  await test('portal with url_suffix "help" should exist in dev', async () => {
    const results = await get('sp_portal', 'url_suffix=help', 'sys_id,title,url_suffix,kb_knowledge_base,header,footer,theme', 1);
    assert.strictEqual(results.length, 1, 'portal not found');
    portal = results[0];
  });

  await test('portal title should be "Rainger Help Center"', async () => {
    assert.ok(portal, 'portal must exist first');
    assert.strictEqual(portal.title, 'Rainger Help Center');
  });

  await test('portal kb_knowledge_base should be the Rainger KB', async () => {
    assert.ok(portal, 'portal must exist first');
    const kbId = portal.kb_knowledge_base?.value || portal.kb_knowledge_base;
    assert.strictEqual(kbId, RAINGER_KB_ID, `expected Rainger KB, got ${kbId}`);
  });

  await test('portal should have a theme', async () => {
    assert.ok(portal, 'portal must exist first');
    assert.ok(portal.theme?.value || portal.theme, 'portal has no theme');
  });

  await test('portal theme should have a header and footer set', async () => {
    assert.ok(portal, 'portal must exist first');
    const themeId = portal.theme?.value || portal.theme;
    assert.ok(themeId, 'portal has no theme');
    const theme = (await get('sp_theme', `sys_id=${themeId}`, 'sys_id,header,footer', 1))[0];
    assert.ok(theme?.header?.value || theme?.header, 'theme has no header');
    assert.ok(theme?.footer?.value || theme?.footer, 'theme has no footer');
  });

  console.log('\n─── Pages (scoped to Rainger portal) ───');

  let portalSysId;
  let pageMap = {};

  await test('all 5 pages should exist scoped to Rainger portal', async () => {
    assert.ok(portal, 'portal must exist first');
    portalSysId = portal.sys_id;
    for (const pageId of EXPECTED_PAGES) {
      const results = await get('sp_page', `id=${pageId}^sp_portal=${portalSysId}`, 'sys_id,id,title', 1);
      assert.strictEqual(results.length, 1, `page "${pageId}" not found on Rainger portal`);
      pageMap[pageId] = results[0].sys_id;
    }
  });

  await test('portal homepage should be set to ahc_index', async () => {
    assert.ok(portalSysId, 'portal must exist first');
    const result = await get('sp_portal', `sys_id=${portalSysId}`, 'sys_id,homepage', 1);
    const homepageId = result[0]?.homepage?.value;
    assert.ok(homepageId, 'portal homepage not set');
    assert.strictEqual(homepageId, pageMap['ahc_index'], `homepage should be ahc_index (${pageMap['ahc_index']}), got ${homepageId}`);
  });

  await test('portal kb_knowledge_page should point to ahc_kb_search', async () => {
    assert.ok(portalSysId, 'portal must exist first');
    const result = await get('sp_portal', `sys_id=${portalSysId}`, 'sys_id,kb_knowledge_page', 1);
    const kbPageId = result[0]?.kb_knowledge_page?.value;
    assert.strictEqual(kbPageId, pageMap['ahc_kb_search'], `kb_knowledge_page should be ahc_kb_search (${pageMap['ahc_kb_search']}), got ${kbPageId}`);
  });

  console.log('\n─── Widgets deployed ───');

  await test('all AHC widgets should exist in sp_widget', async () => {
    for (const widgetId of EXPECTED_WIDGETS) {
      const results = await get('sp_widget', `id=${widgetId}`, 'sys_id,id', 1);
      assert.strictEqual(results.length, 1, `widget "${widgetId}" not found`);
    }
  });

  console.log('\n─── Widget placement on pages ───');

  await test('ahc-hero should be wired to ahc_index page', async () => {
    assert.ok(pageMap['ahc_index'], 'ahc_index page must exist first');
    const heroWidget = (await get('sp_widget', 'id=ahc-hero', 'sys_id', 1))[0];
    assert.ok(heroWidget, 'ahc-hero widget not found');
    // Walk: page → container → row → column → instance
    const instances = await get('sp_instance', `sp_widget=${heroWidget.sys_id}^sp_column.sp_row.sp_container.sp_page=${pageMap['ahc_index']}`, 'sys_id', 1);
    assert.ok(instances.length > 0, 'ahc-hero not wired to ahc_index page');
  });

  await test('ahc-kb-categories should be wired to ahc_kb_search page', async () => {
    assert.ok(pageMap['ahc_kb_search'], 'ahc_kb_search page must exist first');
    const catWidget = (await get('sp_widget', 'id=ahc-kb-categories', 'sys_id', 1))[0];
    assert.ok(catWidget, 'ahc-kb-categories widget not found');
    const instances = await get('sp_instance', `sp_widget=${catWidget.sys_id}^sp_column.sp_row.sp_container.sp_page=${pageMap['ahc_kb_search']}`, 'sys_id', 1);
    assert.ok(instances.length > 0, 'ahc-kb-categories not wired to ahc_kb_search page');
  });

  console.log('\n─── Rainger KB → portal M2M link ───');

  await test('Rainger KB should be in m2m_sp_portal_knowledge_base for Rainger portal', async () => {
    assert.ok(portalSysId, 'portal must exist first');
    const links = await get('m2m_sp_portal_knowledge_base', `sp_portal=${portalSysId}^kb_knowledge_base=${RAINGER_KB_ID}`, 'sys_id', 1);
    assert.strictEqual(links.length, 1, 'Rainger KB not in portal M2M table');
  });

  // ─── summary ──────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
