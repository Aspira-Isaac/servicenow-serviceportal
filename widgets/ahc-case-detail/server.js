(function() {
  var sysId = $sp.getParameter('sys_id');

  if (!sysId) {
    data.error = 'No case specified.';
    return;
  }

  // Handle comment submission
  if (input && input.action === 'add_comment' && input.comment) {
    var upd = new GlideRecord('sn_customerservice_case');
    if (upd.get(sysId) && upd.canWrite()) {
      upd.comments = input.comment;
      upd.update();
      data.commentSaved = true;
    } else {
      data.commentError = true;
    }
  }

  var gr = new GlideRecord('sn_customerservice_case');
  if (!gr.get(sysId) || !gr.canRead()) {
    data.error = 'Case not found or you do not have access.';
    return;
  }

  var stateVal = gr.getValue('state');
  var stateBadge = {
    '1': 'new', '2': 'open', '5': 'in-progress',
    '6': 'resolved', '3': 'closed', '18': 'awaiting'
  };

  data.sys_id          = gr.getUniqueValue();
  data.number          = gr.getValue('number');
  data.shortDesc       = gr.getValue('short_description');
  data.description     = gr.getValue('description') || '';
  data.state           = gr.getDisplayValue('state');
  data.stateVal        = stateVal;
  data.badgeClass      = stateBadge[stateVal] || 'open';
  data.priority        = gr.getDisplayValue('priority');
  data.account         = gr.getDisplayValue('account');
  data.contact         = gr.getDisplayValue('contact');
  data.assignedTo      = gr.getDisplayValue('assigned_to');
  data.category        = gr.getDisplayValue('category');
  data.created         = gr.getDisplayValue('sys_created_on');
  data.updated         = gr.getDisplayValue('sys_updated_on');
  data.canClose        = (stateVal !== '3' && stateVal !== '6') && gr.canWrite();

  // Activity: customer-visible comments only
  var jGr = new GlideRecord('sys_journal_field');
  jGr.addQuery('element_id', sysId);
  jGr.addQuery('element', 'comments');
  jGr.orderBy('sys_created_on');
  jGr.query();

  var activity = [];
  var userId = gs.getUserID();
  while (jGr.next()) {
    var authorId = jGr.getValue('sys_created_by');
    activity.push({
      author:    jGr.getDisplayValue('sys_created_by'),
      created:   jGr.getDisplayValue('sys_created_on'),
      value:     jGr.getValue('value'),
      isMine:    (authorId === gs.getUserName())
    });
  }
  data.activity = activity;

  // Attachments
  var attGr = new GlideRecord('sys_attachment');
  attGr.addQuery('table_name', 'sn_customerservice_case');
  attGr.addQuery('table_sys_id', sysId);
  attGr.orderByDesc('sys_created_on');
  attGr.query();
  var attachments = [];
  while (attGr.next()) {
    attachments.push({
      sys_id:     attGr.getUniqueValue(),
      file_name:  attGr.getValue('file_name'),
      content_type: attGr.getValue('content_type'),
      size_bytes: attGr.getValue('size_bytes'),
      created:    attGr.getDisplayValue('sys_created_on')
    });
  }
  data.attachments = attachments;
})();
