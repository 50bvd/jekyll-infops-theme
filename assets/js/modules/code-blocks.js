/**
 * modules/code-blocks.js
 * Wraps <pre> blocks with CRT header (lang + copy button).
 *
 * ROOT CAUSE OF HTML BUTTON BUG:
 * Rouge (server-side) wraps html blocks in <div class="language-html highlighter-rouge">
 * with the raw HTML tags UNESCAPED inside <code class="language-html">.
 * Prism (client-side) then sees real <script>, <button> etc. as DOM nodes.
 *
 * FIX: Set Prism.manual=true BEFORE Prism loads (via window var),
 * then sanitise all html/xml/markup code elements BEFORE calling
 * Prism.highlightAll(). This way Prism only ever tokenises escaped text.
 */
'use strict';

// ── Tell Prism NOT to auto-run — we control when it highlights ──────────────
// This must be set before prism-core.min.js evaluates.
window.Prism = window.Prism || {};
window.Prism.manual = true;

(function() {

  var UNSAFE = { html:1, xml:1, markup:1, svg:1, mathml:1 };

  function escHtml(str) {
    return (str || '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;');
  }

  // ── Sanitise all html/xml blocks in the DOM ──────────────────────────────
  // Called before Prism highlights, so Prism never sees raw < > in html blocks.
  function sanitiseHtmlBlocks() {
    document.querySelectorAll('code[class*="language-"]').forEach(function(code) {
      var cls = code.className || '';
      var m = cls.match(/language-([a-z]+)/i);
      var lang = m ? m[1].toLowerCase() : '';
      if (!UNSAFE[lang]) return;
      // textContent gives the raw unescaped text (what the author typed)
      var raw = code.textContent || '';
      // Replace innerHTML with safely escaped version
      code.innerHTML = escHtml(raw);
      // Store raw for copy button
      code.setAttribute('data-raw', raw);
      // Remove language class so Prism won't try to highlight this block
      code.className = code.className.replace(/\blanguage-\S+/g, 'language-none');
      if (code.parentElement) {
        code.parentElement.className = (code.parentElement.className || '')
          .replace(/\blanguage-\S+/g, '').replace(/\bhighlighter-rouge\b/g, '');
      }
    });
  }

  // ── Wrap blocks and build UI ─────────────────────────────────────────────
  function process() {
    // Flatten rouge line-number tables
    document.querySelectorAll('.highlight table, .rouge-table').forEach(function(tbl) {
      var td  = tbl.querySelector('.rouge-code, td.code');
      var pre = td && td.querySelector('pre');
      if (pre && tbl.parentNode) tbl.parentNode.replaceChild(pre, tbl);
    });

    document.querySelectorAll(
      '.post-body pre, .post-content pre, article pre, .content pre'
    ).forEach(function(pre) {
      if (pre.closest('.code-block-wrapper')) return;
      if (pre.closest('.sidebar, nav, .widget, .toc-content')) return;
      if (!pre.textContent.trim()) return;

      var code   = pre.querySelector('code');
      var hlWrap = pre.parentNode && pre.parentNode.classList &&
                   pre.parentNode.classList.contains('highlight') ? pre.parentNode : null;

      // ── Detect language label (for display — after sanitiseHtmlBlocks ran) ─
      var lang = '';
      // Check data attribute set by sanitise step (original lang before we wiped it)
      if (code && code.getAttribute('data-original-lang')) {
        lang = code.getAttribute('data-original-lang');
      }
      if (!lang) {
        [pre, code, hlWrap].filter(Boolean).forEach(function(el) {
          if (lang || !el.className) return;
          var m = el.className.match(/language-([a-z]+)/i);
          if (m && m[1] !== 'none' && m[1] !== 'plaintext') lang = m[1].toLowerCase();
        });
      }
      if (!lang && hlWrap && hlWrap.className) {
        var m2 = hlWrap.className.match(
          /\b(bash|sh|shell|zsh|powershell|ps1|js|javascript|ts|typescript|python|py|ruby|rb|css|scss|sass|html|xml|yaml|yml|json|dockerfile|go|rust|php|sql|nginx|apache|ini|toml|c|cpp|java|kotlin|swift|markdown|md|lua|vim|markup)\b/i
        );
        if (m2) lang = m2[1].toLowerCase();
      }

      // raw text for copy (prefer data-raw set by sanitise, else textContent)
      var rawText = (code && code.getAttribute('data-raw')) || (code ? code.textContent : pre.textContent) || '';

      // ── Build wrapper ────────────────────────────────────────────────────
      var wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      var header = document.createElement('div');
      header.className = 'code-block-header';

      var langSpan = document.createElement('span');
      langSpan.className   = 'code-lang';
      langSpan.textContent = lang || 'code';

      var copyBtn = document.createElement('button');
      copyBtn.className   = 'copy-btn';
      copyBtn.type        = 'button';
      copyBtn.textContent = 'copy';
      copyBtn.setAttribute('aria-label', 'Copy code');
      copyBtn.addEventListener('click', function() {
        function ok() {
          copyBtn.textContent = 'copied!'; copyBtn.classList.add('copied');
          setTimeout(function() { copyBtn.textContent = 'copy'; copyBtn.classList.remove('copied'); }, 2000);
        }
        var txt = rawText;
        if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(ok).catch(ok); }
        else {
          var ta = document.createElement('textarea');
          ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch(e) {}
          document.body.removeChild(ta); ok();
        }
      });

      header.appendChild(langSpan);
      header.appendChild(copyBtn);

      var body = document.createElement('div');
      body.className = 'code-block-body';

      var rawLines = rawText.replace(/\n$/, '').split('\n');
      if (rawLines.length > 1) {
        wrapper.classList.add('has-line-numbers');
        var nums = document.createElement('div');
        nums.className = 'code-line-numbers';
        nums.setAttribute('aria-hidden', 'true');
        for (var i = 1; i <= rawLines.length; i++) {
          var sp = document.createElement('span'); sp.textContent = i; nums.appendChild(sp);
        }
        body.appendChild(nums);
      }

      var anchor = hlWrap || pre;
      var anchorParent = anchor.parentNode;
      if (!anchorParent) return;
      anchorParent.insertBefore(wrapper, anchor);
      body.appendChild(pre);
      wrapper.appendChild(header);
      wrapper.appendChild(body);
      if (hlWrap && hlWrap.parentNode) hlWrap.parentNode.removeChild(hlWrap);
    });
  }

  // ── Pre-sanitise: record original lang, then sanitise ───────────────────
  function preSanitise() {
    document.querySelectorAll('code[class*="language-"]').forEach(function(code) {
      var m = (code.className || '').match(/language-([a-z]+)/i);
      var lang = m ? m[1].toLowerCase() : '';
      if (UNSAFE[lang]) {
        code.setAttribute('data-original-lang', lang);
      }
    });
    sanitiseHtmlBlocks();
  }

  // ── Main sequence ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    // 1. Sanitise html/xml blocks (remove raw tags before Prism sees them)
    preSanitise();

    // 2. Now let Prism run — it will NOT see raw HTML tags
    if (window.Prism) {
      Prism.highlightAll();
    }

    // 3. Wrap all pre blocks with our CRT header
    process();

    // 4. Safety net: re-wrap anything Prism's autoloader highlighted late
    setTimeout(process, 600);
    setTimeout(process, 1800);
  });
})();
