const fs = require('fs');
const path = require('path');
const { upsert } = require('../lib/idempotent');

function read(widgetDir, filename, overrideRoot) {
  // Check override dir first (e.g. widgets-dev/) then fall back to widgets/
  if (overrideRoot) {
    const overridePath = path.join(__dirname, '..', overrideRoot, widgetDir, filename);
    if (fs.existsSync(overridePath)) return fs.readFileSync(overridePath, 'utf8');
  }
  const filePath = path.join(__dirname, '..', 'widgets', widgetDir, filename);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const WIDGETS = [
  {
    id: 'ahc-hero',
    name: 'AHC Hero',
    dir: 'ahc-hero',
    ctxKey: 'widgetHero'
  },
  {
    id: 'ahc-ticket-wizard',
    name: 'AHC Ticket Wizard',
    dir: 'ahc-ticket-wizard',
    ctxKey: 'widgetWizard'
  },
  {
    id: 'ahc-cat-item',
    name: 'AHC Catalog Item',
    dir: 'ahc-cat-item',
    ctxKey: 'widgetCatItem'
  },
  {
    id: 'ahc-kb-search-widget',
    name: 'AHC KB Search',
    dir: 'ahc-kb-search',
    ctxKey: 'widgetKb'
  },
  {
    id: 'ahc-quick-links',
    name: 'AHC Quick Links',
    dir: 'ahc-quick-links',
    ctxKey: 'widgetQuickLinks'
  },
  {
    id: 'ahc-case-list',
    name: 'AHC Case List',
    dir: 'ahc-case-list',
    ctxKey: 'widgetCaseList'
  },
  {
    id: 'ahc-case-detail',
    name: 'AHC Case Detail',
    dir: 'ahc-case-detail',
    ctxKey: 'widgetCaseDetail'
  },
  {
    id: 'ahc-stats',
    name: 'AHC Stats Dashboard',
    dir: 'ahc-stats',
    ctxKey: 'widgetStats'
  }
];

module.exports = async function deployWidgets(ctx) {
  const overrideRoot = ctx.widgetsOverrideDir || null;
  if (overrideRoot) console.log(`  Using widget overrides from: ${overrideRoot}/`);

  for (const w of WIDGETS) {
    const { sys_id } = await upsert('sp_widget', 'id', w.id, {
      name: w.name,
      id: w.id,
      template: read(w.dir, 'template.html', overrideRoot),
      client_script: read(w.dir, 'client.js', overrideRoot),
      script: read(w.dir, 'server.js', overrideRoot),
      css: read(w.dir, 'style.scss', overrideRoot),
      public: true
    });
    ctx[w.ctxKey] = sys_id;
    console.log(`  Widget "${w.name}" (${w.id}): ${sys_id}`);
  }
};

if (require.main === module) {
  require('dotenv').config();
  const ctx = {};
  module.exports(ctx).then(() => console.log('Done', ctx)).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
