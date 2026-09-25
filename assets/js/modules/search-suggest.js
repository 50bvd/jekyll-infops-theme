/**
 * modules/search-suggest.js — instant suggestions under the navbar search box.
 *
 * From the first letter, matching articles slide in under the box: cover
 * thumbnail, highlighted title, excerpt, date and tags. The panel opens and
 * closes with a fade/slide, its height follows the number of results
 * smoothly, and results appear one after another. Honours reduced motion.
 *
 * ↑/↓ to move, Enter to open (or to see all results), Esc to close.
 * "/" or Ctrl+K focuses the search box from anywhere on the page.
 * Accessible combobox pattern (role=combobox / listbox / option); results are
 * built with DOM APIs, never innerHTML, so post data can't inject markup.
 */
'use strict';
(function initSearchSuggest() {
  const MAX = 6;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function norm(s) {
    s = String(s || '').toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }
  function safeUrl(u) { u = String(u || ''); return /^(\/|https?:\/\/)/i.test(u) ? u : '#'; }

  let indexPromise = null;
  function loadIndex() {
    if (indexPromise) return indexPromise;
    const meta = document.querySelector('meta[name="search-json-url"]');
    const url = (meta && meta.getAttribute('content')) || '/search.json';
    indexPromise = fetch(url, { credentials: 'same-origin' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(list => (Array.isArray(list) ? list : []).map(p => {
        const title = norm(p.title), tags = norm(p.tags);
        return { p, title, tags, hay: [title, tags, norm(p.categories), norm(p.excerpt), norm(p.content)].join(' ') };
      }))
      .catch(e => { indexPromise = null; throw e; });
    return indexPromise;
  }

  // 1–2 letters match the start of a word only ("d" → Docker, not every d)
  function has(hay, t) {
    if (t.length > 2) return hay.indexOf(t) !== -1;
    return hay.indexOf(t) === 0 || new RegExp('[^a-z0-9]' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(hay);
  }

  function search(index, q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return { terms, hits: [] };
    const hits = index.map(e => {
      if (!terms.every(t => has(e.hay, t))) return null;
      let score = 0;
      terms.forEach(t => {
        if (has(e.title, t)) score += 10 + (e.title.startsWith(t) || e.title.indexOf(' ' + t) !== -1 ? 5 : 0);
        if (has(e.tags, t)) score += 3;
      });
      return { e, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    return { terms, hits };
  }

  // Text with the matched words wrapped in <mark> (text nodes only)
  function highlight(text, terms) {
    const frag = document.createDocumentFragment();
    const n = norm(text);
    const marks = [];
    terms.forEach(t => {
      let i = n.indexOf(t);
      while (i !== -1 && t) {
        // short terms: only highlight at the start of a word
        if (t.length > 2 || i === 0 || /[^a-z0-9]/.test(n[i - 1])) marks.push([i, i + t.length]);
        i = n.indexOf(t, i + t.length);
      }
    });
    marks.sort((a, b) => a[0] - b[0]);
    let pos = 0;
    marks.forEach(([s, e]) => {
      if (s < pos) return;
      frag.appendChild(document.createTextNode(text.slice(pos, s)));
      const m = document.createElement('mark');
      m.textContent = text.slice(s, e);
      frag.appendChild(m);
      pos = e;
    });
    frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
  }

  // Excerpt around the first match (or its beginning)
  function snippet(text, terms, len) {
    text = String(text || '');
    const n = norm(text);
    let at = -1;
    terms.forEach(t => {
      const m = t.length > 2 ? n.indexOf(t) : n.search(new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const i = m > 0 && t.length <= 2 ? m + 1 : m;
      if (i !== -1 && (at === -1 || i < at)) at = i;
    });
    let start = at > 40 ? text.lastIndexOf(' ', at - 30) + 1 : 0;
    let out = text.slice(start, start + len);
    if (start + len < text.length) out = out.replace(/\s+\S*$/, '') + '…';
    return (start > 0 ? '…' : '') + out;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form  = document.querySelector('.navbar-search .search-form');
    const input = form && form.querySelector('.search-input');
    if (!form || !input) return;

    // panel > [head] + listbox + [foot]; the panel animates, the list scrolls
    const panel = el('div', 'search-suggest');
    const head  = el('div', 'search-suggest-head');
    const list  = el('ul', 'search-suggest-list');
    const foot  = el('div', 'search-suggest-foot');
    list.id = 'search-suggest';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Suggestions');
    [['↑↓', 'navigate'], ['↵', 'open'], ['esc', 'close']].forEach(([k, t]) => {
      const s = el('span'); s.append(el('kbd', null, k), document.createTextNode(' ' + t)); foot.appendChild(s);
    });
    panel.append(head, list, foot);
    panel.setAttribute('aria-hidden', 'true');
    form.appendChild(panel);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    let active = -1, items = [], timer = null, lastQ = '', open = false;
    const light = () => document.documentElement.getAttribute('data-theme') === 'light';

    function show() {
      if (open) return;
      open = true;
      panel.classList.add('is-open');
      panel.removeAttribute('aria-hidden');
      input.setAttribute('aria-expanded', 'true');
    }
    function close() {
      if (!open) return;
      open = false; active = -1; lastQ = '';
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function setActive(i) {
      items.forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      active = i;
      if (i >= 0 && items[i]) {
        input.setAttribute('aria-activedescendant', items[i].id);
        items[i].scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }
    function option(id, href, build, i) {
      const li = el('li');
      li.id = id; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      li.style.setProperty('--i', i);
      const a = el('a'); a.href = href; a.tabIndex = -1;
      build(a);
      li.appendChild(a);
      li.addEventListener('mousedown', e => e.preventDefault());   // keep focus in the input
      li.addEventListener('mousemove', () => { if (active !== items.indexOf(li)) setActive(items.indexOf(li)); });
      return li;
    }

    // Height follows the content smoothly (FLIP on the list's height)
    function morph(fn) {
      const from = list.getBoundingClientRect().height;    // current height, even mid-animation
      list.style.transition = 'none';
      list.style.height = '';
      fn();
      if (reduced || !open) return;
      const to = list.getBoundingClientRect().height;      // natural height of the new content
      if (Math.abs(from - to) < 2) return;
      list.style.height = from + 'px';
      list.offsetHeight;                                   // reflow
      list.style.transition = 'height .26s cubic-bezier(.16,1,.3,1)';
      list.style.height = to + 'px';
      const done = () => { list.style.height = ''; list.style.transition = ''; list.removeEventListener('transitionend', done); };
      list.addEventListener('transitionend', done);
      setTimeout(done, 320);
    }

    function render(q, res) {
      const { terms, hits } = res;
      morph(() => {
        list.replaceChildren();
        items = [];
        head.textContent = hits.length ? hits.length + (hits.length > 1 ? ' articles' : ' article') : '';
        if (!hits.length) {
          const li = el('li', 'search-suggest-empty');
          li.append(el('i', 'fas fa-search'), el('span', null, 'No article matches “' + q.trim() + '”'));
          list.appendChild(li);
        }
        hits.slice(0, MAX).forEach((h, i) => {
          const p = h.e.p;
          const li = option('search-suggest-' + i, safeUrl(p.url), a => {
            const cover = (light() && p.cover_light) || p.cover;
            if (cover) {
              const img = el('img', 'search-suggest-thumb');
              img.src = safeUrl(cover); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
              a.appendChild(img);
            } else a.appendChild(el('span', 'search-suggest-thumb search-suggest-thumb--none'));
            const body = el('span', 'search-suggest-body');
            const t = el('span', 'search-suggest-title');
            t.appendChild(highlight(String(p.title || ''), terms));
            const ex = el('span', 'search-suggest-excerpt');
            ex.appendChild(highlight(snippet(p.excerpt || p.content, terms, 90), terms));
            const m = el('span', 'search-suggest-meta', [p.date, p.tags].filter(Boolean).join(' · '));
            body.append(t, ex, m);
            a.appendChild(body);
          }, i);
          items.push(li); list.appendChild(li);
        });
        if (hits.length) {
          const all = option('search-suggest-all', form.action + '?q=' + encodeURIComponent(q.trim()), a => {
            a.className = 'search-suggest-all';
            a.textContent = hits.length > MAX ? 'See all ' + hits.length + ' results →' : 'Open the search page →';
          }, Math.min(hits.length, MAX));
          items.push(all); list.appendChild(all);
        }
        active = -1;
        input.removeAttribute('aria-activedescendant');
      });
      show();
    }

    function update() {
      const q = input.value;
      if (!q.trim()) { close(); return; }
      if (q === lastQ && open) return;
      lastQ = q;
      loadIndex().then(index => { if (input.value === q) render(q, search(index, q)); }).catch(close);
    }

    input.addEventListener('focus', () => { loadIndex().catch(() => {}); if (input.value.trim()) update(); });
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 40); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setActive(active <= 0 ? items.length - 1 : active - 1); }
      else if (e.key === 'Enter' && active >= 0 && items[active]) { e.preventDefault(); location.href = items[active].querySelector('a').href; }
      else if (e.key === 'Escape') { if (open) { e.preventDefault(); close(); } else input.blur(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));

    // "/" or Ctrl/Cmd+K: focus the search box (unless typing somewhere else)
    document.addEventListener('keydown', e => {
      const t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) && !e.altKey) {
        if (!input.offsetParent) return;                    // hidden (collapsed mobile menu)
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  });
})();
