/**
 * Lock down public /help pages + harden ahc-case-list (DEV)
 *
 * Fixes the 2026-07-17 anonymous case leak — see lib/lock-help-pages.js.
 * Dev widget matches the repo, so the widget is fully redeployed from
 * widgets-dev/ (which now includes the login guard).
 *
 * Run: node deploy/19-lock-help-pages-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST load before lib/client

module.exports = async function lockHelpPagesDev() {
  if (!process.env.SNOW_INSTANCE.includes('aspiraconnecttest')) {
    throw new Error('Refusing to run: not pointed at the dev instance');
  }
  await require('../lib/lock-help-pages')({ fullWidget: true });
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
