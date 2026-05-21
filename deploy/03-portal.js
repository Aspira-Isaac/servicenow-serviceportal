const { upsert } = require('../lib/idempotent');
const client = require('../lib/client');

module.exports = async function deployPortal(ctx) {
  // Consumer Service KB and catalog — same as CSP portal
  const KB_SYS_ID      = '2b292926c3302200e7c7d44d81d3ae10'; // Consumer Service KB
  const CATALOG_SYS_ID = '0f910a2ac3112200b12d9f2974d3ae3c'; // Consumer Service catalog
  const KB_PAGE_SYS_ID = 'e1c919e4dbd3220099f93691f0b8f535'; // shared KB article page
  const CAT_PAGE_SYS_ID = 'fe87a11147132100ba13a5554ee490b9'; // catalog page

  // Portal-level CSS variable overrides (format matches existing portals: $var:value;\n)
  const CSS_VARIABLES = [
    '$navbar-inverse-bg:#1c1c1c;',
    '$navbar-inverse-link-color:#ffffff;',
    '$navbar-inverse-link-hover-color:#cf1d25;',
    '$navbar-inverse-link-active-color:#cf1d25;',
    '$brand-primary:#cf1d25;',
    '$brand-danger:#cf1d25;',
    '$body-bg:#ffffff;',
    '$sp-homepage-bg:#f5f5f5;',
    '$text-color:#333333;',
    '$sp-tagline-color:#1c1c1c;',
    '$link-color:#cf1d25;',
    '$btn-danger-bg:#cf1d25;',
    '$btn-danger-border:#a8161c;',
  ].join('\n');

  const { sys_id } = await upsert('sp_portal', 'url_suffix', 'help', {
    title: 'Aspira Help Center',
    url_suffix: 'help',
    theme: ctx.themeSysId,
    header: ctx.headerSysId,
    footer: ctx.footerSysId,
    login_page: 'a0e3b3acc3521200b0449f2974d3ae14', // csm_login — same as CSM portal, works for snc_external users
    default_search_page: 'search',
    css_variables: CSS_VARIABLES,
    kb_knowledge_base: KB_SYS_ID,
    sc_catalog: CATALOG_SYS_ID,
    kb_knowledge_page: KB_PAGE_SYS_ID,
    sc_catalog_page: CAT_PAGE_SYS_ID,
    navbar_fixed: true
  });
  ctx.portalSysId = sys_id;
  console.log(`  Portal sys_id: ${sys_id}`);
  console.log(`  Portal URL: ${process.env.SNOW_INSTANCE}/help`);
};

if (require.main === module) {
  require('dotenv').config();
  const ctx = {
    themeSysId: process.argv[2],
    headerSysId: process.argv[3],
    footerSysId: process.argv[4]
  };
  module.exports(ctx).then(() => console.log('Done', ctx)).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
