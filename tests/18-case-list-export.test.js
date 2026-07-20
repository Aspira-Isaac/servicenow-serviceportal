/**
 * Integration tests for deploy/18-case-list-export-dev.js
 *
 * READ-ONLY — verifies the ahc-case-list widget on DEV carries the export
 * menu wired to the platform list exporter (same mechanism as the OOB
 * Data Table widget: /<table>_list.do?<FORMAT>&sysparm_query=...).
 * Run: node tests/18-case-list-export.test.js
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

const WIDGET_ID = 'ahc-case-list';

async function run() {
  console.log('\n─── Widget record ───');

  let widget;

  await test('widget "ahc-case-list" should exist in sp_widget', async () => {
    const results = await get('sp_widget', 'id=' + WIDGET_ID, 'sys_id,id,script,template,client_script', 1);
    assert.strictEqual(results.length, 1, 'widget not found');
    widget = results[0];
  });

  console.log('\n─── Server script ───');

  await test('server script should expose an export query', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.exportQuery'), 'server script does not set data.exportQuery');
  });

  await test('export query should be URI-encoded server-side', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(
      widget.script.includes('encodeURIComponent'),
      'export query is not encoded — special chars in filters would break the export URL'
    );
  });

  await test('export query should reuse the same conditions as the list', async () => {
    assert.ok(widget, 'widget must exist first');
    // The export GlideRecord must go through addConditions() so the file
    // matches what the user sees (scope + filters + search)
    const exportSection = widget.script.substring(widget.script.indexOf('exportQuery') - 600, widget.script.indexOf('exportQuery'));
    assert.ok(exportSection.includes('addConditions'), 'export query does not apply addConditions()');
  });

  await test('server script should expose export fields', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.exportFields'), 'server script does not set data.exportFields');
  });

  console.log('\n─── Template ───');

  await test('template should link to the platform list exporter', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(
      widget.template.includes('sn_customerservice_case_list.do'),
      'template does not link to /sn_customerservice_case_list.do'
    );
  });

  await test('export links should pass query and fields', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.template.includes('sysparm_query={{data.exportQuery}}'), 'missing sysparm_query binding');
    assert.ok(widget.template.includes('sysparm_fields={{data.exportFields}}'), 'missing sysparm_fields binding');
  });

  await test('export links should open in a new tab', async () => {
    assert.ok(widget, 'widget must exist first');
    const menuIdx = widget.template.indexOf('ahc-cl__export-menu');
    assert.ok(menuIdx !== -1, 'export menu markup not found');
    assert.ok(widget.template.substring(menuIdx, menuIdx + 600).includes('target="_blank"'), 'export links do not open in a new tab');
  });

  console.log('\n─── Client script ───');

  await test('client should offer PDF, Excel and CSV (same as OOB Data Table)', async () => {
    assert.ok(widget, 'widget must exist first');
    for (const fmt of ["'PDF'", "'EXCEL'", "'CSV'"]) {
      assert.ok(widget.client_script.includes(fmt), `missing export format ${fmt}`);
    }
  });

  await test('client reload should refresh the export query with the filters', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(
      widget.client_script.includes("'exportQuery'"),
      'reload() does not copy exportQuery — export would ignore filter changes made after page load'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
