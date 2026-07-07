(function() {
  data.articles = [];
  data.term = '';

  var catItemId = $sp.getParameter('sys_id') || $sp.getParameter('sysparm_id');
  if (!catItemId) return;

  var cat = new GlideRecord('sc_cat_item');
  if (!cat.get(catItemId)) return;

  var name = (cat.getValue('name') || '').trim();
  if (!name) return;
  data.term = name;

  var STOP = {the:1,and:1,'for':1,'with':1,'this':1,that:1,from:1,your:1,have:1,
              been:1,will:1,are:1,was:1,has:1,not:1,you:1,use:1,how:1,
              what:1,when:1,where:1,request:1,please:1,about:1,into:1};
  var combined = (name + ' ' + (cat.getValue('short_description') || '')).toLowerCase();
  var seen = {};
  var keywords = combined.split(/\W+/).filter(function(w) {
    if (w.length <= 3 || STOP[w] || seen[w]) return false;
    seen[w] = true; return true;
  });

  var portalGr = $sp.getPortalRecord();
  var kbId = portalGr ? String(portalGr.getValue('kb_knowledge_base') || '') : '';

  var foundIds = {};
  var results = [];

  // Pass 1 — title contains exact catalog item name
  var kb1 = new GlideRecord('kb_knowledge');
  kb1.addActiveQuery();
  kb1.addQuery('workflow_state', 'published');
  if (kbId) kb1.addQuery('kb_knowledge_base', kbId);
  kb1.addQuery('short_description', 'CONTAINS', name);
  kb1.setLimit(10); kb1.orderByDesc('sys_view_count'); kb1.query();
  while (kb1.next() && results.length < 3) {
    var id1 = kb1.getUniqueValue();
    if (!foundIds[id1]) { foundIds[id1]=true; results.push({sys_id:id1, title:kb1.getValue('short_description'), cat:kb1.getDisplayValue('kb_category')}); }
  }

  // Pass 2 — title contains any extracted keyword
  if (results.length < 3 && keywords.length) {
    var kb2 = new GlideRecord('kb_knowledge');
    kb2.addActiveQuery();
    kb2.addQuery('workflow_state', 'published');
    if (kbId) kb2.addQuery('kb_knowledge_base', kbId);
    var qc2 = kb2.addQuery('short_description', 'CONTAINS', keywords[0]);
    for (var i = 1; i < keywords.length; i++) qc2.addOrCondition('short_description', 'CONTAINS', keywords[i]);
    kb2.setLimit(10); kb2.orderByDesc('sys_view_count'); kb2.query();
    while (kb2.next() && results.length < 3) {
      var id2 = kb2.getUniqueValue();
      if (!foundIds[id2]) { foundIds[id2]=true; results.push({sys_id:id2, title:kb2.getValue('short_description'), cat:kb2.getDisplayValue('kb_category')}); }
    }
  }

  // Pass 3 — body contains exact catalog item name
  if (results.length < 3) {
    var kb3 = new GlideRecord('kb_knowledge');
    kb3.addActiveQuery();
    kb3.addQuery('workflow_state', 'published');
    if (kbId) kb3.addQuery('kb_knowledge_base', kbId);
    kb3.addQuery('text', 'CONTAINS', name);
    kb3.setLimit(10); kb3.orderByDesc('sys_view_count'); kb3.query();
    while (kb3.next() && results.length < 3) {
      var id3 = kb3.getUniqueValue();
      if (!foundIds[id3]) { foundIds[id3]=true; results.push({sys_id:id3, title:kb3.getValue('short_description'), cat:kb3.getDisplayValue('kb_category')}); }
    }
  }

  // Pass 4 — body contains any extracted keyword
  if (results.length < 3 && keywords.length) {
    var kb4 = new GlideRecord('kb_knowledge');
    kb4.addActiveQuery();
    kb4.addQuery('workflow_state', 'published');
    if (kbId) kb4.addQuery('kb_knowledge_base', kbId);
    var qc4 = kb4.addQuery('text', 'CONTAINS', keywords[0]);
    for (var j = 1; j < keywords.length; j++) qc4.addOrCondition('text', 'CONTAINS', keywords[j]);
    kb4.setLimit(10); kb4.orderByDesc('sys_view_count'); kb4.query();
    while (kb4.next() && results.length < 3) {
      var id4 = kb4.getUniqueValue();
      if (!foundIds[id4]) { foundIds[id4]=true; results.push({sys_id:id4, title:kb4.getValue('short_description'), cat:kb4.getDisplayValue('kb_category')}); }
    }
  }

  data.articles = results;
})();
