function($sce, $timeout, $window, $scope) {
  var c = this;
  c.submitted = false;
  c.tocOpen   = true;
  c.toc       = [];
  c.shared    = false;

  if (c.data.article && c.data.article.text) {
    c.safeText = $sce.trustAsHtml(c.data.article.text);
  }

  // Build ToC from article headings after Angular renders the HTML
  $timeout(function() {
    var body = document.querySelector('.kav__body');
    if (!body) return;
    var headings = body.querySelectorAll('h2, h3');
    if (headings.length < 2) return; // not worth a ToC for 0-1 headings
    var toc = [];
    for (var i = 0; i < headings.length; i++) {
      var hId = 'kav-h-' + i;
      headings[i].id = hId;
      toc.push({ id: hId, text: headings[i].textContent.trim(), level: headings[i].tagName });
    }
    c.toc = toc;
    if (!$scope.$$phase) $scope.$apply();
  }, 80);

  c.scrollTo = function(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  c.share = function() {
    var url = $window.location.href;
    try {
      $window.navigator.clipboard.writeText(url).then(function() {
        c.shared = true;
        $timeout(function() { c.shared = false; }, 2200);
        if (!$scope.$$phase) $scope.$apply();
      });
    } catch (e) {
      // Fallback for browsers without clipboard API
      var el = document.createElement('input');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      c.shared = true;
      $timeout(function() { c.shared = false; }, 2200);
    }
  };

  c.rate = function(helpful) {
    c.submitted = true;
    c.server.get({ action: 'rate', helpful: helpful }).then(function(r) {
      c.data.percent  = r.data.percent;
      c.data.response = r.data.response;
    });
  };
}
