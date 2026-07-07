function() {
  var c = this;
  c.filter = '';

  c.filtered = function() {
    if (!c.filter) return c.data.articles;
    var q = c.filter.toLowerCase();
    return c.data.articles.filter(function(a) {
      return (a.short_description || '').toLowerCase().indexOf(q) !== -1 ||
             (a.snippet || '').toLowerCase().indexOf(q) !== -1;
    });
  };
}
