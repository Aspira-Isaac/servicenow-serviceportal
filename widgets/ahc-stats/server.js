(function() {
  var userId    = gs.getUserID();
  var isAdmin   = gs.hasRole('sn_customerservice.customer_admin');
  var accountId = isAdmin ? gs.getUser().getCompanyID() : '';
  var isAccount = isAdmin && !!accountId;
  data.scopeLabel = isAccount ? 'account' : 'personal';

  // Count by state using aggregate
  var agg = new GlideAggregate('sn_customerservice_case');
  if (isAccount) {
    agg.addQuery('account', accountId);
  } else {
    agg.addQuery('contact.user', userId).addOrCondition('opened_by', userId);
  }
  agg.groupBy('state');
  agg.addAggregate('COUNT');
  agg.query();

  var counts = {};
  while (agg.next()) {
    counts[agg.getValue('state')] = parseInt(agg.getAggregate('COUNT'), 10) || 0;
  }

  var open     = (counts['1'] || 0) + (counts['2'] || 0) + (counts['5'] || 0);
  var awaiting = counts['18'] || 0;
  var resolved = (counts['3'] || 0) + (counts['6'] || 0);
  var total    = open + awaiting + resolved;

  data.stats = {
    total:    total,
    open:     open,
    awaiting: awaiting,
    resolved: resolved
  };

  // 5 most recently updated cases
  var gr = new GlideRecord('sn_customerservice_case');
  if (isAccount) {
    gr.addQuery('account', accountId);
  } else {
    gr.addQuery('contact.user', userId).addOrCondition('opened_by', userId);
  }
  gr.addQuery('state', 'NOT IN', '3,6');
  gr.orderByDesc('sys_updated_on');
  gr.setLimit(5);
  gr.query();

  var recent = [];
  var badge = { '1':'new','2':'open','5':'in-progress','18':'awaiting','3':'closed','6':'resolved' };
  while (gr.next()) {
    var s = gr.getValue('state');
    recent.push({
      sys_id:  gr.getUniqueValue(),
      number:  gr.getValue('number'),
      desc:    gr.getValue('short_description') || '',
      state:   gr.getDisplayValue('state'),
      badge:   badge[s] || 'open',
      updated: gr.getDisplayValue('sys_updated_on')
    });
  }
  data.recent = recent;
})();
