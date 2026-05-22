(function() {
  var DEFAULT_ITEM = '097aa7701d7da410f877631e17be4ede'; // Contact ReserveAmerica/Aspira

  var sysId = $sp.getParameter('sys_id') || DEFAULT_ITEM;

  data.catItemWidget = $sp.getWidget('widget-sc-cat-item-v2', {
    sys_id: sysId,
    show_add_cart_button: 'false',
    auto_redirect: 'false'
  });

  if (input && input.action === 'get_case') {
    var gr = new GlideRecord('sc_request');
    if (gr.get(input.requestId)) {
      data.caseId = gr.getValue('parent');
    }
  }
})();
