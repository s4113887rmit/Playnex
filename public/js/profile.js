(function () {
  'use strict';

  var currentEmail = '';
  var profileId = '';

  var tabs = document.querySelectorAll('.profile-tab');
  var sections = document.querySelectorAll('.profile-section');

  var profAvatarImg = document.getElementById('profile-avatar-img');
  var avatarLetter = document.getElementById('profile-avatar-letter');
  var displayName = document.getElementById('profile-display-name');
  var usernameEl = document.getElementById('profile-username');
  var emailDisplay = document.getElementById('profile-email-display');
  var descEl = document.getElementById('profile-description');

  var nameInput = document.getElementById('profile-name');
  var descInput = document.getElementById('profile-desc');
  var descCharCount = document.getElementById('prof-desc-char-count');
  var profFileInput = document.getElementById('profile-picture-upload');
  var profFileName = document.getElementById('prof-file-name');

  var currentEmailInput = document.getElementById('current-email');

  descInput.addEventListener('input', function () {
    descCharCount.textContent = descInput.value.length;
  });

  profFileInput.addEventListener('change', function () {
    profFileName.textContent = profFileInput.files.length > 0 ? profFileInput.files[0].name : 'No file chosen';
  });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var sectionId = 'section-' + tab.getAttribute('data-section');
      sections.forEach(function (s) {
        s.classList.toggle('is-hidden', s.id !== sectionId);
      });
      clearAllMessages();
    });
  });

  function clearAllMessages() {
    var msgs = document.querySelectorAll('.auth-server-msg');
    msgs.forEach(function (m) { m.textContent = ''; m.className = 'auth-server-msg'; });
    var errors = document.querySelectorAll('.form-group__error');
    errors.forEach(function (e) { e.textContent = ''; });
    var inputs = document.querySelectorAll('.profile-form input.is-invalid, .profile-form textarea.is-invalid');
    inputs.forEach(function (i) { i.classList.remove('is-invalid'); });
  }

  function showFieldError(id, message) {
    var el = document.getElementById(id);
    var err = document.getElementById(id + '-error');
    if (el) el.classList.add('is-invalid');
    if (err) err.textContent = message;
  }

  function showServerMsg(id, message, type) {
    var el = document.getElementById(id);
    el.textContent = message;
    el.className = 'auth-server-msg is-' + type;
  }

  function loadProfile() {
    var stored = localStorage.getItem('playnex_user');
    if (!stored) {
      showServerMsg('profile-edit-msg', 'No user session found. Please log in.', 'error');
      return;
    }
    var userData = JSON.parse(stored);
    currentEmail = userData.email;
    profileId = userData.id;

    fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail })
    })
      .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
      .then(function (result) {
        if (result.status === 200) {
          renderProfile(result.data);
        } else {
          showServerMsg('profile-edit-msg', result.data.error || 'Failed to load profile.', 'error');
        }
      })
      .catch(function () {
        showServerMsg('profile-edit-msg', 'Network error.', 'error');
      });
  }

  function renderProfile(user) {
    var name = user.name || user.username;
    displayName.textContent = name;
    usernameEl.textContent = '@' + user.username;
    emailDisplay.textContent = user.email;
    descEl.textContent = user.description || '';
    nameInput.value = name;
    descInput.value = user.description || '';
    descCharCount.textContent = (user.description || '').length;
    currentEmailInput.value = user.email;
    currentEmail = user.email;
    profFileName.textContent = 'No file chosen';

    avatarLetter.textContent = name.charAt(0);
    if (user.profilePicture && user.profilePicture !== 'uploads/default-profile.svg') {
      profAvatarImg.src = user.profilePicture;
    }
  }

  function updateLocalStorage(updates) {
    var stored = JSON.parse(localStorage.getItem('playnex_user') || '{}');
    Object.assign(stored, updates);
    localStorage.setItem('playnex_user', JSON.stringify(stored));
  }

  document.getElementById('form-edit-profile').addEventListener('submit', function (e) {
    e.preventDefault();
    clearAllMessages();
    if (!currentEmail) return;

    var btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    var file = profFileInput.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function () {
        sendProfileUpdate(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      sendProfileUpdate(null);
    }
  });

  function sendProfileUpdate(pictureBase64) {
    var payload = {
      email: currentEmail,
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      profilePicture: pictureBase64 || null
    };

    fetch('/api/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
      .then(function (result) {
        if (result.status === 200) {
          showServerMsg('profile-edit-msg', result.data.message, 'success');
          renderProfile(result.data.user);
          updateLocalStorage({ name: result.data.user.name });
          profFileInput.value = '';
          profFileName.textContent = 'No file chosen';
        } else {
          showServerMsg('profile-edit-msg', result.data.error, 'error');
        }
      })
      .catch(function () {
        showServerMsg('profile-edit-msg', 'Network error.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Save changes';
      });
  }

  document.getElementById('form-change-email').addEventListener('submit', function (e) {
    e.preventDefault();
    clearAllMessages();
    var newEmail = document.getElementById('new-email').value.trim();
    var password = document.getElementById('email-password').value;

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      showFieldError('new-email', 'Enter a valid email address');
      return;
    }
    if (!password) {
      showFieldError('email-password', 'Password is required');
      return;
    }

    var btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    fetch('/api/auth/email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentEmail: currentEmail, newEmail: newEmail, password: password })
    })
      .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
      .then(function (result) {
        if (result.status === 200) {
          showServerMsg('email-msg', result.data.message, 'success');
          currentEmail = result.data.email;
          currentEmailInput.value = result.data.email;
          updateLocalStorage({ email: result.data.email });
          document.getElementById('new-email').value = '';
        } else {
          showServerMsg('email-msg', result.data.error, 'error');
        }
      })
      .catch(function () { showServerMsg('email-msg', 'Network error.', 'error'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Update email'; });
  });

  document.getElementById('form-change-password').addEventListener('submit', function (e) {
    e.preventDefault();
    clearAllMessages();
    var currentPassword = document.getElementById('current-password').value;
    var newPassword = document.getElementById('new-password').value;
    var confirmNew = document.getElementById('new-password-confirm').value;

    if (!currentPassword) { showFieldError('current-password', 'Current password is required'); return; }
    if (!newPassword || newPassword.length < 8) { showFieldError('new-password', 'Must be at least 8 characters'); return; }
    if (newPassword !== confirmNew) { showFieldError('new-password-confirm', 'Passwords do not match'); return; }

    var btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    fetch('/api/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, currentPassword: currentPassword, newPassword: newPassword, confirmNewPassword: confirmNew })
    })
      .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
      .then(function (result) {
        if (result.status === 200) {
          showServerMsg('password-msg', result.data.message, 'success');
          document.getElementById('current-password').value = '';
          document.getElementById('new-password').value = '';
          document.getElementById('new-password-confirm').value = '';
        } else {
          showServerMsg('password-msg', result.data.error, 'error');
        }
      })
      .catch(function () { showServerMsg('password-msg', 'Network error.', 'error'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Update password'; });
  });

  document.getElementById('form-delete-account').addEventListener('submit', function (e) {
    e.preventDefault();
    clearAllMessages();
    var confirmed = document.getElementById('confirm-delete').checked;
    var password = document.getElementById('delete-password').value;

    if (!confirmed) { showFieldError('confirm-delete', 'You must confirm you understand this is permanent'); return; }
    if (!password) { showFieldError('delete-password', 'Password is required'); return; }

    var btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    fetch('/api/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentEmail, password: password })
    })
      .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
      .then(function (result) {
        if (result.status === 200) {
          showServerMsg('delete-msg', result.data.message, 'success');
          localStorage.removeItem('playnex_user');
          setTimeout(function () { window.location.href = 'Login.html'; }, 2000);
        } else {
          showServerMsg('delete-msg', result.data.error, 'error');
        }
      })
      .catch(function () { showServerMsg('delete-msg', 'Network error.', 'error'); })
      .finally(function () { btn.disabled = false; btn.textContent = 'Delete my account'; });
  });

  document.getElementById('logout-btn').addEventListener('click', function (e) {
    e.preventDefault();
    localStorage.removeItem('playnex_user');
    window.location.href = 'Login.html';
  });

  if (nameInput) {
    nameInput.addEventListener('input', function () {
      if (nameInput.value.trim()) {
        avatarLetter.textContent = nameInput.value.trim().charAt(0);
      }
    });
  }

  loadProfile();
})();
