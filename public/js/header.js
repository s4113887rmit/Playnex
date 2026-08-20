(function () {
  'use strict';

  function updateHeader() {
    var page = window.location.pathname.split('/').pop() || 'homepage.html';
    if (page === 'Login.html' || page === 'Profile.html') return;

    var wrapper = document.querySelector('.topbar__actions');
    if (!wrapper || wrapper.getAttribute('data-auth-synced') === 'true') return;

    var user = null;
    try {
      var raw = localStorage.getItem('playnex_user');
      if (raw) user = JSON.parse(raw);
    } catch (e) {}

    if (!user) {
      localStorage.removeItem('playnex_user');
      wrapper.setAttribute('data-auth-synced', 'true');
      return;
    }

    wrapper.setAttribute('data-auth-synced', 'true');

    var loginBtn = wrapper.querySelector('.btn--ghost');
    var signupBtn = wrapper.querySelector('.btn--primary.btn--small');
    var hardcoded = wrapper.querySelector('.profile-icon, a[data-auth-logout]');

    if (loginBtn) loginBtn.remove();
    if (signupBtn) signupBtn.remove();
    if (hardcoded) hardcoded.remove();

    var profileLink = document.createElement('a');
    profileLink.href = 'Profile.html';
    profileLink.className = 'icon-btn profile-icon';
    profileLink.setAttribute('aria-label', 'Profile');
    profileLink.title = 'Profile';

    var letter = ((user.name || user.username || 'U') + '').charAt(0).toUpperCase();
    profileLink.innerHTML = '<span class="profile-icon__letter">' + letter + '</span>';

    var logoutBtn = document.createElement('a');
    logoutBtn.href = 'Login.html';
    logoutBtn.className = 'btn btn--ghost btn--small';
    logoutBtn.setAttribute('data-auth-logout', 'true');
    logoutBtn.textContent = 'Log out';
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem('playnex_user');
      window.location.href = 'Login.html';
    });

    wrapper.insertBefore(logoutBtn, wrapper.firstElementChild);
    wrapper.insertBefore(profileLink, wrapper.firstElementChild);

    // reveal admin-only UI (e.g. Admin Panel button) for administrators
    if (user.role === 'admin') {
      document.querySelectorAll('[data-admin-only]').forEach(function (el) {
        el.hidden = false;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHeader);
  } else {
    updateHeader();
  }
})();
