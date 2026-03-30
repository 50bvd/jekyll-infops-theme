/**
 * modules/notifications.js — Toast notifications
 * showNotification(message, type) is a global function used by other modules.
 * copyPageUrl() is also global, called from share buttons in post footer.
 * Types: 'success' | 'error' | 'info'
 */
'use strict';

function showNotification(msg, type) {
  type = type || 'info';
  let el = document.getElementById('site-notification');
  if (!el) {
    el = document.createElement('div');
    el.id = 'site-notification';
    el.className = 'notification';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'notification ' + type;
  requestAnimationFrame(() => {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
  });
}

function copyPageUrl() {
  navigator.clipboard.writeText(window.location.href)
    .then(()  => showNotification('Link copied!', 'success'))
    .catch(()  => showNotification('Copy failed', 'error'));
}
