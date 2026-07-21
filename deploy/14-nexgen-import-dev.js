/**
 * Next Gen KB — import prod content into dev (2026-07-09 content reset)
 *
 * The dev customer KB (formerly "Rainger", sys_id below) was seeded with demo
 * articles; the real content is being authored in PROD by the docs team.
 * This script makes the dev KB mirror prod:
 *
 *   1. PROD (read-only): fetch all active articles in the prod "Rainger" KB
 *   2. DEV: ensure the "Getting Started" category (parented to the KB, reactivating if needed)
 *   3. DEV: deactivate other active categories under the KB
 *   4. DEV: DELETE articles in the KB that are not in the prod set (seed/demo cleanup)
 *   5. DEV: upsert the prod articles (matched by short_description), scoping
 *      any embedded page-template CSS so it can't leak into the portal
 *      (see sanitizeArticleHtml) + categorize
 *   6. DEV: publish imported articles via one-time sysauto_script job
 *      (direct PATCH to workflow_state is blocked by business rules)
 *   7. DEV: rename the KB "Rainger" → "Next Gen"
 *
 * PROD is never written to. "Rainger (Internal)" is untouched in both instances.
 * Idempotent — safe to re-run; re-runs also pull article edits made in prod.
 *
 * Run: node deploy/14-nexgen-import-dev.js
 */
const fs     = require('fs');
const path   = require('path');
const axios  = require('axios');
const dotenv = require('dotenv');

const DEV_KB_ID  = '3902d2f793994f50408cbf3b6aba103f'; // dev customer KB (was "Rainger")
const PROD_KB_ID = '7ed6a5ad2b190318a0ebfe37b891bfd3'; // prod "Rainger" KB (read-only source)
const NEW_TITLE  = 'Next Gen';

// Single category for now (2026-07-09 request) — all imported articles land here.
const KEEP_CATS    = ['Getting Started'];
const DEFAULT_CAT  = 'Getting Started';

// CSS scoping lives in lib/article-scoper.js (shared with the prod fix script):
// the embedded template's global selectors get prefixed under a wrapper div so
// the authored design renders as-is without leaking into the portal.
const { sanitizeArticleHtml } = require('../lib/article-scoper');

function makeClient(envFile) {
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', envFile)));
  return axios.create({
    baseURL: env.SNOW_INSTANCE,
    auth: { username: env.SNOW_USER, password: env.SNOW_PASSWORD },
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    timeout: 30000
  });
}

const devClient  = makeClient('.env.dev');
const prodClient = makeClient('.env'); // used for GET only — never write to prod

async function getRows(client, table, query, fields, limit = 200) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

