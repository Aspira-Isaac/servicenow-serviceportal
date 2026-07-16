(function() {
  data.kbId         = '';
  data.categories   = [];
  data.trending     = [];
  data.recent       = [];
  data.totalArticles = 0;

  // Company-map routing: user's company → their KB; fallback → portal's KB
  var kbId = '';
  var companyId = gs.isLoggedIn() ? String(gs.getUser().getCompanyID() || '') : '';
  if (companyId) {
    var mapJson = gs.getProperty('ahc.kb.company_map', '{}');
    var kbMap = {};
    try { kbMap = JSON.parse(mapJson); } catch(e) {}
    kbId = kbMap[companyId] || '';
  }
  if (!kbId) {
    var portalGr = $sp.getPortalRecord();
    kbId = portalGr ? String(portalGr.getValue('kb_knowledge_base') || '') : '';
  }
  data.kbId = kbId;

  // Pure-KB portals (no catalog, e.g. /nextgen) never show ticket CTAs — this is
  // portal-based, so it also covers /help pages rendered under ?id= on that portal.
  var ctaPortalGr = $sp.getPortalRecord();
  data.noCatalog = !ctaPortalGr || !String(ctaPortalGr.getValue('sc_catalog') || '');

  // ── Password gate (anonymous visitors on /nextgen) ────────────────────────
  // Replaces the login bounce: the page is public, but no article data leaves
  // the server without a valid gate token. The token is stateless —
  // SHA256(secret + expiry) — so any node can verify it without a session.
  // Fails closed: if the password property is unset, nobody gets in.
  var gateSuffix  = ctaPortalGr ? String(ctaPortalGr.getValue('url_suffix') || '') : '';
  var gateEnabled = gateSuffix === 'nextgen' && !gs.isLoggedIn();
  data.gateRequired = gateEnabled;

  function gateToken(exp) {
    var secret = gs.getProperty('ahc.nextgen.gate_password', '');
    if (!secret) return '';
    return new GlideDigest().getSHA256Hex(secret + '|' + exp + '|ahc-kbh-gate');
  }
  function gateOk() {
    if (!gateEnabled) return true;
    if (!input || !input.gate_token || !input.gate_exp) return false;
    var exp = parseInt(input.gate_exp, 10) || 0;
    if (exp < new GlideDateTime().getNumericValue()) return false;
    var expected = gateToken(String(exp));
    return expected !== '' && expected === String(input.gate_token);
  }

  if (!kbId) return;

  // ── AJAX: unlock the gate ─────────────────────────────────────────────────
  if (input && input.action === 'gate_unlock') {
    data.gateOk = false;
    var gateSecret = gs.getProperty('ahc.nextgen.gate_password', '');
    if (gateEnabled && gateSecret && String(input.password || '') === gateSecret) {
      var ttlHours = parseInt(gs.getProperty('ahc.nextgen.gate_ttl_hours', '24'), 10) || 24;
      var gateExp  = new GlideDateTime().getNumericValue() + ttlHours * 3600000;
      data.gateOk    = true;
      data.gateToken = gateToken(String(gateExp));
      data.gateExp   = gateExp;
    }
    return;
  }

  // ── AJAX: load articles for a category ────────────────────────────────────
  if (input && input.action === 'load_category') {
    if (!gateOk()) { data.gateDenied = true; return; }
    data.articles = [];
    var catId = String(input.catId || '');
    if (!catId) return;
    var catArtGr = new GlideRecord('kb_knowledge');
    catArtGr.addActiveQuery();
    catArtGr.addQuery('kb_knowledge_base', kbId);
    catArtGr.addQuery('workflow_state', 'published');
    catArtGr.addQuery('kb_category', catId);
    if (data.noCatalog) {
      // Pure-KB portals (e.g. /nextgen): alphabetical, per stakeholder request
      catArtGr.orderBy('short_description');
    } else {
      catArtGr.orderByDesc('sys_view_count');
    }
    catArtGr.setLimit(50);
    catArtGr.query();
    var catArts = [];
    while (catArtGr.next()) {
      var rawTxt = catArtGr.getValue('text') || '';
      var snip = rawTxt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (snip.length > 160) snip = snip.substring(0, 160) + '...';
      catArts.push({
        sys_id:  catArtGr.getUniqueValue(),
        title:   catArtGr.getValue('short_description'),
        snippet: snip,
        views:   parseInt(catArtGr.getValue('sys_view_count') || '0', 10)
      });
    }
    data.articles = catArts;
    return;
  }

  // ── AJAX: load full article content ───────────────────────────────────────
  if (input && input.action === 'load_article') {
    if (!gateOk()) { data.gateDenied = true; return; }
    data.article = null;
    data.related  = [];
    var fetchId = String(input.artId || '');
    if (!fetchId) return;
    var fetchGr = new GlideRecord('kb_knowledge');
    if (!fetchGr.get(fetchId) || !fetchGr.canRead()) return;
    data.article = {
      sys_id:   fetchGr.getUniqueValue(),
      title:    fetchGr.getValue('short_description'),
      text:     fetchGr.getValue('text'),
      author:   fetchGr.getDisplayValue('author'),
      updated:  fetchGr.getDisplayValue('sys_updated_on'),
      views:    parseInt(fetchGr.getValue('sys_view_count') || '0', 10),
      cat_id:   String(fetchGr.getValue('kb_category') || ''),
      cat_name: fetchGr.getDisplayValue('kb_category')
    };
    try { fetchGr.incrementViewCount(); } catch (e) {}
    if (data.article.cat_id) {
      var relGr = new GlideRecord('kb_knowledge');
      relGr.addActiveQuery();
      relGr.addQuery('workflow_state', 'published');
      relGr.addQuery('kb_category', data.article.cat_id);
      relGr.addQuery('sys_id', '!=', fetchId);
      relGr.orderByDesc('sys_view_count');
      relGr.setLimit(4);
      relGr.query();
      while (relGr.next()) {
        data.related.push({ sys_id: relGr.getUniqueValue(), title: relGr.getValue('short_description') });
      }
    }
    return;
  }

  // ── AJAX: rate article ─────────────────────────────────────────────────────
  if (input && input.action === 'rate') {
    if (!gateOk()) { data.gateDenied = true; return; }
    var rateFb = new GlideRecord('kb_feedback');
    rateFb.user    = gs.getUserID();
    rateFb.article = String(input.artId || '');
    rateFb.helpful = input.helpful;
    try { rateFb.insert(); } catch (e) {}
    data.rated = true;
    return;
  }

  // ── AJAX: search ──────────────────────────────────────────────────────────
  if (input && input.action === 'search') {
    if (!gateOk()) { data.gateDenied = true; return; }
    data.results = [];
    var term = (input.term || '').trim();
    if (term.length < 2) return;
    var srGr = new GlideRecord('kb_knowledge');
    srGr.addActiveQuery();
    srGr.addQuery('kb_knowledge_base', kbId);
    srGr.addQuery('workflow_state', 'published');
    var srQ = srGr.addQuery('short_description', 'CONTAINS', term);
    srQ.addOrCondition('text', 'CONTAINS', term);
    srGr.orderByDesc('sys_view_count');
    srGr.setLimit(20);
    srGr.query();
    var srResults = [];
    while (srGr.next()) {
      srResults.push({
        sys_id:   srGr.getUniqueValue(),
        title:    srGr.getValue('short_description'),
        cat_name: srGr.getDisplayValue('kb_category')
      });
    }
    data.results = srResults;
    return;
  }

  // ── Initial page load ──────────────────────────────────────────────────────
  // Also serves {action:'init'}: locked visitors get the shell only on page
  // load; once unlocked, the client re-requests this block with its token.
  if (!gateOk()) {
    if (input) data.gateDenied = true; // stored token expired → client re-locks
    return;
  }

  // Build category map from published articles
  var initGr = new GlideRecord('kb_knowledge');
  initGr.addActiveQuery();
  initGr.addQuery('kb_knowledge_base', kbId);
  initGr.addQuery('workflow_state', 'published');
  initGr.query();

  var catMap = {};
  var total = 0;
  while (initGr.next()) {
    total++;
    var cId = String(initGr.getValue('kb_category') || '');
    if (!cId) continue;
    if (!catMap[cId]) {
      catMap[cId] = { sys_id: cId, label: String(initGr.getDisplayValue('kb_category') || cId), count: 0, desc: '' };
    }
    catMap[cId].count++;
  }
  data.totalArticles = total;

  // Fetch category descriptions
  var catKeys = [];
  for (var ck in catMap) { catKeys.push(ck); }
  var descGr;
  for (var ci = 0; ci < catKeys.length; ci++) {
    descGr = new GlideRecord('kb_category');
    if (descGr.get(catKeys[ci])) {
      catMap[catKeys[ci]].desc = String(descGr.getValue('description') || '');
    }
  }

  var cats = [];
  for (var cm in catMap) { cats.push(catMap[cm]); }
  cats.sort(function(a, b) { return a.label < b.label ? -1 : 1; });
  data.categories = cats;

  // Trending (top 5 by view count — exclude zero-view articles)
  var trendGr = new GlideRecord('kb_knowledge');
  trendGr.addActiveQuery();
  trendGr.addQuery('kb_knowledge_base', kbId);
  trendGr.addQuery('workflow_state', 'published');
  trendGr.addQuery('sys_view_count', '>', '0');
  trendGr.orderByDesc('sys_view_count');
  trendGr.setLimit(5);
  trendGr.query();
  var trending = [];
  while (trendGr.next()) {
    trending.push({
      sys_id:   trendGr.getUniqueValue(),
      title:    trendGr.getValue('short_description'),
      cat_name: trendGr.getDisplayValue('kb_category'),
      views:    parseInt(trendGr.getValue('sys_view_count') || '0', 10)
    });
  }
  data.trending = trending;

  // Recently updated (top 5 by sys_updated_on)
  var recentGr = new GlideRecord('kb_knowledge');
  recentGr.addActiveQuery();
  recentGr.addQuery('kb_knowledge_base', kbId);
  recentGr.addQuery('workflow_state', 'published');
  recentGr.orderByDesc('sys_updated_on');
  recentGr.setLimit(5);
  recentGr.query();
  var recents = [];
  while (recentGr.next()) {
    recents.push({
      sys_id:   recentGr.getUniqueValue(),
      title:    recentGr.getValue('short_description'),
      cat_name: recentGr.getDisplayValue('kb_category'),
      updated:  recentGr.getDisplayValue('sys_updated_on')
    });
  }
  data.recent = recents;
})();
