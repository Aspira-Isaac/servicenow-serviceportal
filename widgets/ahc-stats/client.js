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
}
