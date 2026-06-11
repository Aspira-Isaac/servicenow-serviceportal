/**
 * Rainger KB — initial setup
 *
 * Creates:
 *   • "Rainger" KB               — visible to Customer Knowledge & Training group
 *   • "Rainger (Internal)" KB    — visible to CSR agents only (backend)
 *
 * Access is intentionally minimal:
 *   - No company_map entry → portal-invisible for all customers
 *   - No CSR Agents link on customer KB (add later when ready)
 *   - No categories or articles (content uploaded manually)
 *
 * Pending (do later):
 *   - Link CSR Agents to Rainger customer KB
 *   - Run 09-rainger-link-company.js per company at migration time
 *
 * Run standalone: node deploy/08-rainger-kb.js
 */
require('dotenv').config();
const client     = require('../lib/client');
const { upsert } = require('../lib/idempotent');

const CUSTOMER_KB_TITLE = 'Rainger';
const AGENT_KB_TITLE    = 'Rainger (Internal)';

// Customer Knowledge & Training group sys_id
const CKT_GROUP_SYS_ID  = 'd913510087fa0510122d8446cebb35cc';

async function findOne(table, query) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: 'sys_id,name,title', sysparm_limit: 1 }
  });
  return r.data.result && r.data.result.length ? r.data.result[0] : null;
}

async function linkUserCriteriaToKb(kbSysId, ucSysId) {
  const existing = await findOne(
    'kb_uc_can_read_mtom',
    `kb_knowledge_base=${kbSysId}^user_criteria=${ucSysId}`
  );
  if (existing) {
    console.log(`  [skip]    criteria link already exists`);
    return existing.sys_id;
  }
  const r = await client.post('/api/now/table/kb_uc_can_read_mtom', {
    kb_knowledge_base: kbSysId,
    user_criteria:     ucSysId
  });
  console.log(`  [created] kb_uc_can_read_mtom (${r.data.result.sys_id})`);
  return r.data.result.sys_id;
}

module.exports = async function createRaingerKb(ctx) {

  // 1. Create the customer-facing KB
  console.log('\n  Creating Rainger customer KB...');
  const { sys_id: kbSysId } = await upsert('kb_knowledge_base', 'title', CUSTOMER_KB_TITLE, {
    title:       CUSTOMER_KB_TITLE,
    description: 'Shared customer-facing KB for Rainger migration. Companies added incrementally via 09-rainger-link-company.js.',
    active:      true
  });
  ctx.raingerKbSysId = kbSysId;
  console.log(`  Customer KB sys_id: ${kbSysId}`);

  // 2. Create the agent-only KB
  console.log('\n  Creating Rainger (Internal) KB...');
  const { sys_id: agentKbSysId } = await upsert('kb_knowledge_base', 'title', AGENT_KB_TITLE, {
    title:       AGENT_KB_TITLE,
    description: 'Internal KB for Rainger — CSR agents only. Not linked to any customer portal.',
    active:      true
  });
  ctx.raingerAgentKbSysId = agentKbSysId;
  console.log(`  Agent KB sys_id: ${agentKbSysId}`);

  // 3. Create user criteria — Customer Knowledge & Training group
  console.log('\n  Creating user criteria (Customer Knowledge & Training)...');
  const { sys_id: ucGroupSysId } = await upsert('user_criteria', 'name', 'Customer Knowledge & Training', {
    name:   'Customer Knowledge & Training',
    groups: CKT_GROUP_SYS_ID,
    active: true
  });

  // 4. Link CKT group to customer KB
  console.log('  Linking Customer Knowledge & Training to Rainger KB...');
  await linkUserCriteriaToKb(kbSysId, ucGroupSysId);

  // 5. Create/reuse CSR Agents Only criteria and link to agent KB
  console.log('\n  Creating user criteria (CSR Agents Only)...');
  const { sys_id: ucAgentOnlySysId } = await upsert('user_criteria', 'name', 'CSR Agents Only', {
    name:   'CSR Agents Only',
    roles:  'sn_customerservice.agent',
    active: true
  });
  console.log('  Linking CSR Agents Only to Rainger (Internal) KB...');
  await linkUserCriteriaToKb(agentKbSysId, ucAgentOnlySysId);

  console.log('\n  Rainger KB setup complete.');
  console.log(`  Customer KB:  ${kbSysId}`);
  console.log(`  Agent KB:     ${agentKbSysId}`);
  console.log('\n  Next steps:');
  console.log('  - Upload content manually in SNOW back-end');
  console.log('  - Run 09-rainger-link-company.js per company at migration time');
  console.log('  - Add CSR Agents criteria to customer KB when ready');
};

if (require.main === module) {
  require('dotenv').config();
  const ctx = {};
  module.exports(ctx)
    .then(() => console.log('\nDone.', ctx))
    .catch(e => { console.error(e.message); process.exit(1); });
}
