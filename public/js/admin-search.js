document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.admin-toolbar input');
  const userRows = document.querySelectorAll('.admin-row');

  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();

    userRows.forEach(row => {
      // Look at the username and the details paragraph for matches
      const username = row.querySelector('.account-info h3').textContent.toLowerCase();
      const details = row.querySelector('.account-info p').textContent.toLowerCase();

      // Toggle visibility based on whether the search term is found
      if (username.includes(searchTerm) || details.includes(searchTerm)) {
        row.style.display = 'flex';
      } else {
        row.style.display = 'none';
      }
    });
  });
});