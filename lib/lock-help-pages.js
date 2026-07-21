/**
 * Secure the /help portal against the anonymous case leak — WITHOUT breaking
 * external customer access.
 *
 * Background: cases opened via unauthenticated channels (inbound email) carry
 * opened_by=guest, and the case-list widget's personal-scope fallback
 * (opened_by=<current user>) matched them for anonymous sessions — ~220k cases
 * visible to any logged-out visitor on /help?id=ticket_list (found 2026-07-17).
 *
 * CORRECTION (2026-07-21): the first version of this fix set the /help pages
 * public=false. That broke the portal for real customers: external CSM users
 * (sn_customerservice.customer / snc_external) lack the `admin` role, and the
 * stock sp_page read ACL ("Allow read … for users with role admin") means they
 * CANNOT read a non-public sp_page — every /help page rendered "Not Found" for
 * them. Page publicity is therefore the WRONG lever.
 *
 * The real protection is at the WIDGET layer and is independent of publicity:
 *   • ahc-case-list bails to empty when !gs.isLoggedIn() (the actual leak fix).
 *   • ahc-stats already did the same.
 *   • The /help header hides nav links + bell for anonymous visitors.
 * With those in place, an anonymous visitor on a public page gets no data.
 *
 * Steps (idempotent, safe to re-run):
 *   1. Ensure every /help page is public=true (external customers must be able
 *      to read the sp_page). nextgen_kb is also public — it has its own gate.
 *   2. Ensure ahc-case-list carries the gs.isLoggedIn() guard:
 *        fullWidget=true  (dev)  → redeploy all four files from widgets-dev/.
 *        fullWidget=false (prod) → insert ONLY the guard into the deployed
 *                                  script (prod may run an older widget and a
 *                                  full redeploy would ship unreviewed changes).
 *   3. Ensure the /help header hides nav links + notification bell for
 *      anonymous visitors (ng-if="data.isLoggedIn"). Leaves the derived Next
 *      Gen header untouched — separate record.
 */
const fs     = require('fs');
const path   = require('path');
const client = require('./client');

// Customer-facing /help pages. Must be PUBLIC so external users can read the
// sp_page; data safety is enforced by the widgets, not by page publicity.
const HELP_PAGES = [
  'ahc_index', 'ahc_submit_ticket', 'ahc_kb_search',
  'ticket_list', 'ticket_detail',
  'ahc_kb_category', 'ahc_kb_article' // dev-only pages — skipped when absent
];

const GUARD_MARKER = 'gs.isLoggedIn()';
const GUARD = `
  // Anonymous sessions get nothing. Cases opened via unauthenticated channels
  // (inbound email) carry opened_by=guest, so the personal-scope fallback
  // below (opened_by=<current user>) would hand ALL of them to a logged-out
  // visitor. Pages stay public (external customers need that) — THIS guard,
  // not page publicity, is what closes the leak (2026-07-17, revised 07-21).
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

module.exports = async function secureHelpPortal({ fullWidget }) {
  // ── 1. Pages MUST be public (external customers can't read non-public pages)
  console.log('\n  Ensuring /help pages are public (external customer access)...');
  for (const id of HELP_PAGES) {
    const pages = await getRows('sp_page', `id=${id}`, 'sys_id,public', 5);
    if (!pages.length) { console.log(`  [absent]  ${id}`); continue; }
    for (const p of pages) {
      if (p.public === 'true') { console.log(`  [ok]      ${id} already public`); continue; }
      await client.patch(`/api/now/table/sp_page/${p.sys_id}`, { public: 'true' });
      console.log(`  [FIXED]   ${id} → public=true (was non-public — external customers were getting "Not Found")`);
    }
  }

  // ── 2. Case-list widget guard (the real leak protection) ───────────────────
  console.log('\n  Ensuring ahc-case-list guards anonymous sessions...');
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
  console.log('\n  Ensuring /help header hides nav for anonymous visitors...');
  const [hdr] = await getRows('sp_header_footer', 'name=Aspira Help Center Header', 'sys_id,template', 1);
  if (!hdr) {
    console.log('  [warn]    "Aspira Help Center Header" not found — skipping');
  } else {
    let tpl = hdr.template;
    let changed = false;
    if (tpl.includes('<ul class="ahc-nav__links">')) {
      tpl = tpl.replace('<ul class="ahc-nav__links">', '<ul class="ahc-nav__links" ng-if="data.isLoggedIn">');
      changed = true;
    }
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

  console.log('\n  /help portal secured (pages public, data guarded at the widget).');
};
