/**
 * modules/notifications.js — Toast notifications
 * showNotification(message, type) is a global function used by other modules.
 * copyPageUrl() is also global (share button in post footer, [data-copy-url]).
 * Types: 'success' | 'error' | 'info'
 */
'use strict';

let _notifTimer = null;
function showNotification(msg, type) {
  type = type || 'info';
  let el = document.getElementById('site-notification');
  if (!el) {
    el = document.createElement('div');
    el.id = 'site-notification';
    el.className = 'notification';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'notification ' + type;
  clearTimeout(_notifTimer);
  requestAnimationFrame(() => {
    el.classList.add('show');
    _notifTimer = setTimeout(() => el.classList.remove('show'), 3000);
  });
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    ok ? resolve() : reject(new Error('copy failed'));
  });
}

function copyPageUrl() {
  copyText(window.location.href)
    .then(()  => showNotification('Link copied!', 'success'))
    .catch(()  => showNotification('Copy failed', 'error'));
}

document.addEventListener('click', e => {
  if (e.target.closest && e.target.closest('[data-copy-url]')) copyPageUrl();
});
