function($scope, $timeout) {
  var c = this;

  var ICON_MAP = [
    { k: 'account',     i: 'fa-user-circle'  },
    { k: 'application', i: 'fa-desktop'       },
    { k: 'change',      i: 'fa-exchange'      },
    { k: 'customer',    i: 'fa-headphones'    },
    { k: 'hardware',    i: 'fa-desktop'       },
    { k: 'inventory',   i: 'fa-cubes'         },
    { k: 'license',     i: 'fa-key'           },
    { k: 'network',     i: 'fa-sitemap'       },
    { k: 'refund',      i: 'fa-credit-card'   },
    { k: 'report',      i: 'fa-bar-chart'     },
    { k: 'support',     i: 'fa-life-ring'     },
    { k: 'access',      i: 'fa-lock'          },
    { k: 'billing',     i: 'fa-file-text-o'   },
    { k: 'payment',     i: 'fa-credit-card'   },
    { k: 'software',    i: 'fa-laptop'        },
    { k: 'security',    i: 'fa-shield'        },
    { k: 'onboard',     i: 'fa-flag'          },
    { k: 'setting',     i: 'fa-cog'           }
  ];
  var FALLBACK = ['fa-folder-open','fa-bookmark','fa-tag','fa-cube','fa-star','fa-archive'];

  function iconFor(label, idx) {
    var lower = (label || '').toLowerCase();
    for (var j = 0; j < ICON_MAP.length; j++) {
      if (lower.indexOf(ICON_MAP[j].k) !== -1) return ICON_MAP[j].i;
    }
    return FALLBACK[idx % FALLBACK.length];
  }

  var cats = c.data.categories || [];
  for (var ci = 0; ci < cats.length; ci++) {
    cats[ci].icon = iconFor(cats[ci].label, ci);
  }

  // ── State ──────────────────────────────────────────────────────────────────
  c.view            = 'home';
  c.selectedCat     = null;
  c.items           = [];
  c.loading         = false;
  c.searchTerm      = '';
  c.searchResults   = [];
  c.searchTimer     = null;
  c.sidebarExpanded = {};
  c.sidebarItemMap  = {};
  c.sidebarLoading  = {};

  // ── Navigation ─────────────────────────────────────────────────────────────
  c.goHome = function() {
    c.view = 'home';
    c.selectedCat = null;
    c.searchTerm = '';
    c.searchResults = [];
  };

  c.toggleSidebarCat = function(cat, $event) {
    if ($event) $event.stopPropagation();
    var id = cat.sys_id;
    c.sidebarExpanded[id] = !c.sidebarExpanded[id];
    if (c.sidebarExpanded[id] && !c.sidebarItemMap[id]) {
      c.sidebarLoading[id] = true;
      $scope.server.get({ action: 'load_category', catId: id }).then(function(r) {
        c.sidebarItemMap[id] = r.data.items || [];
        c.sidebarLoading[id] = false;
      });
    }
  };

  c.selectCategory = function(cat) {
    c.view = 'category';
    c.selectedCat = cat;
    c.loading = true;
    c.sidebarExpanded[cat.sys_id] = true;
    if (c.sidebarItemMap[cat.sys_id]) {
      c.items = c.sidebarItemMap[cat.sys_id];
      c.loading = false;
    } else {
      c.sidebarLoading[cat.sys_id] = true;
      $scope.server.get({ action: 'load_category', catId: cat.sys_id }).then(function(r) {
        c.items = r.data.items || [];
        c.sidebarItemMap[cat.sys_id] = c.items;
        c.sidebarLoading[cat.sys_id] = false;
        c.loading = false;
      });
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  c.doSearch = function() {
    if (!c.searchTerm) {
      c.searchResults = [];
      if (c.view === 'search') c.goHome();
      return;
    }
    if (c.searchTerm.length < 2) return; // wait for more input, don't jump views
    c.loading = true;
    c.view = 'search';
    $scope.server.get({ action: 'search', term: c.searchTerm }).then(function(r) {
      c.searchResults = r.data.results || [];
      c.loading = false;
    });
  };

  c.onSearchKey = function($event) {
    if ($event.keyCode === 13) {
      if (c.searchTimer) $timeout.cancel(c.searchTimer);
      if (c.searchTerm && c.searchTerm.length >= 2) c.doSearch();
      return;
    }
    if (c.searchTimer) $timeout.cancel(c.searchTimer);
    c.searchTimer = $timeout(c.doSearch, 400);
  };

  c.clearSearch = function() {
    c.searchTerm = '';
    c.searchResults = [];
    c.goHome();
  };

}
