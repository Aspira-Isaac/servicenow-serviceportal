function($scope) {
  var c = this;

  c.activeTab = 'details';
  c.comment = '';
  c.sending = false;
  c.sent = false;
  c.sendError = false;

  c.setTab = function(tab) {
    c.activeTab = tab;
  };

  c.submitComment = function() {
    if (!c.comment || !c.comment.trim() || c.sending) return;
    c.sending = true;
    c.sent = false;
    c.sendError = false;

    c.server.update({
      action: 'add_comment',
      comment: c.comment.trim()
    }).then(function() {
      if (c.data.commentSaved) {
        c.sent = true;
        c.comment = '';
        // Reload to get updated activity
        c.server.refresh().then(function() {
          c.sending = false;
        });
      } else {
        c.sendError = true;
        c.sending = false;
      }
    });
  };

  c.formatBytes = function(bytes) {
    if (!bytes) return '';
    var b = parseInt(bytes, 10);
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  c.fileIcon = function(contentType) {
    if (!contentType) return 'fa-file-o';
    if (contentType.indexOf('image') === 0) return 'fa-file-image-o';
    if (contentType.indexOf('pdf') >= 0) return 'fa-file-pdf-o';
    if (contentType.indexOf('word') >= 0 || contentType.indexOf('document') >= 0) return 'fa-file-word-o';
    if (contentType.indexOf('excel') >= 0 || contentType.indexOf('sheet') >= 0) return 'fa-file-excel-o';
    return 'fa-file-o';
  };
}
