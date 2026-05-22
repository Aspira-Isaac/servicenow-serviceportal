(function() {
  var sysId = $sp.getParameter('sys_id');

  if (!sysId) {
    data.error = 'No case specified.';
    return;
  }

  // Handle actions
  if (input && input.action) {
    var actGr = new GlideRecord('sn_customerservice_case');
    if (actGr.get(sysId) && actGr.canWrite()) {
      if (input.action === 'add_comment' && input.comment) {
        actGr.comments = '[code]' + input.comment + '[/code]';
        actGr.update();
        data.commentSaved = true;
      } else if (input.action === 'close_case' || input.action === 'accept_solution') {
        actGr.state = '3';
        actGr.update();
        data.actionDone = true;
      } else if (input.action === 'reopen_case') {
        actGr.state = '2';
        actGr.update();
        data.actionDone = true;
      }
    } else {
      data.actionError = true;
    }
  }

  var gr = new GlideRecord('sn_customerservice_case');
  if (!gr.get(sysId) || !gr.canRead()) {
    data.error = 'Case not found or you do not have access.';
    return;
  }

  var stateVal = gr.getValue('state');
  var stateBadge = {
    '1': 'new',  '2': 'open',  '10': 'in-progress',
    '18': 'awaiting', '8': 'awaiting', '1000': 'awaiting',
    '1010': 'in-progress', '1020': 'in-progress', '1030': 'awaiting',
    '6': 'resolved', '3': 'closed', '7': 'closed'
  };

  data.sys_id      = gr.getUniqueValue();
  data.number      = gr.getValue('number');
  data.shortDesc   = gr.getValue('short_description');
  data.description = gr.getValue('description') || '';
  data.state       = gr.getDisplayValue('state');
  data.stateVal    = stateVal;
  data.badgeClass  = stateBadge[stateVal] || 'open';
  data.priority    = gr.getDisplayValue('priority');
  data.created     = gr.getDisplayValue('sys_created_on');
  data.updated     = gr.getDisplayValue('sys_updated_on');
  data.createdRaw  = gr.getValue('sys_created_on');
  data.updatedRaw  = gr.getValue('sys_updated_on');
  data.canClose      = (stateVal !== '3' && stateVal !== '7' && stateVal !== '6') && gr.canWrite();
  data.canCloseCase  = data.canClose;
  data.isResolved    = (stateVal === '6');
  data.canReopen     = (stateVal === '3' || stateVal === '7' || stateVal === '6') && gr.canWrite();

  // Who and where
  data.openedBy       = gr.getDisplayValue('opened_by');
  data.openedByEmail  = gr.getDisplayValue('opened_by.email');
  data.openedByPhone  = gr.getDisplayValue('opened_by.mobile_phone') || gr.getDisplayValue('opened_by.phone');
  data.contact        = gr.getDisplayValue('contact');
  data.account        = gr.getDisplayValue('account');
  data.location       = gr.getDisplayValue('location');

  // Assignment
  data.assignmentGroup = gr.getDisplayValue('assignment_group');
  data.assignedTo      = gr.getDisplayValue('assigned_to');

  // Classification
  data.category    = gr.getDisplayValue('category');
  data.subcategory = gr.getDisplayValue('subcategory');

  // Direct custom fields on the case table (field names discovered from the instance)
  data.subcategory = gr.getDisplayValue('u_subcategory') || gr.getDisplayValue('subcategory') || '';
  data.market      = gr.getDisplayValue('u_market') || '';
  data.environment = gr.getDisplayValue('u_enviorment') || ''; // note: typo in the instance schema

  // Catalog variables (Platform, Application, Type of Request, etc.)
  // Uses the same API as the built-in sc-variable-summarizer SP widget.
  // Skip variables whose data is already shown in the static case fields above.
  var varSkipNames = {
    opened_by:1, u_opened_by:1, caller_id:1, u_caller:1,
    requested_for:1, u_requested_for:1,
    email:1, email_address:1, u_email:1,
    phone:1, mobile_phone:1, u_phone:1,
    account:1, u_account:1, company:1,
    location:1, u_location:1,
    environment:1, u_environment:1, u_enviorment:1,
    assignment_group:1, u_assignment_group:1,
    assigned_to:1, u_assigned_to:1,
    priority:1, state:1,
    category:1, u_category:1,
    subcategory:1, u_subcategory:1,
    contact:1, u_contact:1,
    market:1, u_market:1
  };
  // Also skip by normalized label — catches variables whose internal names differ
  var varSkipLabels = {
    'opened by':1, 'requested for':1, 'email':1, 'email address':1,
    'phone':1, 'mobile phone':1, 'account':1, 'location':1,
    'environment':1, 'assignment group':1, 'assigned to':1,
    'priority':1, 'status':1, 'state':1, 'category':1,
    'subcategory':1, 'contact':1, 'market':1
  };

  var variables = [];
  try {
    var taskVars = new GlobalServiceCatalogUtil().getVariablesForTask(gr, true);
    if (taskVars && taskVars.length) {
      for (var vi = 0; vi < taskVars.length; vi++) {
        var v = taskVars[vi];
        var vName  = String(v.name  || '').toLowerCase().replace(/-/g, '_');
        var vLabel = String(v.label || '').toLowerCase().trim();
        if (varSkipNames[vName] || varSkipLabels[vLabel]) continue;

        // Prefer display_value (resolves choice labels and reference names)
        var val = String(v.display_value || v.value || '').trim();

        // Skip empty, plain "false", or raw 32-char sys_ids
        if (!val || val === 'false' || /^[0-9a-f]{32}$/i.test(val)) continue;

        if (v.label) {
          variables.push({ label: String(v.label), value: val });
        }
      }
    }
  } catch(e) { /* GlobalServiceCatalogUtil not available — skip */ }
  data.variables = variables;

  // Activity: customer-visible comments, newest first
  var jGr = new GlideRecord('sys_journal_field');
  jGr.addQuery('element_id', sysId);
  jGr.addQuery('element', 'comments');
  jGr.orderByDesc('sys_created_on');
  jGr.query();

  var tempEntries = [];
  var userNames = {};
  while (jGr.next()) {
    var username = jGr.getValue('sys_created_by');
    userNames[username] = true;
    var rawValue = jGr.getValue('value') || '';
    // Strip [code]/[/code] wrapper — content inside is HTML from the rich text editor
    if (/^\s*\[code\]/i.test(rawValue)) {
      rawValue = rawValue.replace(/^\s*\[code\]/i, '').replace(/\[\/code\]\s*$/i, '').trim();
    } else {
      // Plain text — escape and preserve line breaks
      rawValue = rawValue
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
    tempEntries.push({
      username:   username,
      created:    jGr.getDisplayValue('sys_created_on'),
      createdRaw: jGr.getValue('sys_created_on'),
      value:      rawValue
    });
  }

  // Bulk-resolve usernames → full display names
  var nameMap = {};
  var unameList = Object.keys(userNames);
  if (unameList.length > 0) {
    var uGr = new GlideRecord('sys_user');
    uGr.addQuery('user_name', 'IN', unameList.join(','));
    uGr.query();
    while (uGr.next()) {
      nameMap[uGr.getValue('user_name')] = uGr.getValue('name') || uGr.getValue('user_name');
    }
  }

  // Load image attachments on this case for inline display in activity
  var imgGr = new GlideRecord('sys_attachment');
  imgGr.addQuery('table_name', 'sn_customerservice_case');
  imgGr.addQuery('table_sys_id', sysId);
  imgGr.addQuery('content_type', 'STARTSWITH', 'image/');
  imgGr.orderBy('sys_created_on');
  imgGr.query();

  var imgList = [];
  while (imgGr.next()) {
    imgList.push({
      sys_id:     imgGr.getUniqueValue(),
      file_name:  imgGr.getValue('file_name'),
      created_by: imgGr.getValue('sys_created_by'),
      created_ms: new Date(String(imgGr.getValue('sys_created_on')).replace(' ', 'T')).getTime()
    });
  }

  var currentUsername = gs.getUserName();
  var activity = [];
  for (var i = 0; i < tempEntries.length; i++) {
    var entry    = tempEntries[i];
    var fullName = nameMap[entry.username] || entry.username;
    var entryMs  = new Date(entry.createdRaw.replace(' ', 'T')).getTime();

    // Correlate image attachments: same author, within 2 minutes of this entry
    var entryImages = [];
    for (var ii = 0; ii < imgList.length; ii++) {
      var img  = imgList[ii];
      var diff = Math.abs(img.created_ms - entryMs) / 1000;
      if (img.created_by === entry.username && diff <= 120) {
        entryImages.push({ sys_id: img.sys_id, file_name: img.file_name });
      }
    }

    activity.push({
      author:        entry.username,
      authorName:    fullName,
      authorInitial: fullName.charAt(0).toUpperCase(),
      created:       entry.created,
      createdRaw:    entry.createdRaw,
      value:         entry.value,
      images:        entryImages,
      isMine:        (entry.username === currentUsername)
    });
  }
  data.activity = activity;

  // Attachments tab (all file types)
  var attGr = new GlideRecord('sys_attachment');
  attGr.addQuery('table_name', 'sn_customerservice_case');
  attGr.addQuery('table_sys_id', sysId);
  attGr.orderByDesc('sys_created_on');
  attGr.query();
  var attachments = [];
  while (attGr.next()) {
    attachments.push({
      sys_id:       attGr.getUniqueValue(),
      file_name:    attGr.getValue('file_name'),
      content_type: attGr.getValue('content_type'),
      size_bytes:   attGr.getValue('size_bytes'),
      created:      attGr.getDisplayValue('sys_created_on')
    });
  }
  data.attachments = attachments;
})();
