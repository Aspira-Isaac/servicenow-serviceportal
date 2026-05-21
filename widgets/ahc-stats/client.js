function($scope, $location) {
  var c = this;

  c.goToList = function(filter) {
    $location.search({ id: 'ticket_list', filter: filter });
  };
}
