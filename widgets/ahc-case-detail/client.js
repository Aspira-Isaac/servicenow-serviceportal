function($scope, $rootScope, $element, $timeout) {
  var c = this;

  // Always resolve elements within THIS widget instance — document-level
  // lookups can grab a stale editor from a previous SPA page and silently
  // read empty text.
  function findEditor() {
    return $element[0].querySelector('.ahc-cd__reply-editor');
  }

  // Enable editing after the template is compiled — see the template comment
  // on why contenteditable can't live in the markup
  $timeout(function() {
    var ed = findEditor();
    if (ed) ed.contentEditable = 'true';
  });

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
  c.descOpen          = true;
  c.detailsOpen       = true;

  // Close dropdowns when clicking outside — removed on $destroy so SPA
  // navigation doesn't stack stale listeners on destroyed scopes
  function onDocClick() {
    $scope.$applyAsync(function() {
      c.showActions    = false;
      c.showFontPicker = false;
    });
  }
  document.addEventListener('click', onDocClick);
  $scope.$on('$destroy', function() {
    document.removeEventListener('click', onDocClick);
  });

  c.toggleActions = function($event) {
    $event.stopPropagation();
    c.showActions = !c.showActions;
  };

  // All widget actions go through server.get — server.update() can post the
  // whole data object instead of the argument (same trap as the header widget).
  // The error branch matters: without it a single failed call leaves the
  // busy flags stuck and every later click silently does nothing.
  function serverAction(inputObj) {
    return c.server.get(inputObj).then(function(resp) {
      return (resp && resp.data) ? resp.data : {};
    }, function(err) {
      console.error('[ahc-case-detail] server action failed:', inputObj.action, err);
      return {};
    });
  }

  c.performAction = function(action) {
    c.showActions = false;
    c.actionError = false;
    serverAction({ action: action }).then(function(rd) {
      if (rd.actionDone) {
        c.server.refresh();
      } else {
        c.actionError = true;
      }
    });
  };

  // Close Case confirmation — mirrors OOTB CSM: closing is final, so confirm first
  c.showCloseConfirm = false;

  c.startClose = function() {
    c.showActions      = false;
    c.actionError      = false;
    c.showCloseConfirm = true;
  };

  c.cancelClose = function() {
    c.showCloseConfirm = false;
  };

  c.confirmClose = function() {
    c.showCloseConfirm = false;
    c.performAction('close_case');
  };

  // Accept Solution confirmation
  c.showAccept = false;

  c.startAccept = function() {
    c.showActions = false;
    c.actionError = false;
    c.showAccept  = true;
  };

  c.cancelAccept = function() {
    c.showAccept = false;
  };

  c.confirmAccept = function() {
    c.showAccept = false;
    c.performAction('accept_solution');
  };

  // Reject Solution — mirrors OOTB CSM: a reason is required and is posted
  // as a comment along with the state change
  c.showReject   = false;
  c.rejectReason = '';
  c.rejecting    = false;

  c.startReject = function() {
    c.showActions  = false;
    c.actionError  = false;
    c.rejectReason = '';
    c.showReject   = true;
  };

  c.cancelReject = function() {
    c.showReject = false;
  };

  c.confirmReject = function() {
    var reason = (c.rejectReason || '').trim();
    if (!reason || c.rejecting) return;
    c.rejecting = true;
    serverAction({ action: 'reject_solution', comment: reason }).then(function(rd) {
      c.rejecting  = false;
      c.showReject = false;
      if (rd.actionDone) {
        c.server.refresh();
      } else {
        c.actionError = true;
      }
    });
  };

  c.format = function(cmd, val) {
    document.execCommand(cmd, false, val || null);
    var ed = findEditor();
    if (ed) ed.focus();
  };

  c.toggleFontPicker = function($event) {
    $event.stopPropagation();
    c.showFontPicker = !c.showFontPicker;
  };

  c.setFont = function(fontName, label) {
    c.showFontPicker    = false;
    c.selectedFontLabel = label || 'System Font';
    var ed = findEditor();
    if (!ed) return;
    ed.focus();
    if (fontName) {
      document.execCommand('fontName', false, fontName);
    } else {
      document.execCommand('removeFormat', false, null);
    }
  };

  c.toggleCode = function() {
    var ed = findEditor();
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
    var ed = findEditor();
    if (ed) ed.innerHTML = '';
  };

  c.submitComment = function() {
    if (c.sending) return;
    var ed   = findEditor();
    var html = ed ? ed.innerHTML : '';
    var text = ed ? (ed.innerText || ed.textContent || '').trim() : '';
    if (!ed) console.error('[ahc-case-detail] reply editor not found in widget element');
    if (!text) return;

    c.sending   = true;
    c.sent      = false;
    c.sendError = false;

    serverAction({ action: 'add_comment', comment: html })
      .then(function(rd) {
        if (rd.commentSaved) {
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
