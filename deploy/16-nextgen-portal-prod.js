/**
 * Next-Gen portal — pure-KB Service Portal (PROD)
 *
 * ⚠ PRODUCTION DEPLOY (aspiraconnect.service-now.com) — approved 2026-07-09.
 *
 * Thin entry for lib/nextgen-portal.js pointing the portal at the prod
 * "Rainger" KB (title unchanged in prod — rename not yet approved).
 * See the lib file for the full step list.
 *
 * Password gate (approved 2026-07-16, tested on dev first): the nextgen_kb
 * page is PUBLIC and the widget asks anonymous visitors for a shared password
 * instead of forcing login. Consequence: the Rainger KB is guest-readable
 * (the "Guest User" cannot-read criteria is removed) — the password is the
 * only barrier for anonymous visitors.
 *
 * What this does NOT do:
 *   • Never touches kb_knowledge — the KB team's articles stay exactly
 *     as authored (see KB_ARTICLE_TEMPLATE_GUIDE.md).
 *   • Never modifies /help records — variants are separate records.
 *
 * Idempotent — safe to re-run.
 *
 * Run: node deploy/16-nextgen-portal-prod.js
 */
require('dotenv').config(); // .env → PROD; MUST load before lib/client

const PROD_KB_ID = '7ed6a5ad2b190318a0ebfe37b891bfd3'; // "Rainger" KB (prod)

module.exports = async function deployNextGenPortalProd() {
  if (!process.env.SNOW_INSTANCE || !process.env.SNOW_INSTANCE.includes('//aspiraconnect.service-now.com')) {
    throw new Error(`Refusing to run: expected prod instance, got ${process.env.SNOW_INSTANCE}`);
  }
  console.log('\n  ⚠ PRODUCTION deploy → ' + process.env.SNOW_INSTANCE);
  await require('../lib/nextgen-portal')({
    kbSysId: PROD_KB_ID,
    // Seed value only — never overwritten if the property already exists;
    // rotate in the instance UI (also invalidates outstanding unlock tokens).
    passwordGate: { password: 'aspiranext', ttlHours: 24 }
  });
};

if (require.main === module) {
  module.exports()
    .then(() => console.log('\nDone.'))
    .catch(e => { console.error(e.message); process.exit(1); });
}
