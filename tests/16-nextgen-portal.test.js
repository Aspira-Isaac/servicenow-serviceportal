/**
 * Integration tests for deploy/15-nextgen-portal-dev.js
 *
 * Verifies the "Next-Gen" pure-KB portal in dev:
 *   • sp_portal /nextgen exists, points at the Next Gen KB, and has NO catalog
 *   • Its theme/header/footer are the KB-only variants (no ticket links, no bell)
 *   • One portal-scoped PUBLIC page hosting ahc-kb-home with the ticket CTAs hidden
 *   • Password gate: sys_properties exist, widget carries the gate (server-side
 *     token validation), KB is guest-readable (no Guest cannot-read criteria)
 *   • Pure-KB portals sort category articles alphabetically
 *   • The /help portal is untouched (catalog + ticket header intact)
 *
 * READ-ONLY — no POST/PATCH/DELETE.
 * Run against dev: node tests/16-nextgen-portal.test.js
 */
require('dotenv').config({ path: '.env.dev' });
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

const DEV_KB_ID = '3902d2f793994f50408cbf3b6aba103f'; // "Next Gen" KB

// ─── tests ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n─── Portal record ───');

  let portal;
  await test('portal /nextgen exists with title "Next-Gen"', async () => {
    const portals = await get('sp_portal', 'url_suffix=nextgen', 'sys_id,title,theme,homepage,kb_knowledge_base,kb_knowledge_page,sc_catalog,sc_catalog_page,login_page', 1);
    assert.strictEqual(portals.length, 1, 'portal not found');
    portal = portals[0];
    assert.strictEqual(portal.title, 'Next-Gen', `title: "${portal.title}"`);
  });

  await test('portal uses the Next Gen KB', async () => {
    assert.ok(portal, 'portal must exist first');
    assert.strictEqual(portal.kb_knowledge_base && portal.kb_knowledge_base.value, DEV_KB_ID);
  });

  await test('portal has NO catalog and NO catalog page', async () => {
    assert.ok(portal, 'portal must exist first');
    const cat = portal.sc_catalog && portal.sc_catalog.value;
    const catPage = portal.sc_catalog_page && portal.sc_catalog_page.value;
    assert.ok(!cat, `sc_catalog should be empty, got ${cat}`);
    assert.ok(!catPage, `sc_catalog_page should be empty, got ${catPage}`);
  });

  await test('portal has a homepage, KB page and theme; login falls back to native /login.do', async () => {
    assert.ok(portal, 'portal must exist first');
    for (const f of ['homepage', 'kb_knowledge_page', 'theme']) {
      assert.ok(portal[f] && portal[f].value, `${f} not set`);
    }
    assert.strictEqual(portal.homepage.value, portal.kb_knowledge_page.value, 'homepage and kb_knowledge_page should be the same page');
    // Empty login_page → SP sends anonymous visitors to the NATIVE platform
    // login instead of the CSM login widget (which breaks with "GET is not allowed!")
    const login = portal.login_page && portal.login_page.value;
    assert.ok(!login, `login_page should be empty for native-login fallback, got ${login}`);
  });

  console.log('\n─── KB-only header / footer / theme ───');

  let headerTpl, footerTpl;
  await test('theme "Next Gen Theme" exists with variant header + footer', async () => {
    assert.ok(portal, 'portal must exist first');
    const themes = await get('sp_theme', `sys_id=${portal.theme.value}`, 'sys_id,name,header,footer', 1);
    assert.strictEqual(themes.length, 1, 'theme not found');
    assert.strictEqual(themes[0].name, 'Next Gen Theme');
    const hdr = await get('sp_header_footer', `sys_id=${themes[0].header.value}`, 'name,template', 1);
    const ftr = await get('sp_header_footer', `sys_id=${themes[0].footer.value}`, 'name,template', 1);
    assert.strictEqual(hdr[0].name, 'Next Gen Portal Header');
    assert.strictEqual(ftr[0].name, 'Next Gen Portal Footer');
    headerTpl = hdr[0].template;
    footerTpl = ftr[0].template;
  });

  await test('variant header has no ticket/catalog links and no notification bell', async () => {
    assert.ok(headerTpl, 'header must exist first');
    for (const marker of ['?id=ticket_list', '?id=sc_category', '?id=ahc_index', 'ahc-nav__notif-btn', 'My Tickets', 'ahc-notif-panel']) {
      assert.ok(!headerTpl.includes(marker), `header still contains "${marker}"`);
    }
    assert.ok(headerTpl.includes('href="{{data.portalUrl}}"'), 'brand logo should link to the portal root');
    assert.ok(headerTpl.includes('<ul class="ahc-nav__links"></ul>'), 'header lost the flex spacer that right-aligns the user pill');
    assert.ok(headerTpl.includes('ahc-nav__brand'), 'header lost its brand block');
    assert.ok(headerTpl.includes('ahc-nav__user'), 'header lost its user pill');
  });

  await test('variant footer has no ticket link', async () => {
    assert.ok(footerTpl, 'footer must exist first');
    for (const marker of ['Submit a Ticket', '?id=sc_category']) {
      assert.ok(!footerTpl.includes(marker), `footer still contains "${marker}"`);
    }
    assert.ok(footerTpl.includes('ahc-footer__copy'), 'footer lost its copyright line');
  });

  console.log('\n─── Page + widget wiring ───');

  await test('portal-scoped page nextgen_kb exists and hosts ahc-kb-home with CTAs hidden', async () => {
    assert.ok(portal, 'portal must exist first');
    const pages = await get('sp_page', `id=nextgen_kb^sp_portal=${portal.sys_id}`, 'sys_id,public', 1);
    assert.strictEqual(pages.length, 1, 'nextgen_kb page not found for portal');
    // Public page: anonymous visitors reach the widget, which shows the
    // password gate instead of the old login bounce
    assert.strictEqual(pages[0].public, 'true', 'page must be public so anonymous visitors reach the password gate');
    assert.strictEqual(portal.homepage.value, pages[0].sys_id, 'portal homepage is not the nextgen_kb page');
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'sys_id', 1);
    const instances = await get(
      'sp_instance',
      `sp_widget=${widgets[0].sys_id}^sp_column.sp_row.sp_container.sp_page=${pages[0].sys_id}`,
      'sys_id,widget_parameters', 1
    );
    assert.strictEqual(instances.length, 1, 'ahc-kb-home not wired to nextgen_kb page');
    assert.ok(
      (instances[0].widget_parameters || '').includes('hide_ticket_cta'),
      `instance missing hide_ticket_cta option: ${instances[0].widget_parameters}`
    );
  });

  await test('deployed ahc-kb-home widget guards ticket CTAs (option + portal-aware)', async () => {
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'sys_id,template,script', 1);
    assert.ok(widgets[0].template.includes('!options.hide_ticket_cta'), 'template has no hide_ticket_cta guard');
    // Portal-based guard: hides CTAs on catalog-less portals even for /help pages
    // rendered under /nextgen?id=… (SP pages are global across portals)
    assert.ok(widgets[0].template.includes('!data.noCatalog'), 'template has no noCatalog guard');
    assert.ok(widgets[0].script.includes('data.noCatalog'), 'server script does not compute noCatalog');
  });

  await test('Next Gen KB is in the portal M2M allowlist', async () => {
    assert.ok(portal, 'portal must exist first');
    const links = await get('m2m_sp_portal_knowledge_base', `sp_portal=${portal.sys_id}^kb_knowledge_base=${DEV_KB_ID}`, 'sys_id', 1);
    assert.strictEqual(links.length, 1, 'M2M portal↔KB link missing');
  });

  console.log('\n─── Password gate ───');

  await test('gate password property exists, is private, and has a value', async () => {
    const props = await get('sys_properties', 'name=ahc.nextgen.gate_password', 'sys_id,value,is_private', 1);
    assert.strictEqual(props.length, 1, 'ahc.nextgen.gate_password property missing');
    assert.ok(props[0].value, 'gate password property is empty — gate would lock everyone out');
    assert.strictEqual(props[0].is_private, 'true', 'gate password property should be private (excluded from update sets)');
  });

  await test('gate TTL property exists (hours)', async () => {
    const props = await get('sys_properties', 'name=ahc.nextgen.gate_ttl_hours', 'sys_id,value', 1);
    assert.strictEqual(props.length, 1, 'ahc.nextgen.gate_ttl_hours property missing');
    assert.ok(parseInt(props[0].value, 10) > 0, `TTL should be a positive number of hours, got "${props[0].value}"`);
  });

  await test('deployed widget carries the gate: server validates, client stores, template renders', async () => {
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'sys_id,template,script,client_script', 1);
    const w = widgets[0];
    // Server: unlock handler + token check that guards every data-returning path
    for (const marker of ['gate_unlock', 'GlideDigest', 'function gateOk', 'gateDenied']) {
      assert.ok(w.script.includes(marker), `server script missing "${marker}"`);
    }
    // Password must never be compared client-side (would leak in page source)
    assert.ok(!w.client_script.includes('aspiranext'), 'client script must not contain the password');
    assert.ok(!w.template.includes('aspiranext'), 'template must not contain the password');
    // Client: localStorage persistence + expiry
    for (const marker of ['ahcNextgenGate', 'gate_token', 'gate_exp']) {
      assert.ok(w.client_script.includes(marker), `client script missing "${marker}"`);
    }
    // Template: gate overlay markup, content hidden while locked
    assert.ok(w.template.includes('ahc-kbh__gate'), 'template missing gate overlay');
    assert.ok(w.template.includes('!c.gateLocked'), 'template does not hide content while gate is locked');
  });

  await test('Next Gen KB is guest-readable (gate replaces login as the barrier)', async () => {
    const cannot = await get('kb_uc_cannot_read_mtom', `kb_knowledge_base=${DEV_KB_ID}^user_criteria.name=Guest User`, 'sys_id', 1);
    assert.strictEqual(cannot.length, 0, 'Guest User cannot-read criteria still blocks anonymous visitors');
    const can = await get('kb_uc_can_read_mtom', `kb_knowledge_base=${DEV_KB_ID}^user_criteria.name=Guest User`, 'sys_id', 1);
    assert.strictEqual(can.length, 1, 'Guest User can-read criteria missing');
  });

  await test('pure-KB portals sort category articles alphabetically', async () => {
    const widgets = await get('sp_widget', 'id=ahc-kb-home', 'script', 1);
    const script = widgets[0].script;
    assert.ok(script.includes("orderBy('short_description')"), 'server script has no alphabetical sort');
    // /help keeps its views-based sort — alphabetical must be conditional
    assert.ok(script.includes('data.noCatalog'), 'alphabetical sort should be scoped to pure-KB portals');
    assert.ok(script.includes("orderByDesc('sys_view_count')"), 'views-based sort for /help was removed');
  });

  console.log('\n─── /help portal untouched ───');

  await test('/help still has its catalog and ticket-capable header', async () => {
    const helpPortals = await get('sp_portal', 'url_suffix=help', 'sys_id,sc_catalog,theme', 1);
    assert.strictEqual(helpPortals.length, 1, '/help portal not found');
    assert.ok(helpPortals[0].sc_catalog && helpPortals[0].sc_catalog.value, '/help lost its sc_catalog');
    const hdr = await get('sp_header_footer', 'name=Aspira Help Center Header', 'template', 1);
    assert.ok(hdr[0].template.includes('?id=ticket_list'), '/help header lost its My Tickets link');
  });

  console.log('\n─── /help leak fix (widget-guarded, pages stay public) ───');

  // The leak (inbound-email cases with opened_by=guest matched the case list's
  // personal scope for anonymous visitors) is closed at the WIDGET layer, NOT
  // by page publicity. Pages MUST stay public: external CSM customers lack the
  // `admin` role and cannot read a non-public sp_page (renders "Not Found").
  await test('all /help pages are public (external customers can read them)', async () => {
    for (const id of ['ahc_index', 'ahc_submit_ticket', 'ahc_kb_search', 'ticket_list', 'ticket_detail', 'ahc_kb_category', 'ahc_kb_article']) {
      const pages = await get('sp_page', `id=${id}`, 'id,public', 5);
      assert.ok(pages.length >= 1, `page ${id} not found`);
      for (const p of pages) {
        assert.strictEqual(p.public, 'true', `page ${id} is non-public — external customers get "Not Found"`);
      }
    }
  });

  await test('case-list widget refuses anonymous sessions (the actual leak fix)', async () => {
    const widgets = await get('sp_widget', 'id=ahc-case-list', 'script', 1);
    assert.strictEqual(widgets.length, 1, 'ahc-case-list widget not found');
    assert.ok(widgets[0].script.includes('gs.isLoggedIn()'), 'case-list server script has no login guard');
  });

  await test('/help header hides nav links + bell for anonymous visitors', async () => {
    const hdr = await get('sp_header_footer', 'name=Aspira Help Center Header', 'template', 1);
    assert.strictEqual(hdr.length, 1, 'header not found');
    const t = hdr[0].template;
    assert.ok(t.includes('<ul class="ahc-nav__links" ng-if="data.isLoggedIn">'), 'nav links not gated on login');
    assert.ok(t.includes('<div class="ahc-nav__notif-wrap" ng-if="data.isLoggedIn">'), 'notification bell not gated on login');
    // The Sign In link stays for logged-out users
    assert.ok(t.includes('ng-if="!data.isLoggedIn"'), 'Sign In affordance lost for anonymous visitors');
  });

  // ─── summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
