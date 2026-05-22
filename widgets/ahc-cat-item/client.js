function($scope, $location) {
  var c = this;

  $scope.$on('$sp.sc_cat_item.submitted', function(event, data) {
    if (data.redirect_portal_url) {
      $location.url(data.redirect_portal_url);
      return;
    }

    // For record producers that directly create a case
    if (data.table === 'sn_customerservice_case') {
      $location.search('id=ticket_detail&sys_id=' + data.sys_id);
      return;
    }

    // For catalog items that create a request — look up the resulting case
    $scope.server.get({ action: 'get_case', requestId: data.sys_id }).then(function(response) {
      if (response.data.caseId) {
        $location.search('id=ticket_detail&sys_id=' + response.data.caseId);
      } else {
        $location.search('id=ticket_list');
      }
    });
  });
}
