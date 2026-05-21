(function() {
  var userId = gs.getUserID();
  data.currentUserId = userId;

  var stateBadge = {
    '1': 'new', '2': 'open', '5': 'in-progress',
    '6': 'resolved', '3': 'closed', '18': 'awaiting'
  };

  var isAdmin       = gs.hasRole('sn_customerservice.customer_admin');
  var accountId     = isAdmin ? gs.getUser().getCompanyID() : '';
  data.scopeLabel   = (isAdmin && accountId) ? 'account' : 'personal';

  var gr = new GlideRecord('sn_customerservice_case');

  if (isAdmin && accountId) {
    gr.addQuery('account', accountId);
  } else {
    gr.addQuery('contact.user', userId).addOrCondition('opened_by', userId);
  }

  gr.orderByDesc('sys_updated_on');
  gr.setLimit(500);
  gr.query();

  var cases = [];
  while (gr.next()) {
    var stateVal = gr.getValue('state');
    cases.push({
      sys_id:            gr.getUniqueValue(),
      number:            gr.getValue('number'),
      short_description: gr.getValue('short_description') || '',
      account:           gr.getDisplayValue('account'),
      state:             gr.getDisplayValue('state'),
      stateVal:          stateVal,
      badgeClass:        stateBadge[stateVal] || 'open',
      updated:           gr.getDisplayValue('sys_updated_on'),
      openedById:        gr.getValue('opened_by'),
      openedByName:      gr.getDisplayValue('opened_by')
    });
  }

  data.cases = cases;
})();
