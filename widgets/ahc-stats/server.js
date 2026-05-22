(function() {
  data.isLoggedIn = gs.isLoggedIn();
  if (!data.isLoggedIn) return;

  var userId    = gs.getUserID();
  var isAdmin   = gs.hasRole('sn_customerservice.customer_admin');
  var accountId = isAdmin ? String(gs.getUser().getCompanyID() || '') : '';
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

  var open     = (counts['1']  || 0) + (counts['2']    || 0) + (counts['10']   || 0);
  var pending  = (counts['18'] || 0) + (counts['8']    || 0) + (counts['1000'] || 0) +
                 (counts['1010'] || 0) + (counts['1020'] || 0) + (counts['1030'] || 0);
  var resolved = (counts['3'] || 0) + (counts['6'] || 0) + (counts['7'] || 0);
  var total    = open + pending + resolved;

  data.stats = {
    total:    total,
    open:     open,
    pending:  pending,
    resolved: resolved
  };

  // 5 most recently updated cases
  var gr = new GlideRecord('sn_customerservice_case');
  if (isAccount) {
    gr.addQuery('account', accountId);
  } else {
    gr.addQuery('contact.user', userId).addOrCondition('opened_by', userId);
  }
  gr.addQuery('state', 'NOT IN', '3,6,7');
  gr.orderByDesc('sys_updated_on');
  gr.setLimit(5);
  gr.query();

  var recent = [];
  var badge = {
    '1':'new', '2':'open', '10':'in-progress',
    '18':'awaiting', '8':'awaiting', '1000':'awaiting', '1030':'awaiting',
    '1010':'in-progress', '1020':'in-progress',
    '6':'resolved', '3':'closed', '7':'closed'
  };
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
