function($scope, $rootScope, $element, $timeout, $http) {
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

  // ── Reply attachments ────────────────────────────────────────
  c.pendingFiles = [];
  var fileInput = null;
  $timeout(function() {
    fileInput = $element[0].querySelector('.ahc-cd__file-input');
    if (!fileInput) return;
    fileInput.addEventListener('change', function() {
      $scope.$applyAsync(function() {
        for (var i = 0; i < fileInput.files.length; i++) {
          c.pendingFiles.push(fileInput.files[i]);
        }
        fileInput.value = '';
      });
    });
  });

  c.pickFiles = function() {
    if (fileInput) fileInput.click();
  };

  c.removeFile = function(idx) {
    c.pendingFiles.splice(idx, 1);
  };

  // SP's $http carries the session token, so the Attachment API just works
  function uploadFile(file) {
    var fd = new FormData();
    fd.append('table_name', 'sn_customerservice_case');
    fd.append('table_sys_id', c.data.sys_id);
    fd.append('uploadFile', file, file.name);
    return $http.post('/api/now/attachment/upload', fd, {
      headers: { 'Content-Type': undefined },
      transformRequest: angular.identity
    });
  }

  function uploadAll() {
    // Sequential so a mid-list failure leaves the remaining files in the chips
    var files = c.pendingFiles.slice();
    var chain = Promise.resolve();
    files.forEach(function(f) {
      chain = chain.then(function() {
        return uploadFile(f).then(function() {
          var i = c.pendingFiles.indexOf(f);
          if (i >= 0) c.pendingFiles.splice(i, 1);
        });
      });
    });
    return chain;
  }

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
      c.showActions       = false;
      c.showFontPicker    = false;
      c.showWatcherPicker = false;
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

  // ── Watchers ─────────────────────────────────────────────────
  // Add/remove a colleague (from the account) OR any email address on the case
  // watch list so updates reach them.
  c.showWatcherPicker = false;
  c.watcherToAdd      = '';
  c.watcherEmail      = '';
  c.watchBusy         = false;
  c.watchEmailError   = false;
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  c.toggleWatcherPicker = function($event) {
    if ($event) $event.stopPropagation();
    c.showWatcherPicker = !c.showWatcherPicker;
    c.watchEmailError   = false;
  };

  function sendAdd(payload) {
    c.watchBusy     = true;
    c.actionError   = false;
    serverAction(payload).then(function(rd) {
      c.watchBusy = false;
      if (rd.actionDone) {
        c.showWatcherPicker = false;
        c.watcherToAdd = '';
        c.watcherEmail = '';
        c.server.refresh();
      } else {
        c.actionError = true;
      }
    });
  }

  // Add a colleague chosen from the account picker
  c.addWatcher = function(sysId) {
    var id = sysId || c.watcherToAdd;
    if (!id || c.watchBusy) return;
    sendAdd({ action: 'add_watcher', watcherId: id });
  };

  // Add an arbitrary email address (validated client-side too for quick feedback)
  c.addWatcherEmail = function() {
    var em = (c.watcherEmail || '').trim();
    c.watchEmailError = false;
    if (!em || c.watchBusy) return;
    if (!EMAIL_RE.test(em)) { c.watchEmailError = true; return; }
    sendAdd({ action: 'add_watcher', watcherEmail: em });
  };

  c.removeWatcher = function(sysId) {
    if (!sysId || c.watchBusy) return;
    c.watchBusy   = true;
    c.actionError = false;
    serverAction({ action: 'remove_watcher', watcherId: sysId }).then(function(rd) {
      c.watchBusy = false;
      if (rd.actionDone) c.server.refresh();
      else c.actionError = true;
    });
  };

  // Quick self-watch toggle (reuses add/remove with the current user's sys_id)
  c.watchThis   = function() { c.addWatcher(c.data.currentUserId); };
  c.unwatchThis = function() { c.removeWatcher(c.data.currentUserId); };

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
    if (!text && !c.pendingFiles.length) return;

    c.sending      = true;
    c.sent         = false;
    c.sendError    = false;
    c.sendErrorMsg = '';

    // Attachments go up first so images correlate with the comment entry
    uploadAll()
      .then(function() {
        if (!text) return {};  // attachments-only send
        return serverAction({ action: 'add_comment', comment: html });
      })
      .then(function(rd) {
        if (text && !rd.commentSaved) {
          c.sendError = true;
          c.sending   = false;
          $scope.$applyAsync();
          return;
        }
        c.sent = true;
        if (text) c.clearEditor();
        c.server.refresh().then(function() { c.sending = false; });
      })
      .catch(function(err) {
        console.error('[ahc-case-detail] attachment upload failed:', err);
        c.sendError    = true;
        c.sendErrorMsg = 'Attachment upload failed.';
        c.sending      = false;
        $scope.$applyAsync();
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
