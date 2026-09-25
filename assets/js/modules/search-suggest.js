/**
 * modules/search-suggest.js — instant suggestions under the navbar search box.
 *
 * The index (search.json) is fetched the first time the box gets focus, then
 * matches are shown while typing: title hits first, matched words highlighted.
 * ↑/↓ to move, Enter to open (or to see all results), Esc to close.
 * "/" or Ctrl+K focuses the search box from anywhere on the page.
 * Accessible combobox pattern (role=combobox / listbox / option); results are
 * built with DOM APIs, never innerHTML, so post data can't inject markup.
 */
'use strict';
(function initSearchSuggest() {
  const MAX = 6;

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

  function search(index, q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return { terms, hits: [] };
    const hits = index.map(e => {
      if (!terms.every(t => e.hay.indexOf(t) !== -1)) return null;
      let score = 0;
      terms.forEach(t => {
        if (e.title.indexOf(t) !== -1) score += 10 + (e.title.startsWith(t) || e.title.indexOf(' ' + t) !== -1 ? 5 : 0);
        if (e.tags.indexOf(t) !== -1) score += 3;
      });
      return { e, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    return { terms, hits };
  }

  // Title with the matched words wrapped in <mark> (text nodes only)
  function highlight(text, terms) {
    const frag = document.createDocumentFragment();
    const n = norm(text);
    const marks = [];
    terms.forEach(t => {
      let i = n.indexOf(t);
      while (i !== -1 && t) { marks.push([i, i + t.length]); i = n.indexOf(t, i + t.length); }
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

  document.addEventListener('DOMContentLoaded', () => {
    const form  = document.querySelector('.navbar-search .search-form');
    const input = form && form.querySelector('.search-input');
    if (!form || !input) return;

    const list = document.createElement('ul');
    list.id = 'search-suggest';
    list.className = 'search-suggest';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Suggestions');
    list.hidden = true;
    form.appendChild(list);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('autocomplete', 'off');

    let active = -1, items = [], timer = null, lastQ = '';

    function close() {
      list.hidden = true; active = -1; items = [];
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
    function option(id, href, build) {
      const li = document.createElement('li');
      li.id = id; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      const a = document.createElement('a');
      a.href = href; a.tabIndex = -1;
      build(a);
      li.appendChild(a);
      li.addEventListener('mousedown', e => e.preventDefault());   // keep focus in the input
      li.addEventListener('mousemove', () => setActive(items.indexOf(li)));
      return li;
    }

    function render(q, res) {
      list.replaceChildren();
      items = [];
      if (!q.trim()) { close(); return; }
      const { terms, hits } = res;
      if (!hits.length) {
        const li = document.createElement('li');
        li.className = 'search-suggest-empty';
        li.textContent = 'No article matches “' + q.trim() + '”';
        list.appendChild(li);
      }
      hits.slice(0, MAX).forEach((h, i) => {
        const p = h.e.p;
        const li = option('search-suggest-' + i, safeUrl(p.url), a => {
          const t = document.createElement('span');
          t.className = 'search-suggest-title';
          t.appendChild(highlight(String(p.title || ''), terms));
          const m = document.createElement('span');
          m.className = 'search-suggest-meta';
          m.textContent = [p.date, p.tags].filter(Boolean).join(' · ');
          a.append(t, m);
        });
        items.push(li); list.appendChild(li);
      });
      if (hits.length) {
        const all = option('search-suggest-all', form.action + '?q=' + encodeURIComponent(q.trim()), a => {
          a.className = 'search-suggest-all';
          a.textContent = hits.length > MAX ? 'See all ' + hits.length + ' results →' : 'Open the search page →';
        });
        items.push(all); list.appendChild(all);
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      setActive(-1);
    }

    function update() {
      const q = input.value;
      if (q === lastQ && !list.hidden) return;
      lastQ = q;
      if (!q.trim()) { close(); return; }
      loadIndex().then(index => { if (input.value === q) render(q, search(index, q)); }).catch(close);
    }

    input.addEventListener('focus', () => { loadIndex().catch(() => {}); if (input.value.trim()) { lastQ = ''; update(); } });
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 60); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setActive((active + 1) % items.length); }
      else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setActive(active <= 0 ? items.length - 1 : active - 1); }
      else if (e.key === 'Enter' && active >= 0 && items[active]) { e.preventDefault(); location.href = items[active].querySelector('a').href; }
      else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); close(); } else input.blur(); }
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
