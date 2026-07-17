/**
 * Shared builder for the Next-Gen pure-KB Service Portal (/nextgen).
 * Entry scripts load the right .env BEFORE requiring this module:
 *   deploy/15-nextgen-portal-dev.js  → dev  (.env.dev, "Next Gen" KB)
 *   deploy/16-nextgen-portal-prod.js → prod (.env,     "Rainger" KB)
 *
 * Steps:
 *   1. Derive KB-only header/footer variants from the deployed /help ones:
 *      header minus Catalog/Knowledge/My Tickets links + notification bell
 *      (kept as a flex spacer so the user pill stays right-aligned), footer
 *      minus ticket links. Separate sp_header_footer records — /help untouched.
 *   2. "Next Gen Theme" — /help theme CSS + variant header/footer; the UXA
 *      "usage insights" hide rules are appended if the source theme lacks them.
 *   3. sp_portal url_suffix=nextgen — kb_knowledge_base = the given KB,
 *      NO sc_catalog / sc_catalog_page, EMPTY login_page (SP then falls back
 *      to the native /login.do for anonymous visitors — the CSM login widget
 *      throws "Login: GET is not allowed!" when rendered in place).
 *   4. Redeploy ahc-kb-home from widgets-dev/ (portal-aware ticket-CTA guards,
 *      sticky-sidebar fix).
 *   5. Page "nextgen_kb" hosting ahc-kb-home with {"hide_ticket_cta": true};
 *      set as portal homepage AND kb_knowledge_page. Non-public by default
 *      (anonymous → login); PUBLIC when opts.passwordGate is set — the widget
 *      then shows a password gate and withholds all data server-side until a
 *      valid gate token is presented.
 *   6. M2M allowlist link portal ↔ KB.
 *   7. Ensure a "Getting Started" category parented to the KB (kb_category
 *      needs parent_id/parent_table or the native category picker is empty).
 *   8. (passwordGate only) Gate wiring:
 *      • sys_properties ahc.nextgen.gate_password (private) + gate_ttl_hours —
 *        created if missing, NEVER overwritten (rotate in the instance UI)
 *      • KB made guest-readable: the "Guest User" cannot-read criteria is
 *        REMOVED (cannot-read beats can-read, so it would blank the portal)
 *        and "Guest User" is added to can-read. The password gate becomes the
 *        only barrier for anonymous visitors — do NOT enable for KBs with
 *        content that must stay behind real auth.
 *
 * NEVER touches kb_knowledge (articles). Purely additive to /help.
 * Idempotent — safe to re-run.
 */
const fs     = require('fs');
const path   = require('path');
const client = require('./client');
const { upsert } = require('./idempotent');

const PORTAL_TITLE = 'Next-Gen';
const URL_SUFFIX   = 'nextgen';
const PAGE_ID      = 'nextgen-kb'; // SNOW stores it as nextgen_kb

// Keep in sync with deploy/01-theme.js — appended when the source theme
// predates the fix (e.g. prod, where /help hasn't been redeployed).
const UXA_HIDE_CSS = `
/* Hide SNOW UXA analytics floating button/panel ("usage insights").
   Angular prepends classes at runtime — use substring matches. */
#uxa-analytics-btn,
#uxa-iframe,
[id*="uxa"],
[class*="uxa-analytics"],
.uxa-analytics-root,
[aria-label="Agent analytics window"] {
  display: none !important;
}
`;

// ─── helpers ────────────────────────────────────────────────────────────────

async function getRows(table, query, fields, limit = 20) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

async function findOrCreate(table, query, payload, label) {
  const existing = await getRows(table, query, 'sys_id', 1);
  if (existing.length) {
    console.log(`  [skip]    ${label}`);
    return existing[0].sys_id;
  }
  const r = await client.post(`/api/now/table/${table}`, payload);
  console.log(`  [created] ${label} (${r.data.result.sys_id})`);
  return r.data.result.sys_id;
}

// Remove the section between two markers (markers removed too). Throws if a
// marker is missing so a header refactor can't silently ship ticket links.
function cutBetween(str, startMarker, endMarker, label) {
  const s = str.indexOf(startMarker);
  if (s === -1) throw new Error(`transform: start marker not found for ${label}`);
  const e = str.indexOf(endMarker, s);
  if (e === -1) throw new Error(`transform: end marker not found for ${label}`);
  return str.slice(0, s) + str.slice(e + endMarker.length);
}

