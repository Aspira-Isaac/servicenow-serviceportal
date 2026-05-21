(function() {
  // Get the KB(s) linked to this portal
  var portalKbId = '';
  try {
    var portalGr = $sp.getPortalRecord();
    if (portalGr) portalKbId = String(portalGr.getValue('kb_knowledge_base') || '');
  } catch(e) {}

  // Build KB filter chips — restricted to the portal's linked KB
  var kbs = [];
  var kbMap = {};
  var kbGr = new GlideRecord('kb_knowledge_base');
  kbGr.addActiveQuery();
  if (portalKbId) kbGr.addQuery('sys_id', portalKbId);
  kbGr.orderBy('title');
  kbGr.query();
  while (kbGr.next()) {
    var sysId = kbGr.getUniqueValue();
    var title  = kbGr.getValue('title');
    kbs.push({ sys_id: sysId, title: title });
    kbMap[sysId] = title;
  }
  data.knowledgeBases = kbs;
  data.portalKbId     = portalKbId;

  // Handle search AJAX call
  if (input && input.action === 'search') {
    var articles = [];
    var gr = new GlideRecord('kb_knowledge');
    gr.addActiveQuery();
    gr.addQuery('workflow_state', 'published');

    if (input.query) {
      var qc = gr.addQuery('short_description', 'CONTAINS', input.query);
      qc.addOrCondition('text', 'CONTAINS', input.query);
      qc.addOrCondition('keywords', 'CONTAINS', input.query);
    }

    // Scope to selected KB, falling back to the portal's KB
    if (input.kb && input.kb !== 'all') {
      gr.addQuery('kb_knowledge_base', input.kb);
    } else if (portalKbId) {
      gr.addQuery('kb_knowledge_base', portalKbId);
    }

    gr.orderByDesc('sys_view_count');
    gr.setLimit(30);
    gr.query();

    while (gr.next()) {
      var rawText = gr.getValue('text') || '';
      var snippet = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (snippet.length > 160) snippet = snippet.substring(0, 160) + '...';

      articles.push({
        sys_id:            gr.getUniqueValue(),
        short_description: gr.getValue('short_description'),
        snippet:           snippet,
        view_count:        parseInt(gr.getValue('sys_view_count') || '0', 10),
        kb_label:          kbMap[gr.getValue('kb_knowledge_base')] || 'Knowledge Base'
      });
    }

    data.result = articles;
  }
})();
