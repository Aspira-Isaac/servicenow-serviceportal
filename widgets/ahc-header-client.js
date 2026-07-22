function($scope, $rootScope, $location) {
  var c = this;

  /* Header client controller.
   *
   * NOTE: this logic used to live in an ng-init on the header template, but
   * Angular expressions cannot contain `function () {}` literals — the whole
   * ng-init threw a $parse syntax error and none of it ever ran. Navigation
   * helpers and location listeners must live here instead.
   *
   * Overlay contract: anything that sets $root.ahcOverlay = true must navigate
   * to a page whose widget clears it on init (ahc-case-list and ahc-case-detail
   * both do). It is deliberately NOT cleared on $locationChangeSuccess — that
   * event fires as soon as the URL changes, before the new page's widgets have
   * loaded, which would kill the loading screen too early.
   */

  function search() { return $location.search() || {}; }

  if (!$rootScope.currentPageId) {
    $rootScope.currentPageId = search().id || '';
  }

  // Bell toggle — the badge mirrors OOTB CSM (count of cases needing the
  // user's action), so it clears by acting on the cases, not by viewing.
  // NOTE if a custom input is ever needed here: the header's server.update()
  // ignores its argument and posts the whole data object — use server.get().
  function toggleNotifs() {
    $rootScope.ahcNotifOpen = !$rootScope.ahcNotifOpen;
  }
  $scope.toggleNotifs = toggleNotifs;
  c.toggleNotifs = toggleNotifs;

  // Notification panel footer: "View all my cases".
  // Must drive the SPA navigation itself — a bare href="?id=..." anchor is
  // dropped by Angular's HTML5-mode handler, so the click did nothing before.
  $rootScope.navToTicketList = function() {
    $rootScope.ahcNotifOpen = false;
    if (search().id !== 'ticket_list') {
      $rootScope.ahcOverlay = true;
      $location.search({ id: 'ticket_list' });
    }
  };

  // Notification item: open a case. Guard against the no-navigation case —
  // clicking a notification for the case already on screen leaves the URL
  // unchanged, so nothing would ever clear the overlay (don't set it either).
  $rootScope.navToCase = function(sysId) {
    $rootScope.ahcNotifOpen = false;
    var s = search();
    if (s.id !== 'ticket_detail' || s.sys_id !== sysId) {
      $rootScope.ahcOverlay = true;
      $location.search({ id: 'ticket_detail', sys_id: sysId });
    }
  };

  $rootScope.$on('$locationChangeStart', function() {
    $rootScope.ahcBarLoading = true;
    $rootScope.currentPageId = '';
  });
  $rootScope.$on('$locationChangeSuccess', function(e, newUrl) {
    $rootScope.ahcBarLoading = false;
    var m = newUrl && newUrl.match(/[?&]id=([^&]+)/);
    $rootScope.currentPageId = m ? m[1] : '';
  });
  $rootScope.$on('$locationChangeError', function() {
    $rootScope.ahcBarLoading = false;
    $rootScope.ahcOverlay = false;
  });
}
