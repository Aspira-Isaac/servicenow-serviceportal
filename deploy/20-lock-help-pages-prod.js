/**
 * Lock down public /help pages + harden ahc-case-list (PROD)
 *
 * ⚠ PRODUCTION FIX (aspiraconnect.service-now.com) — approved 2026-07-17.
 * Fixes the anonymous case leak: /help pages were created public on
 * 2026-05-21 and inbound-email cases (opened_by=guest) matched the case
 * list's personal scope for logged-out visitors. See lib/lock-help-pages.js.
 *
 * Prod runs an OLDER ahc-case-list than the repo, so only the login guard is
 * inserted into the deployed script — no other widget changes ship.
 *
 * Run: node deploy/20-lock-help-pages-prod.js
 */
require('dotenv').config(); // .env → PROD; MUST load before lib/client

module.exports = async function lockHelpPagesProd() {
  if (!process.env.SNOW_INSTANCE || !process.env.SNOW_INSTANCE.includes('//aspiraconnect.service-now.com')) {
    throw new Error(`Refusing to run: expected prod instance, got ${process.env.SNOW_INSTANCE}`);
  }
  console.log('\n  ⚠ PRODUCTION fix → ' + process.env.SNOW_INSTANCE);
  await require('../lib/lock-help-pages')({ fullWidget: false });
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
