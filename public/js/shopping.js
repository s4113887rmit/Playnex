/**
 * shopping.js — Dynamic filtering, searching, sorting, and pagination for shopping.html.
 */
(function () {
  'use strict';

  const { api, showToast, requireLogin } = window.Playnex;

  let allProducts = [];
  let wishlistIds = new Set();
  let filteredProducts = [];
  let appliedFilters = { platforms: [], genres: [], prices: [], availability: [] };
  let currentPage = 1;
  const itemsPerPage = 9;

  const grid = document.querySelector('.shop-grid');
  const countEl = document.querySelector('.page-header__count');
  const toolbarCountEl = document.querySelector('.shop-toolbar__count');
  const sortSelect = document.querySelector('.shop-toolbar .sort-select');
  const filterForm = document.querySelector('.filters form');
  const searchInput = document.getElementById('site-search');
  const categoryTabs = document.querySelectorAll('.tabs .tab');
  const paginationNav = document.querySelector('.pagination');

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function cardHTML(p) {
    const priceHTML = p.oldPrice
      ? `<span class="card__price-old">${money(p.oldPrice)}</span><span class="card__price-now">${money(p.price)}</span>`
      : `<span class="card__price-now">${p.price === 0 ? 'Free' : money(p.price)}</span>`;

    const badge = p.badge
      ? `<span class="card__badge${p.category === 'physical' ? ' card__badge--merch' : (p.badge === 'New' ? ' card__badge--new' : '')}">${p.badge}</span>`
      : (p.category === 'physical' ? '<span class="card__badge card__badge--merch">Physical</span>' : '');

    const imgTag = p.image
      ? `<img src="${p.image}" alt="${p.title} poster" loading="lazy">`
      : `<div class="card__placeholder-art">${p.title.charAt(0)}</div>`;

    const isSaved = wishlistIds.has(p.id);

    return `
      <li>
        <article class="card" data-id="${p.id}">
          <div class="card__art ${p.art || 'card__art--1'}">
            <a href="${p.href || 'shopping.html'}" aria-label="View ${p.title} detail page">
              ${imgTag}
            </a>
            ${badge}
            <button class="card__wishlist${isSaved ? ' is-saved' : ''}" aria-label="${isSaved ? 'Remove ' + p.title + ' from wishlist' : 'Add ' + p.title + ' to wishlist'}" type="button" data-action="wishlist" data-id="${p.id}">&hearts;</button>
          </div>
          <div class="card__body">
            <h3 class="card__title"><a href="${p.href || 'shopping.html'}">${p.title}</a></h3>
            <p class="card__meta">${p.genre} · ${p.platform}</p>
            <div class="card__price">${priceHTML}</div>
            <button type="button" class="btn btn--ghost btn--small card__add" data-action="add-to-cart" data-id="${p.id}">Add to cart</button>
          </div>
        </article>
      </li>`;
  }

  function getActiveCategory() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('cat') || 'all';
  }

  function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    if (searchInput && searchInput.value) return searchInput.value.trim().toLowerCase();
    return (urlParams.get('q') || '').trim().toLowerCase();
  }

  function getFormFilters() {
    if (!filterForm) return { platforms: [], genres: [], prices: [], availability: [] };

    const formData = new FormData(filterForm);
    return {
      platforms: formData.getAll('platform'),
      genres: formData.getAll('genre'),
      prices: formData.getAll('price'),
      availability: formData.getAll('availability')
    };
  }

  function filterAndSortProducts() {
    const activeCat = getActiveCategory();
    const query = getSearchQuery();
    const filters = appliedFilters;

    filteredProducts = allProducts.filter(p => {
      // Category filter
      if (activeCat === 'digital' && p.category !== 'digital') return false;
      if (activeCat === 'merch' && p.category !== 'physical') return false;
      if (activeCat === 'deals' && (!p.oldPrice || p.oldPrice <= p.price)) return false;
      if (activeCat === 'free' && p.price > 0) return false;

      // Search query
      if (query) {
        const text = `${p.title} ${p.genre} ${p.platform} ${p.category}`.toLowerCase();
        if (!text.includes(query)) return false;
      }

      // Platform filter
      if (filters.platforms.length > 0) {
        const matchesPlatform = filters.platforms.some(plat => {
          if (plat === 'pc') return p.platform.toLowerCase().includes('pc');
          if (plat === 'console') return p.platform.toLowerCase().includes('console');
          return true;
        });
        if (!matchesPlatform) return false;
      }

      // Genre filter
      if (filters.genres.length > 0) {
        const matchesGenre = filters.genres.some(g => p.genre.toLowerCase() === g.toLowerCase());
        if (!matchesGenre) return false;
      }

      // Price filter
      if (filters.prices.length > 0) {
        const matchesPrice = filters.prices.some(pr => {
          if (pr === 'under-25') return p.price < 25;
          if (pr === '25-50') return p.price >= 25 && p.price <= 50;
          if (pr === 'over-50') return p.price > 50;
          return true;
        });
        if (!matchesPrice) return false;
      }

      // Availability filter
      if (filters.availability.length > 0) {
        const matchesAvail = filters.availability.some(a => (p.availability || 'in-stock') === a);
        if (!matchesAvail) return false;
      }

      return true;
    });

    // Sorting
    const sortVal = sortSelect ? sortSelect.value : 'relevance';
    if (sortVal.includes('low to high') || sortVal === 'price-asc') {
      filteredProducts.sort((a, b) => a.price - b.price);
    } else if (sortVal.includes('high to low') || sortVal === 'price-desc') {
      filteredProducts.sort((a, b) => b.price - a.price);
    } else if (sortVal.includes('Newest') || sortVal === 'newest') {
      filteredProducts.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    }

    render();
  }

  function render() {
    const total = filteredProducts.length;
    const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
    if (currentPage > totalPages) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, total);
    const pageItems = filteredProducts.slice(startIdx, endIdx);

    // Update counts
    if (countEl) countEl.textContent = `${total} item${total === 1 ? '' : 's'}`;
    if (toolbarCountEl) {
      toolbarCountEl.textContent = total > 0
        ? `Showing ${startIdx + 1}–${endIdx} of ${total}`
        : '0 items found';
    }

    // Render Grid
    if (grid) {
      grid.innerHTML = pageItems.length
        ? pageItems.map(cardHTML).join('')
        : '<li class="shelf-empty">No products match your selected filters. Try broadening your criteria.</li>';
    }

    // Render Pagination
    if (paginationNav) {
      if (totalPages <= 1) {
        paginationNav.innerHTML = '';
      } else {
        let pagesHTML = '';
        for (let i = 1; i <= totalPages; i++) {
          pagesHTML += `<a href="#page-${i}" class="${i === currentPage ? 'is-active' : ''}" data-page="${i}">${i}</a>`;
        }
        if (currentPage < totalPages) {
          pagesHTML += `<a href="#page-${currentPage + 1}" class="pagination__next" data-page="${currentPage + 1}">Next</a>`;
        }
        paginationNav.innerHTML = pagesHTML;
      }
    }
  }

  async function loadCatalogue() {
    try {
      const [productsData, wishlistData] = await Promise.all([
        api('/api/products'),
        api('/api/wishlist').catch(() => ({ items: [] }))
      ]);
      allProducts = productsData;
      wishlistIds = new Set((wishlistData.items || []).map(item => item.id));

      // Sync initial search from URL query
      const urlParams = new URLSearchParams(window.location.search);
      if (searchInput && urlParams.get('q')) {
        searchInput.value = urlParams.get('q');
      }

      // Sync active category tab
      const cat = urlParams.get('cat');
      if (categoryTabs) {
        categoryTabs.forEach(tab => {
          const href = tab.getAttribute('href');
          const isCatMatch = (cat && href.includes(`cat=${cat}`)) || (!cat && href === 'shopping.html');
          tab.classList.toggle('is-active', isCatMatch);
        });
      }

      filterAndSortProducts();
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  async function refreshWishlist() {
    try {
      const wishlistData = await api('/api/wishlist').catch(() => ({ items: [] }));
      wishlistIds = new Set((wishlistData.items || []).map(item => item.id));
      document.querySelectorAll('[data-action="wishlist"]').forEach(btn => {
        const id = btn.dataset.id;
        if (id) {
          btn.classList.toggle('is-saved', wishlistIds.has(id));
        }
      });
    } catch {}
  }

  window.addEventListener('pageshow', refreshWishlist);
  window.addEventListener('focus', refreshWishlist);

  // Filter Form listeners
  if (filterForm) {
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      appliedFilters = getFormFilters();
      currentPage = 1;
      filterAndSortProducts();
    });

    filterForm.addEventListener('reset', () => {
      setTimeout(() => {
        appliedFilters = { platforms: [], genres: [], prices: [], availability: [] };
        currentPage = 1;
        filterAndSortProducts();
      }, 10);
    });
  }

  // Live Search listener
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentPage = 1;
      filterAndSortProducts();
    });
  }

  // Sort listener
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      filterAndSortProducts();
    });
  }

  // Pagination listener
  if (paginationNav) {
    paginationNav.addEventListener('click', (e) => {
      const pageLink = e.target.closest('[data-page]');
      if (pageLink) {
        e.preventDefault();
        currentPage = parseInt(pageLink.dataset.page, 10);
        render();
        window.scrollTo({ top: 150, behavior: 'smooth' });
      }
    });
  }

  // Add to cart & wishlist handlers
  document.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-action="add-to-cart"]');
    if (addBtn) {
      if (!requireLogin()) return;
      const productId = addBtn.dataset.id;
      addBtn.disabled = true;
      const originalText = addBtn.textContent;
      try {
        await api('/api/cart', {
          method: 'POST',
          body: { productId, qty: 1 }
        });
        addBtn.textContent = 'Added ✓';
        showToast('Added item to your cart!', 'success');
        setTimeout(() => {
          addBtn.textContent = originalText;
          addBtn.disabled = false;
        }, 1200);
      } catch (err) {
        showToast(err.message, 'error');
        addBtn.disabled = false;
      }
      return;
    }

    const wishBtn = e.target.closest('[data-action="wishlist"]');
    if (wishBtn) {
      if (!requireLogin()) return;
      const productId = wishBtn.dataset.id;
      if (!productId) return;
      wishBtn.disabled = true;

      const isAlreadySaved = wishBtn.classList.contains('is-saved') || wishlistIds.has(productId);

      if (isAlreadySaved) {
        try {
          await api(`/api/wishlist/${productId}`, {
            method: 'DELETE'
          });
          wishlistIds.delete(productId);
          document.querySelectorAll(`[data-action="wishlist"][data-id="${productId}"]`).forEach(btn => {
            btn.classList.remove('is-saved');
          });
          showToast('Removed item from your wishlist.', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          wishBtn.disabled = false;
        }
      } else {
        try {
          await api('/api/wishlist', {
            method: 'POST',
            body: { productId }
          });
          wishlistIds.add(productId);
          document.querySelectorAll(`[data-action="wishlist"][data-id="${productId}"]`).forEach(btn => {
            btn.classList.add('is-saved');
          });
          showToast('Added item to your wishlist!', 'success');
        } catch (err) {
          showToast(err.message, err.status === 409 ? 'info' : 'error');
        } finally {
          wishBtn.disabled = false;
        }
      }
      return;
    }
  });

  loadCatalogue();
})();
