/**
 * wishlist.js — Dynamic wishlist controller for Playnex.
 * Features:
 *   - Live client-side search, sort, and filtering (All / Digital / Physical / Purchased)
 *   - Displays detailed item statistics (wishlisted count, in-cart count, bought count)
 *   - Move to cart, remove, mark purchased, buy again
 *   - Seamless server & local synchronization scoped to current user.
 */
(function () {
  'use strict';

  const { api, showToast } = window.Playnex;

  const grid = document.querySelector('.wishlist-grid');
  const countHeader = document.querySelector('.page-header__count');
  const summarySaved = document.querySelector('.wishlist-summary span:nth-child(1)');
  const summaryValue = document.querySelector('.wishlist-summary span:nth-child(2)');
  const summaryPurchased = document.querySelector('.wishlist-summary span:nth-child(3)');
  const sortSelect = document.getElementById('wishlist-sort');
  const filterBtns = document.querySelectorAll('[data-wishlist-filter]');

  let rawWishlistData = { items: [], totalCount: 0, savedCount: 0, purchasedCount: 0, totalValue: 0 };
  let currentFilter = 'all';

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function cardHTML(item) {
    const isPurchased = !!item.purchased;
    const badgeText = item.category === 'physical' ? 'Physical' : 'Digital';
    const purchasedTag = isPurchased ? '<span class="wishlist-card__purchased-tag">Purchased</span>' : '';
    
    const stats = item.stats || { wishlistCount: 1, cartCount: 0, purchasedCount: 0 };

    const actionButtons = isPurchased
      ? `<button type="button" class="btn btn--ghost btn--small" data-action="buy-again" data-id="${item.id}">Buy again</button>
         <button type="button" class="btn btn--ghost btn--small" data-action="remove" data-id="${item.id}">Remove</button>`
      : `<button type="button" class="btn btn--primary btn--small" data-action="move-to-cart" data-id="${item.id}">Move to cart</button>
         <button type="button" class="btn btn--ghost btn--small" data-action="mark-purchased" data-id="${item.id}">Mark purchased</button>
         <button type="button" class="btn btn--ghost btn--small" data-action="remove" data-id="${item.id}">Remove</button>`;

    const imgTag = item.image
      ? `<img src="${item.image}" alt="${item.title} poster">`
      : `<div class="card__placeholder-art">${item.title.charAt(0)}</div>`;

    return `
      <li>
        <article class="wishlist-card ${isPurchased ? 'is-purchased' : ''}" data-id="${item.id}">
          <div class="card__art ${item.art || 'card__art--1'} wishlist-card__art">
            <a href="${item.href || 'shopping.html'}" aria-label="View ${item.title} details">
              ${imgTag}
            </a>
            <span class="card__badge${item.category === 'physical' ? ' card__badge--merch' : ''}">${badgeText}</span>
            ${purchasedTag}
          </div>
          <div class="wishlist-card__body">
            <p class="wishlist-card__meta">${item.genre} · ${item.platform}</p>
            <h3 class="wishlist-card__title"><a href="${item.href || 'shopping.html'}">${item.title}</a></h3>
            <p class="wishlist-card__price">${item.price === 0 ? 'Free' : money(item.price)}</p>
            
            <div class="wishlist-card__stats" style="font-size: 11px; color: var(--text-muted); margin: 6px 0 10px 0; display: flex; gap: 8px; flex-wrap: wrap;">
              <span>⭐ ${stats.wishlistCount || 1} in wishlists</span> • 
              <span>🛒 ${stats.cartCount || 0} added to cart</span> • 
              <span>📦 ${stats.purchasedCount || 0} bought</span>
            </div>

            <div class="wishlist-card__actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${actionButtons}
            </div>
          </div>
        </article>
      </li>`;
  }

  function getFilteredAndSortedItems() {
    let items = [...(rawWishlistData.items || [])];

    // Filter
    if (currentFilter === 'digital') {
      items = items.filter(i => i.category === 'digital');
    } else if (currentFilter === 'physical') {
      items = items.filter(i => i.category === 'physical');
    } else if (currentFilter === 'purchased') {
      items = items.filter(i => !!i.purchased);
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

  function updateSummary() {
    const items = rawWishlistData.items || [];
    const purchasedCount = items.filter(i => i.purchased).length;
    const savedCount = items.length - purchasedCount;
    const totalValue = items.reduce((sum, p) => sum + p.price, 0);

    if (countHeader) {
      countHeader.textContent = `${savedCount} saved · ${purchasedCount} purchased`;
    }
    if (summarySaved) {
      summarySaved.innerHTML = `<strong>${items.length}</strong> item${items.length === 1 ? '' : 's'} total`;
    }
    if (summaryValue) {
      summaryValue.innerHTML = `<strong>${money(totalValue)}</strong> total value`;
    }
    if (summaryPurchased) {
      summaryPurchased.innerHTML = `<strong>${purchasedCount}</strong> already purchased`;
    }
  }

  function render() {
    const displayItems = getFilteredAndSortedItems();

    if (grid) {
      grid.innerHTML = displayItems.length
        ? displayItems.map(cardHTML).join('')
        : '<li class="shelf-empty">No wishlist items found for the selected filter. <a href="shopping.html">Explore games &amp; merchandise →</a></li>';
    }

    updateSummary();
  }

  async function loadWishlist() {
    try {
      rawWishlistData = await api('/api/wishlist');
      render();
    } catch (err) {
      console.error('Error fetching wishlist:', err);
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

  // Action event delegation
  if (grid) {
    grid.addEventListener('click', async (e) => {
      // 1. Move to cart
      const moveBtn = e.target.closest('[data-action="move-to-cart"]');
      if (moveBtn) {
        const productId = moveBtn.dataset.id;
        moveBtn.disabled = true;
        try {
          await api(`/api/wishlist/${productId}/move-to-cart`, { method: 'POST' });
          showToast('Moved item to cart!', 'success');
          loadWishlist();
        } catch (err) {
          showToast(err.message, 'error');
          moveBtn.disabled = false;
        }
        return;
      }

      // 2. Buy again
      const buyAgainBtn = e.target.closest('[data-action="buy-again"]');
      if (buyAgainBtn) {
        const productId = buyAgainBtn.dataset.id;
        buyAgainBtn.disabled = true;
        try {
          await api('/api/cart', { method: 'POST', body: { productId, qty: 1 } });
          showToast('Added item to cart!', 'success');
          buyAgainBtn.disabled = false;
        } catch (err) {
          showToast(err.message, 'error');
          buyAgainBtn.disabled = false;
        }
        return;
      }

      // 3. Mark purchased
      const markBtn = e.target.closest('[data-action="mark-purchased"]');
      if (markBtn) {
        const productId = markBtn.dataset.id;
        try {
          await api(`/api/wishlist/${productId}/purchased`, {
            method: 'PUT',
            body: { purchased: true }
          });
          showToast('Marked item as purchased.', 'info');
          loadWishlist();
        } catch (err) {
          showToast(err.message, 'error');
        }
        return;
      }

      // 4. Remove from wishlist
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (removeBtn) {
        const productId = removeBtn.dataset.id;
        try {
          await api(`/api/wishlist/${productId}`, { method: 'DELETE' });
          showToast('Removed item from wishlist.', 'info');
          loadWishlist();
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }

  loadWishlist();
})();
