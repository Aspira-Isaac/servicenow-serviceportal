function($scope, $sce, $timeout) {
  var c = this;

  // Color palette for sidebar category dots
  var COLORS = ['#10b981','#3b82f6','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'];

  // Icon map: keyword → FontAwesome class
  var ICON_MAP = [
    { k: 'getting started',  i: 'fa-rocket'        },
    { k: 'account',          i: 'fa-user-circle'   },
    { k: 'setting',          i: 'fa-cog'           },
    { k: 'payment',          i: 'fa-credit-card'   },
    { k: 'billing',          i: 'fa-file-text-o'   },
    { k: 'invoice',          i: 'fa-file-text-o'   },
    { k: 'reservation',      i: 'fa-calendar'      },
    { k: 'booking',          i: 'fa-calendar-check-o'},
    { k: 'troubleshoot',     i: 'fa-wrench'        },
    { k: 'issue',            i: 'fa-exclamation-circle'},
    { k: 'onboard',          i: 'fa-flag'          },
    { k: 'agent',            i: 'fa-headphones'    },
    { k: 'escalat',          i: 'fa-level-up'      }
  ];
  var FALLBACK = ['fa-folder-open','fa-bookmark','fa-tag','fa-cube','fa-star','fa-archive'];

  function iconFor(label, idx) {
    var lower = (label || '').toLowerCase();
    for (var j = 0; j < ICON_MAP.length; j++) {
      if (lower.indexOf(ICON_MAP[j].k) !== -1) return ICON_MAP[j].i;
    }
    return FALLBACK[idx % FALLBACK.length];
  }

  // Enrich categories with color + icon
  var cats = c.data.categories || [];
  for (var ci = 0; ci < cats.length; ci++) {
    cats[ci].color = COLORS[ci % COLORS.length];
    cats[ci].icon  = iconFor(cats[ci].label, ci);
  }

  // ── State ──────────────────────────────────────────────────────────────────
  c.view              = 'home';   // 'home' | 'category' | 'article' | 'search'
  c.selectedCat       = null;
  c.articles          = [];
  c.article           = null;
  c.articleHtml       = null;
  c.related           = [];
  c.loading           = false;
  c.searchTerm        = '';
  c.searchResults     = [];
  c.rated             = false;
  c.searchTimer       = null;
  c.sidebarExpanded   = {};   // catId → boolean
  c.sidebarArticleMap = {};   // catId → articles[]
  c.sidebarLoading    = {};   // catId → boolean

  // ── Navigation ─────────────────────────────────────────────────────────────
  c.goHome = function() {
    c.view = 'home';
    c.selectedCat = null;
    c.article = null;
    c.searchTerm = '';
    c.searchResults = [];
    c.rated = false;
  };

  c.toggleSidebarCat = function(cat, $event) {
    if ($event) $event.stopPropagation();
    var id = cat.sys_id;
    c.sidebarExpanded[id] = !c.sidebarExpanded[id];
    if (c.sidebarExpanded[id] && !c.sidebarArticleMap[id]) {
      c.sidebarLoading[id] = true;
      $scope.server.get({ action: 'load_category', catId: id }).then(function(r) {
        c.sidebarArticleMap[id] = r.data.articles || [];
        c.sidebarLoading[id] = false;
      });
    }
  };

  c.selectCategory = function(cat) {
    c.view = 'category';
    c.selectedCat = cat;
    c.article = null;
    c.rated = false;
    c.loading = true;
    // Auto-expand sidebar for this category
    c.sidebarExpanded[cat.sys_id] = true;
    if (c.sidebarArticleMap[cat.sys_id]) {
      // Already cached — reuse and skip second server call
      c.articles = c.sidebarArticleMap[cat.sys_id];
      c.loading = false;
    } else {
      c.sidebarLoading[cat.sys_id] = true;
      $scope.server.get({ action: 'load_category', catId: cat.sys_id }).then(function(r) {
        c.articles = r.data.articles || [];
        c.sidebarArticleMap[cat.sys_id] = c.articles;
        c.sidebarLoading[cat.sys_id] = false;
        c.loading = false;
      });
    }
  };

  c.selectArticle = function(art, catOverride) {
    c.view = 'article';
    c.article = art;
    c.rated = false;
    if (catOverride) c.selectedCat = catOverride;
    c.loading = true;
    $scope.server.get({ action: 'load_article', artId: art.sys_id }).then(function(r) {
      if (r.data.article) {
        c.article    = r.data.article;
        c.articleHtml = $sce.trustAsHtml(r.data.article.text || '');
        c.related    = r.data.related || [];
        // Resolve sidebar category from article if not already set
        if (r.data.article.cat_id) {
          for (var i = 0; i < c.data.categories.length; i++) {
            if (c.data.categories[i].sys_id === r.data.article.cat_id) {
              if (!c.selectedCat) c.selectedCat = c.data.categories[i];
              // Expand sidebar for this category so active article is visible
              c.sidebarExpanded[r.data.article.cat_id] = true;
              if (!c.sidebarArticleMap[r.data.article.cat_id]) {
                c.sidebarArticleMap[r.data.article.cat_id] = r.data.related
                  ? [r.data.article].concat(r.data.related) : [r.data.article];
              }
              break;
            }
          }
        }
      }
      c.loading = false;
    });
  };

  c.rate = function(helpful) {
    $scope.server.get({ action: 'rate', artId: c.article.sys_id, helpful: helpful }).then(function() {
      c.rated = true;
    });
  };

  // ── Search ─────────────────────────────────────────────────────────────────
  c.doSearch = function() {
    if (!c.searchTerm || c.searchTerm.length < 2) {
      c.searchResults = [];
      if (c.view === 'search') c.goHome();
      return;
    }
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
      c.doSearch();
      return;
    }
    if (c.searchTimer) $timeout.cancel(c.searchTimer);
    c.searchTimer = $timeout(c.doSearch, 350);
  };

  c.clearSearch = function() {
    c.searchTerm = '';
    c.doSearch();
  };
}
