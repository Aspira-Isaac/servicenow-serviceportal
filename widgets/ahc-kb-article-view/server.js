(function() {
  data.article  = null;
  data.isValid  = false;
  data.canRate  = false;
  data.percent  = -1;
  data.response = '';
  data.related  = [];

  var id = $sp.getParameter('sys_id') ||
           $sp.getParameter('sys_kb_id') ||
           $sp.getParameter('sysparm_article');
  if (!id) return;

  var gr = new GlideRecord('kb_knowledge');
  gr.addQuery('sys_id', id);
  gr.addOrCondition('number', id);
  gr.query();
  if (!gr.next() || !gr.canRead()) return;

  data.isValid = true;

  var articleId = gr.getUniqueValue();
  var catId     = gr.getValue('kb_category')      || '';
  var kbId      = gr.getValue('kb_knowledge_base') || '';

  data.article = {
    sys_id:     articleId,
    title:      gr.getValue('short_description'),
    text:       gr.getValue('text'),
    author:     gr.getDisplayValue('author'),
    updated:    gr.getDisplayValue('sys_updated_on'),
    view_count: parseInt(gr.getValue('sys_view_count') || '0', 10),
    kb_id:      kbId,
    kb_name:    gr.getDisplayValue('kb_knowledge_base'),
    cat_id:     catId,
    cat_name:   gr.getDisplayValue('kb_category')
  };

  // Track view on initial page load only (not on AJAX rating calls).
  // Use the OOTB incrementViewCount() on the GlideRecord so the platform's
  // handleViewCountIncrement chain runs with a proper current context.
  if (!input) {
    try {
      gr.incrementViewCount();
    } catch (e) { /* non-critical — proceed */ }
  }

  // Rating availability — use GlideAggregate for reliable live counts
  data.canRate = true;
  data.percent = _getPercent(articleId);

  // Handle rating submission
  if (input && input.action === 'rate') {
    try {
      var fb = new GlideRecord('kb_feedback');
      fb.user    = gs.getUserID();
      fb.article = articleId;
      fb.helpful = input.helpful;
      fb.insert();
    } catch (e) { /* log but don't break */ }
    data.response = 'Thank you for your feedback';
    data.percent  = _getPercent(articleId);
  }

  // Related articles — same category, different article, top by views
  if (catId) {
    var rel = new GlideRecord('kb_knowledge');
    rel.addActiveQuery();
    rel.addQuery('workflow_state', 'published');
    rel.addQuery('kb_category', catId);
    rel.addQuery('sys_id', '!=', articleId);
    rel.orderByDesc('sys_view_count');
    rel.setLimit(4);
    rel.query();
    while (rel.next()) {
      data.related.push({
        sys_id: rel.getUniqueValue(),
        title:  rel.getValue('short_description'),
        views:  parseInt(rel.getValue('sys_view_count') || '0', 10)
      });
    }
  }

  function _getPercent(artId) {
    try {
      var total = new GlideAggregate('kb_feedback');
      total.addQuery('article', artId);
      total.addAggregate('COUNT');
      total.query();
      var t = total.next() ? parseInt(total.getAggregate('COUNT') || '0', 10) : 0;
      if (t <= 0) return -1;

      var yes = new GlideAggregate('kb_feedback');
      yes.addQuery('article', artId);
      yes.addQuery('helpful', true);
      yes.addAggregate('COUNT');
      yes.query();
      var y = yes.next() ? parseInt(yes.getAggregate('COUNT') || '0', 10) : 0;

      return Math.round((y / t) * 100);
    } catch (e) { return -1; }
  }
})();
