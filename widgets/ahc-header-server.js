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

  // Notifications from live_notification (case mentions, updates)
  var notifList  = [];
  var notifCount = 0;

  try {
    var profileGr = new GlideRecord('live_profile');
    profileGr.addQuery('document', data.userId);
    profileGr.setLimit(1);
    profileGr.query();

    if (profileGr.next()) {
      var notifGr = new GlideRecord('live_notification');
      notifGr.addQuery('profile', profileGr.getUniqueValue());
      notifGr.orderByDesc('sys_created_on');
      notifGr.setLimit(10);
      notifGr.query();

      while (notifGr.next()) {
        notifList.push({
          sys_id:     notifGr.getUniqueValue(),
          message:    notifGr.getValue('message')    || '',
          caseNum:    notifGr.getValue('title')       || '',
          docSysId:   notifGr.getValue('document')    || '',
          fromName:   notifGr.getDisplayValue('user_from') || '',
          createdOn:  notifGr.getDisplayValue('sys_created_on') || ''
        });
      }
      notifCount = notifList.length;
    }
  } catch(e) { /* live_notification may not be accessible */ }

  data.notifications = notifList;
  data.notifCount    = notifCount > 9 ? '9+' : (notifCount > 0 ? String(notifCount) : '');

  // Avatar background color derived from initials
  var colors = ['#1a2980', '#7c3aed', '#0d9488', '#b45309', '#dc2626', '#0369a1'];
  data.avatarColor = colors[(data.userInitials.charCodeAt(0) || 0) % colors.length];

  // Portal base URL
  var urlSuffix = 'help';
  try { urlSuffix = $sp.getPortalRecord().getDisplayValue('url_suffix') || 'help'; } catch(e) {}
  data.portalUrl = '/' + urlSuffix;
})();
