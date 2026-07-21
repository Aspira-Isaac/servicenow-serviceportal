/**
 * Rainger KB — fix category parents (dev)
 *
 * Repairs the categories created by early runs of 10-rainger-seed-dev.js,
 * which were created with only a label. A kb_category belongs to a KB via
 * parent_id + parent_table — without them the native category picker on the
 * Knowledge form shows nothing, so articles can't be categorized manually.
 *
 * For each Rainger KB (customer + internal):
 *   1. Collect the categories referenced by the KB's articles; PATCH any with
 *      an empty parent to parent_id=<KB>, parent_table=kb_knowledge_base.
 *      Categories already parented to a DIFFERENT KB are warned and skipped.
 *   2. De-duplicate: when multiple active categories under the KB share a
 *      label, keep the oldest, re-point this KB's articles to it, and
 *      deactivate the newer duplicate (only if nothing else references it).
 *
 * Only touches kb_category records our articles reference and article
 * kb_category values inside the two Rainger KBs. Idempotent — safe to re-run.
 *
 * Run: node deploy/13-rainger-fix-category-parents-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST load before lib/client
const client = require('../lib/client');

// Customer KB was renamed "Rainger" → "Next Gen" on 2026-07-09 (deploy/14-nexgen-import-dev.js)
const KB_TITLES = ['Next Gen', 'Rainger (Internal)'];

async function get(table, query, fields, limit = 100) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

async function fixKb(title) {
  console.log(`\n  ── ${title} ──`);
  const kbs = await get('kb_knowledge_base', `title=${title}`, 'sys_id', 1);
  if (!kbs.length) {
    console.log(`  [warn]    KB "${title}" not found — skipping`);
    return;
  }
  const kbId = kbs[0].sys_id;

  // 1. Parent every category referenced by this KB's articles
  const articles = await get('kb_knowledge', `kb_knowledge_base=${kbId}`, 'sys_id,kb_category');
  const catIds = [...new Set(articles.map(a => a.kb_category && a.kb_category.value).filter(Boolean))];

  for (const catId of catIds) {
    const cats = await get('kb_category', `sys_id=${catId}`, 'sys_id,label,parent_id,parent_table', 1);
    if (!cats.length) continue;
    const cat = cats[0];
    const parentId = cat.parent_id && cat.parent_id.value;

    if (!parentId) {
      await client.patch(`/api/now/table/kb_category/${catId}`, {
        parent_id:    kbId,
        parent_table: 'kb_knowledge_base'
      });
      console.log(`  [fixed]   "${cat.label}" → parented to ${title}`);
    } else if (parentId !== kbId) {
      console.log(`  [warn]    "${cat.label}" is parented to a different KB (${parentId}) — skipping`);
    } else {
      console.log(`  [skip]    "${cat.label}" already parented correctly`);
    }
  }

  // 2. De-duplicate same-label active categories under this KB
  const kbCats = await get('kb_category', `parent_id=${kbId}^active=true^ORDERBYsys_created_on`, 'sys_id,label,sys_created_on');
  const byLabel = {};
  for (const c of kbCats) (byLabel[c.label] = byLabel[c.label] || []).push(c);

  for (const label of Object.keys(byLabel)) {
    const group = byLabel[label];
    if (group.length < 2) continue;

    const keeper = group[0]; // oldest (ORDERBYsys_created_on)
    for (const dup of group.slice(1)) {
      // Re-point this KB's articles from the duplicate to the keeper
      const dupArticles = await get('kb_knowledge', `kb_knowledge_base=${kbId}^kb_category=${dup.sys_id}`, 'sys_id,number');
      for (const a of dupArticles) {
        await client.patch(`/api/now/table/kb_knowledge/${a.sys_id}`, { kb_category: keeper.sys_id });
        console.log(`  [moved]   ${a.number} → "${label}" (${keeper.sys_id})`);
      }

      // Deactivate the duplicate only if nothing else still references it
      const remaining = await get('kb_knowledge', `kb_category=${dup.sys_id}`, 'sys_id', 1);
      if (remaining.length) {
        console.log(`  [warn]    duplicate "${label}" (${dup.sys_id}) still referenced outside this KB — left active`);
      } else {
        await client.patch(`/api/now/table/kb_category/${dup.sys_id}`, { active: false });
        console.log(`  [merged]  duplicate "${label}" (${dup.sys_id}) deactivated, kept ${keeper.sys_id}`);
      }
    }
  }
}

module.exports = async function fixRaingerCategoryParents() {
  console.log('\n  Fixing Rainger KB category parents...');
  for (const title of KB_TITLES) await fixKb(title);
  console.log('\n  Category parent fix complete.');
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
