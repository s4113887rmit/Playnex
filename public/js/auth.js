(function () {
  'use strict';

  localStorage.removeItem('playnex_user');

  var tabs = document.querySelectorAll('.auth-tab');
  var loginForm = document.getElementById('login-form');
  var forgotForm = document.getElementById('forgot-form');
  var signupForm = document.getElementById('signup-form');
  var descField = document.getElementById('signup-description');
  var charCount = document.getElementById('desc-char-count');
  var fileInput = document.getElementById('signup-picture');
  var fileName = document.getElementById('file-name');
  var showForgot = document.getElementById('show-forgot');
  var backToLogin = document.getElementById('back-to-login');

  descField.addEventListener('input', function () {
    charCount.textContent = descField.value.length;
  });

  fileInput.addEventListener('change', function () {
    fileName.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file chosen';
  });

  function showForm(form) {
    [loginForm, forgotForm, signupForm].forEach(function (f) { f.classList.add('is-hidden'); });
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
    if (el) el.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = message;
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
          showServerMsg('login', 'Welcome, ' + (result.data.user.name || result.data.user.username) + '! Logged in successfully.', 'success');
          setTimeout(function () { window.location.href = 'index.html'; }, 1000);
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
})();
