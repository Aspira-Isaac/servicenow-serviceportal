/**
 * 21 — Case list export menu (PROD)
 *
 * ⚠ PRODUCTION DEPLOY (aspiraconnect.service-now.com) — approved 2026-07-20.
 *
 * Redeploys the ahc-case-list widget to PROD from widgets-dev/, adding the
 * Export (PDF/Excel/CSV) menu that reuses the platform list exporter — the
 * same mechanism as the OOB Data Table widget. Verified 2026-07-20 that the
 * ONLY difference between prod's deployed widget and the repo is this export
 * feature (facet counts / sortable columns / category / the anonymous-session
 * login guard are all already live in prod and unchanged by this redeploy).
 *
 * The export URL hits /sn_customerservice_case_list.do, which enforces ACLs
 * and instance export limits; the query mirrors the user's current scope +
 * filters + sort. Purely an sp_widget field update — no other config touched.
 *
 * Run:  node deploy/21-case-list-export-prod.js
 * Test: node tests/21-case-list-export-prod.test.js
 */
require('dotenv').config(); // .env → PROD; MUST be before require('../lib/client')

const fs   = require('fs');
const path = require('path');
const { upsert } = require('../lib/idempotent');

const WIDGET = { id: 'ahc-case-list', name: 'AHC Case List', dir: 'ahc-case-list' };

// widgets-dev/ override first, fall back to widgets/ (same as index-dev.js)
function readWidget(widgetDir, file) {
  const override = path.join(__dirname, '..', 'widgets-dev', widgetDir, file);
  if (fs.existsSync(override)) return fs.readFileSync(override, 'utf8');
  const base = path.join(__dirname, '..', 'widgets', widgetDir, file);
  return fs.existsSync(base) ? fs.readFileSync(base, 'utf8') : '';
}

async function run() {
  if (!process.env.SNOW_INSTANCE || !process.env.SNOW_INSTANCE.includes('//aspiraconnect.service-now.com')) {
    throw new Error(`Refusing to run: expected prod instance, got ${process.env.SNOW_INSTANCE}`);
  }
  // Guard the guard: the repo widget MUST still carry the anonymous-session
  // bail (2026-07-17 leak fix) or this redeploy would re-open the case leak.
  const serverScript = readWidget(WIDGET.dir, 'server.js');
  if (!serverScript.includes('gs.isLoggedIn()')) {
    throw new Error('Refusing to run: widgets-dev/ahc-case-list/server.js lost its login guard — deploying would re-open the anonymous case leak');
  }

  console.log(`\n  ⚠ PRODUCTION deploy → ${process.env.SNOW_INSTANCE}`);
  console.log(`  Deploying "${WIDGET.name}" (${WIDGET.id}) with export menu...`);
  const { sys_id } = await upsert('sp_widget', 'id', WIDGET.id, {
    id: WIDGET.id,
    name: WIDGET.name,
    template:      readWidget(WIDGET.dir, 'template.html'),
    client_script: readWidget(WIDGET.dir, 'client.js'),
    script:        serverScript,
    css:           readWidget(WIDGET.dir, 'style.scss'),
    public: true
  });
  console.log(`  Widget updated: ${sys_id}\n`);
}

if (require.main === module) {
  run().then(() => console.log('Done.')).catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = run;