module.exports = async function importNexGen() {

  // ── 1. Fetch prod articles (READ-ONLY) ────────────────────────────────────
  console.log('\n  Fetching prod Rainger articles (read-only)...');
  const prodArticles = await getRows(
    prodClient,
    'kb_knowledge',
    `kb_knowledge_base=${PROD_KB_ID}^active=true^ORDERBYnumber`,
    'sys_id,number,short_description,text,keywords,article_type'
  );
  if (!prodArticles.length) throw new Error('No active articles found in prod Rainger KB — aborting before any dev changes.');
  console.log(`  Found ${prodArticles.length} prod articles:`);
  for (const a of prodArticles) console.log(`    ${a.number} "${a.short_description}"`);
  const prodTitles = new Set(prodArticles.map(a => a.short_description));

  // ── 2. Ensure How To + General categories in dev ──────────────────────────
  console.log('\n  Ensuring dev categories...');
  const catIds = {};
  for (const label of KEEP_CATS) {
    const existing = await getRows(devClient, 'kb_category', `label=${label}^parent_id=${DEV_KB_ID}`, 'sys_id,active', 1);
    if (existing.length) {
      catIds[label] = existing[0].sys_id;
      if (existing[0].active !== 'true') {
        await devClient.patch(`/api/now/table/kb_category/${catIds[label]}`, { active: true });
        console.log(`  [reactivated] category "${label}" (${catIds[label]})`);
      } else {
        console.log(`  [skip]    category "${label}" (${catIds[label]})`);
      }
    } else {
      const r = await devClient.post('/api/now/table/kb_category', {
        label, parent_id: DEV_KB_ID, parent_table: 'kb_knowledge_base', active: true
      });
      catIds[label] = r.data.result.sys_id;
      console.log(`  [created] category "${label}" (${catIds[label]})`);
    }
  }

  // ── 3. Deactivate the old seeded categories ───────────────────────────────
  console.log('\n  Deactivating old categories...');
  const activeCats = await getRows(devClient, 'kb_category', `parent_id=${DEV_KB_ID}^active=true`, 'sys_id,label');
  for (const c of activeCats) {
    if (KEEP_CATS.includes(c.label)) continue;
    await devClient.patch(`/api/now/table/kb_category/${c.sys_id}`, { active: false });
    console.log(`  [retired] category "${c.label}"`);
  }

  // ── 4. Delete dev articles that are not part of the prod set ──────────────
  console.log('\n  Cleaning up dev-only articles...');
  const devArticles = await getRows(
    devClient, 'kb_knowledge', `kb_knowledge_base=${DEV_KB_ID}`, 'sys_id,number,short_description'
  );
  let deleted = 0;
  for (const a of devArticles) {
    if (prodTitles.has(a.short_description)) continue;
    // Dev-only test fixtures (e.g. "TEST - Template Authoring Reference",
    // linked from KB_ARTICLE_TEMPLATE_GUIDE.md) survive imports.
    if (a.short_description.startsWith('TEST - ')) {
      console.log(`  [kept]    ${a.number} "${a.short_description}" (dev test fixture)`);
      continue;
    }
    await devClient.delete(`/api/now/table/kb_knowledge/${a.sys_id}`);
    console.log(`  [deleted] ${a.number} "${a.short_description}"`);
    deleted++;
  }
  if (!deleted) console.log('  [skip]    nothing to delete');

  // ── 5. Upsert prod articles into dev ──────────────────────────────────────
  console.log('\n  Importing prod articles...');
  const importedIds = [];
  for (const a of prodArticles) {
    const category = catIds[DEFAULT_CAT];
    const payload = {
      short_description: a.short_description,
      text:              sanitizeArticleHtml(a.text),
      keywords:          a.keywords,
      kb_knowledge_base: DEV_KB_ID,
      kb_category:       category,
      active:            true,
      valid_to:          '2100-01-01'
    };
    const existing = await getRows(
      devClient, 'kb_knowledge',
      `kb_knowledge_base=${DEV_KB_ID}^short_description=${a.short_description}`,
      'sys_id', 1
    );
    if (existing.length) {
      await devClient.patch(`/api/now/table/kb_knowledge/${existing[0].sys_id}`, payload);
      console.log(`  [updated] "${a.short_description}"`);
      importedIds.push(existing[0].sys_id);
    } else {
      const r = await devClient.post('/api/now/table/kb_knowledge', payload);
      console.log(`  [created] "${a.short_description}"`);
      importedIds.push(r.data.result.sys_id);
    }
  }

  // ── 6. Publish via one-time background job ────────────────────────────────
  console.log('\n  Publishing imported articles...');
  const unpublished = await getRows(
    devClient, 'kb_knowledge',
    `kb_knowledge_base=${DEV_KB_ID}^workflow_state!=published`,
    'sys_id,number'
  );
  if (!unpublished.length) {
    console.log('  [skip]    all articles already published');
  } else {
    const ids = unpublished.map(a => a.sys_id);
    const script =
      `var ids=${JSON.stringify(ids)};for(var i=0;i<ids.length;i++){var gr=new GlideRecord('kb_knowledge');` +
      `if(gr.get(ids[i])){gr.setWorkflow(false);gr.setValue('workflow_state','published');gr.update();}}`;
    const past = new Date(Date.now() - 5000).toISOString().replace('T', ' ').substring(0, 19);
    await devClient.post('/api/now/table/sysauto_script', {
      name:      `Next Gen Dev - Publish Imported Articles (${past})`,
      script,
      active:    true,
      run_type:  'once',
      run_start: past
    });
    console.log(`  [created] publish job for ${ids.length} articles`);

    // Poll until the job has run (usually seconds)
    for (let i = 0; i < 12; i++) {
      await sleep(5000);
      const remaining = await getRows(
        devClient, 'kb_knowledge',
        `kb_knowledge_base=${DEV_KB_ID}^workflow_state!=published`,
        'sys_id', 1
      );
      if (!remaining.length) { console.log('  [ok]      all articles published'); break; }
      if (i === 11) console.log('  [warn]    publish job has not finished yet — re-check in a minute');
    }
  }

  // ── 7. Rename KB → Next Gen ───────────────────────────────────────────────
  console.log('\n  Renaming KB...');
  const kb = (await getRows(devClient, 'kb_knowledge_base', `sys_id=${DEV_KB_ID}`, 'sys_id,title', 1))[0];
  if (!kb) throw new Error('Dev customer KB not found by sys_id');
  if (kb.title === NEW_TITLE) {
    console.log(`  [skip]    KB already titled "${NEW_TITLE}"`);
  } else {
    await devClient.patch(`/api/now/table/kb_knowledge_base/${DEV_KB_ID}`, { title: NEW_TITLE });
    console.log(`  [renamed] "${kb.title}" → "${NEW_TITLE}"`);
  }

  console.log('\n  Next Gen import complete.');
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
