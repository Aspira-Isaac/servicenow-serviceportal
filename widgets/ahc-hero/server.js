(function() {
  var companyId = String(gs.getUser().getCompanyID() || 'default');
  var configJson = gs.getProperty('ahc.client.configs', '{}');
  var configs = {};
  try { configs = JSON.parse(configJson); } catch(e) {}

  var defaultBranding = {
    primaryColor:    '#1a2980',
    accentColor:     '#cf1d25',
    primaryLight:    '#243499',
    companyName:     'Aspira',
    welcomeTitle:    'How can we help you today?',
    welcomeSubtitle: 'Search our knowledge base or submit a support ticket.',
    logoText:        'ASPIRA'
  };
  data.branding = configs[companyId] || defaultBranding;

  // Derive a stable pattern (0-4) from the company ID
  var idStr = String(companyId);
  var hash = 0;
  for (var hi = 0; hi < idStr.length; hi++) {
    hash += idStr.charCodeAt(hi) * (hi + 1);
  }
  data.branding.patternIndex = hash % 5;

  // Account display name — prefer config, fall back to the company record name
  var accountName = data.branding.companyName;
  if (!configs[companyId] && companyId !== 'default') {
    var co = new GlideRecord('core_company');
    if (co.get(companyId)) accountName = co.getValue('name') || accountName;
  }
  data.accountName = accountName;

  // Current user
  var userName = gs.getUserDisplayName() || '';
  var nameParts = userName.trim().split(' ');
  data.userName     = userName;
  data.userInitials = (nameParts[0] ? nameParts[0][0] : '') +
                      (nameParts.length > 1 && nameParts[nameParts.length - 1]
                        ? nameParts[nameParts.length - 1][0] : '');
  data.isLoggedIn   = gs.isLoggedIn();

  data.quickCards = data.branding.quickCards || [
    { title: 'Submit a Ticket',  description: 'Report an issue or request something — we\'ll route it right.', icon: 'fa-ticket',   url: '?id=sc_category&catalog_id=-1', color: '#cf1d25' },
    // KB card hidden until ready: { title: 'Knowledge Base', description: 'Browse how-to guides, FAQs, and troubleshooting articles.', icon: 'fa-book', url: '?id=ahc_kb_search', color: '#1a2980' },
    { title: 'My Tickets',       description: 'Track the status of your open and recently resolved requests.',  icon: 'fa-list-alt', url: '?id=ticket_list',       color: '#28a745', showOverlay: true }
  ];
})();
