document.addEventListener('DOMContentLoaded', async () => {
  const forumList = document.querySelector('.forum-list');
  const headerHtml = forumList.querySelector('.header').outerHTML;
  const searchInput = document.querySelector('.forum-toolbar__search');
  const typeFilter = document.querySelector('select[aria-label="Filter Type"]');
  const sortSelect = document.querySelector('select[aria-label="Sort By"]');

  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('playnex_user') || 'null');
  } catch (e) {}

  let threads = [];

  const createBtn = document.getElementById('create-thread-btn');
  if (createBtn && !currentUser) {
    createBtn.href = 'Login.html';
    createBtn.textContent = 'Log in to create a thread';
  }

  const canDelete = (thread) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return thread.authorId && String(thread.authorId) === String(currentUser.id);
  };

  const tagLabel = (tag) => {
    if (tag === 'support') return 'Technical Support';
    if (tag === 'review') return 'Product Review';
    if (tag === 'modding') return 'Modding & Development';
    return 'General Discussion';
  };

  const escapeHtml = (s) => {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const renderRows = () => {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const selectedType = typeFilter.value.toLowerCase();
    const sortBy = sortSelect.value;

    let visible = threads.filter((thread) => {
      const title = (thread.title || '').toLowerCase();
      const content = (thread.content || '').toLowerCase();
      const author = (thread.author || '').toLowerCase();
      const matchesSearch = !searchTerm || title.includes(searchTerm) || content.includes(searchTerm) || author.includes(searchTerm);
      const matchesType = !selectedType || (thread.tag || '').toLowerCase() === selectedType;
      return matchesSearch && matchesType;
    });

    const ts = (value) => {
      if (typeof value === 'number') return value;
      const parsed = Date.parse(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    visible = visible.slice().sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return ts(b.lastPostAt) - ts(a.lastPostAt);
        case 'oldest-activity':
          return ts(a.lastPostAt) - ts(b.lastPostAt);
        case 'newest-thread':
          return ts(b.createdAt) - ts(a.createdAt);
        case 'oldest-thread':
          return ts(a.createdAt) - ts(b.createdAt);
        case 'views':
          return (b.views || 0) - (a.views || 0);
        case 'replies':
          return (b.replies || 0) - (a.replies || 0);
        default:
          return ts(b.lastPostAt) - ts(a.lastPostAt);
      }
    });

    let htmlContent = headerHtml;

    visible.forEach((thread) => {
      const deleteHtml = canDelete(thread)
        ? `<button class="btn btn--outline btn--small delete-btn" data-id="${thread.id}" style="border-color:#e74c3c; color:#e74c3c; margin-top:8px; display:block;">Delete</button>`
        : '';

      htmlContent += `
        <div class="forum-row">
          <div class="forum-author">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(thread.author)}" alt="User avatar">
            <span>${escapeHtml(thread.author)}</span>
          </div>
          <div class="forum-thread-info">
            <h2><a href="forum-detail.html?id=${thread.id}">${escapeHtml(thread.title)}</a></h2>
          </div>
          <div><span class="forum-tag ${escapeHtml(thread.tagClass || 'tag--general')}">${escapeHtml(tagLabel(thread.tag))}</span></div>
          <div class="forum-stats">${thread.replies}</div>
          <div class="forum-stats">${thread.views}</div>
          <div class="forum-last-post">
            <strong>${escapeHtml(thread.lastPostAuthor)}</strong><br>
            ${escapeHtml(thread.lastPostTime)}
            ${deleteHtml}
          </div>
        </div>
      `;
    });

    forumList.innerHTML = htmlContent;
  };

  const loadThreads = async () => {
    try {
      const response = await fetch('/api/threads');
      threads = await response.json();
      renderRows();
    } catch (error) {
      console.error('Failed to load threads:', error);
    }
  };

  if (searchInput) searchInput.addEventListener('input', renderRows);
  if (typeFilter) typeFilter.addEventListener('change', renderRows);
  if (sortSelect) sortSelect.addEventListener('change', renderRows);

  forumList.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');

    if (deleteBtn) {
      const threadId = deleteBtn.getAttribute('data-id');
      const confirmed = confirm('Are you sure you want to delete this thread?');

      if (confirmed) {
        try {
          const res = await fetch(`/api/threads/${threadId}`, {
            method: 'DELETE',
            headers: currentUser ? { 'x-user-id': String(currentUser.id) } : {}
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Delete failed.');
          }
          loadThreads();
        } catch (error) {
          console.error('Failed to delete thread:', error);
        }
      }
    }
  });

  loadThreads();
});
