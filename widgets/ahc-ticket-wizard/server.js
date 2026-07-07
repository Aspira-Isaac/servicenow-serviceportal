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

  // Handle KB deflection search
  if (input && input.action === 'kb_search') {
    data.kbResults = [];
    var term = (input.term || '').trim();
    if (term.length >= 4) {
      try {
        var portalGr = $sp.getPortalRecord();
        var kbId = portalGr ? String(portalGr.getValue('kb_knowledge_base') || '') : '';

        var STOP = {the:1,and:1,'for':1,'with':1,'this':1,that:1,from:1,your:1,have:1,
                    been:1,will:1,are:1,was:1,has:1,not:1,you:1,use:1,how:1,
                    what:1,when:1,where:1,please:1,about:1,into:1};
        var seen = {};
        var keywords = term.toLowerCase().split(/\W+/).filter(function(w) {
          if (w.length <= 3 || STOP[w] || seen[w]) return false;
          seen[w] = true;
          return true;
        });

        var foundIds = {};
        var results  = [];

        var baseKb = function() {
          var r = new GlideRecord('kb_knowledge');
          r.addActiveQuery();
          r.addQuery('workflow_state', 'published');
          if (kbId) r.addQuery('kb_knowledge_base', kbId);
          return r;
        };

        var collect = function(kb) {
          kb.setLimit(10);
          kb.orderByDesc('sys_view_count');
          kb.query();
          while (kb.next() && results.length < 3) {
            var id = kb.getUniqueValue();
            if (!foundIds[id]) {
              foundIds[id] = true;
              results.push({ sys_id: id, title: kb.getValue('short_description'), cat: kb.getDisplayValue('kb_category') });
            }
          }
        };

        // Pass 1 — title exact phrase
        var k1 = baseKb(); k1.addQuery('short_description', 'CONTAINS', term); collect(k1);

        // Pass 2 — title any keyword
        if (results.length < 3 && keywords.length) {
          var k2 = baseKb();
          var q2 = k2.addQuery('short_description', 'CONTAINS', keywords[0]);
          for (var i = 1; i < keywords.length; i++) q2.addOrCondition('short_description', 'CONTAINS', keywords[i]);
          collect(k2);
        }

        // Pass 3 — body exact phrase
        if (results.length < 3) { var k3 = baseKb(); k3.addQuery('text', 'CONTAINS', term); collect(k3); }

        // Pass 4 — body any keyword (broadest fallback)
        if (results.length < 3 && keywords.length) {
          var k4 = baseKb();
          var q4 = k4.addQuery('text', 'CONTAINS', keywords[0]);
          for (var j = 1; j < keywords.length; j++) q4.addOrCondition('text', 'CONTAINS', keywords[j]);
          collect(k4);
        }

        data.kbResults = results;
      } catch (e) { /* non-critical */ }
    }
  }

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
