(function () {
  'use strict';

  function updateHeader() {
    var user = localStorage.getItem('playnex_user');
    var wrapper = document.querySelector('.topbar__actions');

    if (!wrapper) return;

    var existingProfile = wrapper.querySelector('a[href="Profile.html"]');
    if (existingProfile || wrapper.getAttribute('data-auth-synced') === 'true') return;

    if (user) {
      wrapper.setAttribute('data-auth-synced', 'true');

      var loginBtn = wrapper.querySelector('.btn--ghost');
      var signupBtn = wrapper.querySelector('.btn--primary.btn--small');

      if (loginBtn) loginBtn.remove();
      if (signupBtn) signupBtn.remove();

      var profileLink = document.createElement('a');
      profileLink.href = 'Profile.html';
      profileLink.className = 'icon-btn';
      profileLink.setAttribute('aria-label', 'Profile');
      profileLink.title = 'Profile';

      try {
        var userData = JSON.parse(user);
        var letter = (userData.name || userData.username || 'U').charAt(0).toUpperCase();
        profileLink.innerHTML = '<span class="profile-icon__letter">' + letter + '</span>';
      } catch (e) {
        profileLink.innerHTML = '<span class="profile-icon__letter">U</span>';
      }

      wrapper.insertBefore(profileLink, wrapper.firstElementChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateHeader);
  } else {
    updateHeader();
  }
})();
