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

  // Whole sidebar collapses to a slim rail; choice sticks for the session
  var SIDE_KEY = 'ahc-cl-side-open';
  c.sideOpen = true;
  try { c.sideOpen = sessionStorage.getItem(SIDE_KEY) !== '0'; } catch(e) {}
  c.toggleSide = function() {
    c.sideOpen = !c.sideOpen;
    try { sessionStorage.setItem(SIDE_KEY, c.sideOpen ? '1' : '0'); } catch(e) {}
  };
  c.activeCount = function() {
    return (c.filter !== 'all' ? 1 : 0) + (c.opener !== 'everyone' ? 1 : 0) +
           (c.location ? 1 : 0) + (c.category ? 1 : 0);
  };

  // A selected option can drop to zero matches under the other filters — keep
  // it in the list (count 0) so the user can see it's active and unselect it
  function keepSelected(fresh, old, selectedVal) {
    if (!selectedVal || !fresh) return fresh;
    for (var i = 0; i < fresh.length; i++) {
      if (fresh[i].value === selectedVal) return fresh;
    }
    for (var j = 0; j < (old || []).length; j++) {
      if (old[j].value === selectedVal) {
        fresh.unshift({ value: old[j].value, label: old[j].label, count: 0 });
        break;
      }
    }
    return fresh;
  }

  // Persist filter/sort state so it survives opening a case and coming back
  var STATE_KEY = 'ahc-cl-state';
  function persistState() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        filter:   c.filter,
        opener:   c.opener,
        search:   c.search,
        location: c.location,
        category: c.category,
        sortBy:   c.sortBy,
        sortDir:  c.sortDir
      }));
    } catch(e) {}
  }

  function reload() {
    persistState();
    c.loading = true;
    c.server.get({
      filter:   c.filter,
      opener:   c.opener,
      search:   c.search.trim(),
      location: c.location,
      category: c.category,
      sortBy:   c.sortBy,
      sortDir:  c.sortDir,
      page:     c.page
    }).then(function(resp) {
      var rd = (resp && resp.data) ? resp.data : {};
      ['cases', 'total', 'page'].forEach(function(k) {
        if (typeof rd[k] !== 'undefined') c.data[k] = rd[k];
      });
      if (rd.states)     c.data.states     = keepSelected(rd.states,     c.data.states,     c.filter !== 'all' ? c.filter : '');
      if (rd.locations)  c.data.locations  = keepSelected(rd.locations,  c.data.locations,  c.location);
      if (rd.categories) c.data.categories = keepSelected(rd.categories, c.data.categories, c.category);
      c.page    = c.data.page;
      c.loading = false;
    }, function() {
      c.loading = false;
    });
  }

  // Column sorting — click toggles direction, new column starts with its
  // natural direction (dates newest-first, text A→Z)
  c.sortBy  = c.data.sortBy  || 'updated';
  c.sortDir = c.data.sortDir || 'desc';

  c.setSort = function(key) {
    if (c.sortBy === key) {
      c.sortDir = (c.sortDir === 'asc') ? 'desc' : 'asc';
    } else {
      c.sortBy  = key;
      c.sortDir = (key === 'updated' || key === 'number') ? 'desc' : 'asc';
    }
    c.page = 0;
    reload();
  };

  c.sortIcon = function(key) {
    if (c.sortBy !== key) return 'fa-sort';
    return c.sortDir === 'asc' ? 'fa-sort-asc' : 'fa-sort-desc';
  };

  // Restore the saved state when returning from a case. An explicit ?filter=
  // in the URL (stats card deep-links) takes precedence over the saved state.
  try {
    var savedState = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    var urlFilter  = ($location.search() || {}).filter;
    if (savedState && !urlFilter) {
      c.filter   = savedState.filter   || c.filter;
      c.opener   = savedState.opener   || c.opener;
      c.search   = savedState.search   || '';
      c.location = savedState.location || '';
      c.category = savedState.category || '';
      c.sortBy   = savedState.sortBy   || c.sortBy;
      c.sortDir  = savedState.sortDir  || c.sortDir;
      // First-load data came from server defaults — refetch if they differ
      if (c.filter   !== (c.data.filter   || 'all')      ||
          c.opener   !== (c.data.opener   || 'everyone') ||
          c.search   !== (c.data.search   || '')         ||
          c.location !== (c.data.location || '')         ||
          c.category !== (c.data.category || '')         ||
          c.sortBy   !== (c.data.sortBy   || 'updated')  ||
          c.sortDir  !== (c.data.sortDir  || 'desc')) {
        reload();
      }
    }
  } catch(e) { /* corrupted saved state — start clean */ }

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
