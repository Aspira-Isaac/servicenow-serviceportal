(function() {
  data.isLoggedIn = gs.isLoggedIn();
  if (!data.isLoggedIn) return;

  var userId    = gs.getUserID();
  var isAdmin   = gs.hasRole('sn_customerservice.customer_admin');
  var accountId = isAdmin ? String(gs.getUser().getCompanyID() || '') : '';
  // Account scope only applies when the company is an actual customer account
  // (internal users hold customer_admin implicitly via admin)
  if (accountId) {
    var coGr = new GlideRecord('core_company');
    coGr.addQuery('sys_id', accountId);
    coGr.addQuery('customer', true);
    coGr.setLimit(1);
    coGr.query();
    if (!coGr.hasNext()) accountId = '';
  }

  // Account admins can flip the whole section between account-wide and
  // personal scope (input.scope from the toggle; default account-wide)
  data.canToggleScope = isAdmin && !!accountId;
  var isAccount = data.canToggleScope && !(input && input.scope === 'mine');
  data.scope      = isAccount ? 'account' : 'mine';
  data.scopeLabel = isAccount ? 'account' : 'personal';

  function addScope(gr) {
    if (isAccount) {
      gr.addQuery('account', accountId);
    } else {
      gr.addQuery('contact', userId).addOrCondition('opened_by', userId);
    }
  }

  // Count by state using aggregate
  var agg = new GlideAggregate('sn_customerservice_case');
  addScope(agg);
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

  // Per-state breakdown rows inside the Open and Pending cards.
  // Values must stay valid ahc-case-list filter params (exact state match).
  var stateLabels = {
    '1': 'New', '2': 'Assigned', '10': 'In Progress',
    '18': 'Pending', '8': 'Pending - Aspira', '1000': 'Pending Quality Control',
    '1010': 'Ready to Test', '1020': 'Ready for Prod', '1030': 'On Hold (Future Consideration)',
    '6': 'Resolved', '3': 'Closed', '7': 'Cancelled'
  };
  function breakdown(stateVals) {
    var rows = [];
    for (var bi = 0; bi < stateVals.length; bi++) {
      var v = stateVals[bi];
      var n = counts[v] || 0;
      if (n > 0) rows.push({ value: v, label: stateLabels[v] || v, count: n });
    }
    rows.sort(function(a, b) { return b.count - a.count; });
    return rows;
  }
  data.breakdown = {
    open:     breakdown(['1', '2', '10']),
    pending:  breakdown(['18', '8', '1000', '1010', '1020', '1030']),
    resolved: breakdown(['6', '3', '7'])
  };

  // Monthly momentum — opened / resolved this calendar month vs last.
  // Resolved uses closed_at within the resolved-group states; plain
  // addQuery/addOrCondition only (encoded ^NQ would drop the scope filter).
  function countOpened(from, to) {
    var ag = new GlideAggregate('sn_customerservice_case');
    addScope(ag);
    ag.addQuery('opened_at', '>=', from);
    if (to) ag.addQuery('opened_at', '<', to);
    ag.addAggregate('COUNT');
    ag.query();
    return ag.next() ? (parseInt(ag.getAggregate('COUNT'), 10) || 0) : 0;
  }
  function countResolved(from, to) {
    var ag = new GlideAggregate('sn_customerservice_case');
    addScope(ag);
    ag.addQuery('state', 'IN', '3,6,7');
    ag.addQuery('closed_at', '>=', from);
    if (to) ag.addQuery('closed_at', '<', to);
    ag.addAggregate('COUNT');
    ag.query();
    return ag.next() ? (parseInt(ag.getAggregate('COUNT'), 10) || 0) : 0;
  }
  var monthStart     = gs.beginningOfThisMonth();
  var lastMonthStart = gs.beginningOfLastMonth();
  data.trend = {
    openedThis:   countOpened(monthStart),
    openedLast:   countOpened(lastMonthStart, monthStart),
    resolvedThis: countResolved(monthStart),
    resolvedLast: countResolved(lastMonthStart, monthStart)
  };

  // Account insights — top locations / categories over the last 90 days
  // (account scope only; not meaningful for a personal case list)
  // Some cases carry the account-level location instead of a real park, so the
  // location list excludes any entry named after the account itself.
  var accountName = '';
  if (isAccount) {
    var accGr = new GlideRecord('core_company');
    if (accGr.get(accountId)) accountName = String(accGr.getValue('name') || '').toLowerCase();
  }

  function topGroups(field) {
    var out = [];
    var ag = new GlideAggregate('sn_customerservice_case');
    ag.addQuery('account', accountId);
    ag.addQuery('opened_at', '>=', gs.daysAgo(90));
    ag.addNotNullQuery(field);
    ag.groupBy(field);
    ag.addAggregate('COUNT');
    ag.query();
    while (ag.next()) {
      var label = String(ag.getDisplayValue(field) || '');
      var cnt   = parseInt(ag.getAggregate('COUNT'), 10) || 0;
      if (!label || cnt === 0) continue;
      if (field === 'location' && accountName && label.toLowerCase() === accountName) continue;
      out.push({ label: label, count: cnt });
    }
    out.sort(function(a, b) { return b.count - a.count; });
    out = out.slice(0, 5);
    var max = out.length ? out[0].count : 1;
    for (var ti = 0; ti < out.length; ti++) {
      out[ti].pct = Math.max(8, Math.round(out[ti].count / max * 100));
    }
    return out;
  }
  data.insights = { locations: [], categories: [] };
  if (isAccount) {
    data.insights.locations  = topGroups('location');
    data.insights.categories = topGroups('category');
  }

  // 5 most recently updated cases
  var gr = new GlideRecord('sn_customerservice_case');
  addScope(gr);
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
