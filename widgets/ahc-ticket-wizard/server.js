(function() {
  data.ticketTypes = [
    {
      value: 'incident',
      label: 'Report an Issue',
      description: 'Something is broken or not working',
      icon: 'fa-exclamation-triangle'
    },
    {
      value: 'request',
      label: 'Request Something',
      description: 'Software, access, hardware, or a service',
      icon: 'fa-plus-circle'
    },
    {
      value: 'question',
      label: 'Ask a Question',
      description: 'General inquiry or guidance needed',
      icon: 'fa-question-circle'
    }
  ];

  data.urgencyLevels = [
    {
      value: '3',
      label: 'Low',
      description: 'No immediate impact',
      icon: 'fa-circle text-success'
    },
    {
      value: '2',
      label: 'Medium',
      description: 'Some business impact',
      icon: 'fa-circle text-warning'
    },
    {
      value: '1',
      label: 'High',
      description: 'Critical — blocking work',
      icon: 'fa-circle text-danger'
    }
  ];

  // Populate top-level catalog categories
  var cats = [];
  var gr = new GlideRecord('sc_category');
  gr.addActiveQuery();
  gr.addNullQuery('parent');
  gr.orderBy('title');
  gr.setLimit(50);
  gr.query();
  while (gr.next()) {
    cats.push({ value: gr.getUniqueValue(), label: gr.getValue('title') });
  }
  data.categories = cats;

  // Handle AJAX submit
  if (input && input.action === 'submit') {
    var form = input.form;

    try {
      var table = (form.type === 'incident') ? 'incident' : 'sc_request';
      var rec = new GlideRecord(table);
      rec.initialize();
      rec.setValue('short_description', form.short_description);
      rec.setValue('description', form.description || '');
      rec.setValue('urgency', form.urgency || '3');

      // Set caller to current user
      var userId = gs.getUserID();
      if (table === 'incident') {
        rec.setValue('caller_id', userId);
        rec.setValue('impact', form.urgency || '3');
      } else {
        rec.setValue('requested_for', userId);
      }

      var sysId = rec.insert();
      if (sysId) {
        var inserted = new GlideRecord(table);
        inserted.get(sysId);
        data.result = { number: inserted.getValue('number'), sys_id: sysId };
      } else {
        data.result = { error: 'Record insert failed — check field-level ACLs' };
      }
    } catch (e) {
      data.result = { error: e.toString() };
    }
  }
})();
