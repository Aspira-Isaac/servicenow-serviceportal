function($scope, $location, $rootScope) {
  var c = this;

  c.goToList = function(filter) {
    $rootScope.ahcOverlay = true;
    $location.search({ id: 'ticket_list', filter: filter });
  };
}
