document.addEventListener('DOMContentLoaded', () => {
  const normalList = document.querySelectorAll('.admin-list')[0];
  const lockedList = document.querySelectorAll('.admin-list')[1];

  // Function to fetch and render users
  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      
      normalList.innerHTML = ''; 
      lockedList.innerHTML = '';

      users.forEach(user => {
        if (user.status === 'normal') {
          normalList.innerHTML += `
            <div class="admin-row">
              <input type="checkbox" aria-label="Select user">
              <div class="account-profile">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}" alt="Avatar">
                <div class="account-info">
                  <h4>${user.username}</h4>
                  <p>Joined: ${user.joined} · ${user.flags}</p>
                </div>
              </div>
              <div class="admin-actions">
                <button class="btn btn--danger btn--small toggle-lock-btn" data-id="${user.id}">Lock account</button>
              </div>
            </div>`;
        } else {
          lockedList.innerHTML += `
            <div class="admin-row">
              <input type="checkbox" aria-label="Select user">
              <div class="account-profile">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatarSeed}" alt="Avatar" style="opacity:0.5;">
                <div class="account-info">
                  <h4>${user.username}</h4>
                  <p>Locked: ${user.lockedDate} · Reason: ${user.reason}</p>
                </div>
              </div>
              <div class="admin-actions">
                <button class="btn btn--success btn--small toggle-lock-btn" data-id="${user.id}">Unlock account</button>
              </div>
            </div>`;
        }
      });
    } catch (error) {
      console.error("Failed to load users", error);
    }
  };

  // Listen for clicks on the lock/unlock buttons
  const handleToggle = async (e) => {
    if (e.target.classList.contains('toggle-lock-btn')) {
      const userId = e.target.getAttribute('data-id');
      await fetch(`/api/users/${userId}/toggle-lock`, { method: 'POST' });
      loadUsers(); // Instantly refresh the UI!
    }
  };

  normalList.addEventListener('click', handleToggle);
  lockedList.addEventListener('click', handleToggle);

  loadUsers(); // Initial load
});