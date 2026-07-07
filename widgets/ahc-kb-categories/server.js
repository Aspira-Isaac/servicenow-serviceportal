(function() {
  var kbId = $sp.getParameter('kb_id');
  data.categories = [];
  data.kbName = '';

  // Fallback: use the portal's primary KB when no kb_id in URL.
  // This lets the Rainger-dedicated portal show categories automatically.
  if (!kbId) {
    var portalGr = $sp.getPortalRecord();
    if (portalGr) kbId = String(portalGr.getValue('kb_knowledge_base') || '');
  }

  // Set after fallback so the template's ng-if sees the resolved value
  data.kbId = kbId;

  if (!kbId) return;

  var kbGr = new GlideRecord('kb_knowledge_base');
  if (kbGr.get(kbId)) {
    data.kbName = kbGr.getDisplayValue('title');
  }

  // Group published articles by category for this KB.
  // kb_category has no kb_knowledge_base field — we bridge through articles.
  var gr = new GlideRecord('kb_knowledge');
  gr.addActiveQuery();
  gr.addQuery('kb_knowledge_base', kbId);
  gr.addQuery('workflow_state', 'published');
  gr.query();

  var catMap = {};
  while (gr.next()) {
    var catId = String(gr.getValue('kb_category') || '');
    if (!catId) continue;
    if (!catMap[catId]) {
      catMap[catId] = {
        sys_id: catId,
        label:  String(gr.getDisplayValue('kb_category') || catId),
        count:  0
      };
    }
    catMap[catId].count++;
  }

  var cats = [];
  for (var k in catMap) { cats.push(catMap[k]); }
  cats.sort(function(a, b) { return a.label < b.label ? -1 : 1; });
  data.categories = cats;
})();
