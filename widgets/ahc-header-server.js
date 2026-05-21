(function() {
  // Multi-tenant branding
  var companyId = gs.getUser().getCompanyID() || 'default';
  var configs = {};
  try { configs = JSON.parse(gs.getProperty('ahc.client.configs', '{}')); } catch(e) {}

  var defaultBranding = {
    primaryColor: '#1a2980',
    accentColor:  '#cf1d25',
    logoText:     'ASPIRA',
    logoSub:      'CONNECTED EXPERIENCES',
    companyName:  'Aspira'
  };
  data.branding = configs[companyId] || defaultBranding;

  // Current user
  var displayName = gs.getUserDisplayName() || 'Guest';
  var parts = displayName.trim().split(' ');
  data.userName     = displayName;
  data.userInitials = ((parts[0] || '')[0] + (parts.length > 1 ? (parts[parts.length - 1] || '')[0] : '')).toUpperCase();
  data.isLoggedIn   = gs.isLoggedIn();
  data.userId       = gs.getUser().getID();

  // Notification count — count active announcements as a proxy
  var notifCount = 0;
  try {
    var annGr = new GlideAggregate('sys_ux_announcement');
    annGr.addQuery('active', 'true');
    annGr.addAggregate('COUNT');
    annGr.query();
    if (annGr.next()) {
      notifCount = parseInt(annGr.getAggregate('COUNT'), 10) || 0;
    }
  } catch(e) { /* table may not exist in all instances */ }
  data.notifCount = notifCount > 9 ? '9+' : (notifCount > 0 ? String(notifCount) : '');

  // Avatar background color derived from initials
  var colors = ['#1a2980', '#7c3aed', '#0d9488', '#b45309', '#dc2626', '#0369a1'];
  data.avatarColor = colors[(data.userInitials.charCodeAt(0) || 0) % colors.length];

  // Portal base URL
  var urlSuffix = 'help';
  try { urlSuffix = $sp.getPortalRecord().getDisplayValue('url_suffix') || 'help'; } catch(e) {}
  data.portalUrl = '/' + urlSuffix;
})();
