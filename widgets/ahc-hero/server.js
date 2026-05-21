(function() {
  // ── Multi-tenant branding lookup ──────────────────────────────────────────
  var companyId = gs.getUser().getCompanyID() || 'default';
  var configJson = gs.getProperty('ahc.client.configs', '{}');
  var configs = {};
  try { configs = JSON.parse(configJson); } catch(e) {}

  var defaultBranding = {
    primaryColor:   '#1a2980',
    accentColor:    '#cf1d25',
    primaryLight:   '#243499',
    companyName:    'Aspira',
    welcomeTitle:   'How can we help you today?',
    welcomeSubtitle: 'Search our knowledge base or submit a support ticket.',
    logoText:       'ASPIRA'
  };
  data.branding = configs[companyId] || defaultBranding;

  // ── Current user ──────────────────────────────────────────────────────────
  var userName = gs.getUserDisplayName() || '';
  var nameParts = userName.trim().split(' ');
  data.userName    = userName;
  data.userInitials = (nameParts[0] ? nameParts[0][0] : '') +
                      (nameParts[nameParts.length - 1] && nameParts.length > 1
                        ? nameParts[nameParts.length - 1][0] : '');
  data.isLoggedIn  = gs.isLoggedIn();

  // ── Quick cards (can be overridden per client in branding config) ─────────
  data.quickCards = (data.branding.quickCards) || [
    {
      title: 'Submit a Ticket',
      description: 'Report an issue or request something — we\'ll route it right.',
      icon: 'fa-ticket',
      url: '?id=ahc_submit_ticket',
      color: '#cf1d25'
    },
    {
      title: 'Knowledge Base',
      description: 'Browse how-to guides, FAQs, and troubleshooting articles.',
      icon: 'fa-book',
      url: '?id=ahc_kb_search',
      color: '#1a2980'
    },
    {
      title: 'My Tickets',
      description: 'Track the status of your open and recently resolved requests.',
      icon: 'fa-list-alt',
      url: '?id=ticket_list',
      color: '#28a745'
    }
  ];
})();