// Optional variant — the prod /help header may predate a feature (e.g. the
// notification bell); skip the cut when the section isn't there.
function cutIfPresent(str, startMarker, endMarker, label) {
  if (!str.includes(startMarker)) {
    console.log(`  [skip]    header has no ${label} — nothing to remove`);
    return str;
  }
  return cutBetween(str, startMarker, endMarker, label);
}

// ─── main ────────────────────────────────────────────────────────────────────

module.exports = async function buildNextGenPortal({ kbSysId, passwordGate }) {
  if (!kbSysId) throw new Error('buildNextGenPortal: kbSysId is required');
  if (passwordGate && !passwordGate.password) throw new Error('buildNextGenPortal: passwordGate.password is required when the gate is enabled');

  // ── 1. KB-only header/footer variants (derived from the deployed /help ones)
  console.log('\n  Building KB-only header/footer variants...');
  const [srcHeader] = await getRows('sp_header_footer', 'name=Aspira Help Center Header', 'sys_id,template,css,script,client_script', 1);
  const [srcFooter] = await getRows('sp_header_footer', 'name=Aspira Help Center Footer', 'sys_id,template,css', 1);
  if (!srcHeader || !srcFooter) throw new Error('Source /help header/footer not found — run the main deploy first.');

  let headerTpl = srcHeader.template;
  // Markers omit the closing ">" so they still match after attributes are
  // added to the tag (e.g. ng-if="data.isLoggedIn", added 2026-07-17).
  headerTpl = cutBetween(headerTpl, '<ul class="ahc-nav__links"', '</ul>', 'nav links');
  // The removed <ul> carried flex:1 — keep an empty one as the spacer that
  // pushes the user pill to the right edge of the navbar.
  if (!headerTpl.includes('<div class="ahc-nav__right">')) throw new Error('header transform: nav-right marker not found');
  headerTpl = headerTpl.replace('<div class="ahc-nav__right">', '<ul class="ahc-nav__links"></ul>\n      <div class="ahc-nav__right">');
  headerTpl = cutIfPresent(headerTpl, '<div class="ahc-nav__notif-wrap"', '<!-- End notif wrap -->', 'notification bell');
  headerTpl = cutIfPresent(headerTpl, '<div class="ahc-notif-backdrop"', '></div>', 'notification backdrop');
  headerTpl = headerTpl.replace('<span class="ahc-nav__divider"></span>', '');
  // Logo → portal root (resolves to this portal's homepage). The /help brand link
  // targets ?id=ahc_index, which would render the ticket homepage inside /nextgen —
  // SP pages are global, so any portal can render any page id via ?id=.
  if (!headerTpl.includes('href="{{data.portalUrl}}?id=ahc_index"')) throw new Error('header transform: brand link marker not found');
  headerTpl = headerTpl.replace('href="{{data.portalUrl}}?id=ahc_index"', 'href="{{data.portalUrl}}"');
  for (const leftover of ['?id=ticket_list', '?id=sc_category', '?id=ahc_index', 'ahc-notif']) {
    if (headerTpl.includes(leftover)) throw new Error(`header variant still contains "${leftover}"`);
  }

  let footerTpl = cutBetween(srcFooter.template, '<div class="ahc-footer__links">', '</div>', 'footer links');
  if (footerTpl.includes('Submit a Ticket')) throw new Error('footer variant still contains ticket link');

  // UXA "usage insights" hide rules ride in the FOOTER css (sp_theme has no
  // real css column — REST drops it silently). The prod /help footer predates
  // the robust selectors, so append them when missing.
  let footerCss = srcFooter.css || '';
  if (!footerCss.includes('[class*="uxa-analytics"]')) {
    footerCss += UXA_HIDE_CSS;
    console.log('  [added]   robust UXA hide rules to footer css');
  }

  const { sys_id: headerSysId } = await upsert('sp_header_footer', 'name', 'Next Gen Portal Header', {
    name: 'Next Gen Portal Header',
    template: headerTpl,
    css: srcHeader.css,
    script: srcHeader.script,
    client_script: srcHeader.client_script,
    public: true
  });
  const { sys_id: footerSysId } = await upsert('sp_header_footer', 'name', 'Next Gen Portal Footer', {
    name: 'Next Gen Portal Footer',
    template: footerTpl,
    css: footerCss,
    public: true
  });

  // ── 2. Theme — same variables as /help theme, variant header/footer ───────
  // (sp_theme has no css column — theme-level CSS actually lives in the
  // header/footer widget css fields.)
  console.log('\n  Creating Next Gen Theme...');
  const [srcTheme] = await getRows('sp_theme', 'name=Aspira Help Center Theme', 'sys_id,css_variables', 1);
  if (!srcTheme) throw new Error('Source theme not found — run the main deploy first.');
  const { sys_id: themeSysId } = await upsert('sp_theme', 'name', 'Next Gen Theme', {
    name: 'Next Gen Theme',
    css_variables: srcTheme.css_variables,
    header: headerSysId,
    footer: footerSysId,
    navbar_fixed: true,
    footer_fixed: false
  });

  // ── 3. Portal — KB only, no catalog ────────────────────────────────────────
  console.log('\n  Creating Next-Gen portal...');
  const [helpPortal] = await getRows('sp_portal', 'url_suffix=help', 'sys_id,css_variables', 1);
  if (!helpPortal) throw new Error('/help portal not found — run the main deploy first.');
  const { sys_id: portalSysId } = await upsert('sp_portal', 'url_suffix', URL_SUFFIX, {
    title: PORTAL_TITLE,
    url_suffix: URL_SUFFIX,
    theme: themeSysId,
    // No portal login page — SP then falls back to the NATIVE platform login
    // (/login.do) for anonymous visitors, instead of the CSM login widget
    // (which throws "Login: GET is not allowed!" when rendered in place).
    login_page: '',
    css_variables: helpPortal.css_variables,
    kb_knowledge_base: kbSysId,
    sc_catalog: '',       // pure KB — explicitly no catalog
    sc_catalog_page: '',
    navbar_fixed: true
  });
  console.log(`  Portal: ${process.env.SNOW_INSTANCE}/${URL_SUFFIX}`);

  // ── 4. Redeploy ahc-kb-home (portal-aware CTA guards + sidebar fix) ───────
  console.log('\n  Redeploying ahc-kb-home widget...');
  const widgetDir = ['widgets-dev', 'widgets'].map(d => path.join(__dirname, '..', d, 'ahc-kb-home'));
  const readWidget = f => {
    for (const d of widgetDir) {
      const p = path.join(d, f);
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
    }
    return '';
  };
  const { sys_id: widgetSysId } = await upsert('sp_widget', 'id', 'ahc-kb-home', {
    id: 'ahc-kb-home',
    name: 'AHC KB Home',
    template:      readWidget('template.html'),
    client_script: readWidget('client.js'),
    script:        readWidget('server.js'),
    css:           readWidget('style.scss'),
    public: true
  });

  // ── 5. Page + layout ───────────────────────────────────────────────────────
  console.log('\n  Creating nextgen_kb page + layout...');
  const storedPageId = PAGE_ID.replace(/-/g, '_');
  // passwordGate: public page — anonymous visitors reach the widget's password
  // gate (data stays server-side until unlocked). Otherwise non-public → login.
  const wantPublic = passwordGate ? 'true' : 'false';
  const pageSysId = await findOrCreate(
    'sp_page', `id=${storedPageId}^sp_portal=${portalSysId}`,
    { id: PAGE_ID, title: 'Next Gen Knowledge', sp_portal: portalSysId, public: wantPublic },
    `sp_page ${storedPageId}`
  );
  const pg = (await getRows('sp_page', `sys_id=${pageSysId}`, 'sys_id,public', 1))[0];
  if (pg && pg.public !== wantPublic) {
    // sp_page PATCH may be ACL-blocked in prod (create-only user) — warn, don't die
    try {
      await client.patch(`/api/now/table/sp_page/${pageSysId}`, { public: wantPublic });
      console.log(`  [set]     nextgen_kb public=${wantPublic} (${passwordGate ? 'password gate' : 'login required'})`);
    } catch (e) {
      console.log(`  [warn]    could not set page public=${wantPublic} (${e.message}) — fix manually in UI`);
    }
  }
  const containerSysId = await findOrCreate(
    'sp_container', `sp_page=${pageSysId}^order=10`,
    { sp_page: pageSysId, order: 10, width: 'container-fluid', background_style: 'default', name: 'Next Gen KB Container' },
    'sp_container'
  );
  const rowSysId = await findOrCreate(
    'sp_row', `sp_container=${containerSysId}^order=10`,
    { sp_container: containerSysId, order: 10 },
    'sp_row'
  );
  const colSysId = await findOrCreate(
    'sp_column', `sp_row=${rowSysId}^order=10`,
    { sp_row: rowSysId, size: 12, order: 10 },
    'sp_column'
  );
  await findOrCreate(
    'sp_instance', `sp_column=${colSysId}`,
    {
      sp_column: colSysId,
      sp_widget: widgetSysId,
      order: 10,
      widget_parameters: JSON.stringify({ hide_ticket_cta: true })
    },
    'sp_instance (ahc-kb-home, ticket CTAs hidden)'
  );

  // Homepage + KB page → the one page (portal PATCH is allowed, unlike sp_page)
  await client.patch(`/api/now/table/sp_portal/${portalSysId}`, {
    homepage: pageSysId,
    kb_knowledge_page: pageSysId
  });
  console.log('  [set]     portal homepage + kb_knowledge_page → nextgen_kb');

  // ── 6. KB M2M allowlist ────────────────────────────────────────────────────
  console.log('\n  Linking KB to portal...');
  await findOrCreate(
    'm2m_sp_portal_knowledge_base', `sp_portal=${portalSysId}^kb_knowledge_base=${kbSysId}`,
    { sp_portal: portalSysId, kb_knowledge_base: kbSysId },
    'm2m portal↔KB'
  );

  // ── 7. Starter category, properly parented ────────────────────────────────
  // Without parent_id/parent_table the native category picker shows nothing
  // (the orphan-category bug from 2026-07-09). Articles themselves are NEVER
  // touched here — authors assign the category when publishing.
  console.log('\n  Ensuring "Getting Started" category...');
  await findOrCreate(
    'kb_category', `label=Getting Started^parent_id=${kbSysId}`,
    { label: 'Getting Started', parent_id: kbSysId, parent_table: 'kb_knowledge_base', active: true },
    'kb_category "Getting Started"'
  );

  // ── 8. Password gate wiring (opt-in) ───────────────────────────────────────
  if (passwordGate) {
    console.log('\n  Wiring password gate...');

    // Properties — create-if-missing only, NEVER overwrite (the live password
    // may have been rotated in the instance since this script was written)
    await findOrCreate(
      'sys_properties', 'name=ahc.nextgen.gate_password',
      {
        name: 'ahc.nextgen.gate_password',
        value: passwordGate.password,
        type: 'string',
        is_private: 'true',
        description: 'Shared access password for the /nextgen portal gate (ahc-kb-home widget). Rotating it invalidates all outstanding gate tokens.'
      },
      'sys_property ahc.nextgen.gate_password'
    );
    await findOrCreate(
      'sys_properties', 'name=ahc.nextgen.gate_ttl_hours',
      {
        name: 'ahc.nextgen.gate_ttl_hours',
        value: String(passwordGate.ttlHours || 24),
        type: 'integer',
        description: 'How long a /nextgen gate unlock lasts before the password is asked again (hours).'
      },
      'sys_property ahc.nextgen.gate_ttl_hours'
    );

    // Guest readability — the ONE non-additive step in this deploy, and only
    // because cannot-read criteria beat can-read: with "Guest User" in the
    // cannot-read list, anonymous visitors would unlock the gate onto an empty
    // portal. Removing it makes the password the only barrier for guests.
    const guestBlocks = await getRows(
      'kb_uc_cannot_read_mtom',
      `kb_knowledge_base=${kbSysId}^user_criteria.name=Guest User`,
      'sys_id', 5
    );
    for (const gb of guestBlocks) {
      await client.delete(`/api/now/table/kb_uc_cannot_read_mtom/${gb.sys_id}`);
      console.log('  [REMOVED] "Guest User" cannot-read criteria from the KB — anonymous read is now allowed, gated only by the password');
    }
    if (!guestBlocks.length) console.log('  [skip]    KB has no "Guest User" cannot-read criteria');

    const [guestUc] = await getRows('user_criteria', 'name=Guest User', 'sys_id', 1);
    if (guestUc) {
      await findOrCreate(
        'kb_uc_can_read_mtom', `kb_knowledge_base=${kbSysId}^user_criteria=${guestUc.sys_id}`,
        { kb_knowledge_base: kbSysId, user_criteria: guestUc.sys_id },
        'KB can-read += "Guest User"'
      );
    } else {
      console.log('  [warn]    no "Guest User" user_criteria on this instance — relying on "Any User" to cover guests');
    }
  }

  console.log(`\n  Next-Gen portal deploy complete: ${process.env.SNOW_INSTANCE}/${URL_SUFFIX}`);
};
