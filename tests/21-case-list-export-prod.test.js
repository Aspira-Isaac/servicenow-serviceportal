/**
 * Integration tests for deploy/21-case-list-export-prod.js
 *
 * READ-ONLY — verifies the ahc-case-list widget on PROD carries the export
 * menu wired to the platform list exporter, AND that the redeploy preserved
 * the 2026-07-17 anonymous-session login guard (must not re-open the leak).
 * Run: node tests/21-case-list-export-prod.test.js
 */
require('dotenv').config(); // .env → PROD
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

const WIDGET_ID = 'ahc-case-list';

async function run() {
  assert.ok(
    process.env.SNOW_INSTANCE.includes('//aspiraconnect.service-now.com'),
    'these tests must run against prod (.env)'
  );

  console.log('\n─── Widget record ───');
  let widget;
  await test('widget "ahc-case-list" exists in sp_widget', async () => {
    const results = await get('sp_widget', 'id=' + WIDGET_ID, 'sys_id,id,script,template,client_script', 1);
    assert.strictEqual(results.length, 1, 'widget not found');
    widget = results[0];
  });

  console.log('\n─── Server script ───');
  await test('server script exposes a URI-encoded export query built via addConditions()', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.exportQuery'), 'server does not set data.exportQuery');
    assert.ok(widget.script.includes('encodeURIComponent'), 'export query is not URI-encoded');
    const section = widget.script.substring(widget.script.indexOf('exportQuery') - 600, widget.script.indexOf('exportQuery'));
    assert.ok(section.includes('addConditions'), 'export query does not apply addConditions() (scope/filters/search)');
    assert.ok(widget.script.includes('data.exportFields'), 'server does not set data.exportFields');
  });

  await test('server STILL guards anonymous sessions (leak fix preserved)', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('gs.isLoggedIn()'), 'login guard missing — redeploy re-opened the anonymous case leak');
  });

  console.log('\n─── Template ───');
  await test('template links to the platform list exporter with query + fields', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.template.includes('sn_customerservice_case_list.do'), 'no link to /sn_customerservice_case_list.do');
    assert.ok(widget.template.includes('sysparm_query={{data.exportQuery}}'), 'missing sysparm_query binding');
    assert.ok(widget.template.includes('sysparm_fields={{data.exportFields}}'), 'missing sysparm_fields binding');
  });

  await test('export links open in a new tab', async () => {
    assert.ok(widget, 'widget must exist first');
    const menuIdx = widget.template.indexOf('ahc-cl__export-menu');
    assert.ok(menuIdx !== -1, 'export menu markup not found');
    assert.ok(widget.template.substring(menuIdx, menuIdx + 600).includes('target="_blank"'), 'export links do not open in a new tab');
  });

  console.log('\n─── Client script ───');
  await test('client offers PDF, Excel and CSV and refreshes exportQuery on reload', async () => {
    assert.ok(widget, 'widget must exist first');
    for (const fmt of ["'PDF'", "'EXCEL'", "'CSV'"]) {
      assert.ok(widget.client_script.includes(fmt), `missing export format ${fmt}`);
    }
    assert.ok(widget.client_script.includes("'exportQuery'"), 'reload() does not copy exportQuery — export would ignore later filter changes');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
