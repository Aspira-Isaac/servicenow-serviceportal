/**
 * Integration tests for deploy/16-nextgen-portal-prod.js
 *
 * Verifies the "Next-Gen" pure-KB portal in PROD:
 *   • sp_portal /nextgen exists, points at the prod Rainger KB, NO catalog
 *   • KB-only theme/header/footer variants (no ticket links, no bell)
 *   • PUBLIC nextgen_kb page hosting ahc-kb-home with CTAs hidden — anonymous
 *     visitors get the widget's password gate, not a login bounce
 *   • Password gate: sys_properties exist, widget validates server-side,
 *     Rainger KB is guest-readable (no Guest cannot-read criteria)
 *   • "Getting Started" category parented to the KB (picker works)
 *   • The KB team's articles are UNTOUCHED (KB title still "Rainger",
 *     the 5 authored articles still present)
 *   • The prod /help portal is untouched
 *
 * READ-ONLY — no POST/PATCH/DELETE.
 * Run against prod: node tests/17-nextgen-portal-prod.test.js
 */
require('dotenv').config(); // .env → PROD
const assert = require('assert');
const client = require('../lib/client');

// ─── minimal test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

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

async function get(table, query, fields, limit = 20) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

const PROD_KB_ID = '7ed6a5ad2b190318a0ebfe37b891bfd3'; // "Rainger" KB (prod)
// Authored by the KB team as of 2026-07-09 — must never be touched by the deploy
const TEAM_ARTICLES = ['KB0010728', 'KB0010729', 'KB0010734', 'KB0010735', 'KB0010736'];

// ─── tests ───────────────────────────────────────────────────────────────────

