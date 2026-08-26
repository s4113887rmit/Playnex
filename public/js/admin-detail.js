document.addEventListener('DOMContentLoaded', () => {
  const getAuthHeaders = () => {
    try {
      const user = JSON.parse(localStorage.getItem('playnex_user') || 'null');
      return user && user.id ? { 'x-user-id': String(user.id) } : {};
    } catch (e) {
      return {};
    }
  };

  // Read which user we are viewing from the URL (?id=...)
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('id');

  const avatarEl = document.getElementById('admin-profile-avatar');
  const nameEl = document.getElementById('admin-profile-name');
  const metaEl = document.getElementById('admin-profile-meta');
  const bioEl = document.getElementById('admin-profile-bio');
  const bioTextEl = document.getElementById('admin-profile-bio-text');
  const lockBtn = document.getElementById('admin-profile-lock-btn');

  const updateLockButton = (user) => {
    lockBtn.style.display = '';
    lockBtn.dataset.id = user.id;
    if (user.status === 'locked') {
      lockBtn.textContent = 'Unlock Account';
      lockBtn.classList.remove('btn--danger');
      lockBtn.classList.add('btn--success');
    } else {
      lockBtn.textContent = 'Lock Account';
      lockBtn.classList.remove('btn--success');
      lockBtn.classList.add('btn--danger');
    }
  };

  const renderUser = (user) => {
    avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}`;
    nameEl.textContent = user.username;
    const joined = user.joined || user.lockedDate || 'Unknown';
    metaEl.innerHTML = `Joined: ${joined}<br>User ID: #PLX-${String(user.id).padStart(5, '0')}`;
    if (user.bio) {
      bioTextEl.textContent = user.bio;
      bioEl.style.display = 'block';
    } else {
      bioEl.style.display = 'none';
    }
    updateLockButton(user);
  };

  const loadUser = async () => {
    if (!userId) {
      nameEl.textContent = 'No user selected';
      metaEl.innerHTML = 'Return to the admin dashboard and choose a user.';
      lockBtn.style.display = 'none';
      return;
    }
    try {
      const response = await fetch(`/api/users/${userId}`, { headers: getAuthHeaders() });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        nameEl.textContent = 'User not found';
        metaEl.textContent = err.error || 'Could not load this user.';
        lockBtn.style.display = 'none';
        return;
      }
      renderUser(await response.json());
    } catch (error) {
      console.error('Failed to load user', error);
      nameEl.textContent = 'Error';
      metaEl.textContent = 'Could not load this user.';
    }
  };

  // Lock / unlock the account shown on this page
  lockBtn.addEventListener('click', async () => {
    const id = lockBtn.dataset.id;
    if (!id) return;
    const res = await fetch(`/api/users/${id}/toggle-lock`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Action failed.');
      return;
    }
    const data = await res.json();
    updateLockButton(data.user);
    alert(`User status successfully updated to ${data.user.status}.`);
  });

  // Mark a flag as resolved
  const resolveBtn = document.querySelector('.resolve-flag-btn');
  if (resolveBtn) {
    resolveBtn.addEventListener('click', () => {
      const row = resolveBtn.closest('.flag-row');
      const strong = row.querySelector('.flag-info strong');
      const span = row.querySelector('.flag-info span');
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

      row.classList.add('flag-resolved');
      strong.classList.add('flag-resolved-title');
      span.textContent = `Resolved on ${today}`;
      resolveBtn.classList.remove('btn--outline');
      resolveBtn.classList.add('btn--ghost');
      resolveBtn.disabled = true;
      resolveBtn.textContent = 'Resolved';
    });
  }

  // ---- Warning form logic (unchanged) ----
  const warningInput = document.querySelector('.warning-box textarea');
  const submitBtn = document.querySelector('.btn--warning-finalize');

  const validateWarning = () => {
    let errorSpan = warningInput.nextElementSibling;

    if (!errorSpan || !errorSpan.classList.contains('error-msg')) {
      errorSpan = document.createElement('span');
      errorSpan.classList.add('error-msg');
      errorSpan.style.color = '#e74c3c';
      errorSpan.style.fontSize = '12px';
      errorSpan.style.display = 'block';
      errorSpan.style.marginTop = '8px';
      warningInput.parentNode.insertBefore(errorSpan, warningInput.nextSibling);
    }

    if (warningInput.value.trim() === '') {
      warningInput.style.borderColor = '#e74c3c';
      errorSpan.textContent = 'Warning message cannot be empty.';
      return false;
    } else {
      warningInput.style.borderColor = 'var(--border)';
      errorSpan.textContent = '';
      return true;
    }
  };

  warningInput.addEventListener('input', validateWarning);

  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (validateWarning()) {
      alert('Warning finalized and sent to user.');
      warningInput.value = '';
    }
  });

  loadUser();
});