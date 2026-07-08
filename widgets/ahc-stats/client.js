function($scope, $location, $rootScope) {
  var c = this;

  c.goToList = function(filter) {
    $rootScope.ahcOverlay = true;
    $location.search({ id: 'ticket_list', filter: filter });
  };

  // Breakdown rows pass the exact state value — the case list filters on it directly
  c.goToState = function(stateVal) {
    c.goToList(stateVal);
  };

  // Account admins: flip the whole section between account-wide and personal.
  // server.get() reruns the server script with input.scope and returns fresh data.
  c.scopeLoading = false;
  c.setScope = function(scope) {
    if (c.scopeLoading || scope === c.data.scope) return;
    c.scopeLoading = true;
    c.server.get({ scope: scope }).then(function(resp) {
      var rd = (resp && resp.data) ? resp.data : {};
      ['stats', 'breakdown', 'insights', 'recent', 'scope', 'scopeLabel'].forEach(function(k) {
        if (typeof rd[k] !== 'undefined') c.data[k] = rd[k];
      });
      c.scopeLoading = false;
    }, function() {
      c.scopeLoading = false;
    });
  };
}
