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

  // A visible explanation instead of an empty box when Disqus can't show up
  var note = null;
  function explain(text) {
    if (!note) {
      note = document.createElement('p');
      note.className = 'comments-notice';
      box.parentNode.insertBefore(note, box.nextSibling);
    }
    note.textContent = text;
  }

  // Load only when the comments get close to the viewport (saves bandwidth)
  function load() {
    if (load.done) return; load.done = true;
    var s = document.createElement('script');
    s.src = 'https://' + shortname + '.disqus.com/embed.js';
    s.setAttribute('data-timestamp', String(Date.now()));
    s.onerror = function() {
      explain('Comments could not load: Disqus is blocked by this browser (ad / tracker blocker or ' +
              'tracking prevention). Allow disqus.com on this site to read and post comments.');
    };
    (document.head || document.body).appendChild(s);
    // Script loaded but no comment frame after a while: Disqus refused the page
    setTimeout(function() {
      if (!box.querySelector('iframe') && !note) {
        explain('Comments are taking long to load. If they never appear, Disqus may be blocked by this ' +
                'browser, or the site owner must add this domain to Disqus → Settings → Advanced → Trusted Domains.');
      }
    }, 12000);
  }
  // Disqus picks its colours from the page when it loads: reload the thread
  // after a dark/light switch so it doesn't stay in the old theme.
  window.addEventListener('themechange', function() {
    if (!load.done || !window.DISQUS || typeof window.DISQUS.reset !== 'function') return;
    setTimeout(function() { window.DISQUS.reset({ reload: true, config: window.disqus_config }); }, 350);
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      if (entries.some(function(e) { return e.isIntersecting; })) { io.disconnect(); load(); }
    }, { rootMargin: '600px 0px' });
    io.observe(box);
  } else {
    load();
  }
})();
