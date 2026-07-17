/**
 * Aspira Help Center — DEV portal deploy
 *
 * Deploys the full portal to aspiraconnecttest.service-now.com.
 *
 * Differences from production (deploy/index.js):
 *   • Targets dev instance (.env.dev)
 *   • Portal KB → Rainger (instead of Consumer Service)
 *   • Widgets loaded with widgets-dev/ override layer (05-widgets.js)
 *   • Deploys ahc-kb-categories (with dev overrides) + ahc-kb-article-list
 *   • Creates ahc_kb_category page for article listings
 *   • Patches kb_knowledge_page to the portal's own ahc_kb_search page
 *   • Adds Rainger KB to the portal's M2M KB allowlist
 *
 * Run: node deploy/index-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST be before any require('../lib/client')

const fs   = require('fs');
const path = require('path');
const client     = require('../lib/client');
const { upsert } = require('../lib/idempotent');

const RAINGER_KB_ID = '3902d2f793994f50408cbf3b6aba103f';

// Shared context — sys_ids flow between steps
const ctx = {
  portalKbSysId:      RAINGER_KB_ID,  // tells 03-portal.js to use Rainger KB instead of Consumer Service
  widgetsOverrideDir: 'widgets-dev',  // 05-widgets.js checks here first, falls back to widgets/
  showKbNav:          true,           // adds Knowledge link to nav + footer (dev only)
  catalogId:          '65bcd377c3011200b12d9f2974d3aea0' // Customer Service catalog (scopes nav/footer links)
};

async function step(name, fn) {
  console.log(`\n[${name}]`);
  try {
    await fn(ctx);
  } catch (err) {
    console.error(`\nFATAL: Step "${name}" failed: ${err.message}`);
    process.exit(1);
  }
}

// Read a widget file — checks widgets-dev/ first, falls back to widgets/
function readWidget(widgetDir, file) {
  const override = path.join(__dirname, '..', 'widgets-dev', widgetDir, file);
  if (fs.existsSync(override)) return fs.readFileSync(override, 'utf8');
  const base = path.join(__dirname, '..', 'widgets', widgetDir, file);
  return fs.existsSync(base) ? fs.readFileSync(base, 'utf8') : '';
}

async function deployInlineWidget(id, name, dir) {
  const { sys_id } = await upsert('sp_widget', 'id', id, {
    id,
    name,
    template:      readWidget(dir, 'template.html'),
    client_script: readWidget(dir, 'client.js'),
    script:        readWidget(dir, 'server.js'),
    css:           readWidget(dir, 'style.scss'),
    public: true
  });
  console.log(`  Widget "${name}" (${id}): ${sys_id}`);
  return sys_id;
}

async function run() {
  console.log('\n========================================');
  console.log('  Aspira Help Center — DEV Deploy');
  console.log(`  ${process.env.SNOW_INSTANCE}/help`);
  console.log('========================================');

  // ── Shared pipeline steps 00–05 ──────────────────────────────────────────
  await step('00-preflight',     require('./00-preflight'));
  await step('01-theme',         require('./01-theme'));
  await step('02-header-footer', require('./02-header-footer'));
  await step('03-portal',        require('./03-portal'));
  await step('04-pages',         require('./04-pages'));

  // ── DEV-only: create portal-scoped pages ─────────────────────────────────
  console.log('\n[04b-dev] DEV-only pages');
  async function ensurePage(id, title) {
    const stored = id.replace(/-/g, '_');
    const r = await client.get('/api/now/table/sp_page', {
      params: { sysparm_query: `id=${stored}^sp_portal=${ctx.portalSysId}`, sysparm_fields: 'sys_id', sysparm_limit: 1 }
    });
    if (r.data.result.length) {
      console.log(`  [exists]  ${stored}: ${r.data.result[0].sys_id}`);
      return r.data.result[0].sys_id;
    }
    const created = await client.post('/api/now/table/sp_page', {
      // NEVER public — see deploy/04-pages.js (2026-07-17 anonymous case leak)
      title, id, sp_portal: ctx.portalSysId, public: 'false'
    });
    console.log(`  [created] ${stored}: ${created.data.result.sys_id}`);
    return created.data.result.sys_id;
  }

  // ahc_kb_category — article listing for a category
  ctx.pageCategoryArticles = await ensurePage('ahc-kb-category', 'KB Category Articles');
  // ahc_kb_article — custom article view page on the Rainger portal
  ctx.pageArticle          = await ensurePage('ahc-kb-article',  'Knowledge Base Article');

  // ── DEV-only: patch kb_knowledge_page to portal's own KB page ────────────
  // 03-portal.js set it to the shared kb_home page; override now that pages exist
  console.log('\n[04c-dev] Patch kb_knowledge_page → ahc_kb_search');
  await client.patch(`/api/now/table/sp_portal/${ctx.portalSysId}`, {
    kb_knowledge_page: ctx.pageKb
  });
  console.log(`  kb_knowledge_page → ${ctx.pageKb}`);

  await step('05-widgets', require('./05-widgets'));

  // ── DEV-only: deploy dev-specific widgets ────────────────────────────────
  // These are not in the shared 05-widgets pipeline (dev portal only).
  // readWidget() applies widgets-dev/ overrides automatically.
  console.log('\n[05b-dev] Dev widgets');
  ctx.widgetKbHome       = await deployInlineWidget('ahc-kb-home',          'AHC KB Home',          'ahc-kb-home');
  ctx.widgetKbCategories = await deployInlineWidget('ahc-kb-categories',    'AHC KB Categories',    'ahc-kb-categories');
  ctx.widgetArticleList  = await deployInlineWidget('ahc-kb-article-list',  'AHC KB Article List',  'ahc-kb-article-list');
  ctx.widgetArticleView  = await deployInlineWidget('ahc-kb-article-view',  'AHC KB Article View',  'ahc-kb-article-view');

  // Stub widget — empty template used to silence old KB slots at orders 100/200
  const stubResult = await upsert('sp_widget', 'id', 'ahc-kb-stub', {
    id: 'ahc-kb-stub', name: 'AHC KB Stub (Hidden)', template: '', client_script: '', script: '', css: '', public: true
  });
  ctx.widgetKbStub = stubResult.sys_id;
  console.log(`  Widget "AHC KB Stub" (ahc-kb-stub): ${ctx.widgetKbStub}`);

  // ── Shared pipeline step 06 (picks up ctx keys automatically) ─────────────
  // 06-layout.js wires:
  //   - ahc-kb-categories  → ahc_kb_search page   (when ctx.widgetKbCategories set)
  //   - ahc-kb-article-list → ahc_kb_category page (when ctx.widgetArticleList + ctx.pageCategoryArticles set)
  await step('06-layout', require('./06-layout'));

  // ── DEV-only: link Rainger KB to portal M2M allowlist ────────────────────
  console.log('\n[07-dev] KB → Portal M2M');
  const existing = await client.get('/api/now/table/m2m_sp_portal_knowledge_base', {
    params: { sysparm_query: `sp_portal=${ctx.portalSysId}^kb_knowledge_base=${RAINGER_KB_ID}`, sysparm_fields: 'sys_id', sysparm_limit: 1 }
  });
  if (existing.data.result.length) {
    console.log('  [skip]    Rainger KB already linked to portal');
  } else {
    await client.post('/api/now/table/m2m_sp_portal_knowledge_base', {
      sp_portal: ctx.portalSysId, kb_knowledge_base: RAINGER_KB_ID
    });
    console.log('  [created] Rainger KB linked to portal');
  }

  console.log('\n========================================');
  console.log('  DEV deploy complete!');
  console.log(`  Portal: ${process.env.SNOW_INSTANCE}/help`);
  console.log('========================================\n');
}

run();
