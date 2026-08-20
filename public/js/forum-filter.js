document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.forum-toolbar__search');
  const categoryFilter = document.querySelector('select[aria-label="Filter Category"]');
  const typeFilter = document.querySelector('select[aria-label="Filter Type"]');
  const sortSelect = document.querySelector('select[aria-label="Sort By"]');
  
  const forumList = document.querySelector('.forum-list');
  // Grab all rows except the header
  const threadRows = Array.from(document.querySelectorAll('.forum-row:not(.header)'));

  function updateForumDisplay() {
    const searchTerm = searchInput.value.toLowerCase();
    const selectedCategory = categoryFilter.value.toLowerCase();
    const selectedType = typeFilter.value.toLowerCase();

    // 1. Filter the rows
    let visibleRows = threadRows.filter(row => {
      const title = row.querySelector('.forum-thread-info h2').textContent.toLowerCase();
      const tag = row.querySelector('.forum-tag').textContent.toLowerCase();
      
      const matchesSearch = title.includes(searchTerm);
      
      // Determine type based on the tag text
      let rowType = "";
      if (tag.includes('review')) rowType = 'review';
      if (tag.includes('support')) rowType = 'support';
      
      const matchesType = (selectedType === "" || rowType === selectedType);
      
      // Since specific game category tags aren't fully fleshed out in the HTML yet, 
      // we'll filter broadly or pass it if empty
      const matchesCategory = (selectedCategory === "" || title.includes(selectedCategory));

      return matchesSearch && matchesType && matchesCategory;
    });

    // 2. Sort the visible rows
    visibleRows.sort((a, b) => {
      const statsA = a.querySelectorAll('.forum-stats');
      const statsB = b.querySelectorAll('.forum-stats');
      
      // Parse numbers (e.g., converting "1.2k" to 1200)
      const parseStat = (text) => {
        let num = parseFloat(text);
        if (text.includes('k')) num *= 1000;
        return num;
      };

      const repliesA = parseStat(statsA[0].textContent);
      const repliesB = parseStat(statsB[0].textContent);
      const viewsA = parseStat(statsA[1].textContent);
      const viewsB = parseStat(statsB[1].textContent);

      if (sortSelect.value === 'replies') {
        return repliesB - repliesA; // Highest first
      } else if (sortSelect.value === 'views') {
        return viewsB - viewsA; // Highest first
      }
      return 0; // Default (Recent - relies on original HTML order)
    });

    // 3. Re-render the DOM
    // Clear out existing rows (keeping the header)
    const header = document.querySelector('.forum-row.header');
    forumList.innerHTML = '';
    forumList.appendChild(header);

    // Append the newly filtered and sorted rows, or hide them if they don't match
    threadRows.forEach(row => row.style.display = 'none'); // Hide all initially
    visibleRows.forEach(row => {
      row.style.display = 'grid'; // The CSS uses grid for these rows
      forumList.appendChild(row);
    });
  }

  // Attach event listeners to trigger the update function whenever the user interacts
  searchInput.addEventListener('input', updateForumDisplay);
  categoryFilter.addEventListener('change', updateForumDisplay);
  typeFilter.addEventListener('change', updateForumDisplay);
  sortSelect.addEventListener('change', updateForumDisplay);
});