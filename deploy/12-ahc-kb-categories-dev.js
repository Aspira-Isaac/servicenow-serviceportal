/**
 * AHC KB Categories widget — dev deploy
 *
 * Creates the ahc-kb-categories SP widget and wires it onto the kb_home page
 * (container order=100, after existing containers at orders 1-4).
 *
 * The widget reads kb_id from the URL and renders category tiles for that KB.
 * When kb_id is absent the widget renders nothing, so existing kb_home content
 * (KB tiles, search, featured articles) is unaffected.
 *
 * Purely additive — never modifies existing records.
 * Run: node deploy/12-ahc-kb-categories-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST load before lib/client
const fs     = require('fs');
const path   = require('path');
const client = require('../lib/client');
const { upsert } = require('../lib/idempotent');

const KB_HOME_PAGE_SYS_ID = 'e1c919e4dbd3220099f93691f0b8f535';
const WIDGET_ID   = 'ahc-kb-categories';
const WIDGET_NAME = 'AHC KB Categories';
const WIDGET_DIR  = path.join(__dirname, '..', 'widgets', 'ahc-kb-categories');

function read(filename) {
  const p = path.join(WIDGET_DIR, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function findOrCreate(table, query, payload) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: 'sys_id', sysparm_limit: 1 }
  });
  if (r.data.result.length) {
    console.log(`  [skip]    ${table}`);
    return r.data.result[0].sys_id;
  }
  const created = await client.post(`/api/now/table/${table}`, payload);
  console.log(`  [created] ${table}`);
  return created.data.result.sys_id;
}

async function wireToKbHome(widgetSysId) {
  // Container order=100 — after existing containers (orders 1–4)
  const containerSysId = await findOrCreate(
    'sp_container',
    `sp_page=${KB_HOME_PAGE_SYS_ID}^order=100`,
    {
      sp_page:          KB_HOME_PAGE_SYS_ID,
      order:            100,
      width:            'container-fluid',
      background_style: 'default',
      name:             'AHC KB Categories Container'
    }
  );

  const rowSysId = await findOrCreate(
    'sp_row',
    `sp_container=${containerSysId}^order=10`,
    { sp_container: containerSysId, order: 10 }
  );

  const colSysId = await findOrCreate(
    'sp_column',
    `sp_row=${rowSysId}^order=10`,
    { sp_row: rowSysId, size: 12, order: 10 }
  );

  const instanceSysId = await findOrCreate(
    'sp_instance',
    `sp_column=${colSysId}`,
    { sp_column: colSysId, sp_widget: widgetSysId, order: 10 }
  );

  return instanceSysId;
}

// ─── main ────────────────────────────────────────────────────────────────────

module.exports = async function deployAhcKbCategories(ctx) {
  console.log('\n  Deploying AHC KB Categories widget...');

  const { sys_id: widgetSysId } = await upsert('sp_widget', 'id', WIDGET_ID, {
    id:            WIDGET_ID,
    name:          WIDGET_NAME,
    template:      read('template.html'),
    client_script: read('client.js'),
    script:        read('server.js'),
    css:           read('style.scss'),
    public:        true
  });
  console.log(`  Widget sys_id: ${widgetSysId}`);
  if (ctx) ctx.widgetKbCategories = widgetSysId;

  console.log('\n  Wiring widget to kb_home page (container order=100)...');
  const instanceSysId = await wireToKbHome(widgetSysId);
  console.log(`  Instance sys_id: ${instanceSysId}`);

  console.log('\n  Deploy complete.');
  console.log('  Browse Rainger: /csm?id=kb_home&kb_id=3902d2f793994f50408cbf3b6aba103f');
};

if (require.main === module) {
  const ctx = {};
  module.exports(ctx)
    .then(() => console.log('\nDone.', ctx))
    .catch(e => { console.error(e.message); process.exit(1); });
}
