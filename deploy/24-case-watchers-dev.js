/**
 * 24 — Case watchers (DEV ONLY)
 *
 * Redeploys the ahc-case-detail widget to the DEV instance from the widgets-dev/
 * override layer, adding a "Watchers" section to the Case Details card: a
 * submitter can add/remove watchers on the case watch_list (e.g. before going
 * on leave) so case updates reach them — either a colleague on the case's
 * account (picker) OR any email address. Controls appear when the user is
 * involved with the case (opener/contact, customer_admin/admin, or canWrite) —
 * see canManageWatchers; NOT a field-level ACL check (that hid the UI for the
 * case opener, and SP server GlideRecord bypasses ACLs anyway).
 *
 * Purely an sp_widget field update; no other config is touched. Same shape as
 * deploy/18 and deploy/23.
 *
 * Watcher emails work OOTB: active sn_customerservice_case notifications already
 * recipient the watch_list ("Case commented/resolved/closed for customer").
 *
 * Run:  node deploy/24-case-watchers-dev.js
 * Test: node tests/24-case-watchers.test.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST be before require('../lib/client')

const fs   = require('fs');
const path = require('path');
const { upsert } = require('../lib/idempotent');

const WIDGET = { id: 'ahc-case-detail', name: 'AHC Case Detail', dir: 'ahc-case-detail' };

// widgets-dev/ override first, fall back to widgets/ (same as index-dev.js)
function readWidget(widgetDir, file) {
  const override = path.join(__dirname, '..', 'widgets-dev', widgetDir, file);
  if (fs.existsSync(override)) return fs.readFileSync(override, 'utf8');
  const base = path.join(__dirname, '..', 'widgets', widgetDir, file);
  return fs.existsSync(base) ? fs.readFileSync(base, 'utf8') : '';
}

async function run() {
  if (!/test/.test(process.env.SNOW_INSTANCE || '')) {
    console.error(`Refusing to run: SNOW_INSTANCE (${process.env.SNOW_INSTANCE}) does not look like the dev instance.`);
    process.exit(1);
  }

  console.log(`\nDeploying "${WIDGET.name}" (${WIDGET.id}) → ${process.env.SNOW_INSTANCE}`);
  const { sys_id } = await upsert('sp_widget', 'id', WIDGET.id, {
    id: WIDGET.id,
    name: WIDGET.name,
    template:      readWidget(WIDGET.dir, 'template.html'),
    client_script: readWidget(WIDGET.dir, 'client.js'),
    script:        readWidget(WIDGET.dir, 'server.js'),
    css:           readWidget(WIDGET.dir, 'style.scss'),
    public: true
  });
  console.log(`  Widget updated: ${sys_id}\n`);
}

run().catch(e => { console.error(e.message); process.exit(1); });
