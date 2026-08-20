document.addEventListener('DOMContentLoaded', async () => {
  // Grab the ID from the URL (e.g., ?id=1)
  const urlParams = new URLSearchParams(window.location.search);
  const threadId = urlParams.get('id');

  if (!threadId) return;

  try {
    const response = await fetch(`/api/threads/${threadId}`);
    const thread = await response.json();

    // Inject the exact thread data into your HTML classes
    document.querySelector('.thread-header h1').textContent = thread.title;
    document.querySelector('.post-sidebar h4').textContent = thread.author;
    document.querySelector('.post-content-body').innerHTML = `<p>${thread.content || "No content provided."}</p>`;

  } catch (error) {
    console.error("Failed to load thread details.");
  }
});