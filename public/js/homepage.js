/**
 * homepage.js — Dynamic homepage logic for Playnex.
 * Renders digital & merchandise shelves dynamically, supports live search, category toggles, sorting, and cart/wishlist additions.
 */
(function () {
  'use strict';

  const { api, showToast } = window.Playnex;

  let allProducts = [];
  let activeCategory = 'all'; // 'all' | 'digital' | 'physical'
  let searchTerm = '';

  const newReleasesList = document.querySelector('#new-releases .shelf__row');
  const merchList = document.querySelector('#merch .shelf__row');
  const newSection = document.getElementById('new-releases');
  const merchSection = document.getElementById('merch');
  const searchInput = document.getElementById('site-search');

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

    return `
      <li>
        <article class="card" data-id="${p.id}">
          <div class="card__art ${p.art || 'card__art--1'}">
            <a href="${p.href || 'shopping.html'}" aria-label="View ${p.title} details">
              ${imgTag}
            </a>
            ${badge}
            <button class="card__wishlist" aria-label="Add ${p.title} to wishlist" type="button" data-action="wishlist" data-id="${p.id}">&hearts;</button>
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

  function applySort(list, sortValue) {
    const sorted = [...list];
    if (sortValue === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sortValue === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sortValue === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }

  function matchesSearch(product) {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return product.title.toLowerCase().includes(term) ||
           product.genre.toLowerCase().includes(term) ||
           product.platform.toLowerCase().includes(term);
  }

  function render() {
    const digitalSortEl = document.getElementById('sort-digital');
    const merchSortEl = document.getElementById('sort-merch');
    const digitalSort = digitalSortEl ? digitalSortEl.value : 'title';
    const merchSort = merchSortEl ? merchSortEl.value : 'title';

    const digital = applySort(
      allProducts.filter(p => p.category === 'digital' && matchesSearch(p)),
      digitalSort
    );
    const physical = applySort(
      allProducts.filter(p => p.category === 'physical' && matchesSearch(p)),
      merchSort
    );

    if (newReleasesList) {
      newReleasesList.innerHTML = digital.length
        ? digital.map(cardHTML).join('')
        : '<li class="shelf-empty">No digital games match your search.</li>';
    }

    if (merchList) {
      merchList.innerHTML = physical.length
        ? physical.map(cardHTML).join('')
        : '<li class="shelf-empty">No physical merch matches your search.</li>';
    }

    if (newSection) newSection.style.display = activeCategory === 'physical' ? 'none' : '';
    if (merchSection) merchSection.style.display = activeCategory === 'digital' ? 'none' : '';
  }

  async function loadProducts() {
    try {
      allProducts = await api('/api/products');
      render();
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  // Live search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.trim();
      render();
    });
    const searchForm = searchInput.closest('form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        if (window.location.pathname.endsWith('homepage.html') || window.location.pathname === '/') {
          e.preventDefault();
        }
      });
    }
  }

  // Category filter tabs in subnav
  document.querySelectorAll('.subnav__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === 'homepage.html' || href === 'homepage.html#') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activeCategory = 'all';
        document.querySelectorAll('.subnav__link').forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        render();
      });
    } else if (href === 'shopping.html?cat=digital') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activeCategory = 'digital';
        document.querySelectorAll('.subnav__link').forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        render();
      });
    } else if (href === 'shopping.html?cat=merch') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activeCategory = 'physical';
        document.querySelectorAll('.subnav__link').forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        render();
      });
    }
  });

  // Event delegation for adding to cart & wishlist
  document.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-action="add-to-cart"]');
    if (addBtn) {
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
      const productId = wishBtn.dataset.id;
      wishBtn.disabled = true;
      try {
        await api('/api/wishlist', {
          method: 'POST',
          body: { productId }
        });
        wishBtn.classList.add('is-saved');
        showToast('Added item to your wishlist!', 'success');
      } catch (err) {
        showToast(err.message, err.status === 409 ? 'info' : 'error');
      } finally {
        wishBtn.disabled = false;
      }
      return;
    }

    const claimBtn = e.target.closest('.promo-strip a, .promo-strip button');
    if (claimBtn) {
      e.preventDefault();
      try {
        await api('/api/cart', {
          method: 'POST',
          body: { productId: 'ruinport-chronicles', qty: 1 }
        });
        showToast('Claimed Ruinport Chronicles for free!', 'success');
        setTimeout(() => {
          window.location.href = 'cart.html';
        }, 600);
      } catch (err) {
        showToast(err.message, 'info');
      }
    }
  });

  loadProducts();
})();
