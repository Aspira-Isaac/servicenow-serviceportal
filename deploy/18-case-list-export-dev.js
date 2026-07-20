/**
 * 18 — Case list export menu (DEV ONLY)
 *
 * Redeploys the ahc-case-list widget to the DEV instance with the
 * widgets-dev/ override layer, adding an Export (PDF/Excel/CSV) menu that
 * reuses the platform list exporter — same mechanism as the OOB Data Table
 * widget. Purely an sp_widget field update; no other config is touched.
 *
 * Run: node deploy/18-case-list-export-dev.js
 * Test: node tests/18-case-list-export.test.js
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
