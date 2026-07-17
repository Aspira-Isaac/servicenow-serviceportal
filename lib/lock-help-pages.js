/**
 * Lock down the /help pages that deploy/04-pages.js (and index-dev.js) created
 * PUBLIC on 2026-05-21. Discovered 2026-07-17: cases opened via
 * unauthenticated channels (inbound email) carry opened_by=guest, and the
 * case-list widget's personal-scope fallback (opened_by=<current user>)
 * matched them for anonymous sessions — ~220k cases visible to any logged-out
 * visitor on /help?id=ticket_list.
 *
 * Steps (idempotent, safe to re-run):
 *   1. PATCH public=false on every /help page we own. nextgen_kb is the ONE
 *      page that stays public — its widget carries the password gate and
 *      withholds data server-side.
 *   2. Harden ahc-case-list with a gs.isLoggedIn() guard:
 *        fullWidget=true  (dev)  → redeploy all four files from widgets-dev/
 *                                  (dev instance matches the repo exactly)
 *        fullWidget=false (prod) → insert ONLY the guard into the deployed
 *                                  script — prod runs an older widget version
 *                                  and a full redeploy would ship unreviewed
 *                                  features (facet counts, sortable columns).
 *   3. Hide the /help header nav links + notification bell for anonymous
 *      visitors (ng-if="data.isLoggedIn"). Patched into the DEPLOYED header
 *      template so it doesn't depend on re-running the full index deploy
 *      (which would need showKbNav/catalogId context). Idempotent. Leaves the
 *      derived Next Gen header untouched — that's a separate record.
 *   4. Audit: warn about any remaining public page created by our accounts.
 */
const fs     = require('fs');
const path   = require('path');
const client = require('./client');

const LOCK_PAGES = [
  'ahc_index', 'ahc_submit_ticket', 'ahc_kb_search',
  'ticket_list', 'ticket_detail',
  'ahc_kb_category', 'ahc_kb_article' // dev-only pages — skipped when absent
];
const OUR_ACCOUNTS = ['easyBI', 'isaacn', 'inavarrete'];

const GUARD_MARKER = 'gs.isLoggedIn()';
const GUARD = `
  // Anonymous sessions get nothing. Cases opened via unauthenticated channels
  // (inbound email) carry opened_by=guest, so the personal-scope fallback
  // below (opened_by=<current user>) would hand ALL of them to any logged-out
  // visitor if this widget ever lands on a public page again (2026-07-17).
  data.isLoggedIn = gs.isLoggedIn();
  if (!data.isLoggedIn) {
    data.cases = []; data.total = 0; data.states = [];
    data.locations = []; data.categories = []; data.page = 0;
    return;
  }
`;

async function getRows(table, query, fields, limit = 20) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: fields, sysparm_limit: limit }
  });
  return r.data.result;
}

module.exports = async function lockHelpPages({ fullWidget }) {
  // ── 1. Pages → non-public ──────────────────────────────────────────────────
  console.log('\n  Locking /help pages (public → false)...');
  for (const id of LOCK_PAGES) {
    const pages = await getRows('sp_page', `id=${id}`, 'sys_id,public', 5);
    if (!pages.length) { console.log(`  [absent]  ${id}`); continue; }
    for (const p of pages) {
      if (p.public !== 'true') { console.log(`  [ok]      ${id} already non-public`); continue; }
      await client.patch(`/api/now/table/sp_page/${p.sys_id}`, { public: 'false' });
      console.log(`  [LOCKED]  ${id} — anonymous visitors now get the login page`);
    }
  }

  // ── 2. Case-list widget guard ──────────────────────────────────────────────
  console.log('\n  Hardening ahc-case-list widget...');
  const [widget] = await getRows('sp_widget', 'id=ahc-case-list', 'sys_id,script', 1);
  if (!widget) throw new Error('ahc-case-list widget not found');
  if (widget.script.includes(GUARD_MARKER)) {
    console.log('  [ok]      widget already guards anonymous sessions');
  } else if (fullWidget) {
    const dir = path.join(__dirname, '..', 'widgets-dev', 'ahc-case-list');
    const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
    const script = read('server.js');
    if (!script.includes(GUARD_MARKER)) throw new Error('widgets-dev/ahc-case-list/server.js is missing the login guard');
    await client.patch(`/api/now/table/sp_widget/${widget.sys_id}`, {
      template:      read('template.html'),
      client_script: read('client.js'),
      script,
      css:           read('style.scss')
    });
    console.log('  [updated] full widget redeployed from widgets-dev/ (with login guard)');
  } else {
    const anchor = '(function() {';
    const idx = widget.script.indexOf(anchor);
    if (idx === -1) throw new Error('deployed script has no IIFE opener — insert the guard manually');
    const patched = widget.script.slice(0, idx + anchor.length) + GUARD + widget.script.slice(idx + anchor.length);
    await client.patch(`/api/now/table/sp_widget/${widget.sys_id}`, { script: patched });
    console.log('  [patched] login guard inserted into the DEPLOYED script only (older widget version kept as-is)');
  }

  // ── 3. Hide header nav links + bell for anonymous visitors ─────────────────
  console.log('\n  Hiding /help header nav for anonymous visitors...');
  const [hdr] = await getRows('sp_header_footer', 'name=Aspira Help Center Header', 'sys_id,template', 1);
  if (!hdr) {
    console.log('  [warn]    "Aspira Help Center Header" not found — skipping');
  } else {
    let tpl = hdr.template;
    let changed = false;
    // Guard the whole nav-links list (covers Catalog, injected Knowledge link,
    // My Tickets) — only if it isn't already gated
    if (tpl.includes('<ul class="ahc-nav__links">')) {
      tpl = tpl.replace('<ul class="ahc-nav__links">', '<ul class="ahc-nav__links" ng-if="data.isLoggedIn">');
      changed = true;
    }
    // Guard the notification bell (account-specific)
    if (tpl.includes('<div class="ahc-nav__notif-wrap">')) {
      tpl = tpl.replace('<div class="ahc-nav__notif-wrap">', '<div class="ahc-nav__notif-wrap" ng-if="data.isLoggedIn">');
      changed = true;
    }
    if (changed) {
      await client.patch(`/api/now/table/sp_header_footer/${hdr.sys_id}`, { template: tpl });
      console.log('  [patched] header nav links + bell now hidden when logged out');
    } else {
      console.log('  [ok]      header already hides nav for anonymous visitors');
    }
  }

  // ── 4. Audit ───────────────────────────────────────────────────────────────
  console.log('\n  Auditing remaining public pages we created...');
  const leftovers = await getRows('sp_page', `public=true^sys_created_byIN${OUR_ACCOUNTS.join(',')}`, 'id', 40);
  for (const p of leftovers) {
    if (p.id === 'nextgen_kb') console.log('  [ok]      nextgen_kb stays public (password gate)');
    else console.log(`  [WARN]    ${p.id} is still public — review it`);
  }

  console.log('\n  Lock-down complete.');
};
