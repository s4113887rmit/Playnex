/**
 * current-user.js — Identifies the current active user for Playnex store operations.
 * Integrates with the shared User Account module (reads 'playnex_user' from localStorage).
 * Generates and stores a unique guest ID if not logged in.
 */
(function () {
  'use strict';

  const GUEST_KEY = 'playnex_guest_id';

  function getCurrentUserId() {
    // 1. Check if user is logged in via Shared User Account module
    try {
      const loggedUser = localStorage.getItem('playnex_user');
      if (loggedUser) {
        const parsed = JSON.parse(loggedUser);
        if (parsed && (parsed.id || parsed.username || parsed.email)) {
          return String(parsed.id || parsed.username || parsed.email);
        }
      }
    } catch (e) {
      // JSON parse error, continue to guest
    }

    // 2. Fallback to guest ID in localStorage
    let guestId = localStorage.getItem(GUEST_KEY);
    if (!guestId) {
      guestId = 'guest_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem(GUEST_KEY, guestId);
    }
    return guestId;
  }

  function getCurrentUser() {
    try {
      const loggedUser = localStorage.getItem('playnex_user');
      if (loggedUser) {
        return JSON.parse(loggedUser);
      }
    } catch (e) {}
    return null;
  }

  window.Playnex = window.Playnex || {};
  window.Playnex.getCurrentUserId = getCurrentUserId;
  window.Playnex.getCurrentUser = getCurrentUser;
})();
