function($scope, $location, $rootScope, $timeout) {
  var c = this;

  // Tell the nav which page we're on, and clear the overlay
  $rootScope.currentPageId = 'ticket_list';
  $rootScope.ahcOverlay = false;

  // Server-side pagination/filtering: every change round-trips through
  // server.get and replaces the current page of rows
  // Multi-select filters: arrays of selected values. Empty array = All.
  c.states     = (c.data.selectedStates     || []).slice();
  c.locations  = (c.data.selectedLocations  || []).slice();
  c.categories = (c.data.selectedCategories || []).slice();
  c.opener   = c.data.opener   || 'everyone';
  c.search   = c.data.search   || '';
  c.page     = c.data.page     || 0;
  c.loading  = false;

  // Sidebar UI state — collapsible groups + in-facet search
  c.groupOpen = { status: true, opener: true, location: true, category: true };
  c.locSearch = '';
  c.catSearch = '';

  // Export menu — same formats as the OOB Data Table widget; the links are
  // plain hrefs to the platform list exporter, built from data.exportQuery
  c.exportTypes = [
    { label: 'PDF',   value: 'PDF' },
    { label: 'Excel', value: 'EXCEL' },
    { label: 'CSV',   value: 'CSV' }
  ];
  c.exportOpen = false;
  var docClick = function(e) {
    if (!c.exportOpen) return;
    if (e.target.closest && e.target.closest('.ahc-cl__export')) return;
    $timeout(function() { c.exportOpen = false; });
  };
  document.addEventListener('click', docClick);
  $scope.$on('$destroy', function() { document.removeEventListener('click', docClick); });

  // Whole sidebar collapses to a slim rail; choice sticks for the session
  var SIDE_KEY = 'ahc-cl-side-open';
  c.sideOpen = true;
  try { c.sideOpen = sessionStorage.getItem(SIDE_KEY) !== '0'; } catch(e) {}
  c.toggleSide = function() {
    c.sideOpen = !c.sideOpen;
    try { sessionStorage.setItem(SIDE_KEY, c.sideOpen ? '1' : '0'); } catch(e) {}
  };
  c.activeCount = function() {
    return (c.states.length ? 1 : 0) + (c.opener !== 'everyone' ? 1 : 0) +
           (c.locations.length ? 1 : 0) + (c.categories.length ? 1 : 0);
  };

  // A selected option can drop to zero matches under the other filters — keep
  // EVERY still-selected value visible (count 0) so the user can always uncheck
  // it even if it currently matches nothing. Works for any multi-select facet.
  function keepSelectedMulti(fresh, old, selectedArr) {
    if (!fresh) return fresh;
    selectedArr.forEach(function(val) {
      if (fresh.some(function(o) { return o.value === val; })) return;
      var prev = (old || []).filter(function(o) { return o.value === val; })[0];
      fresh.unshift({ value: val, label: prev ? prev.label : val, count: 0 });
    });
    return fresh;
  }

  // Persist filter/sort state so it survives opening a case and coming back
  var STATE_KEY = 'ahc-cl-state';
  function persistState() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        states:     c.states,
        locations:  c.locations,
        categories: c.categories,
        opener:     c.opener,
        search:     c.search,
        sortBy:     c.sortBy,
        sortDir:    c.sortDir
      }));
    } catch(e) {}
  }

  function reload() {
    persistState();
    c.loading = true;
    c.server.get({
      states:     c.states.join(','),
      locations:  c.locations.join(','),
      categories: c.categories.join(','),
      opener:     c.opener,
      search:     c.search.trim(),
      sortBy:     c.sortBy,
      sortDir:    c.sortDir,
      page:       c.page
    }).then(function(resp) {
      var rd = (resp && resp.data) ? resp.data : {};
      ['cases', 'total', 'page', 'exportQuery'].forEach(function(k) {
        if (typeof rd[k] !== 'undefined') c.data[k] = rd[k];
      });
      if (rd.states)     c.data.states     = keepSelectedMulti(rd.states,     c.data.states,     c.states);
      if (rd.locations)  c.data.locations  = keepSelectedMulti(rd.locations,  c.data.locations,  c.locations);
      if (rd.categories) c.data.categories = keepSelectedMulti(rd.categories, c.data.categories, c.categories);
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
      c.states     = Array.isArray(savedState.states)     ? savedState.states.slice()     : c.states;
      c.locations  = Array.isArray(savedState.locations)  ? savedState.locations.slice()  : c.locations;
      c.categories = Array.isArray(savedState.categories) ? savedState.categories.slice() : c.categories;
      c.opener   = savedState.opener   || c.opener;
      c.search   = savedState.search   || '';
      c.sortBy   = savedState.sortBy   || c.sortBy;
      c.sortDir  = savedState.sortDir  || c.sortDir;
      // First-load data came from server defaults — refetch if they differ
      if (c.states.join(',')     !== (c.data.selectedStates     || []).join(',') ||
          c.locations.join(',')  !== (c.data.selectedLocations  || []).join(',') ||
          c.categories.join(',') !== (c.data.selectedCategories || []).join(',') ||
          c.opener   !== (c.data.opener   || 'everyone') ||
          c.search   !== (c.data.search   || '')         ||
          c.sortBy   !== (c.data.sortBy   || 'updated')  ||
          c.sortDir  !== (c.data.sortDir  || 'desc')) {
        reload();
      }
    }
  } catch(e) { /* corrupted saved state — start clean */ }

  // Multi-select facets: clicking a value toggles it in/out; the group's "All"
  // clears that facet. Empty array = no constraint on that dimension.
  function toggleIn(arr, val) {
    var i = arr.indexOf(val);
    if (i === -1) arr.push(val);
    else arr.splice(i, 1);
    c.page = 0;
    reload();
  }
  c.isStateSelected    = function(val) { return c.states.indexOf(val)     !== -1; };
  c.isLocationSelected = function(val) { return c.locations.indexOf(val)  !== -1; };
  c.isCategorySelected = function(val) { return c.categories.indexOf(val) !== -1; };

  c.toggleState    = function(val) { toggleIn(c.states, val); };
  c.toggleLocation = function(val) { toggleIn(c.locations, val); };
  c.toggleCategory = function(val) { toggleIn(c.categories, val); };

  c.setAllStates     = function() { c.states     = []; c.page = 0; reload(); };
  c.setAllLocations  = function() { c.locations  = []; c.page = 0; reload(); };
  c.setAllCategories = function() { c.categories = []; c.page = 0; reload(); };
  c.setOpener = function(o) { c.opener = o; c.page = 0; reload(); };

  c.clearAll = function() {
    c.states     = [];
    c.locations  = [];
    c.categories = [];
    c.opener   = 'everyone';
    c.search   = '';
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
    return c.states.length > 0 || c.locations.length > 0 || c.categories.length > 0 ||
           c.opener !== 'everyone' || !!c.search;
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
