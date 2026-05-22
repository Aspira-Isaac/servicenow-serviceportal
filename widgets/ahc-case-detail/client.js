function($scope) {
  var c = this;

  c.sending     = false;
  c.sent        = false;
  c.sendError   = false;
  c.showActions = false;
  c.actionError = false;

  // Close actions menu when clicking outside
  document.addEventListener('click', function() {
    $scope.$apply(function() { c.showActions = false; });
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

  c.timeAgo = function(dateStr) {
    if (!dateStr) return '';
    var d    = new Date(dateStr.replace(' ', 'T'));
    var diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)       return 'just now';
    if (diff < 3600)     return Math.floor(diff / 60)      + 'm ago';
    if (diff < 86400)    return Math.floor(diff / 3600)    + 'h ago';
    if (diff < 2592000)  return Math.floor(diff / 86400)   + 'd ago';
    if (diff < 31536000) return Math.floor(diff / 2592000) + 'mo ago';
    return Math.floor(diff / 31536000) + 'y ago';
  };

  c.format = function(cmd, val) {
    document.execCommand(cmd, false, val || null);
    var ed = document.querySelector('.ahc-cd__reply-editor');
    if (ed) ed.focus();
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
