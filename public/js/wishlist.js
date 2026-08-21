/**
 * wishlist.js — Dynamic wishlist controller for Playnex.
 * Features:
 *   - Live client-side search, sort, and filtering (All / Digital / Physical / Purchased)
 *   - Dynamic saved-item count in the page header
 *   - Dynamic filter counts (All / Digital / Physical / Purchased)
 *   - Polished empty states (fully empty wishlist vs. no matches for a filter)
 *   - Move to cart, remove from wishlist
 *   - Dynamic "Recommended for you" shelf:
 *       * Prioritizes real games with images over placeholder items
 *       * Random order on each page refresh/load
 *       * Excludes items already in the user's wishlist
 *       * Clicking on any recommended item navigates to its description page
 *       * Wishlist button allows quick addition to wishlist
 *   - Total wishlist value displayed subtly below the grid
 *   - Seamless server & local synchronization scoped to current user.
 */
(function () {
  'use strict';

  const { api, showToast, requireLogin } = window.Playnex;

  const grid = document.querySelector('.wishlist-grid');
  const countHeader = document.querySelector('.page-header__count');
  const totalEl = document.getElementById('wishlist-total');
  const sortSelect = document.getElementById('wishlist-sort');
  const filterBtns = document.querySelectorAll('[data-wishlist-filter]');
  const countEls = document.querySelectorAll('[data-wishlist-count]');
  const recommendedGrid = document.getElementById('recommended-list') || document.querySelector('.shelf .shelf__row');

  let rawWishlistData = { items: [], totalCount: 0, savedCount: 0, totalValue: 0 };
  let allProducts = [];
  let currentFilter = 'all';

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function cardHTML(item) {
    const badgeText = item.category === 'physical' ? 'Physical' : 'Digital';
    const stats = item.stats || { wishlistCount: 1, cartCount: 0 };
    const detailUrl = item.href || `listing.html?game=${item.id}`;

    const actionButtons = `
      <button type="button" class="btn btn--primary btn--small" data-action="move-to-cart" data-id="${item.id}">Move to cart</button>
      <button type="button" class="btn btn--ghost btn--small" data-action="remove" data-id="${item.id}">Remove</button>`;

    const imgTag = item.image
      ? `<img src="${item.image}" alt="${item.title} poster">`
      : `<div class="card__placeholder-art">${item.title.charAt(0)}</div>`;

    return `
      <li>
        <article class="card wishlist-card" data-id="${item.id}">
          <div class="card__art ${item.art || 'card__art--1'} wishlist-card__art">
            <a href="${detailUrl}" aria-label="View ${item.title} details">
              ${imgTag}
            </a>
            <span class="card__badge${item.category === 'physical' ? ' card__badge--merch' : ''}">${badgeText}</span>
          </div>
          <div class="wishlist-card__body">
            <p class="wishlist-card__meta">${item.genre} · ${item.platform}</p>
            <h3 class="wishlist-card__title"><a href="${detailUrl}">${item.title}</a></h3>
            <p class="wishlist-card__price">${item.price === 0 ? 'Free' : money(item.price)}</p>

            <div class="wishlist-card__stats">
              <span>${stats.wishlistCount || 1} in wishlists</span> •
              <span>${stats.cartCount || 0} added to cart</span>
            </div>

            <div class="wishlist-card__actions">
              ${actionButtons}
            </div>
          </div>
        </article>
      </li>`;
  }

  function recommendedCardHTML(item) {
    const detailUrl = item.href || `listing.html?game=${item.id}`;
    const priceHTML = item.oldPrice
      ? `<span class="card__price-old">${money(item.oldPrice)}</span><span class="card__price-now">${money(item.price)}</span>`
      : `<span class="card__price-now">${item.price === 0 ? 'Free' : money(item.price)}</span>`;

    const badge = item.badge
      ? `<span class="card__badge${item.category === 'physical' ? ' card__badge--merch' : (item.badge === 'New' ? ' card__badge--new' : '')}">${item.badge}</span>`
      : (item.category === 'physical' ? '<span class="card__badge card__badge--merch">Physical</span>' : '');

    const imgTag = item.image
      ? `<img src="${item.image}" alt="${item.title} poster" loading="lazy">`
      : `<div class="card__placeholder-art">${item.title.charAt(0)}</div>`;

    return `
      <li>
        <article class="card recommended-card" data-id="${item.id}" data-href="${detailUrl}">
          <div class="card__art ${item.art || 'card__art--1'}">
            <a href="${detailUrl}" aria-label="View ${item.title} details">
              ${imgTag}
            </a>
            ${badge}
            <button class="card__wishlist" aria-label="Add ${item.title} to wishlist" type="button" data-action="add-to-wishlist" data-id="${item.id}">&hearts;</button>
          </div>
          <div class="card__body">
            <h3 class="card__title"><a href="${detailUrl}">${item.title}</a></h3>
            <p class="card__meta">${item.genre} · ${item.platform}</p>
            <div class="card__price">${priceHTML}</div>
          </div>
        </article>
      </li>`;
  }

  function emptyStateHTML() {
    const items = rawWishlistData.items || [];
    if (items.length === 0) {
      // Genuinely empty wishlist — full polished empty state
      return `
        <li class="wishlist-empty">
          <svg class="wishlist-empty__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20.5S3 14.9 3 8.9C3 5.9 5.4 3.5 8.4 3.5c1.7 0 3.3.8 4.3 2.1a5.3 5.3 0 0 1 4.3-2.1C20 3.5 21.5 5.9 21.5 8.9c0 6-9.5 11.6-9.5 11.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          </svg>
          <h2 class="wishlist-empty__title">Your wishlist is empty</h2>
          <p class="wishlist-empty__text">You haven't saved anything yet.<br>Find something you love and save it here.</p>
          <a href="shopping.html" class="btn btn--primary wishlist-empty__cta">Explore games &rarr;</a>
        </li>`;
    }
    // Wishlist has items but the selected filter matches none
    return `
      <li class="shelf-empty">
        No wishlist items found for the selected filter.
        <a href="shopping.html">Explore games & merchandise &rarr;</a>
      </li>`;
  }

  function getFilteredAndSortedItems() {
    let items = [...(rawWishlistData.items || [])];

    // Filter
    if (currentFilter === 'digital') {
      items = items.filter(i => i.category === 'digital');
    } else if (currentFilter === 'physical') {
      items = items.filter(i => i.category === 'physical');
    }

    // Sort
    const sortVal = sortSelect ? sortSelect.value : 'default';
    if (sortVal === 'title') {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortVal === 'price-asc') {
      items.sort((a, b) => a.price - b.price);
    } else if (sortVal === 'price-desc') {
      items.sort((a, b) => b.price - a.price);
    }

    return items;
  }

  function updateHeader() {
    const items = rawWishlistData.items || [];
    const savedCount = items.length;

    if (countHeader) {
      countHeader.textContent = `${savedCount} item${savedCount === 1 ? '' : 's'} saved`;
    }
  }

  function updateFilterCounts() {
    const items = rawWishlistData.items || [];
    const counts = {
      all: items.length,
      digital: items.filter(i => i.category === 'digital').length,
      physical: items.filter(i => i.category === 'physical').length
    };

    countEls.forEach(el => {
      const key = el.dataset.wishlistCount;
      if (key in counts) {
        el.textContent = counts[key];
      }
    });
  }

  function updateTotal() {
    const items = rawWishlistData.items || [];
    const totalValue = items.reduce((sum, p) => sum + p.price, 0);

    if (totalEl) {
      totalEl.textContent = items.length
        ? `Total wishlist value: ${money(totalValue)}`
        : '';
    }
  }

  function renderRecommended() {
    if (!recommendedGrid) return;

    const wishlistIds = new Set((rawWishlistData.items || []).map(item => item.id));

    // Exclude any game already in the user's wishlist
    // Prioritize real games with images over placeholder games without images
    const realGamesWithImages = allProducts.filter(p => {
      return p.image && p.image.trim() !== '' && !wishlistIds.has(p.id);
    });

    const otherProducts = allProducts.filter(p => {
      return (!p.image || p.image.trim() === '') && !wishlistIds.has(p.id);
    });

    // Randomize candidates on each refresh/render
    const shuffledReal = shuffle(realGamesWithImages);
    const shuffledOthers = shuffle(otherProducts);

    // Pick recommended items, prioritizing real games with images
    let recommendedList = shuffledReal.slice(0, 5);
    if (recommendedList.length < 5) {
      const needed = 5 - recommendedList.length;
      recommendedList = recommendedList.concat(shuffledOthers.slice(0, needed));
    }

    if (recommendedList.length === 0) {
      recommendedGrid.innerHTML = '<li class="shelf-empty">No recommended games available right now.</li>';
      return;
    }

    recommendedGrid.innerHTML = recommendedList.map(recommendedCardHTML).join('');
  }

  function render() {
    const displayItems = getFilteredAndSortedItems();

    if (grid) {
      grid.innerHTML = displayItems.length
        ? displayItems.map(cardHTML).join('')
        : emptyStateHTML();
    }

    updateHeader();
    updateFilterCounts();
    updateTotal();
    renderRecommended();
  }

  async function loadWishlist() {
    try {
      rawWishlistData = await api('/api/wishlist');
      render();
    } catch (err) {
      console.error('Error fetching wishlist:', err);
    }
  }

  async function init() {
    try {
      const [wishlistData, productsData] = await Promise.all([
        api('/api/wishlist').catch(() => ({ items: [], totalCount: 0, savedCount: 0, totalValue: 0 })),
        api('/api/products').catch(() => [])
      ]);
      rawWishlistData = wishlistData;
      allProducts = productsData;
      render();
    } catch (err) {
      console.error('Error initializing wishlist page:', err);
    }
  }

  // Filter tabs
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = btn.dataset.wishlistFilter;
      render();
    });
  });

  // Sort dropdown
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      render();
    });
  }

  // Action event delegation on wishlist grid
  if (grid) {
    grid.addEventListener('click', async (e) => {
      // 1. Move to cart
      const moveBtn = e.target.closest('[data-action="move-to-cart"]');
      if (moveBtn) {
        if (!requireLogin()) return;
        const productId = moveBtn.dataset.id;
        moveBtn.disabled = true;
        try {
          await api(`/api/wishlist/${productId}/move-to-cart`, { method: 'POST' });
          showToast('Moved item to cart!', 'success');
          await loadWishlist();
        } catch (err) {
          showToast(err.message, 'error');
          moveBtn.disabled = false;
        }
        return;
      }

      // 2. Remove from wishlist
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (removeBtn) {
        if (!requireLogin()) return;
        const productId = removeBtn.dataset.id;
        try {
          await api(`/api/wishlist/${productId}`, { method: 'DELETE' });
          showToast('Removed item from wishlist.', 'info');
          await loadWishlist();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }

  // Action event delegation on recommended shelf
  if (recommendedGrid) {
    recommendedGrid.addEventListener('click', async (e) => {
      // 1. Add to wishlist button on recommended card
      const wishBtn = e.target.closest('[data-action="add-to-wishlist"]');
      if (wishBtn) {
        e.stopPropagation();
        e.preventDefault();
        if (!requireLogin()) return;
        const productId = wishBtn.dataset.id;
        wishBtn.disabled = true;
        try {
          await api('/api/wishlist', {
            method: 'POST',
            body: { productId }
          });
          showToast('Added item to your wishlist!', 'info');
          await loadWishlist();
        } catch (err) {
          showToast(err.message, err.status === 409 ? 'info' : 'error');
          wishBtn.disabled = false;
        }
        return;
      }

      // 2. Click anywhere on recommended card -> navigate to description page
      const card = e.target.closest('.recommended-card');
      if (card && !e.target.closest('button') && !e.target.closest('a')) {
        const href = card.dataset.href;
        if (href) {
          window.location.href = href;
        }
      }
    });
  }

  init();
})();
