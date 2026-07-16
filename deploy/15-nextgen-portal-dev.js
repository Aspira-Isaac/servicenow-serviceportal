/**
 * Next-Gen portal — pure-KB Service Portal (DEV)
 *
 * Thin entry for lib/nextgen-portal.js against aspiraconnecttest, pointing the
 * portal at the dev "Next Gen" KB. See the lib file for the full step list.
 *
 * Purely additive to /help — its records are never modified. Never touches
 * kb_knowledge. Idempotent — safe to re-run (also how header/footer/theme
 * changes on /help are propagated into the derived Next Gen variants).
 *
 * Run: node deploy/15-nextgen-portal-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST load before lib/client

const DEV_KB_ID = '3902d2f793994f50408cbf3b6aba103f'; // "Next Gen" KB (dev)

module.exports = async function deployNextGenPortalDev() {
  if (!process.env.SNOW_INSTANCE.includes('aspiraconnecttest')) {
    throw new Error('Refusing to run: not pointed at the dev instance');
  }
  await require('../lib/nextgen-portal')({
    kbSysId: DEV_KB_ID,
    // Password gate instead of login force (DEV TEST). This is the seed value
    // only — if the sys_property already exists it is never overwritten, so
    // rotate the password in the instance UI, not here. Unlock lasts 24h.
    passwordGate: { password: 'aspiranext', ttlHours: 24 }
  });
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
