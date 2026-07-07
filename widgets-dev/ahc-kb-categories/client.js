function() {
  var c = this;

  var ICONS = {
    'getting started': 'fa-rocket',
    'onboarding':      'fa-flag',
    'account':         'fa-user-circle-o',
    'settings':        'fa-cog',
    'payment':         'fa-credit-card',
    'billing':         'fa-file-text-o',
    'reservation':     'fa-calendar-check-o',
    'troubleshoot':    'fa-wrench',
    'login':           'fa-key',
    'agent':           'fa-headphones',
    'known issue':     'fa-exclamation-triangle',
    'escalation':      'fa-level-up',
    'reference':       'fa-book',
    'guide':           'fa-map-o'
  };

  // Nature-palette accents that complement the portal's navy/red brand
  var ACCENTS = ['#1a2980', '#cf1d25', '#2a6e4a', '#b07e14', '#4e3c8a', '#1a6b7a'];

  c.iconFor = function(label) {
    var lc = (label || '').toLowerCase();
    for (var k in ICONS) {
      if (lc.indexOf(k) !== -1) return ICONS[k];
    }
    return 'fa-folder-open-o';
  };

  c.accentFor = function(index) {
    return ACCENTS[index % ACCENTS.length];
  };
}
