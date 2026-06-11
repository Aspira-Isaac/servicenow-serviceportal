function($scope, $rootScope) {
  var c = this;

  // Tell the nav which page we're on, and clear the overlay
  // (every nav path that sets ahcOverlay relies on the destination widget to clear it)
  $rootScope.currentPageId = 'ticket_detail';
  $rootScope.ahcOverlay = false;

  c.sending           = false;
  c.sent              = false;
  c.sendError         = false;
  c.showActions       = false;
  c.actionError       = false;
  c.showFontPicker    = false;
  c.selectedFontLabel = 'System Font';
  c.navigating        = false;

  // Close dropdowns when clicking outside
  document.addEventListener('click', function() {
    $scope.$apply(function() {
      c.showActions    = false;
      c.showFontPicker = false;
    });
  });

  c.toggleActions = function($event) {
    $event.stopPropagation();
    c.showActions = !c.showActions;
  };

  c.performAction = function(action) {
    c.showActions = false;
    c.actionError = false;
    c.server.update({ action: action }).then(function() {
      if (c.data.actionDone) {
        c.server.refresh();
      } else {
        c.actionError = true;
      }
    });
  };

  c.format = function(cmd, val) {
    document.execCommand(cmd, false, val || null);
    var ed = document.querySelector('.ahc-cd__reply-editor');
    if (ed) ed.focus();
  };

  c.toggleFontPicker = function($event) {
    $event.stopPropagation();
    c.showFontPicker = !c.showFontPicker;
  };

  c.setFont = function(fontName, label) {
    c.showFontPicker    = false;
    c.selectedFontLabel = label || 'System Font';
    var ed = document.querySelector('.ahc-cd__reply-editor');
    if (!ed) return;
    ed.focus();
    if (fontName) {
      document.execCommand('fontName', false, fontName);
    } else {
      document.execCommand('removeFormat', false, null);
    }
  };

  c.toggleCode = function() {
    var ed = document.querySelector('.ahc-cd__reply-editor');
    if (!ed) return;
    ed.focus();
    var sel = window.getSelection();
    var inCode = false;
    if (sel && sel.rangeCount > 0) {
      var node = sel.getRangeAt(0).commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;
      while (node && node !== ed) {
        if (node.nodeName === 'PRE') { inCode = true; break; }
        node = node.parentNode;
      }
    }
    document.execCommand('formatBlock', false, inCode ? 'div' : 'pre');
  };

  c.clearEditor = function() {
    var ed = document.querySelector('.ahc-cd__reply-editor');
    if (ed) ed.innerHTML = '';
  };

  c.submitComment = function() {
    if (c.sending) return;
    var ed   = document.querySelector('.ahc-cd__reply-editor');
    var html = ed ? ed.innerHTML : '';
    var text = ed ? (ed.innerText || ed.textContent || '').trim() : '';
    if (!text) return;

    c.sending   = true;
    c.sent      = false;
    c.sendError = false;

    c.server.update({ action: 'add_comment', comment: html })
      .then(function() {
        if (c.data.commentSaved) {
          c.sent = true;
          c.clearEditor();
          c.server.refresh().then(function() { c.sending = false; });
        } else {
          c.sendError = true;
          c.sending   = false;
        }
      });
  };

  c.formatBytes = function(bytes) {
    if (!bytes) return '';
    var b = parseInt(bytes, 10);
    if (b < 1024)    return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  c.fileIcon = function(contentType) {
    if (!contentType)                                                              return 'fa-file-o';
    if (contentType.indexOf('image') === 0)                                        return 'fa-file-image-o';
    if (contentType.indexOf('pdf') >= 0)                                           return 'fa-file-pdf-o';
    if (contentType.indexOf('word') >= 0 || contentType.indexOf('document') >= 0) return 'fa-file-word-o';
    if (contentType.indexOf('excel') >= 0 || contentType.indexOf('sheet') >= 0)   return 'fa-file-excel-o';
    return 'fa-file-o';
  };
}
