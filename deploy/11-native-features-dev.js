/**
 * Rainger — native feature activation (dev)
 *
 * Verifies/activates the following in the dev instance:
 *   A. CSAT    — read-only check; logs MANUAL REQUIRED if trigger not wired
 *   B. Quick Messages — creates 5 Rainger templates (skips if plugin inactive)
 *   C. Reports — creates 5 Rainger reports (additive; skips if already exist)
 *   D. VA      — read-only verification of key topics
 *
 * Purely additive — never modifies existing SNOW configuration.
 * All created records are prefixed "Rainger —" or "Rainger - " for easy identification.
 *
 * Run: node deploy/11-native-features-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST load before lib/client
const client     = require('../lib/client');
const { upsert } = require('../lib/idempotent');

// Known sys_ids from dev audit (2026-06-12)
const CSAT_FLOW_SYS_ID   = 'abed82970f0a101051e5721b68767ead';
const CSAT_SURVEY_SYS_ID = '87186844d7211100158ba6859e610378';

// ─── helpers ────────────────────────────────────────────────────────────────

async function findOne(table, query) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: 'sys_id,name,active', sysparm_limit: 1 }
  });
  return r.data.result && r.data.result.length ? r.data.result[0] : null;
}

// ─── section A: CSAT (read-only) ─────────────────────────────────────────────

async function checkCsat() {
  console.log('\n  [A] CSAT');

  const flow = await client.get(`/api/now/table/sys_hub_flow/${CSAT_FLOW_SYS_ID}`, {
    params: { sysparm_fields: 'name,active' }
  }).then(r => r.data.result).catch(() => null);

  if (!flow) {
    console.log('  [ERROR]   CSAT flow not found (sys_id may have changed)');
    return 'ERROR';
  }
  console.log(`  [OK]      Flow "${flow.name}" active=${flow.active}`);

  // Check if a trigger record is wired to this flow
  const trigger = await findOne(
    'sys_hub_trigger_instance',
    `flow=${CSAT_FLOW_SYS_ID}^active=true`
  );

  if (trigger) {
    console.log(`  [OK]      Case-close trigger wired (${trigger.sys_id})`);
    return 'OK';
  } else {
    console.log('  [MANUAL REQUIRED] No active trigger found for CSAT flow.');
    console.log('    → Flow Designer → "Set Customer Satisfaction Score"');
    console.log('    → Add trigger: Record → sn_customerservice_case → Updated → State changes to Closed');
    return 'MANUAL';
  }
}

// ─── section B: Quick Messages ───────────────────────────────────────────────

const QUICK_MESSAGES = [
  {
    name:    'Rainger - Greeting',
    message: 'Hi ${caller_name}, thanks for reaching out to Rainger support. I\'m happy to help you today.'
  },
  {
    name:    'Rainger - Gathering Info',
    message: 'To help you further, could you please provide your account email and reservation confirmation number?'
  },
  {
    name:    'Rainger - Escalating to Tier 2',
    message: 'I\'m escalating this case to our Tier 2 specialist team. You\'ll receive an update within 1 business day.'
  },
  {
    name:    'Rainger - Case Resolved',
    message: 'I\'m marking this case as resolved. If you need anything further, don\'t hesitate to reach back out — we\'re always happy to help.'
  },
  {
    name:    'Rainger - Payment Acknowledgment',
    message: 'I can see there was an issue with your payment. Let me look into this right away — please give me just a moment.'
  }
];

async function setupQuickMessages() {
  console.log('\n  [B] Quick Messages');

  // Probe table accessibility
  try {
    await client.get('/api/now/table/csm_quick_message', { params: { sysparm_limit: 1 } });
  } catch (e) {
    if (e.message.includes('400') || e.message.includes('403')) {
      console.log('  [MANUAL REQUIRED] csm_quick_message table not accessible.');
      console.log('    → System Applications → Plugins → activate com.sn_csm_quick_message');
      console.log('    → Then re-run this script to create Quick Messages automatically.');
      return 'MANUAL';
    }
    throw e;
  }

  for (const qm of QUICK_MESSAGES) {
    await upsert('csm_quick_message', 'name', qm.name, {
      name:    qm.name,
      message: qm.message,
      active:  true
    });
  }
  return 'OK';
}

// ─── section C: Reports ──────────────────────────────────────────────────────

const REPORTS = [
  {
    title:  'Rainger — Total Cases',
    table:  'sn_customerservice_case',
    type:   'list',
    filter: 'active=true^ORactive=false'
  },
  {
    title:  'Rainger — Cases by Category',
    table:  'sn_customerservice_case',
    type:   'pie',
    filter: 'state!=7'
  },
  {
    title:  'Rainger — Avg Time to Close',
    table:  'sn_customerservice_case',
    type:   'bar',
    filter: 'state=3'
  },
  {
    title:  'Rainger — SLA Compliance',
    table:  'task_sla',
    type:   'pie',
    filter: 'task.sys_class_name=sn_customerservice_case'
  },
  {
    title:  'Rainger — KB Article Views',
    table:  'kb_use',
    type:   'bar',
    filter: 'article.kb_knowledge_base.titleSTARTSWITHRainger'
  }
];

async function setupReports() {
  console.log('\n  [C] Reports');
  for (const report of REPORTS) {
    const existing = await findOne('sys_report', `title=${report.title}`);
    if (existing) {
      console.log(`  [skip]    "${report.title}"`);
      continue;
    }
    const r = await client.post('/api/now/table/sys_report', {
      title:  report.title,
      table:  report.table,
      type:   report.type,
      filter: report.filter,
      active: true
    });
    console.log(`  [created] "${report.title}" (${r.data.result.sys_id})`);
  }
  return 'OK';
}

// ─── section D: VA verification (read-only) ──────────────────────────────────

const VA_TOPICS = ['Create Case', 'Live Agent', 'Transfer to Live Agent'];

async function verifyVa() {
  console.log('\n  [D] Virtual Agent (verification only)');
  let allActive = true;
  for (const name of VA_TOPICS) {
    const topic = await findOne('sys_cs_topic', `name=${name}`);
    if (!topic) {
      console.log(`  [WARN]    topic "${name}" not found`);
      allActive = false;
    } else if (topic.active !== 'true') {
      console.log(`  [WARN]    topic "${name}" is inactive`);
      allActive = false;
    } else {
      console.log(`  [OK]      "${name}" is active`);
    }
  }
  return allActive ? 'OK' : 'WARN';
}

// ─── main ────────────────────────────────────────────────────────────────────

module.exports = async function activateNativeFeatures(ctx) {
  const results = {};

  results.csat          = await checkCsat();
  results.quickMessages = await setupQuickMessages();
  results.reports       = await setupReports();
  results.va            = await verifyVa();

  console.log('\n  ─────────────────────────────────────');
  console.log('  Summary');
  console.log('  ─────────────────────────────────────');
  console.log(`  CSAT:           ${results.csat}`);
  console.log(`  Quick Messages: ${results.quickMessages}`);
  console.log(`  Reports:        ${results.reports}`);
  console.log(`  VA Topics:      ${results.va}`);
  console.log('  ─────────────────────────────────────');

  const manualItems = Object.entries(results).filter(([, v]) => v === 'MANUAL');
  if (manualItems.length > 0) {
    console.log(`\n  ACTION REQUIRED: ${manualItems.map(([k]) => k).join(', ')} need manual steps (see above).`);
  }

  ctx.nativeFeatureResults = results;
};

if (require.main === module) {
  const ctx = {};
  module.exports(ctx)
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