async function run() {
  assert.ok(
    process.env.SNOW_INSTANCE.includes('//aspiraconnect.service-now.com'),
    'these tests must run against prod (.env)'
  );

  console.log('\n─── Portal record ───');

  let portal;
  await test('portal /nextgen exists with title "Next-Gen"', async () => {
    const portals = await get('sp_portal', 'url_suffix=nextgen', 'sys_id,title,theme,homepage,kb_knowledge_base,kb_knowledge_page,sc_catalog,sc_catalog_page,login_page', 1);
    assert.strictEqual(portals.length, 1, 'portal not found');
    portal = portals[0];
    assert.strictEqual(portal.title, 'Next-Gen', `title: "${portal.title}"`);
  });

  await test('portal uses the prod Rainger KB', async () => {
    assert.ok(portal, 'portal must exist first');
    assert.strictEqual(portal.kb_knowledge_base && portal.kb_knowledge_base.value, PROD_KB_ID);
  });

  await test('portal has NO catalog, NO catalog page, native-login fallback', async () => {
    assert.ok(portal, 'portal must exist first');
    assert.ok(!(portal.sc_catalog && portal.sc_catalog.value), 'sc_catalog should be empty');
    assert.ok(!(portal.sc_catalog_page && portal.sc_catalog_page.value), 'sc_catalog_page should be empty');
    assert.ok(!(portal.login_page && portal.login_page.value), 'login_page should be empty (native /login.do fallback)');
  });

  console.log('\n─── KB-only header / footer / theme ───');

  let headerTpl, footerTpl;
  await test('theme "Next Gen Theme" exists with variant header + footer + UXA hide', async () => {
    assert.ok(portal, 'portal must exist first');
    const themes = await get('sp_theme', `sys_id=${portal.theme.value}`, 'sys_id,name,header,footer', 1);
    assert.strictEqual(themes.length, 1, 'theme not found');
    assert.strictEqual(themes[0].name, 'Next Gen Theme');
    const hdr = await get('sp_header_footer', `sys_id=${themes[0].header.value}`, 'name,template', 1);
    const ftr = await get('sp_header_footer', `sys_id=${themes[0].footer.value}`, 'name,template,css', 1);
    assert.strictEqual(hdr[0].name, 'Next Gen Portal Header');
    assert.strictEqual(ftr[0].name, 'Next Gen Portal Footer');
    // sp_theme has no css column — UXA hide rules ride in the footer widget css
    assert.ok((ftr[0].css || '').includes('[class*="uxa-analytics"]'), 'footer css missing robust UXA hide rules');
    headerTpl = hdr[0].template;
    footerTpl = ftr[0].template;
  });

  await test('variant header/footer have no ticket surfaces', async () => {
    assert.ok(headerTpl && footerTpl, 'variants must exist first');
    for (const marker of ['?id=ticket_list', '?id=sc_category', '?id=ahc_index', 'ahc-nav__notif-btn', 'My Tickets']) {
      assert.ok(!headerTpl.includes(marker), `header still contains "${marker}"`);
    }
    assert.ok(headerTpl.includes('<ul class="ahc-nav__links"></ul>'), 'header lost the user-pill flex spacer');
    for (const marker of ['Submit a Ticket', '?id=sc_category']) {
      assert.ok(!footerTpl.includes(marker), `footer still contains "${marker}"`);
    }
  });

  console.log('\n─── Page + widget wiring ───');

  await test('public page nextgen_kb hosts ahc-kb-home with CTAs hidden', async () => {
    assert.ok(portal, 'portal must exist first');
    const pages = await get('sp_page', `id=nextgen_kb^sp_portal=${portal.sys_id}`, 'sys_id,public', 1);
    assert.strictEqual(pages.length, 1, 'nextgen_kb page not found');
    assert.strictEqual(pages[0].public, 'true', 'page must be public so anonymous visitors reach the password gate');
    assert.strictEqual(portal.homepage.value, pages[0].sys_id, 'portal homepage is not nextgen_kb');
    assert.strictEqual(portal.kb_knowledge_page.value, pages[0].sys_id, 'kb_knowledge_page is not nextgen_kb');
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'sys_id,template,script', 1);
    assert.strictEqual(widgets.length, 1, 'ahc-kb-home widget missing in prod');
    assert.ok(widgets[0].template.includes('!options.hide_ticket_cta'), 'widget lacks CTA option guard');
    assert.ok(widgets[0].script.includes('data.noCatalog'), 'widget lacks portal-aware guard');
    const instances = await get(
      'sp_instance',
      `sp_widget=${widgets[0].sys_id}^sp_column.sp_row.sp_container.sp_page=${pages[0].sys_id}`,
      'sys_id,widget_parameters', 1
    );
    assert.strictEqual(instances.length, 1, 'ahc-kb-home not wired to nextgen_kb');
    assert.ok((instances[0].widget_parameters || '').includes('hide_ticket_cta'), 'instance missing hide_ticket_cta');
  });

  await test('KB is in the portal M2M allowlist', async () => {
    assert.ok(portal, 'portal must exist first');
    const links = await get('m2m_sp_portal_knowledge_base', `sp_portal=${portal.sys_id}^kb_knowledge_base=${PROD_KB_ID}`, 'sys_id', 1);
    assert.strictEqual(links.length, 1, 'M2M portal↔KB link missing');
  });

  await test('"Getting Started" category exists, parented to the KB', async () => {
    const cats = await get('kb_category', `label=Getting Started^parent_id=${PROD_KB_ID}^active=true`, 'sys_id,parent_table', 1);
    assert.strictEqual(cats.length, 1, 'category missing or orphaned');
    assert.strictEqual(cats[0].parent_table, 'kb_knowledge_base');
  });

  console.log('\n─── Password gate ───');

  await test('gate password + TTL properties exist (password private, non-empty)', async () => {
    const pw = await get('sys_properties', 'name=ahc.nextgen.gate_password', 'sys_id,value,is_private', 1);
    assert.strictEqual(pw.length, 1, 'ahc.nextgen.gate_password property missing');
    assert.ok(pw[0].value, 'gate password property is empty — gate would lock everyone out');
    assert.strictEqual(pw[0].is_private, 'true', 'gate password property should be private');
    const ttl = await get('sys_properties', 'name=ahc.nextgen.gate_ttl_hours', 'sys_id,value', 1);
    assert.strictEqual(ttl.length, 1, 'ahc.nextgen.gate_ttl_hours property missing');
    assert.ok(parseInt(ttl[0].value, 10) > 0, `TTL should be positive hours, got "${ttl[0].value}"`);
  });

  await test('deployed widget carries the gate (server-side validation, no password in client)', async () => {
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'template,script,client_script', 1);
    const w = widgets[0];
    for (const marker of ['gate_unlock', 'GlideDigest', 'function gateOk', 'gateDenied']) {
      assert.ok(w.script.includes(marker), `server script missing "${marker}"`);
    }
    assert.ok(!w.client_script.includes('aspiranext'), 'client script must not contain the password');
    assert.ok(!w.template.includes('aspiranext'), 'template must not contain the password');
    for (const marker of ['ahcNextgenGate', 'gate_token', 'gate_exp']) {
      assert.ok(w.client_script.includes(marker), `client script missing "${marker}"`);
    }
    assert.ok(w.template.includes('ahc-kbh__gate'), 'template missing gate overlay');
    assert.ok(w.template.includes('!c.gateLocked'), 'template does not hide content while locked');
  });

  await test('Rainger KB is guest-readable (gate replaces login as the barrier)', async () => {
    const cannot = await get('kb_uc_cannot_read_mtom', `kb_knowledge_base=${PROD_KB_ID}^user_criteria.name=Guest User`, 'sys_id', 1);
    assert.strictEqual(cannot.length, 0, 'Guest User cannot-read criteria still blocks anonymous visitors');
    const can = await get('kb_uc_can_read_mtom', `kb_knowledge_base=${PROD_KB_ID}^user_criteria.name=Guest User`, 'sys_id', 1);
    assert.strictEqual(can.length, 1, 'Guest User can-read criteria missing');
  });

  await test('pure-KB portals sort category articles alphabetically; /help keeps views sort', async () => {
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'script', 1);
    const script = widgets[0].script;
    assert.ok(script.includes("orderBy('short_description')"), 'server script has no alphabetical sort');
    assert.ok(script.includes('data.noCatalog'), 'alphabetical sort should be scoped to pure-KB portals');
    assert.ok(script.includes("orderByDesc('sys_view_count')"), 'views-based sort for /help was removed');
  });

  console.log('\n─── KB team content untouched ───');

  await test('KB title is still "Rainger" (prod rename not approved)', async () => {
    const kbs = await get('kb_knowledge_base', `sys_id=${PROD_KB_ID}`, 'sys_id,title', 1);
    assert.strictEqual(kbs[0].title, 'Rainger', `KB title changed to "${kbs[0].title}"`);
  });

  await test('all 5 team-authored articles still exist', async () => {
    // Knowledge v3 versioning: one kb_knowledge row PER REVISION (same number),
    // so team edits create duplicates — compare the distinct number set
    const arts = await get('kb_knowledge', `kb_knowledge_base=${PROD_KB_ID}^numberIN${TEAM_ARTICLES.join(',')}`, 'sys_id,number', 50);
    const found = [...new Set(arts.map(a => a.number))].sort();
    assert.deepStrictEqual(found, [...TEAM_ARTICLES].sort(), `missing articles: found ${found.join(', ')}`);
  });

  // After deploy/17-fix-prod-articles.js: every embedded <style> block must be
  // scoped so it can't restyle the portal. Two safe conventions: import-scoped
  // (.ahc-embedded-tpl) or authored per the guide (.nx-article). This also
  // catches NEW unscoped articles the KB team adds — a failure here means the
  // fix script needs a re-run (or the author needs the guide).
  await test('no article ships unscoped global CSS', async () => {
    const articles = await get('kb_knowledge', `kb_knowledge_base=${PROD_KB_ID}`, 'number,short_description,text', 50);
    const SCOPES = ['.ahc-embedded-tpl', '.nx-article'];
    const problems = [];
    for (const a of articles) {
      const text = a.text || '';
      for (const block of text.match(/<style>([\s\S]*?)<\/style>/gi) || []) {
        const css = block.replace(/<\/?style>/gi, '').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const chunk of css.match(/[^{}]+\{/g) || []) {
          for (const sel of chunk.slice(0, -1).split(',')) {
            const s = sel.trim();
            if (!s || s.startsWith('@') || /^(\d+%|from|to)$/i.test(s)) continue;
            if (!SCOPES.some(scope => s.startsWith(scope))) {
              problems.push(`${a.number}: unscoped selector "${s}"`);
            }
          }
        }
      }
    }
    assert.strictEqual(problems.length, 0, `\n      ${problems.slice(0, 10).join('\n      ')}`);
  });

  console.log('\n─── /help portal untouched ───');

  await test('/help still has its catalog and ticket-capable header', async () => {
    const helpPortals = await get('sp_portal', 'url_suffix=help', 'sys_id,sc_catalog', 1);
    assert.strictEqual(helpPortals.length, 1, '/help portal not found');
    assert.ok(helpPortals[0].sc_catalog && helpPortals[0].sc_catalog.value, '/help lost its sc_catalog');
    const hdr = await get('sp_header_footer', 'name=Aspira Help Center Header', 'template', 1);
    assert.ok(hdr[0].template.includes('?id=ticket_list'), '/help header lost its My Tickets link');
  });

  // ─── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
