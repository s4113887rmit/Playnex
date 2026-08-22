/**
 * api.js — Standard fetch wrapper for Playnex API calls.
 * Automatically injects the active user ID in 'x-user-id' header.
 */
(function () {
  'use strict';

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (window.Playnex && typeof window.Playnex.getCurrentUserId === 'function') {
      headers['x-user-id'] = window.Playnex.getCurrentUserId();
    }

    const config = {
      ...options,
      headers
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const res = await fetch(path, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.error || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.fields = data.fields || null;
      throw error;
    }

    if (typeof path === 'string') {
      if (path.startsWith('/api/cart') && data && data.itemCount !== undefined) {
        updateCartBadge(data.itemCount);
      } else if (path.includes('/api/checkout') && options.method === 'POST') {
        updateCartBadge(0);
      }
    }

    return data;
  }

  // Login guard: when logged out, shows a centered "please log in" notice
  // with a clickable underlined "Log In" link and returns false so caller can abort.
  function requireLogin() {
    const user = (window.Playnex && typeof window.Playnex.getCurrentUser === 'function')
      ? window.Playnex.getCurrentUser()
      : null;
    if (user) return true;
    showToast('Please log in to continue. <a href="Login.html" class="playnex-toast__link">Log In -&gt;</a>', 'info');
    return false;
  }

  // Update topbar cart icon badge count
  function updateCartBadge(count) {
    const totalCount = Number(count) || 0;
    const cartIcons = document.querySelectorAll('a.icon-btn[href="cart.html"], a.icon-btn[href*="cart.html"], a.icon-btn[aria-label*="Cart"]');
    cartIcons.forEach(cartIcon => {
      let badge = cartIcon.querySelector('.nav-count');
      if (totalCount > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-count';
          cartIcon.appendChild(badge);
        }
        badge.textContent = totalCount > 99 ? '99+' : totalCount;
        cartIcon.setAttribute('aria-label', `Cart, ${totalCount} item${totalCount === 1 ? '' : 's'}`);
      } else {
        if (badge) badge.remove();
        cartIcon.setAttribute('aria-label', 'Cart');
      }
    });
  }

  async function syncCartBadge() {
    try {
      const data = await api('/api/cart');
      const count = data.itemCount !== undefined ? data.itemCount : (data.items || []).reduce((sum, i) => sum + i.qty, 0);
      updateCartBadge(count);
    } catch {
      updateCartBadge(0);
    }
  }

  // Toast notification helper for UI feedback
  function showToast(message, type = 'success') {
    let toast = document.getElementById('playnex-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'playnex-toast';
      toast.className = 'playnex-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = message;
    toast.className = `playnex-toast is-${type} is-visible`;

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, type === 'info' ? 3500 : 3200);

    toast.onmouseenter = () => {
      clearTimeout(toast._timeout);
    };
    toast.onmouseleave = () => {
      clearTimeout(toast._timeout);
      toast._timeout = setTimeout(() => {
        toast.classList.remove('is-visible');
      }, 1500);
    };
  }

  window.Playnex = window.Playnex || {};
  window.Playnex.api = api;
  window.Playnex.showToast = showToast;
  window.Playnex.requireLogin = requireLogin;
  window.Playnex.updateCartBadge = updateCartBadge;
  window.Playnex.syncCartBadge = syncCartBadge;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncCartBadge);
  } else {
    syncCartBadge();
  }
  window.addEventListener('pageshow', syncCartBadge);
  window.addEventListener('focus', syncCartBadge);
})();
