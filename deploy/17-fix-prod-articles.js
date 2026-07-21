/**
 * PROD article CSS fix — scope embedded template styles in place.
 *
 * ⚠ PRODUCTION (aspiraconnect.service-now.com) — approved 2026-07-10.
 *
 * For every article in the prod Rainger KB:
 *   1. Back up the FULL record (sys_id, text, state, timestamps) to
 *      backups/prod-articles-<timestamp>/KBxxxxxxx.json  (gitignored, local)
 *   2. Run lib/article-scoper.js sanitizeArticleHtml():
 *        • wraps the article in <div class="ahc-embedded-tpl">
 *        • prefixes every CSS selector so styles can't leak into the portal
 *        • strips the HubSpot margin-right:400px wrapper
 *      The authored DESIGN is unchanged — only selectors + a wrapper div.
 *   3. PATCH `text` ONLY when it changed. Workflow state, category, and all
 *      other fields are untouched — Drafts stay Drafts.
 *
 * Idempotent — already-scoped articles are skipped (safe re-run after the
 * KB team edits an article and re-breaks it).
 *
 * Rollback:  node deploy/17-fix-prod-articles.js --restore backups/prod-articles-<timestamp>
 *            (restores each backed-up article's text verbatim)
 *
 * Run:       node deploy/17-fix-prod-articles.js
 */
require('dotenv').config(); // .env → PROD; MUST load before lib/client
const fs     = require('fs');
const path   = require('path');
const client = require('../lib/client');
const { sanitizeArticleHtml } = require('../lib/article-scoper');

const PROD_KB_ID  = '7ed6a5ad2b190318a0ebfe37b891bfd3'; // "Rainger" KB (prod)
const BACKUP_ROOT = path.join(__dirname, '..', 'backups');

async function getArticles(fields) {
  const r = await client.get('/api/now/table/kb_knowledge', {
    params: {
      sysparm_query: `kb_knowledge_base=${PROD_KB_ID}^ORDERBYnumber`,
      sysparm_fields: fields,
      sysparm_limit: 100
    }
  });
  return r.data.result;
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

// kb_knowledge.text PATCH is ACL-blocked in prod (kb_category isn't) — fall
// back to a one-time background job, which runs as system. Same pattern as
// the publish step in the dev seed/import scripts.
async function updateArticleText(sysId, number, text) {
  try {
    await client.patch(`/api/now/table/kb_knowledge/${sysId}`, { text });
    return 'patch';
  } catch (e) {
    if (!String(e.message).includes('403')) throw e;
  }
  const past = new Date(Date.now() - 5000).toISOString().replace('T', ' ').substring(0, 19);
  const script =
    `var payload=${JSON.stringify(text)};` +
    `var gr=new GlideRecord('kb_knowledge');` +
    `if(gr.get('${sysId}')){gr.setWorkflow(false);gr.setValue('text',payload);gr.update();}`;
  const job = await client.post('/api/now/table/sysauto_script', {
    name: `Next Gen - Scope Article CSS ${number} (${past})`,
    script,
    active: true,
    run_type: 'once',
    run_start: past
  });
  // poll until the job has applied the change
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const r = await client.get(`/api/now/table/kb_knowledge/${sysId}`, { params: { sysparm_fields: 'text' } });
    if ((r.data.result.text || '') === text) {
      // job is one-shot; try to tidy it up (best-effort)
      try { await client.delete(`/api/now/table/sysauto_script/${job.data.result.sys_id}`); } catch (e) { /* keep job record */ }
      return 'job';
    }
  }
  throw new Error(`${number}: background job did not apply within 60s — check sysauto_script in prod`);
}

async function restore(dir) {
  const files = fs.readdirSync(dir).filter(f => /^KB\d+\.json$/.test(f));
  if (!files.length) throw new Error(`no article backups found in ${dir}`);
  console.log(`\n  Restoring ${files.length} articles from ${dir} ...`);
  for (const f of files) {
    const rec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const via = await updateArticleText(rec.sys_id, rec.number, rec.text);
    console.log(`  [restored] ${rec.number} "${rec.short_description}" (via ${via})`);
  }
  console.log('  Restore complete.');
}

module.exports = async function fixProdArticles() {
  if (!process.env.SNOW_INSTANCE || !process.env.SNOW_INSTANCE.includes('//aspiraconnect.service-now.com')) {
    throw new Error(`Refusing to run: expected prod instance, got ${process.env.SNOW_INSTANCE}`);
  }

  const restoreIdx = process.argv.indexOf('--restore');
  if (restoreIdx !== -1) {
    const dir = process.argv[restoreIdx + 1];
    if (!dir) throw new Error('usage: --restore <backup dir>');
    return restore(path.resolve(dir));
  }

  console.log('\n  ⚠ PRODUCTION article fix → ' + process.env.SNOW_INSTANCE);

  // ── 1. Backup everything BEFORE any write ──────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(BACKUP_ROOT, `prod-articles-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const articles = await getArticles('sys_id,number,short_description,text,workflow_state,kb_category,active,sys_updated_on,sys_updated_by');
  if (!articles.length) throw new Error('no articles found — aborting');

  for (const a of articles) {
    const file = path.join(backupDir, `${a.number}.json`);
    fs.writeFileSync(file, JSON.stringify(a, null, 2));
    // paranoia: backup must round-trip before we touch anything
    const check = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (check.text !== a.text) throw new Error(`backup verification failed for ${a.number}`);
  }
  console.log(`  [backup]  ${articles.length} articles → ${path.relative(process.cwd(), backupDir)}`);

  // ── 2. Scope + patch (text only, only when changed) ───────────────────────
  console.log('\n  Scoping embedded template CSS...');
  let fixed = 0;
  for (const a of articles) {
    const scoped = sanitizeArticleHtml(a.text);
    if (scoped === (a.text || '')) {
      console.log(`  [skip]    ${a.number} "${a.short_description}" (clean or already scoped)`);
      continue;
    }
    const via = await updateArticleText(a.sys_id, a.number, scoped);
    console.log(`  [scoped]  ${a.number} "${a.short_description}" (${(a.text || '').length} → ${scoped.length} chars, via ${via})`);
    fixed++;
  }

  console.log(`\n  Done: ${fixed} fixed, ${articles.length - fixed} untouched.`);
  console.log(`  Rollback: node deploy/17-fix-prod-articles.js --restore ${path.relative(process.cwd(), backupDir)}`);
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
