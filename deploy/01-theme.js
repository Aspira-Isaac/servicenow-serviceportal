const { upsert } = require('../lib/idempotent');

const CSS_VARIABLES = `
// Aspira Help Center — SASS Variables
// DO NOT edit other themes — this is a standalone theme

// Navbar (inverted dark)
$navbar-inverse-bg:                #1c1c1c !default;
$navbar-inverse-color:             #cccccc !default;
$navbar-inverse-link-color:        #ffffff !default;
$navbar-inverse-link-hover-color:  #cf1d25 !default;
$navbar-inverse-link-active-color: #cf1d25 !default;
$navbar-inverse-border:            transparent !default;
$navbar-inverse-toggle-hover-bg:   #2a2a2a !default;

// Brand / primary actions use Aspira red
$brand-primary:   #cf1d25 !default;
$brand-danger:    #cf1d25 !default;
$danger:          #cf1d25 !default;

$btn-danger-bg:     #cf1d25 !default;
$btn-danger-border: #a8161c !default;

// Body & layout
$body-bg:           #ffffff !default;
$sp-homepage-bg:    #f5f5f5 !default;
$sp-tagline-color:  #1c1c1c !default;
$text-color:        #333333 !default;
$gray-light:        #f0f0f0 !default;
$gray-dark:         #2a2a2a !default;

// Typography
$font-family-sans-serif: "Source Sans Pro", "Helvetica Neue", Arial, sans-serif !default;
$font-size-base: 14px !default;

// Links
$link-color:       #cf1d25 !default;
$link-hover-color: #a8161c !default;

// State colors
$success: #28a745 !default;
$info:    #0d6efd !default;
$warning: #ffc107 !default;
`;

module.exports = async function deployTheme(ctx) {
  const { sys_id } = await upsert('sp_theme', 'name', 'Aspira Help Center Theme', {
    name: 'Aspira Help Center Theme',
    css_variables: CSS_VARIABLES
  });
  ctx.themeSysId = sys_id;
  console.log(`  Theme sys_id: ${sys_id}`);
};

if (require.main === module) {
  const ctx = {};
  module.exports(ctx).then(() => console.log('Done', ctx)).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
