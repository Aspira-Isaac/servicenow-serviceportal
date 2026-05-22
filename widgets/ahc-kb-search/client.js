function($scope, $location) {
  var c = this;

  c.query = $location.search().query || '';
  c.results = [];
  c.loading = false;
  c.hasSearched = false;
  c.activeKb = 'all';

  c.search = function() {
    if (!c.query.trim() && c.activeKb === 'all') return;
    c.loading = true;
    c.hasSearched = false;

    c.server.get({
      action: 'search',
      query:  c.query.trim(),
      kb:     c.activeKb === 'all' ? '' : c.activeKb
    }).then(function(r) {
      c.loading = false;
      c.hasSearched = true;
      c.results = r.data.result || [];
    }).catch(function() {
      c.loading = false;
      c.hasSearched = true;
      c.results = [];
    });
  };

  c.filterByKb = function(kbId) {
    c.activeKb = kbId;
    if (c.hasSearched || c.query.trim()) c.search();
  };

  c.openArticle = function(sysId) {
    window.location = '?id=kb_article&sys_id=' + sysId;
  };

  // Auto-search if query param was passed from hero widget
  if (c.query) c.search();
}
