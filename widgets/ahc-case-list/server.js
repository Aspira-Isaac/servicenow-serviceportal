(function() {
  // Server-side pagination, filtering, and search (mirrors how the stock CSM
  // list behaves). Only one page of rows is ever loaded and serialized —
  // accounts with tens of thousands of cases render in constant time.
  var PAGE_SIZE = 20;

  var userId = gs.getUserID();
  data.currentUserId = userId;

  var stateBadge = {
    '1':    'new',
    '2':    'open',
    '10':   'in-progress',
    '18':   'awaiting',
    '8':    'awaiting',
    '1000': 'awaiting',
    '1010': 'in-progress',
    '1020': 'in-progress',
    '1030': 'awaiting',
    '6':    'resolved',
    '3':    'closed',
    '7':    'closed'
  };

  // Named group filters from the stats cards (must mirror ahc-stats groupings)
  var FILTER_GROUPS = {
    'open':     ['1', '2', '10'],
    'pending':  ['18', '8', '1000', '1010', '1020', '1030'],
    'resolved': ['3', '6', '7']
  };

  var isAdmin   = gs.hasRole('sn_customerservice.customer_admin');
  var accountId = isAdmin ? String(gs.getUser().getCompanyID() || '') : '';
  // Account scope only applies when the company is an actual customer account.
  // Internal users hold customer_admin implicitly via admin, but their company
  // is the vendor — without this check they'd see no cases at all.
  if (accountId) {
    var coGr = new GlideRecord('core_company');
    coGr.addQuery('sys_id', accountId);
    coGr.addQuery('customer', true);
    coGr.setLimit(1);
    coGr.query();
    if (!coGr.hasNext()) accountId = '';
  }
  var isAccount   = isAdmin && !!accountId;
  data.scopeLabel = isAccount ? 'account' : 'personal';

  // Parameters: from server.get input after first load, from the URL initially
  var urlFilter = '';
  try { urlFilter = String($sp.getParameter('filter') || ''); } catch(e) {}

  var filter = String((input && input.filter) || urlFilter || 'all');
  var opener = String((input && input.opener) || 'everyone');
  var search = String((input && input.search) || '').substring(0, 200).trim();
  var page   = parseInt((input && input.page) || 0, 10);
  if (isNaN(page) || page < 0) page = 0;

  function addConditions(gr) {
    if (isAccount) {
      gr.addQuery('account', accountId);
    } else {
      gr.addQuery('contact', userId).addOrCondition('opened_by', userId);
    }
    if (filter !== 'all') {
      var group = FILTER_GROUPS[filter];
      if (group) {
        gr.addQuery('state', 'IN', group.join(','));
      } else {
        gr.addQuery('state', filter);
      }
    }
    if (opener === 'me')   gr.addQuery('opened_by', userId);
    if (opener === 'team') gr.addQuery('opened_by', '!=', userId);
    if (search) {
      gr.addQuery('number', 'CONTAINS', search)
        .addOrCondition('short_description', 'CONTAINS', search)
        .addOrCondition('opened_by.name', 'CONTAINS', search);
    }
  }

  // Total matching cases (count only — no rows)
  var countAgg = new GlideAggregate('sn_customerservice_case');
  addConditions(countAgg);
  countAgg.addAggregate('COUNT');
  countAgg.query();
  var total = countAgg.next() ? (parseInt(countAgg.getAggregate('COUNT'), 10) || 0) : 0;

  // Clamp the page if filters shrank the result set under the current window
  var maxPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  if (page > maxPage) page = maxPage;

  // One page of rows
  var gr = new GlideRecord('sn_customerservice_case');
  addConditions(gr);
  gr.orderByDesc('sys_updated_on');
  gr.chooseWindow(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  gr.query();

  var cases = [];
  while (gr.next()) {
    var stateVal = gr.getValue('state');
    cases.push({
      sys_id:            gr.getUniqueValue(),
      number:            gr.getValue('number'),
      short_description: gr.getValue('short_description') || '',
      account:           gr.getDisplayValue('account'),
      state:             gr.getDisplayValue('state'),
      stateVal:          stateVal,
      badgeClass:        stateBadge[stateVal] || 'open',
      updated:           gr.getDisplayValue('sys_updated_on'),
      openedById:        gr.getValue('opened_by'),
      openedByName:      gr.getDisplayValue('opened_by')
    });
  }

  data.cases    = cases;
  data.total    = total;
  data.page     = page;
  data.pageSize = PAGE_SIZE;
  data.filter   = filter;
  data.opener   = opener;
  data.search   = search;

  // Filter chips: distinct states across the whole scope (unfiltered), so
  // chips don't vanish while one of them is selected
  if (!input) {
    var stAgg = new GlideAggregate('sn_customerservice_case');
    if (isAccount) {
      stAgg.addQuery('account', accountId);
    } else {
      stAgg.addQuery('contact', userId).addOrCondition('opened_by', userId);
    }
    stAgg.groupBy('state');
    stAgg.addAggregate('COUNT');
    stAgg.query();
    var states = [];
    while (stAgg.next()) {
      states.push({ value: stAgg.getValue('state'), label: stAgg.getDisplayValue('state') });
    }
    states.sort(function(a, b) { return Number(a.value) - Number(b.value); });
    data.states = states;
  }
})();
