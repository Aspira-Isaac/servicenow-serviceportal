/**
 * Aspira Help Center — DEV portal deploy
 *
 * Deploys the base /help portal to aspiraconnecttest.service-now.com.
 *
 * Differences from production (deploy/index.js):
 *   • Targets dev instance (.env.dev)
 *   • Widgets loaded with the widgets-dev/ override layer (05-widgets.js)
 *   • Shows the Knowledge nav link + scopes catalog links to the dev catalog
 *
 * The knowledge base (Rainger + Next Gen) now lives in its own repo,
 * `servicenow-knowledgebase`. To layer the KB experience onto this portal on
 * dev, run that repo's `deploy/help-kb-wire-dev.js` AFTER this deploy (it points
 * /help at the Rainger KB, creates the KB pages, and deploys/wires the KB
 * widgets). This repo keeps the base ahc-kb-search widget (05-widgets) so the
 * Knowledge page renders a KB search out of the box.
 *
 * Run: node deploy/index-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST be before any require('../lib/client')

// Shared context — sys_ids flow between steps
const ctx = {
  widgetsOverrideDir: 'widgets-dev',  // 05-widgets.js checks here first, falls back to widgets/
  showKbNav:          true,           // shows the Knowledge nav link (dev)
  catalogId:          '65bcd377c3011200b12d9f2974d3aea0' // Customer Service catalog (scopes nav/footer links)
};

const steps = [
  { name: '00-preflight',     fn: require('./00-preflight') },
  { name: '01-theme',         fn: require('./01-theme') },
  { name: '02-header-footer', fn: require('./02-header-footer') },
  { name: '03-portal',        fn: require('./03-portal') },
  { name: '04-pages',         fn: require('./04-pages') },
  { name: '05-widgets',       fn: require('./05-widgets') },
  { name: '06-layout',        fn: require('./06-layout') }
];

async function run() {
  console.log('\n========================================');
  console.log('  Aspira Help Center — DEV Deploy');
  console.log(`  ${process.env.SNOW_INSTANCE}/help`);
  console.log('========================================');

  for (const step of steps) {
    console.log(`\n[${step.name}]`);
    try {
      await step.fn(ctx);
    } catch (err) {
      console.error(`\nFATAL: Step "${step.name}" failed: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n========================================');
  console.log('  DEV deploy complete!');
  console.log(`  Portal: ${process.env.SNOW_INSTANCE}/help`);
  console.log('  KB: run servicenow-knowledgebase/deploy/help-kb-wire-dev.js to layer the KB');
  console.log('========================================\n');
}

run();
