/**
 * Integration tests for deploy/12-ahc-kb-categories-dev.js
 *
 * READ-ONLY — verifies the widget was deployed and wired to kb_home correctly.
 * Run: node tests/12-ahc-kb-categories.test.js
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

const WIDGET_ID       = 'ahc-kb-categories';
const KB_HOME_PAGE_ID = 'e1c919e4dbd3220099f93691f0b8f535';
const RAINGER_KB_ID   = '3902d2f793994f50408cbf3b6aba103f';

async function run() {
  console.log('\n─── Widget record ───');

  let widget;

  await test('widget "ahc-kb-categories" should exist in sp_widget', async () => {
    const results = await get('sp_widget', 'id=' + WIDGET_ID, 'sys_id,id,name,script,template', 1);
    assert.strictEqual(results.length, 1, 'widget not found');
    widget = results[0];
  });

  await test('widget server script should read kb_id URL param', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(
      widget.script.includes("getParameter('kb_id')") || widget.script.includes('getParameter("kb_id")'),
      'server script does not read kb_id param'
    );
  });

  await test('widget template should link to kb_category page', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(
      widget.template.includes('id=kb_category'),
      'template does not contain kb_category navigation link'
    );
  });

  await test('widget template should be conditional on kb_id being present', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(
      widget.template.includes('c.data.kbId'),
      'template does not guard on kbId (would render even when no KB selected)'
    );
  });

  console.log('\n─── Page placement ───');

  let instanceSysId;

  await test('widget should have a container on kb_home page (order=100)', async () => {
    const containers = await get(
      'sp_container',
      `sp_page=${KB_HOME_PAGE_ID}^order=100`,
      'sys_id,order',
      1
    );
    assert.strictEqual(containers.length, 1, 'no container with order=100 on kb_home page');
  });

  await test('widget should be wired to an sp_instance on kb_home', async () => {
    assert.ok(widget, 'widget must exist first');
    const instances = await get(
      'sp_instance',
      `sp_widget=${widget.sys_id}`,
      'sys_id,sp_widget',
      1
    );
    assert.ok(instances.length > 0, 'no sp_instance found for ahc-kb-categories widget');
    instanceSysId = instances[0].sys_id;
  });

  await test('the sp_instance should be under the kb_home page hierarchy', async () => {
    assert.ok(instanceSysId, 'instance must exist first');
    // Walk up: instance → column → row → container → page
    const instance = await get('sp_instance', 'sys_id=' + instanceSysId, 'sys_id,sp_column', 1);
    const colId = instance[0]?.sp_column?.value;
    assert.ok(colId, 'instance has no sp_column');

    const col = await get('sp_column', 'sys_id=' + colId, 'sys_id,sp_row', 1);
    const rowId = col[0]?.sp_row?.value;
    assert.ok(rowId, 'column has no sp_row');

    const row = await get('sp_row', 'sys_id=' + rowId, 'sys_id,sp_container', 1);
    const containerId = row[0]?.sp_container?.value;
    assert.ok(containerId, 'row has no sp_container');

    const container = await get('sp_container', 'sys_id=' + containerId, 'sys_id,sp_page', 1);
    const pageId = container[0]?.sp_page?.value;
    assert.strictEqual(pageId, KB_HOME_PAGE_ID, `container is on page ${pageId}, expected kb_home (${KB_HOME_PAGE_ID})`);
  });

  console.log('\n─── Knowledge data (Rainger KB) ───');

  await test('Rainger KB should have 5 distinct categories accessible for display', async () => {
    const articles = await get(
      'kb_knowledge',
      `kb_knowledge_base=${RAINGER_KB_ID}^workflow_state=published`,
      'kb_category',
      20
    );
    // kb_category is a reference field — use .value to get sys_id for deduplication
    const cats = [...new Set(articles.map(a => a['kb_category']?.value).filter(Boolean))];
    assert.strictEqual(cats.length, 5, `expected 5 categories, got ${cats.length}`);
  });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
