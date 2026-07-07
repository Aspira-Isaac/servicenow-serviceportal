function($scope, $location, $rootScope, $timeout) {
  var c = this;

  // Tell the nav which page we're on, and clear the overlay
  $rootScope.currentPageId = 'ticket_list';
  $rootScope.ahcOverlay = false;

  // Server-side pagination/filtering: every change round-trips through
  // server.get and replaces the current page of rows
  c.filter   = c.data.filter   || 'all';
  c.opener   = c.data.opener   || 'everyone';
  c.search   = c.data.search   || '';
  c.location = c.data.location || '';
  c.category = c.data.category || '';
  c.page     = c.data.page     || 0;
  c.loading  = false;

  // Sidebar UI state — collapsible groups + in-facet search
  c.groupOpen = { status: true, opener: true, location: true, category: true };
  c.locSearch = '';
  c.catSearch = '';

  function reload() {
    c.loading = true;
    c.server.get({
      filter:   c.filter,
      opener:   c.opener,
      search:   c.search.trim(),
      location: c.location,
      category: c.category,
      page:     c.page
    }).then(function(resp) {
      var rd = (resp && resp.data) ? resp.data : {};
      ['cases', 'total', 'page'].forEach(function(k) {
        if (typeof rd[k] !== 'undefined') c.data[k] = rd[k];
      });
      c.page    = c.data.page;
      c.loading = false;
    }, function() {
      c.loading = false;
    });
  }

  c.setFilter = function(f) { c.filter = f; c.page = 0; reload(); };
  c.setOpener = function(o) { c.opener = o; c.page = 0; reload(); };
  // Clicking the active location/category toggles it back off
  c.setLocation = function(l) { c.location = (c.location === l) ? '' : l; c.page = 0; reload(); };
  c.setCategory = function(cat) { c.category = (c.category === cat) ? '' : cat; c.page = 0; reload(); };

  c.clearAll = function() {
    c.filter   = 'all';
    c.opener   = 'everyone';
    c.search   = '';
    c.location = '';
    c.category = '';
    c.page     = 0;
    reload();
  };

  // Debounced search — one request after the user stops typing
  var searchTimer = null;
  c.searchChanged = function() {
    if (searchTimer) $timeout.cancel(searchTimer);
    searchTimer = $timeout(function() {
      c.page = 0;
      reload();
    }, 350);
  };

  c.clearSearch = function() {
    c.search = '';
    c.page   = 0;
    reload();
  };

  c.hasFilters = function() {
    return c.filter !== 'all' || c.opener !== 'everyone' || !!c.search ||
           !!c.location || !!c.category;
  };

  function fmt(n) { return n.toLocaleString('en-US'); }

  c.totalPages = function() {
    return Math.max(1, Math.ceil((c.data.total || 0) / c.data.pageSize));
  };

  c.prevPage = function() { if (c.page > 0) { c.page--; reload(); } };
  c.nextPage = function() { if (c.page < c.totalPages() - 1) { c.page++; reload(); } };

  c.pageLabel = function() {
    var total = c.data.total || 0;
    var start = c.page * c.data.pageSize + 1;
    var end   = Math.min((c.page + 1) * c.data.pageSize, total);
    return fmt(start) + '–' + fmt(end) + ' of ' + fmt(total);
  };

  c.goToCase = function(sysId) {
    $location.search({ id: 'ticket_detail', sys_id: sysId });
  };
}
