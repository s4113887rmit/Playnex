document.addEventListener('DOMContentLoaded', async () => {
  const forumList = document.querySelector('.forum-list');
  const headerHtml = forumList.querySelector('.header').outerHTML;

  // 1. Function to load and render threads
  const loadThreads = async () => {
    try {
      const response = await fetch('/api/threads');
      const threads = await response.json();

      let htmlContent = headerHtml;

      threads.forEach(thread => {
        htmlContent += `
          <div class="forum-row">
            <div class="forum-author">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${thread.author}" alt="User avatar">
              <span>${thread.author}</span>
            </div>
            <div class="forum-thread-info">
              <h2><a href="Forum-detail.html?id=${thread.id}">${thread.title}</a></h2>
            </div>
            <div><span class="forum-tag ${thread.tagClass}">${thread.tag}</span></div>
            <div class="forum-stats">${thread.replies}</div>
            <div class="forum-stats">${thread.views}</div>
            <div class="forum-last-post">
              <strong>${thread.lastPostAuthor}</strong><br>
              ${thread.lastPostTime}
              <button class="btn btn--outline btn--small delete-btn" data-id="${thread.id}" style="border-color:#e74c3c; color:#e74c3c; margin-top:8px; display:block;">Delete</button>
            </div>
          </div>
        `;
      });

      forumList.innerHTML = htmlContent;
    } catch (error) {
      console.error("Failed to load threads:", error);
    }
  };

  // 2. The Bulletproof Click Listener for Deleting
  forumList.addEventListener('click', async (e) => {
    // .closest() ensures we catch the click even if you click the text inside the button
    const deleteBtn = e.target.closest('.delete-btn'); 
    
    if (deleteBtn) {
      const threadId = deleteBtn.getAttribute('data-id');
      const confirmed = confirm("Are you sure you want to delete this thread?");
      
      if (confirmed) {
        try {
          await fetch(`/api/threads/${threadId}`, { method: 'DELETE' });
          // Reload the threads without refreshing the whole page
          loadThreads(); 
        } catch (error) {
          console.error("Failed to delete thread:", error);
        }
      }
    }
  });

  // 3. Initial load when the page opens
  loadThreads();
});