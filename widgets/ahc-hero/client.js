function($scope, $location) {
  var c = this;
  c.searchQuery = '';

  c.search = function() {
    var q = c.searchQuery.trim();
    if (q) {
      window.location = '?id=ahc_kb_search&query=' + encodeURIComponent(q);
    }
  };
}
