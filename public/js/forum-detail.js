document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const threadId = urlParams.get('id');

  const container = document.getElementById('thread-detail-container');
  const replySection = document.getElementById('reply-form-section');
  const loginCta = document.getElementById('login-cta');
  const replyForm = document.getElementById('reply-form');
  const replyContent = document.getElementById('reply-content');
  const replyCharCount = document.getElementById('reply-char-count');
  const replyMsg = document.getElementById('reply-server-msg');

  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('playnex_user') || 'null');
  } catch (e) {}

  if (!threadId || !container) return;

  const getHeaders = (extra) => {
    const h = extra || {};
    if (currentUser && currentUser.id) h['x-user-id'] = String(currentUser.id);
    return h;
  };

  const canManage = (authorId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return authorId && String(authorId) === String(currentUser.id);
  };

  const escapeHtml = (s) => {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const postTemplate = (post, isMain) => {
    const manageHtml = canManage(post.authorId)
      ? `<button class="btn btn--outline btn--small post-edit-btn" data-id="${escapeHtml(post.id)}" data-main="${isMain ? '1' : '0'}">Edit</button>
         <button class="btn btn--outline btn--small post-delete-btn" data-id="${escapeHtml(post.id)}" data-main="${isMain ? '1' : '0'}" style="border-color:#e74c3c;color:#e74c3c;">Delete</button>`
      : '';

    return `
      <article class="thread-post-card" data-post-id="${escapeHtml(post.id)}" data-main="${isMain ? '1' : '0'}">
        <div class="thread-post-sidebar">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(post.author)}" alt="User avatar">
          <h2>${escapeHtml(post.author)}</h2>
          <p>${escapeHtml(post.timeAgo || '')}</p>
        </div>
        <div class="thread-post-content">
          <div class="thread-post-body">${escapeHtml(post.content)}</div>
          <div class="thread-post-actions">${manageHtml}</div>
        </div>
      </article>`;
  };

  const renderThread = (thread) => {
    const replyCount = (thread.posts || []).length;

    let html = `
      <div class="thread-header">
        <h1>${escapeHtml(thread.title)}</h1>
        <p class="thread-meta">Posted by ${escapeHtml(thread.author)} · ${escapeHtml(thread.lastPostTime)} · ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</p>
      </div>
      ${postTemplate({ id: 'main', author: thread.author, authorId: thread.authorId, content: thread.content, timeAgo: thread.lastPostTime }, true)}
    `;

    (thread.posts || []).forEach((p) => {
      html += `<div class="reply-thread">${postTemplate(p, false)}</div>`;
    });

    container.innerHTML = html;
  };

  const loadThread = async () => {
    try {
      const res = await fetch(`/api/threads/${threadId}`, { headers: getHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        container.innerHTML = `<p class="thread-loading">${escapeHtml(err.error || 'Thread not found.')}</p>`;
        return;
      }
      const thread = await res.json();
      renderThread(thread);
    } catch (error) {
      container.innerHTML = '<p class="thread-loading">Failed to load thread. Check that the server is running.</p>';
    }
  };

  const setupReplyForm = () => {
    if (currentUser) {
      replySection.hidden = false;
    } else {
      loginCta.hidden = false;
      return;
    }

    const draftKey = 'playnex_draft_reply_' + threadId;
    try {
      const draft = sessionStorage.getItem(draftKey);
      if (draft) {
        replyContent.value = draft;
        replyCharCount.textContent = draft.length;
      }
    } catch (e) {}

    replyContent.addEventListener('input', () => {
      const len = replyContent.value.trim().length;
      replyCharCount.textContent = replyContent.value.length;
      showReplyError(len > 2000 ? 'Reply content must be at most 2000 characters' : '');
      try { sessionStorage.setItem(draftKey, replyContent.value); } catch (e) {}
    });

    replyContent.addEventListener('blur', () => {
      if (!replyContent.value.trim()) showReplyError('Reply content is required');
    });

    replyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      replyMsg.textContent = '';
      const content = replyContent.value.trim();
      if (!content) { showReplyError('Reply content is required'); return; }
      if (content.length > 2000) { showReplyError('Reply content must be at most 2000 characters'); return; }

      const btn = replyForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Posting...';

      try {
        const res = await fetch(`/api/threads/${threadId}/replies`, {
          method: 'POST',
          headers: getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ content })
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          try { sessionStorage.removeItem(draftKey); } catch (e) {}
          replyContent.value = '';
          replyCharCount.textContent = '0';
          replyMsg.textContent = data.message;
          replyMsg.className = 'auth-server-msg is-success';
          await loadThread();
        } else {
          replyMsg.textContent = data.error || 'Failed to post reply.';
          replyMsg.className = 'auth-server-msg is-error';
        }
      } catch (err) {
        replyMsg.textContent = 'Network error. Check that the server is running.';
        replyMsg.className = 'auth-server-msg is-error';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Post reply';
      }
    });
  };

  const showReplyError = (message) => {
    const el = document.getElementById('reply-content-error');
    if (el) el.textContent = message || '';
    if (message) replyContent.classList.add('is-invalid');
    else replyContent.classList.remove('is-invalid');
  };

  const startEdit = (article, postId, isMain) => {
    if (article.querySelector('.post-edit-area')) return;
    const body = article.querySelector('.thread-post-body');
    const original = body.textContent;
    body.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.className = 'post-edit-area';
    textarea.rows = 5;
    textarea.value = original;
    body.appendChild(textarea);

    const actions = article.querySelector('.thread-post-actions');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary btn--small';
    saveBtn.textContent = 'Save';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost btn--small';
    cancelBtn.textContent = 'Cancel';

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    const stopEdit = () => {
      body.textContent = original;
      cancelBtn.remove();
      saveBtn.remove();
    };

    cancelBtn.addEventListener('click', stopEdit);

    saveBtn.addEventListener('click', async () => {
      const value = textarea.value.trim();
      if (!value) {
        textarea.classList.add('is-invalid');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const url = isMain ? `/api/threads/${threadId}` : `/api/threads/${threadId}/replies/${postId}`;
      const payload = isMain
        ? { title: document.querySelector('.thread-header h1').textContent, content: value }
        : { content: value };

      try {
        const res = await fetch(url, {
          method: 'PUT',
          headers: getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          await loadThread();
        } else {
          alert(data.error || 'Update failed.');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
        }
      } catch (err) {
        alert('Network error. Check that the server is running.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });
  };

  container.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.post-edit-btn');
    if (editBtn) {
      const postId = editBtn.getAttribute('data-id');
      const isMain = editBtn.getAttribute('data-main') === '1';
      const article = editBtn.closest('.thread-post-card');
      startEdit(article, postId, isMain);
      return;
    }

    const deleteBtn = e.target.closest('.post-delete-btn');
    if (deleteBtn) {
      const postId = deleteBtn.getAttribute('data-id');
      const isMain = deleteBtn.getAttribute('data-main') === '1';
      const confirmed = confirm(isMain ? 'Are you sure you want to delete this thread?' : 'Are you sure you want to delete this reply?');
      if (!confirmed) return;

      const url = isMain ? `/api/threads/${threadId}` : `/api/threads/${threadId}/replies/${postId}`;
      try {
        const res = await fetch(url, { method: 'DELETE', headers: getHeaders() });
        if (res.ok) {
          if (isMain) {
            window.location.href = 'forum.html';
            return;
          }
          await loadThread();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error || 'Delete failed.');
        }
      } catch (err) {
        alert('Network error. Check that the server is running.');
      }
    }
  });

  setupReplyForm();
  await loadThread();
});
