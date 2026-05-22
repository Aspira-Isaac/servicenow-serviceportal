(function() {
  // Resolve which KB to scope to for the current user:
  //   1. Logged-in user → look up their company in ahc.kb.company_map
  //   2. Fallback → KB linked to this portal
  var effectiveKbId = '';

  var companyId = gs.isLoggedIn() ? String(gs.getUser().getCompanyID() || '') : '';
  if (companyId) {
    var mapJson = gs.getProperty('ahc.kb.company_map', '{}');
    var kbMap = {};
    try { kbMap = JSON.parse(mapJson); } catch(e) {}
    effectiveKbId = kbMap[companyId] || '';
  }

  if (!effectiveKbId) {
    try {
      var portalGr = $sp.getPortalRecord();
      if (portalGr) effectiveKbId = String(portalGr.getValue('kb_knowledge_base') || '');
    } catch(e) {}
  }

  // Build KB filter chips — restricted to the effective KB for this user
  var kbs = [];
  var kbLabelMap = {};
  var kbGr = new GlideRecord('kb_knowledge_base');
  kbGr.addActiveQuery();
  if (effectiveKbId) kbGr.addQuery('sys_id', effectiveKbId);
  kbGr.orderBy('title');
  kbGr.query();
  while (kbGr.next()) {
    var sysId = kbGr.getUniqueValue();
    var title  = kbGr.getValue('title');
    kbs.push({ sys_id: sysId, title: title });
    kbLabelMap[sysId] = title;
  }
  data.knowledgeBases = kbs;
  data.effectiveKbId  = effectiveKbId;

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

    if (input.kb && input.kb !== 'all') {
      gr.addQuery('kb_knowledge_base', input.kb);
    } else if (effectiveKbId) {
      gr.addQuery('kb_knowledge_base', effectiveKbId);
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
        kb_label:          kbLabelMap[gr.getValue('kb_knowledge_base')] || 'Knowledge Base'
      });
    }

    data.result = articles;
  }
})();
