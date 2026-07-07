var COLORS = ['#10b981','#3b82f6','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

var portalGr = $sp.getPortalRecord();
var portalUrl = portalGr ? ('/' + portalGr.getValue('url_suffix')) : '/help';
data.portalUrl = portalUrl;

// Read catalog from m2m_sp_portal_catalog — the catalog(s) assigned to this portal in the portal form
var catalogId = null;
if (portalGr) {
  var m2mGr = new GlideRecord('m2m_sp_portal_catalog');
  m2mGr.addQuery('sp_portal', portalGr.getUniqueValue());
  m2mGr.setLimit(1);
  m2mGr.query();
  if (m2mGr.next()) catalogId = m2mGr.getValue('sc_catalog');
}

function itemUrl(sysId) {
  return portalUrl + '?id=sc_cat_item&sys_id=' + sysId;
}

// ── Action handlers ───────────────────────────────────────────────────────────
if (input && input.action === 'load_category') {
  data.items = [];
  var iGr = new GlideRecord('sc_cat_item');
  iGr.addActiveQuery();
  iGr.addQuery('category', String(input.catId || ''));
  iGr.orderBy('order');
  iGr.orderBy('name');
  iGr.query();
  while (iGr.next()) {
    var id = iGr.getUniqueValue();
    data.items.push({
      sys_id: id,
      url:    itemUrl(id),
      title:  iGr.getDisplayValue('name'),
      desc:   iGr.getValue('short_description') || ''
    });
  }
  return;
}

if (input && input.action === 'search') {
  data.results = [];
  var term = String(input.term || '');
  if (!term) return;
  var sGr = new GlideRecord('sc_cat_item');
  sGr.addActiveQuery();
  if (catalogId) sGr.addQuery('category.sc_catalog', catalogId);
  sGr.addEncodedQuery('nameCONTAINS' + term + '^ORshort_descriptionCONTAINS' + term);
  sGr.setLimit(20);
  sGr.query();
  while (sGr.next()) {
    var sid = sGr.getUniqueValue();
    data.results.push({
      sys_id:   sid,
      url:      itemUrl(sid),
      title:    sGr.getDisplayValue('name'),
      desc:     sGr.getValue('short_description') || '',
      cat_name: sGr.getDisplayValue('category')
    });
  }
  return;
}

// ── Initial load ──────────────────────────────────────────────────────────────
var catGr = new GlideRecord('sc_category');
catGr.addActiveQuery();
catGr.addNullQuery('parent');
if (catalogId) catGr.addQuery('sc_catalog', catalogId);
catGr.orderBy('order');
catGr.orderBy('title');
catGr.query();

var categories = [];
while (catGr.next()) {
  var agg = new GlideAggregate('sc_cat_item');
  agg.addActiveQuery();
  agg.addQuery('category', catGr.getUniqueValue());
  agg.addAggregate('COUNT');
  agg.query();
  var cnt = agg.next() ? parseInt(agg.getAggregate('COUNT')) : 0;
  if (!cnt) continue;
  categories.push({
    sys_id: catGr.getUniqueValue(),
    label:  catGr.getValue('title'),
    desc:   catGr.getValue('description') || '',
    count:  cnt,
    color:  COLORS[categories.length % COLORS.length]
  });
}
data.categories = categories;
data.totalItems = 0;
for (var i = 0; i < categories.length; i++) data.totalItems += categories[i].count;

// Popular items — lowest order = most featured/promoted, scoped to portal catalog
var pGr = new GlideRecord('sc_cat_item');
pGr.addActiveQuery();
if (catalogId) pGr.addQuery('category.sc_catalog', catalogId);
pGr.orderBy('order');
pGr.orderBy('name');
pGr.setLimit(6);
pGr.query();
data.popular = [];
while (pGr.next()) {
  var pid = pGr.getUniqueValue();
  data.popular.push({
    sys_id:   pid,
    url:      itemUrl(pid),
    title:    pGr.getDisplayValue('name'),
    desc:     pGr.getValue('short_description') || '',
    cat_name: pGr.getDisplayValue('category')
  });
}
