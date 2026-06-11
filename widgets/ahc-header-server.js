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

  // Notifications — mirrors the OOTB CSM portal bell (the "Notifications"
  // scripted menu item on the csm portal): a live list of records that need
  // the user's action, NOT a read/unread inbox. Cases waiting on the customer
  // (Resolved or Pending) drop out of the count by themselves once acted on,
  // so the badge decreases naturally. No read tracking required.
  var notifList = [];

  try {
    var caseGr = new GlideRecord('sn_customerservice_case');
    caseGr.addQuery('contact', data.userId).addOrCondition('opened_by', data.userId);
    caseGr.addQuery('state', 'IN', '6,18'); // Resolved, Pending — waiting on the customer
    caseGr.orderByDesc('sys_updated_on');
    caseGr.setLimit(10);
    caseGr.query();

    while (caseGr.next()) {
      var st = caseGr.getValue('state');
      notifList.push({
        sys_id:     caseGr.getUniqueValue(),
        docSysId:   caseGr.getUniqueValue(),
        caseNum:    caseGr.getValue('number'),
        message:    caseGr.getValue('short_description') || '',
        stateLabel: caseGr.getDisplayValue('state'),
        kind:       st === '6' ? 'resolved' : 'pending',
        updatedOn:  caseGr.getDisplayValue('sys_updated_on') || ''
      });
    }
  } catch(e) { /* case table may not be accessible */ }

  data.notifications = notifList;
  // List is capped at 10, so length 10 renders as the 9+ badge
  data.notifCount = notifList.length > 9 ? '9+' : (notifList.length > 0 ? String(notifList.length) : '');

  // Avatar background color derived from initials
  var colors = ['#1a2980', '#7c3aed', '#0d9488', '#b45309', '#dc2626', '#0369a1'];
  data.avatarColor = colors[(data.userInitials.charCodeAt(0) || 0) % colors.length];

  // Portal base URL
  var urlSuffix = 'help';
  try { urlSuffix = $sp.getPortalRecord().getDisplayValue('url_suffix') || 'help'; } catch(e) {}
  data.portalUrl = '/' + urlSuffix;
})();
