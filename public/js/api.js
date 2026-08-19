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

    return data;
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

    toast.textContent = message;
    toast.className = `playnex-toast is-${type} is-visible`;

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  window.Playnex = window.Playnex || {};
  window.Playnex.api = api;
  window.Playnex.showToast = showToast;
})();
