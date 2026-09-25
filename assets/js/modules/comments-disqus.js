/**
 * modules/comments-disqus.js — loads Disqus into #disqus_thread.
 * Settings come from data-* attributes (see _includes/comments.html).
 * External file (not inline) so it keeps working under a strict CSP.
 */
'use strict';
(function() {
  var box = document.getElementById('disqus_thread');
  if (!box) return;
  var shortname = box.getAttribute('data-shortname') || '';
  if (!/^[a-z0-9-]+$/i.test(shortname)) return;

  var url = box.getAttribute('data-url');
  var id  = box.getAttribute('data-identifier');
  window.disqus_config = function() {
    this.page.url        = url;
    this.page.identifier = id;
  };

  // Load only when the comments get close to the viewport (saves bandwidth)
  function load() {
    if (load.done) return; load.done = true;
    var s = document.createElement('script');
    s.src = 'https://' + shortname + '.disqus.com/embed.js';
    s.setAttribute('data-timestamp', String(Date.now()));
    (document.head || document.body).appendChild(s);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      if (entries.some(function(e) { return e.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '600px 0px' });
    io.observe(box);
  } else {
    load();
  }
})();
