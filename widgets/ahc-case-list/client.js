function($scope, $location) {
  var c = this;

  var PAGE_SIZE = 20;
  var CLOSED    = ['3', '6'];

  c.filter  = 'all';
  c.opener  = 'everyone';
  c.search  = '';
  c.page    = 0;

  c.setFilter = function(f) { c.filter = f; c.page = 0; };
  c.setOpener = function(o) { c.opener = o; c.page = 0; };
  c.clearAll  = function()  { c.filter = 'all'; c.opener = 'everyone'; c.search = ''; c.page = 0; };

  c.hasFilters = function() {
    return c.filter !== 'all' || c.opener !== 'everyone' || !!c.search;
  };

  c.filtered = function() {
    var q  = (c.search || '').toLowerCase().trim();
    var me = c.data.currentUserId;

    return (c.data.cases || []).filter(function(cs) {
      if (c.filter === 'open'     && CLOSED.indexOf(cs.stateVal) !== -1) return false;
      if (c.filter === 'resolved' && CLOSED.indexOf(cs.stateVal) === -1) return false;

      if (c.opener === 'me'   && cs.openedById !== me) return false;
      if (c.opener === 'team' && cs.openedById === me) return false;

      if (q) {
        var hit = (cs.number            || '').toLowerCase().indexOf(q) !== -1 ||
                  (cs.short_description || '').toLowerCase().indexOf(q) !== -1 ||
                  (cs.openedByName      || '').toLowerCase().indexOf(q) !== -1;
        if (!hit) return false;
      }

      return true;
    });
  };

  c.paged = function() {
    var start = c.page * PAGE_SIZE;
    return c.filtered().slice(start, start + PAGE_SIZE);
  };

  c.totalPages = function() { return Math.max(1, Math.ceil(c.filtered().length / PAGE_SIZE)); };
  c.prevPage   = function() { if (c.page > 0) c.page--; };
  c.nextPage   = function() { if (c.page < c.totalPages() - 1) c.page++; };

  c.pageLabel  = function() {
    var total = c.filtered().length;
    var start = c.page * PAGE_SIZE + 1;
    var end   = Math.min((c.page + 1) * PAGE_SIZE, total);
    return start + '–' + end + ' of ' + total;
  };

  c.goToCase = function(sysId) {
    $location.search({ id: 'ticket_detail', sys_id: sysId });
  };
}
