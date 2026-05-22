const { upsert } = require('../lib/idempotent');

const CSS_VARIABLES = `
// Aspira Help Center — SASS Variables
// DO NOT edit other themes — this is a standalone theme

// Navbar (inverted dark)
$navbar-inverse-bg:                #1c1c1c !default;
$navbar-inverse-color:             #cccccc !default;
$navbar-inverse-link-color:        #ffffff !default;
$navbar-inverse-link-hover-color:  rgba(255,255,255,0.7) !default;
$navbar-inverse-link-active-color: #ffffff !default;
$navbar-inverse-border:            transparent !default;
$navbar-inverse-toggle-hover-bg:   #2a2a2a !default;

// Primary = Aspira navy (buttons, links, active states, catalog UI)
$brand-primary:      #1a2980 !default;
$btn-primary-bg:     #1a2980 !default;
$btn-primary-border: #141f6a !default;

// Danger = Aspira red — kept ONLY for validation/error states (asterisks, alerts)
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

// Links — navy to match primary
$link-color:       #1a2980 !default;
$link-hover-color: #141f6a !default;

// State colors
$success: #28a745 !default;
$info:    #0d6efd !default;
$warning: #ffc107 !default;
`;

// CSS overrides — scoped to our portal theme only, never touches CSM or shared widgets.
const THEME_CSS = `
/* ═══════════════════════════════════════════════════════════════
   GLOBAL: all links navy (beats Bootstrap's compiled link-color)
   ═══════════════════════════════════════════════════════════════ */
a,
a:visited {
  color: #1a2980;
}
a:hover,
a:focus {
  color: #141f6a;
}

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMBS
   ═══════════════════════════════════════════════════════════════ */
.breadcrumb > li > a,
.breadcrumb > li > a:visited,
.breadcrumb > li > span > a {
  color: #1a2980 !important;
}
.breadcrumb > li > a:hover {
  color: #141f6a !important;
}

/* ═══════════════════════════════════════════════════════════════
   REQUIRED INFO TAGS (sidebar in catalog item form)
   ═══════════════════════════════════════════════════════════════ */
.label-danger {
  background-color: #1a2980 !important;
  border-color:     #1a2980 !important;
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG ITEM FORM: submit button + text-primary elements
   ═══════════════════════════════════════════════════════════════ */
.btn-danger,
.btn-danger:focus {
  background-color: #1a2980 !important;
  border-color:     #141f6a !important;
  color: #fff !important;
}
.btn-danger:hover,
.btn-danger:active {
  background-color: #141f6a !important;
  border-color:     #0e1550 !important;
  color: #fff !important;
}

.text-active,
.text-primary {
  color: #1a2980 !important;
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG BROWSE — category sidebar
   ═══════════════════════════════════════════════════════════════ */
.category-widget {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
}
.category-widget .panel-heading {
  background: transparent !important;
  border: none !important;
  padding: 0 0 10px !important;
}
.category-widget .panel-heading .panel-title {
  font-size: 0.7em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #94a3b8;
}
.category-widget .list-group {
  box-shadow: none !important;
}
.category-widget .list-group-item,
.category-widget .group-item {
  background: transparent !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 7px 12px !important;
  font-size: 0.875em;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  margin-bottom: 2px;
}
.category-widget .list-group-item:hover,
.category-widget .group-item:hover {
  background: #f1f5f9 !important;
  color: #1a2980 !important;
}
.category-widget [aria-current="true"],
.category-widget .text-active,
.category-widget .sc_category_treeitem_0[aria-current="true"],
.category-widget [class*="sc_category_treeitem"][aria-current="true"] {
  background: #e8edf8 !important;
  color: #1a2980 !important;
  font-weight: 600;
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG BROWSE — item cards
   ═══════════════════════════════════════════════════════════════ */
.item-card-column {
  padding: 8px !important;
}
.item-card-column .panel,
.item-card-column .sc-panel {
  border: 1px solid #e2e8f0 !important;
  border-radius: 10px !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
  transition: box-shadow 0.18s, border-color 0.18s !important;
  overflow: hidden;
}
.item-card-column .panel:hover,
.item-card-column .sc-panel:hover {
  box-shadow: 0 4px 14px rgba(26,41,128,0.12) !important;
  border-color: #c7d2fe !important;
}
.item-card-column .panel-body {
  padding: 18px 18px 12px !important;
}
.item-card-column .catalog-item-name {
  font-size: 0.9em !important;
  font-weight: 600 !important;
  color: #1a2980 !important;
  margin-bottom: 6px !important;
}
.item-card-column .item-short-desc {
  font-size: 0.8em !important;
  color: #64748b !important;
  line-height: 1.5 !important;
}
.item-card-column .panel-footer {
  background: #f8f9fc !important;
  border-top: 1px solid #e2e8f0 !important;
  padding: 10px 18px !important;
}
.item-card-column .panel-footer a {
  color: #1a2980 !important;
  font-size: 0.8em !important;
  font-weight: 600 !important;
  text-decoration: none !important;
}
.item-card-column .panel-footer a:hover {
  color: #141f6a !important;
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG BROWSE — top area (category title, view toggle)
   ═══════════════════════════════════════════════════════════════ */
#sc_category_page > .row > .col-xs-9 > h2 {
  font-size: 1.2em;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
}
.tab-card-padding {
  color: #94a3b8 !important;
  cursor: pointer;
}
.tab-card-padding.active,
.tab-card-padding:hover {
  color: #1a2980 !important;
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG BROWSE — search bar
   ═══════════════════════════════════════════════════════════════ */
.input-group-btn .btn,
.input-group-btn .btn-default {
  background-color: #1a2980 !important;
  border-color:     #141f6a !important;
  color: #fff !important;
}
.input-group-btn .btn:hover {
  background-color: #141f6a !important;
}
`;

module.exports = async function deployTheme(ctx) {
  const { sys_id } = await upsert('sp_theme', 'name', 'Aspira Help Center Theme', {
    name: 'Aspira Help Center Theme',
    css_variables: CSS_VARIABLES,
    css: THEME_CSS
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
