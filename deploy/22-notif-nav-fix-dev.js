/**
 * 22 — Notification navigation fix (DEV ONLY)
 *
 * Re-upserts the Aspira Help Center Header (+ footer) on the DEV instance with
 * the notification-navigation fix already applied to the source
 * (deploy/02-header-footer.js template + widgets/ahc-header-client.js):
 *   • bell items + "View all my cases" link carry the {{data.portalUrl}} prefix
 *   • navToCase / navToTicketList drive the SPA navigation via $location.search
 *
 * This simply re-runs the shared header/footer deploy with the SAME ctx that
 * index-dev.js uses (showKbNav + dev catalog) so the dev-only Knowledge nav
 * link is preserved. It re-upserts our own header record — additive, no OOTB
 * config is touched. Theme wiring is skipped (already wired).
 *
 * Run:  node deploy/22-notif-nav-fix-dev.js
 * Test: node tests/22-notif-nav-fix.test.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST be before require('../lib/client')

const deployHeaderFooter = require('./02-header-footer');

// Mirror the dev ctx from deploy/index-dev.js so the redeploy reproduces the
// dev header exactly (Knowledge nav link + portal-scoped catalog).
const ctx = {
  showKbNav: true,
  catalogId: '65bcd377c3011200b12d9f2974d3aea0' // Customer Service catalog
};

async function run() {
  if (!/test/.test(process.env.SNOW_INSTANCE || '')) {
    console.error(`Refusing to run: SNOW_INSTANCE (${process.env.SNOW_INSTANCE}) does not look like the dev instance.`);
    process.exit(1);
  }

  console.log(`\nRedeploying header/footer (notif nav fix) → ${process.env.SNOW_INSTANCE}`);
  await deployHeaderFooter(ctx);
  console.log('  Done.\n');
}

run().catch(e => { console.error(e.message); process.exit(1); });
