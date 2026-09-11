document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.admin-toolbar input');
  if (!searchInput) return;

  // The account rows are rendered by admin-render.js after this script runs, so
  // query them on each keystroke instead of caching them at load. Users who can
  // edit their own profile, such as a changed username, need no special casing
  // because the text is read from the live DOM.
  const filterRows = () => {
    const term = searchInput.value.trim().toLowerCase();
    const rows = document.querySelectorAll('.admin-row');

    rows.forEach((row) => {
      const info = row.querySelector('.account-info');
      const text = info ? info.textContent.toLowerCase() : '';
      row.style.display = !term || text.includes(term) ? 'flex' : 'none';
    });
  };

  searchInput.addEventListener('input', filterRows);
  // Re-apply the current filter whenever the dashboard re-renders its lists.
  const lists = document.querySelectorAll('.admin-list');
  lists.forEach((list) => {
    new MutationObserver(filterRows).observe(list, { childList: true });
  });
});
