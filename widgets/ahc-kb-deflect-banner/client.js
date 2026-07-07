function($scope, $document, $timeout) {
  var c = this;
  c.dismissed = false;

  c.dismiss = function() { c.dismissed = true; };

  // Replace the SP page's %name token after the portal framework sets it
  if ($scope.data.term) {
    $timeout(function() {
      $document[0].title = $document[0].title.replace('%name', $scope.data.term);
    }, 50);
  }
}
