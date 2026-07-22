/**
 * 23 — Case list filters: "Hide closed" toggle + "My Team" staff exclusion (DEV ONLY)
 *
 * Redeploys the ahc-case-list widget to the DEV instance from the widgets-dev/
 * override layer, adding:
 *   • a MULTI-SELECT status filter (check any combination of states; "All"
 *     clears; empty = every state) applied as state IN <selected>, and
 *   • a "My Team" scope that excludes internal Aspira staff by matching the
 *     opener's company to the account (opened_by.company = accountId).
 *
 * Purely an sp_widget field update; no other config is touched. Same shape as
 * deploy/18-case-list-export-dev.js.
 *
 * Run:  node deploy/23-case-list-filters-dev.js
 * Test: node tests/23-case-list-filters.test.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST be before require('../lib/client')

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
