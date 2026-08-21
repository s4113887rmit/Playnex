document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('playnex_user') || 'null');
  } catch (e) {}
  if (!currentUser) {
    window.location.href = 'Login.html';
    return;
  }

  const form = document.querySelector('.create-form');
  const titleInput = document.getElementById('thread-title');
  const gameInput = document.getElementById('game-selector');
  const categoryInput = document.getElementById('category');
  const contentInput = document.getElementById('post-content');

  // 1. Load saved drafts from localStorage when the page loads
  if (localStorage.getItem('draftTitle')) titleInput.value = localStorage.getItem('draftTitle');
  if (localStorage.getItem('draftGame')) gameInput.value = localStorage.getItem('draftGame');
  if (localStorage.getItem('draftCategory')) categoryInput.value = localStorage.getItem('draftCategory');
  if (localStorage.getItem('draftContent')) contentInput.value = localStorage.getItem('draftContent');

  // 2. Auto-save to localStorage as the user types or selects options
  form.addEventListener('input', (e) => {
    if (e.target.id === 'thread-title') localStorage.setItem('draftTitle', e.target.value);
    if (e.target.id === 'game-selector') localStorage.setItem('draftGame', e.target.value);
    if (e.target.id === 'category') localStorage.setItem('draftCategory', e.target.value);
    if (e.target.id === 'post-content') localStorage.setItem('draftContent', e.target.value);
  });

  // 3. Live Form Validation (Visual Feedback)
  const validateField = (field, errorMessage) => {
    let errorSpan = field.nextElementSibling;
    if (!errorSpan || !errorSpan.classList.contains('error-msg')) {
      errorSpan = document.createElement('span');
      errorSpan.classList.add('error-msg');
      errorSpan.style.color = '#e74c3c';
      errorSpan.style.fontSize = '12px';
      errorSpan.style.marginTop = '4px';
      field.parentNode.insertBefore(errorSpan, field.nextSibling);
    }
    
    if (field.value.trim() === '') {
      field.style.borderColor = '#e74c3c';
      errorSpan.textContent = errorMessage;
      return false;
    } else {
      field.style.borderColor = 'var(--border)';
      errorSpan.textContent = '';
      return true;
    }
  };

  titleInput.addEventListener('input', () => validateField(titleInput, 'A thread title is required.'));
  contentInput.addEventListener('input', () => validateField(contentInput, 'Please enter your post content.'));

  // 4. Prevent submission if invalid, OR clear storage if successful
  // 4. Prevent submission if invalid, OR send data to backend if successful
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop the default page reload

    const isTitleValid = validateField(titleInput, 'A thread title is required.');
    const isContentValid = validateField(contentInput, 'Please enter your post content.');

    if (isTitleValid && isContentValid) {
      // Gather the data from the form
      const threadData = {
        title: titleInput.value,
        game: gameInput.value,
        category: categoryInput.value,
        content: contentInput.value
      };

      try {
        // Send the data to your new POST route
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': String(currentUser.id)
          },
          body: JSON.stringify(threadData)
        });

        if (response.ok) {
          // Clear the saved draft because the post was successfully submitted
          localStorage.removeItem('draftTitle');
          localStorage.removeItem('draftGame');
          localStorage.removeItem('draftCategory');
          localStorage.removeItem('draftContent');

          // Redirect the user back to the main forum page to see their new post
          window.location.href = 'forum.html';
        } else {
          const errorData = await response.json();
          alert(`Error: ${errorData.error}`);
        }
      } catch (error) {
        console.error("Failed to create thread:", error);
        alert("Failed to connect to the server.");
      }
    }
  });
});