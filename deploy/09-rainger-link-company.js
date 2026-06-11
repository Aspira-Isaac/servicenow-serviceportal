/**
 * Rainger KB — link a company at migration time
 *
 * For each company being migrated to Rainger:
 *   1. Finds the company in core_company by name
 *   2. Creates "<Company> Customers" user criteria
 *   3. Links it to the Rainger customer KB (can_read)
 *   4. Adds { companySysId: raingerKbSysId } to ahc.kb.company_map
 *
 * Fully idempotent — safe to re-run for the same company.
 *
 * Usage: node deploy/09-rainger-link-company.js --company "Company Name"
 */
require('dotenv').config();
const client     = require('../lib/client');
const { upsert } = require('../lib/idempotent');

const CUSTOMER_KB_TITLE = 'Rainger';

async function findOne(table, query, fields = 'sys_id,name,title') {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: 1 }
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

async function updateCompanyMap(companySysId, kbSysId) {
  const existing = await findOne('sys_properties', `name=ahc.kb.company_map`, 'sys_id,name,value');
  let current = {};
  if (existing) {
    try { current = JSON.parse(existing.value || '{}'); } catch (e) {}
  }

  if (current[companySysId] === kbSysId) {
    console.log(`  [skip]    company already in ahc.kb.company_map`);
    return;
  }

  current[companySysId] = kbSysId;
  await upsert('sys_properties', 'name', 'ahc.kb.company_map', {
    name:  'ahc.kb.company_map',
    value: JSON.stringify(current)
  });
  console.log(`  [updated] ahc.kb.company_map: ${companySysId} → ${kbSysId}`);
}

module.exports = async function linkCompanyToRainger(ctx, companyName) {
  if (!companyName) throw new Error('companyName is required');

  // 1. Look up the Rainger customer KB
  console.log(`\n  Looking up Rainger KB...`);
  const kb = await findOne('kb_knowledge_base', `title=${CUSTOMER_KB_TITLE}`);
  if (!kb) throw new Error(`"${CUSTOMER_KB_TITLE}" KB not found — run 08-rainger-kb.js first`);
  const kbSysId = kb.sys_id;
  console.log(`  Rainger KB: ${kbSysId}`);

  // 2. Find the company
  console.log(`\n  Looking up company "${companyName}"...`);
  const company = await findOne('core_company', `name=${companyName}`, 'sys_id,name');
  if (!company) throw new Error(`Company "${companyName}" not found in core_company`);
  const companySysId = company.sys_id;
  console.log(`  Found: "${company.name}" (${companySysId})`);

  // 3. Create user criteria for this company's customers
  console.log(`\n  Creating user criteria (${companyName} Customers)...`);
  const ucName = `${companyName} Customers`;
  const { sys_id: ucSysId } = await upsert('user_criteria', 'name', ucName, {
    name:    ucName,
    company: companySysId,
    active:  true
  });

  // 4. Link criteria to Rainger KB
  console.log(`  Linking "${ucName}" to Rainger KB...`);
  await linkUserCriteriaToKb(kbSysId, ucSysId);

  // 5. Update portal routing map
  console.log(`\n  Updating ahc.kb.company_map...`);
  await updateCompanyMap(companySysId, kbSysId);

  console.log(`\n  Done. "${companyName}" now has access to the Rainger KB.`);
  ctx.linkedCompany    = company.name;
  ctx.linkedCompanySysId = companySysId;
  ctx.raingerKbSysId   = kbSysId;
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const companyFlag = args.indexOf('--company');
  if (companyFlag === -1 || !args[companyFlag + 1]) {
    console.error('Usage: node deploy/09-rainger-link-company.js --company "Company Name"');
    process.exit(1);
  }
  const companyName = args[companyFlag + 1];
  const ctx = {};
  module.exports(ctx, companyName)
    .then(() => console.log('\nDone.', ctx))
    .catch(e => { console.error(e.message); process.exit(1); });
}
