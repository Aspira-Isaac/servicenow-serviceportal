/**
 * Integration tests for deploy/11-native-features-dev.js
 *
 * READ-ONLY — no POST/PATCH/DELETE. Verifies CSAT, Quick Messages, and Reports.
 * Run against dev: node tests/11-native-features.test.js
 * Expected before script: CSAT passes (already active), QM/Reports fail.
 * Expected after script: all pass (or QM skipped with note if plugin inactive).
 */
require('dotenv').config({ path: '.env.dev' });
const assert = require('assert');
const client = require('../lib/client');

// ─── minimal test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    if (err.skip) {
      console.log(`  ○ ${name} (skipped: ${err.message})`);
      skipped++;
    } else {
      console.error(`  ✗ ${name}`);
      console.error(`    → ${err.message}`);
      failed++;
    }
  }
}

function skip(reason) {
  const e = new Error(reason);
  e.skip = true;
  throw e;
}

async function get(table, query, fields = 'sys_id,name,active', limit = 20) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query || 'active=true', sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

// Known sys_ids from audit (2026-06-12)
const CSAT_FLOW_SYS_ID    = 'abed82970f0a101051e5721b68767ead';
const CSAT_SURVEY_SYS_ID  = '87186844d7211100158ba6859e610378';

// ─── tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n─── CSAT ───');

  await test('CSAT flow "Set Customer Satisfaction Score" should be active', async () => {
    const r = await client.get(`/api/now/table/sys_hub_flow/${CSAT_FLOW_SYS_ID}`, {
      params: { sysparm_fields: 'name,active' }
    });
    const flow = r.data.result;
    assert.ok(flow, 'CSAT flow record not found');
    assert.strictEqual(flow.active, 'true', `CSAT flow is inactive`);
  });

  await test('"Customer Satisfaction Survey" template should be active', async () => {
    const r = await client.get(`/api/now/table/asmt_metric_type/${CSAT_SURVEY_SYS_ID}`, {
      params: { sysparm_fields: 'name,active' }
    });
    const survey = r.data.result;
    assert.ok(survey, 'Customer Satisfaction Survey template not found');
    assert.strictEqual(survey.active, 'true', 'Survey template is inactive');
  });

  console.log('\n─── Quick Messages ───');

  let qmAccessible = false;
  try {
    await client.get('/api/now/table/csm_quick_message', { params: { sysparm_limit: 1 } });
    qmAccessible = true;
  } catch (e) {
    // table not accessible — plugin likely not active
  }

  await test('should have 5 Rainger quick messages', async () => {
    if (!qmAccessible) skip('csm_quick_message table not accessible — plugin com.sn_csm_quick_message may not be active');
    const messages = await get('csm_quick_message', 'nameLIKERainger', 'sys_id,name,message');
    assert.strictEqual(messages.length, 5, `expected 5 Rainger quick messages, got ${messages.length}`);
  });

  await test('Rainger quick messages should not have empty body', async () => {
    if (!qmAccessible) skip('csm_quick_message table not accessible');
    const messages = await get('csm_quick_message', 'nameLIKERainger', 'sys_id,name,message');
    const empty = messages.filter(m => !m.message || m.message.trim() === '');
    assert.strictEqual(empty.length, 0, `messages with empty body: ${empty.map(m => m.name).join(', ')}`);
  });

  await test('Rainger quick message names should all be prefixed "Rainger - "', async () => {
    if (!qmAccessible) skip('csm_quick_message table not accessible');
    const messages = await get('csm_quick_message', 'nameLIKERainger', 'sys_id,name');
    const wrong = messages.filter(m => !m.name.startsWith('Rainger - '));
    assert.strictEqual(wrong.length, 0, `messages without "Rainger - " prefix: ${wrong.map(m => m.name).join(', ')}`);
  });

  console.log('\n─── Reports ───');

  const EXPECTED_REPORT_TITLES = [
    'Rainger — Total Cases',
    'Rainger — Cases by Category',
    'Rainger — Avg Time to Close',
    'Rainger — SLA Compliance',
    'Rainger — KB Article Views',
  ];

  const EXPECTED_TABLES = {
    'Rainger — Total Cases':        'sn_customerservice_case',
    'Rainger — Cases by Category':  'sn_customerservice_case',
    'Rainger — Avg Time to Close':  'sn_customerservice_case',
    'Rainger — SLA Compliance':     'task_sla',
    'Rainger — KB Article Views':   'kb_use',
  };

  let reports = [];

  await test('should have 5 Rainger reports', async () => {
    reports = await get('sys_report', 'titleLIKERainger', 'sys_id,title,table,active', 20);
    assert.strictEqual(reports.length, 5, `expected 5 Rainger reports, got ${reports.length}: ${reports.map(r => r.title).join(', ')}`);
  });

  await test('all Rainger reports should be active', async () => {
    if (reports.length === 0) skip('no Rainger reports found — run previous test first');
    const inactive = reports.filter(r => r.active === 'false');
    assert.strictEqual(inactive.length, 0, `inactive reports: ${inactive.map(r => r.title).join(', ')}`);
  });

  await test('Rainger reports should target the correct tables', async () => {
    if (reports.length === 0) skip('no Rainger reports found');
    for (const r of reports) {
      const expected = EXPECTED_TABLES[r.title];
      if (expected) {
        assert.strictEqual(r.table, expected, `"${r.title}" should target table "${expected}", got "${r.table}"`);
      }
    }
  });

  await test('all expected Rainger report titles should exist', async () => {
    if (reports.length === 0) skip('no Rainger reports found');
    const existingTitles = reports.map(r => r.title);
    const missing = EXPECTED_REPORT_TITLES.filter(t => !existingTitles.includes(t));
    assert.strictEqual(missing.length, 0, `missing reports: ${missing.join(', ')}`);
  });

  console.log('\n─── Virtual Agent (verification only) ───');

  await test('"Create Case" VA topic should be active', async () => {
    const results = await get('sys_cs_topic', 'name=Create Case', 'sys_id,name,active', 1);
    assert.strictEqual(results.length, 1, '"Create Case" topic not found');
    assert.strictEqual(results[0].active, 'true', '"Create Case" topic is inactive');
  });

  await test('"Live Agent" VA topic should be active', async () => {
    const results = await get('sys_cs_topic', 'name=Live Agent', 'sys_id,name,active', 1);
    assert.strictEqual(results.length, 1, '"Live Agent" topic not found');
    assert.strictEqual(results[0].active, 'true', '"Live Agent" topic is inactive');
  });

  await test('"Transfer to Live Agent" VA topic should be active', async () => {
    const results = await get('sys_cs_topic', 'name=Transfer to Live Agent', 'sys_id,name,active', 1);
    assert.strictEqual(results.length, 1, '"Transfer to Live Agent" topic not found');
    assert.strictEqual(results[0].active, 'true', '"Transfer to Live Agent" topic is inactive');
  });

  // ─── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed + skipped} tests: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  if (!qmAccessible) {
    console.log('  NOTE: Quick Message tests skipped — activate plugin com.sn_csm_quick_message');
    console.log('        then re-run deploy/11-native-features-dev.js and this test suite.\n');
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
