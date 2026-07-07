(function() {
  var catId = $sp.getParameter('kb_category');
  var kbId  = $sp.getParameter('kb_id');

  data.catId   = catId;
  data.kbId    = kbId;
  data.catName = '';
  data.kbName  = '';
  data.articles = [];

  // Fallback to portal KB when no kb_id in URL
  if (!kbId) {
    var portalGr = $sp.getPortalRecord();
    if (portalGr) kbId = String(portalGr.getValue('kb_knowledge_base') || '');
    data.kbId = kbId;
  }

  if (catId) {
    var catGr = new GlideRecord('kb_category');
    if (catGr.get(catId)) data.catName = catGr.getDisplayValue('label');
  }

  if (kbId) {
    var kbGr = new GlideRecord('kb_knowledge_base');
    if (kbGr.get(kbId)) data.kbName = kbGr.getDisplayValue('title');
  }

  if (!kbId && !catId) return;

  var gr = new GlideRecord('kb_knowledge');
  gr.addActiveQuery();
  gr.addQuery('workflow_state', 'published');
  if (kbId)  gr.addQuery('kb_knowledge_base', kbId);
  if (catId) gr.addQuery('kb_category', catId);
  gr.orderByDesc('sys_view_count');
  gr.setLimit(50);
  gr.query();

  var articles = [];
  while (gr.next()) {
    var rawText = gr.getValue('text') || '';
    var snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (snippet.length > 180) snippet = snippet.substring(0, 180) + '...';

    articles.push({
      sys_id:            gr.getUniqueValue(),
      short_description: gr.getValue('short_description'),
      snippet:           snippet,
      view_count:        parseInt(gr.getValue('sys_view_count') || '0', 10)
    });
  }
  data.articles = articles;
})();
