function($scope, spUtil) {
  var c = this;

  c.step = 1;
  c.submitted = false;
  c.submitting = false;
  c.ticketNumber = '';
  c.errorMessage = '';

  c.form = {
    type: '',
    typeLabel: '',
    typeIcon: '',
    category: null,
    short_description: '',
    description: '',
    urgency: '3'
  };

  c.selectType = function(t) {
    c.form.type = t.value;
    c.form.typeLabel = t.label;
    c.form.typeIcon = t.icon;
    c.form.category = null;
  };

  c.urgencyLabel = function() {
    var levels = (data.urgencyLevels || []);
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].value === c.form.urgency) return levels[i].label;
    }
    return c.form.urgency;
  };

  c.nextStep = function() {
    if (c.step < 3) c.step++;
  };

  c.prevStep = function() {
    if (c.step > 1) c.step--;
  };

  c.reset = function() {
    c.step = 1;
    c.submitted = false;
    c.submitting = false;
    c.ticketNumber = '';
    c.errorMessage = '';
    c.form = {
      type: '', typeLabel: '', typeIcon: '',
      category: null, short_description: '', description: '', urgency: '3'
    };
  };

  c.submit = function() {
    c.submitting = true;
    c.errorMessage = '';

    c.server.get({
      action: 'submit',
      form: {
        type: c.form.type,
        category: c.form.category ? c.form.category.value : '',
        short_description: c.form.short_description,
        description: c.form.description,
        urgency: c.form.urgency
      }
    }).then(function(r) {
      c.submitting = false;
      var result = r.data.result;
      if (result && result.number) {
        c.ticketNumber = result.number;
        c.submitted = true;
      } else {
        c.errorMessage = (result && result.error) || 'Submission failed. Please try again.';
      }
    }).catch(function() {
      c.submitting = false;
      c.errorMessage = 'An unexpected error occurred. Please try again.';
    });
  };
}
