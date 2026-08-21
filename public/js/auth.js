(function () {
  'use strict';

  localStorage.removeItem('playnex_user');

  var tabs = document.querySelectorAll('.auth-tab');
  var loginForm = document.getElementById('login-form');
  var forgotForm = document.getElementById('forgot-form');
  var resetForm = document.getElementById('reset-form');
  var signupForm = document.getElementById('signup-form');
  var descField = document.getElementById('signup-description');
  var charCount = document.getElementById('desc-char-count');
  var fileInput = document.getElementById('signup-picture');
  var fileName = document.getElementById('file-name');
  var showForgot = document.getElementById('show-forgot');
  var showReset = document.getElementById('show-reset');
  var backToLogin = document.getElementById('back-to-login');
  var backToLogin2 = document.getElementById('back-to-login-2');

  descField.addEventListener('input', function () {
    charCount.textContent = descField.value.length;
  });

  fileInput.addEventListener('change', function () {
    fileName.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file chosen';
  });

  function showForm(form) {
    [loginForm, forgotForm, resetForm, signupForm].forEach(function (f) { f.classList.add('is-hidden'); });
    form.classList.remove('is-hidden');
    clearMessages();
    clearErrors();
  }

  function switchToTab(index) {
    tabs.forEach(function (t) { return t.classList.remove('is-active'); });
    if (index >= 0 && index < tabs.length) tabs[index].classList.add('is-active');
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { return t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var target = tab.getAttribute('data-tab');
      if (target === 'login') { showForm(loginForm); }
      else if (target === 'signup') { showForm(signupForm); charCount.textContent = descField.value.length; }
    });
  });

  showForgot.addEventListener('click', function (e) {
    e.preventDefault();
    switchToTab(-1);
    showForm(forgotForm);
  });

  backToLogin.addEventListener('click', function (e) {
    e.preventDefault();
    switchToTab(0);
    showForm(loginForm);
  });

  backToLogin2.addEventListener('click', function (e) {
    e.preventDefault();
    switchToTab(0);
    showForm(loginForm);
  });

  showReset.addEventListener('click', function (e) {
    e.preventDefault();
    switchToTab(-1);
    showForm(resetForm);
  });

  function clearMessages() {
    var msgs = document.querySelectorAll('.auth-server-msg');
    msgs.forEach(function (m) { m.textContent = ''; m.className = 'auth-server-msg'; });
  }

  function clearErrors() {
    var errors = document.querySelectorAll('.form-group__error');
    errors.forEach(function (e) { return e.textContent = ''; });
    var inputs = document.querySelectorAll('.auth-form input.is-invalid, .auth-form textarea.is-invalid');
    inputs.forEach(function (i) { return i.classList.remove('is-invalid'); });
  }

  function showFieldError(id, message) {
    var el = document.getElementById(id);
    var errorEl = document.getElementById(id + '-error');
    if (el) {
      if (message) el.classList.add('is-invalid');
      else el.classList.remove('is-invalid');
    }
    if (errorEl) errorEl.textContent = message || '';
  }

  function showServerMsg(formId, message, type) {
    var el = document.getElementById(formId + '-server-msg');
    el.textContent = message;
    el.className = 'auth-server-msg is-' + type;
  }

  function validateSignup() {
    clearErrors();
    var valid = true;
    var username = document.getElementById('signup-username').value.trim();
    var email = document.getElementById('signup-email').value.trim();
    var password = document.getElementById('signup-password').value;
    var confirm = document.getElementById('signup-confirm').value;
    var description = descField.value.trim();
    var terms = document.getElementById('signup-terms').checked;

    if (!username || username.length < 3) {
      showFieldError('signup-username', 'Username must be at least 3 characters');
      valid = false;
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      showFieldError('signup-username', 'Letters, numbers, hyphens and underscores only');
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('signup-email', 'Please enter a valid email address');
      valid = false;
    }
    if (!password || password.length < 8) {
      showFieldError('signup-password', 'Password must be at least 8 characters');
      valid = false;
    }
    if (password !== confirm) {
      showFieldError('signup-confirm', 'Passwords do not match');
      valid = false;
    }
    if (!description || description.length === 0) {
      showFieldError('signup-description', 'Short description is required');
      valid = false;
    } else if (description.length > 500) {
      showFieldError('signup-description', 'Description must be at most 500 characters');
      valid = false;
    }
    if (!terms) {
      showFieldError('signup-terms', 'You must agree to the Terms of Service');
      valid = false;
    }
    return valid;
  }

  function validateLogin() {
    clearErrors();
    var valid = true;
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    if (!email) { showFieldError('login-email', 'Email is required'); valid = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('login-email', 'Please enter a valid email address'); valid = false; }
    if (!password) { showFieldError('login-password', 'Password is required'); valid = false; }
    return valid;
  }

  function validateForgot() {
    clearErrors();
    var email = document.getElementById('forgot-email').value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('forgot-email', 'Please enter a valid email address');
      return false;
    }
    return true;
  }

  function validateReset() {
    clearErrors();
    var valid = true;
    var token = document.getElementById('reset-token').value.trim();
    var password = document.getElementById('reset-password').value;
    var confirm = document.getElementById('reset-confirm').value;
    if (!token) { showFieldError('reset-token', 'Reset code is required'); valid = false; }
    if (!password || password.length < 8) { showFieldError('reset-password', 'Password must be at least 8 characters'); valid = false; }
    if (password !== confirm) { showFieldError('reset-confirm', 'Passwords do not match'); valid = false; }
    return valid;
  }

  function signupFieldError(id) {
    var el = document.getElementById(id);
    if (id === 'signup-username') {
      var u = el.value.trim();
      if (!u) return 'Username is required';
      if (u.length < 3) return 'Username must be at least 3 characters';
      if (!/^[a-zA-Z0-9_-]+$/.test(u)) return 'Letters, numbers, hyphens and underscores only';
      return '';
    }
    if (id === 'signup-email') {
      var e = el.value.trim();
      if (!e) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address';
      return '';
    }
    if (id === 'signup-password') {
      if (!el.value) return 'Password is required';
      if (el.value.length < 8) return 'Password must be at least 8 characters';
      return '';
    }
    if (id === 'signup-confirm') {
      if (!el.value) return 'Please confirm your password';
      if (el.value !== document.getElementById('signup-password').value) return 'Passwords do not match';
      return '';
    }
    if (id === 'signup-description') {
      var d = el.value.trim();
      if (!d) return 'Short description is required';
      if (d.length > 500) return 'Description must be at most 500 characters';
      return '';
    }
    if (id === 'signup-terms') {
      return el.checked ? '' : 'You must agree to the Terms of Service';
    }
    return '';
  }

  function loginFieldError(id) {
    var el = document.getElementById(id);
    if (id === 'login-email') {
      var e = el.value.trim();
      if (!e) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address';
      return '';
    }
    if (id === 'login-password') {
      return el.value ? '' : 'Password is required';
    }
    return '';
  }

  function forgotFieldError() {
    var el = document.getElementById('forgot-email');
    var e = el.value.trim();
    if (!e) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Please enter a valid email address';
    return '';
  }

  function wireLive(id, errorFn) {
    var el = document.getElementById(id);
    if (!el) return;
    var isCheckbox = el.type === 'checkbox';
    el.addEventListener(isCheckbox ? 'change' : 'input', function () {
      if (isCheckbox) { showFieldError(id, errorFn(id)); return; }
      if (!el.value.trim()) { showFieldError(id, ''); return; }
      showFieldError(id, errorFn(id));
    });
    if (!isCheckbox) {
      el.addEventListener('blur', function () {
        if (!el.value.trim()) showFieldError(id, errorFn(id));
      });
    }
  }

  wireLive('signup-username', signupFieldError);
  wireLive('signup-email', signupFieldError);
  wireLive('signup-password', signupFieldError);
  wireLive('signup-confirm', signupFieldError);
  wireLive('signup-description', signupFieldError);
  wireLive('signup-terms', signupFieldError);
  wireLive('login-email', loginFieldError);
  wireLive('login-password', loginFieldError);
  wireLive('forgot-email', forgotFieldError);

  document.getElementById('signup-password').addEventListener('input', function () {
    var confirm = document.getElementById('signup-confirm');
    if (confirm.value) showFieldError('signup-confirm', signupFieldError('signup-confirm'));
  });

  function saveDraft(key, obj) {
    try { sessionStorage.setItem(key, JSON.stringify(obj)); } catch (e) {}
  }

  function loadDraft(key) {
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveSignupDraft() {
    saveDraft('playnex_draft_signup', {
      username: document.getElementById('signup-username').value,
      email: document.getElementById('signup-email').value,
      description: descField.value,
      terms: document.getElementById('signup-terms').checked
    });
  }

  ['signup-username', 'signup-email', 'signup-description'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', saveSignupDraft);
  });
  document.getElementById('signup-terms').addEventListener('change', saveSignupDraft);

  function restoreSignupDraft() {
    var d = loadDraft('playnex_draft_signup');
    if (!d) return;
    if (typeof d.username === 'string' && d.username) document.getElementById('signup-username').value = d.username;
    if (typeof d.email === 'string' && d.email) document.getElementById('signup-email').value = d.email;
    if (typeof d.description === 'string' && d.description) {
      descField.value = d.description;
      charCount.textContent = d.description.length;
    }
    document.getElementById('signup-terms').checked = !!d.terms;
  }

  document.getElementById('login-email').addEventListener('input', function () {
    saveDraft('playnex_draft_login', { email: document.getElementById('login-email').value });
  });

  function restoreLoginDraft() {
    var d = loadDraft('playnex_draft_login');
    if (d && typeof d.email === 'string') document.getElementById('login-email').value = d.email;
  }

  document.getElementById('forgot-email').addEventListener('input', function () {
    saveDraft('playnex_draft_forgot', { email: document.getElementById('forgot-email').value });
  });

  function restoreForgotDraft() {
    var d = loadDraft('playnex_draft_forgot');
    if (d && typeof d.email === 'string') document.getElementById('forgot-email').value = d.email;
  }

  restoreSignupDraft();
  restoreLoginDraft();
  restoreForgotDraft();

  ['reset-token', 'reset-password', 'reset-confirm'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      if (id === 'reset-confirm' || document.getElementById('reset-token').value.trim() || document.getElementById('reset-password').value) {
        validateReset();
      }
    });
  });

  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessages();
    if (!validateSignup()) return;

    var btn = signupForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account...';

    var file = fileInput.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function () {
        sendSignup(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      sendSignup(null);
    }
  });

  function sendSignup(pictureBase64) {
    var payload = {
      username: document.getElementById('signup-username').value.trim(),
      email: document.getElementById('signup-email').value.trim(),
      password: document.getElementById('signup-password').value,
      confirmPassword: document.getElementById('signup-confirm').value,
      description: descField.value.trim(),
      subscribe: document.getElementById('signup-subscribe').checked,
      profilePicture: pictureBase64 || null
    };

    fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 201) {
          showServerMsg('signup', result.data.message, 'success');
          sessionStorage.removeItem('playnex_draft_signup');
          signupForm.reset();
          charCount.textContent = '0';
          fileName.textContent = 'No file chosen';
          setTimeout(function () {
            showForm(loginForm);
            switchToTab(0);
          }, 1500);
        } else {
          localStorage.removeItem('playnex_user');
          showServerMsg('signup', result.data.error, 'error');
        }
      })
      .catch(function () {
        localStorage.removeItem('playnex_user');
        showServerMsg('signup', 'Network error. Please check your connection.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Create account';
      });
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessages();
    if (!validateLogin()) return;

    var payload = {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    };

    localStorage.removeItem('playnex_user');

    var btn = loginForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 200) {
          localStorage.removeItem('playnex_user');
          localStorage.setItem('playnex_user', JSON.stringify({
            id: result.data.user.id,
            username: result.data.user.username,
            email: result.data.user.email,
            name: result.data.user.name,
            role: result.data.user.role
          }));
          sessionStorage.removeItem('playnex_draft_login');
          showServerMsg('login', 'Welcome, ' + (result.data.user.name || result.data.user.username) + '! Logged in successfully.', 'success');
          setTimeout(function () { window.location.href = 'homepage.html'; }, 1000);
        } else {
          localStorage.removeItem('playnex_user');
          showServerMsg('login', result.data.error, 'error');
        }
      })
      .catch(function () {
        localStorage.removeItem('playnex_user');
        showServerMsg('login', 'Network error. Please check your connection.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Log in';
      });
  });

  forgotForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessages();
    if (!validateForgot()) return;

    var payload = { email: document.getElementById('forgot-email').value.trim() };
    var btn = forgotForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        showServerMsg('forgot', result.data.message, 'success');
        sessionStorage.removeItem('playnex_draft_forgot');
        forgotForm.reset();
      })
      .catch(function () {
        showServerMsg('forgot', 'Network error. Please check your connection.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Send reset link';
      });
  });

  resetForm.addEventListener('submit', function (e) {
    e.preventDefault();
    clearMessages();
    if (!validateReset()) return;

    var payload = {
      token: document.getElementById('reset-token').value.trim(),
      password: document.getElementById('reset-password').value,
      confirmPassword: document.getElementById('reset-confirm').value
    };
    var btn = resetForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Resetting...';

    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json().then(function (data) { return { status: res.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 200) {
          showServerMsg('reset', result.data.message, 'success');
          resetForm.reset();
          setTimeout(function () {
            showForm(loginForm);
            switchToTab(0);
          }, 1500);
        } else {
          showServerMsg('reset', result.data.error, 'error');
        }
      })
      .catch(function () {
        showServerMsg('reset', 'Network error. Please check your connection.', 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Reset password';
      });
  });
})();
