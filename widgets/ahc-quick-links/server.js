(function() {
  var companyId = gs.getUser().getCompanyID() || 'default';
  var configJson = gs.getProperty('ahc.client.configs', '{}');
  var configs = {};
  try { configs = JSON.parse(configJson); } catch(e) {}

  var clientConfig = configs[companyId] || {};

  data.sectionTitle    = clientConfig.quickLinksTitle    || 'Quick Links';
  data.sectionSubtitle = clientConfig.quickLinksSubtitle || 'Shortcuts to what you use most';

  // Default links — override per client in ahc.client.configs
  data.links = clientConfig.quickLinks || [
    { label: 'Reset Password',       icon: 'fa-key',          url: '?id=ahc_submit_ticket&type=request&cat=password', external: false },
    { label: 'VPN Access',           icon: 'fa-shield',       url: '?id=ahc_submit_ticket&type=request&cat=vpn',      external: false },
    { label: 'New Equipment',        icon: 'fa-laptop',       url: '?id=ahc_submit_ticket&type=request&cat=hardware', external: false },
    { label: 'Software Request',     icon: 'fa-download',     url: '?id=ahc_submit_ticket&type=request&cat=software', external: false },
    { label: 'Onboarding Checklist', icon: 'fa-check-square', url: '?id=ahc_submit_ticket&type=request&cat=onboard',  external: false },
    { label: 'IT Status Page',       icon: 'fa-signal',       url: 'https://status.aspiraconnect.com',                external: true  }
  ];
})();
