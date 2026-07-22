(function() {
  // Anonymous sessions get nothing. Cases opened via unauthenticated channels
  // (inbound email) carry opened_by=guest, so the personal-scope fallback
  // below (opened_by=<current user>) would hand ALL of them to any logged-out
  // visitor if this widget ever lands on a public page again (2026-07-17).
  data.isLoggedIn = gs.isLoggedIn();
  if (!data.isLoggedIn) {
    data.cases = []; data.total = 0; data.states = [];
    data.locations = []; data.categories = []; data.page = 0;
    return;
  }

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

  var opener   = String((input && input.opener) || 'everyone');
  var search   = String((input && input.search) || '').substring(0, 200).trim();
  var page     = parseInt((input && input.page) || 0, 10);
  if (isNaN(page) || page < 0) page = 0;

  // Location + Category are multi-select too (comma-joined lists; empty = All),
  // same contract as the status list above.
  function parseList(v) {
    return typeof v === 'undefined' ? [] : String(v).split(',').filter(function(s) { return s; });
  }
  var selectedLocations  = parseList(input && input.locations);
  var selectedCategories = parseList(input && input.categories);

  // Multi-select status: an explicit list of state values the user checked.
  // Empty list = All (no state constraint). After the first load the client
  // sends input.states (comma-joined); the initial load may instead arrive via
  // a stats-card deep-link (?filter=open|pending|resolved) or ?filter=<state>,
  // which we expand into the list once.
  var selectedStates = [];
  if (input && typeof input.states !== 'undefined') {
    selectedStates = String(input.states).split(',').filter(function(s) { return s; });
  } else if (urlFilter && urlFilter !== 'all') {
    selectedStates = FILTER_GROUPS[urlFilter] ? FILTER_GROUPS[urlFilter].slice() : [urlFilter];
  }

  // Sorting — whitelisted columns only
  var SORT_FIELDS = {
    number:  'number',
    desc:    'short_description',
    opener:  'opened_by.name',
    category:'category',
    state:   'state',
    updated: 'sys_updated_on'
  };
  var sortBy  = SORT_FIELDS[String((input && input.sortBy) || '')] ? String(input.sortBy) : 'updated';
  var sortDir = String((input && input.sortDir) || '') === 'asc' ? 'asc' : 'desc';

  // exclude: facet dimension to leave out — each facet's counts reflect every
  // OTHER active filter ("what do I get if I click this?") but not its own group
  function addConditions(gr, exclude) {
    if (isAccount) {
      gr.addQuery('account', accountId);
    } else {
      gr.addQuery('contact', userId).addOrCondition('opened_by', userId);
    }
    if (exclude !== 'state' && selectedStates.length) {
      gr.addQuery('state', 'IN', selectedStates.join(','));
    }
    if (exclude !== 'opener') {
      if (opener === 'me') gr.addQuery('opened_by', userId);
      if (opener === 'team') {
        // "My Team" = other people on my account. Restrict to users whose
        // company IS my account so internal Aspira staff (vendor company) who
        // opened a case on the account are excluded.
        gr.addQuery('opened_by', '!=', userId);
        if (isAccount) gr.addQuery('opened_by.company', accountId);
      }
    }
    if (exclude !== 'location' && selectedLocations.length)  gr.addQuery('location', 'IN', selectedLocations.join(','));
    if (exclude !== 'category' && selectedCategories.length) gr.addQuery('category', 'IN', selectedCategories.join(','));
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
  if (sortDir === 'asc') {
    gr.orderBy(SORT_FIELDS[sortBy]);
  } else {
    gr.orderByDesc(SORT_FIELDS[sortBy]);
  }
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
      category:          gr.getDisplayValue('category') || '',
      updated:           gr.getDisplayValue('sys_updated_on'),
      openedById:        gr.getValue('opened_by'),
      openedByName:      gr.getDisplayValue('opened_by')
    });
  }

  data.cases    = cases;
  data.total    = total;
  data.page     = page;
  data.pageSize = PAGE_SIZE;
  data.selectedStates     = selectedStates;
  data.selectedLocations  = selectedLocations;
  data.selectedCategories = selectedCategories;
  data.opener   = opener;
  data.search   = search;
  data.sortBy   = sortBy;
  data.sortDir  = sortDir;

  // Export — same mechanism as the OOB Data Table widget: links to the
  // platform list exporter (/<table>_list.do?<FORMAT>), which enforces ACLs
  // and the instance export limits. The query mirrors the full current view
  // (scope + filters + search + sort), not just the visible page.
  var expGr = new GlideRecord('sn_customerservice_case');
  addConditions(expGr);
  if (sortDir === 'asc') {
    expGr.orderBy(SORT_FIELDS[sortBy]);
  } else {
    expGr.orderByDesc(SORT_FIELDS[sortBy]);
  }
  data.exportQuery  = encodeURIComponent(expGr.getEncodedQuery());
  data.exportFields = 'number,short_description,category,opened_by,state,sys_updated_on';

  // Facet options recompute on EVERY request so counts answer "what do I get
  // if I click this?" under the other active filters. Each facet excludes its
  // own dimension so sibling options stay switchable.
  function facetOptions(field, cap, exclude) {
    var agg = new GlideAggregate('sn_customerservice_case');
    addConditions(agg, exclude);
    agg.addNotNullQuery(field);
    agg.groupBy(field);
    agg.addAggregate('COUNT');
    agg.query();
    var opts = [];
    while (agg.next()) {
      var label = String(agg.getDisplayValue(field) || '').trim();
      if (!label) continue;
      opts.push({
        value: agg.getValue(field),
        label: label,
        count: parseInt(agg.getAggregate('COUNT'), 10) || 0
      });
    }
    opts.sort(function(a, b) { return b.count - a.count; });
    return cap ? opts.slice(0, cap) : opts;
  }

  var stAgg = new GlideAggregate('sn_customerservice_case');
  addConditions(stAgg, 'state');
  stAgg.groupBy('state');
  stAgg.addAggregate('COUNT');
  stAgg.query();
  var states = [];
  while (stAgg.next()) {
    states.push({
      value: stAgg.getValue('state'),
      label: stAgg.getDisplayValue('state'),
      count: parseInt(stAgg.getAggregate('COUNT'), 10) || 0
    });
  }
  states.sort(function(a, b) { return Number(a.value) - Number(b.value); });
  data.states = states;

  // Generous caps — the sidebar has an in-facet search box for long lists
  data.locations  = facetOptions('location', 100, 'location');
  data.categories = facetOptions('category', 50, 'category');
})();
