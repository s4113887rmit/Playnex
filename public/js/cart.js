/**
 * cart.js — Full shopping cart dynamic controller for Playnex.
 * Features:
 *   - Client & Server synchronization
 *   - Live search/filter within cart items
 *   - Live sort (Title, Quantity, Price)
 *   - Quantity validation with error prevention & live totals
 *   - Promo code validation with live feedback (PLAYNEX10, PLAYNEX20)
 *   - Web Storage persistence for promo code and cart cache
 *   - Order Summary calculations with physical shipping logic & taxes.
 */
(function () {
  'use strict';

  const { api, showToast } = window.Playnex;
  const CACHE_KEY = 'playnex_cart_cache';
  const PROMO_KEY = 'playnex_cart_promo';

  const list = document.querySelector('.cart-list');
  const sortSelect = document.getElementById('cart-sort');
  const filterInput = document.getElementById('cart-filter');
  const itemCountHeader = document.querySelector('.page-header__count');
  const toolbarCountEl = document.querySelector('.cart-toolbar__count');
  const summarySubtotal = document.querySelector('.cart-summary__row:nth-of-type(1) span:last-child');
  const summaryShipping = document.querySelector('.cart-summary__row:nth-of-type(2) span:last-child');
  const summaryTax = document.querySelector('.cart-summary__row:nth-of-type(3) span:last-child');
  const summaryTotal = document.querySelector('.cart-summary__row--total span:last-child');
  const checkoutBtn = document.querySelector('.cart-summary .btn--primary');
  const promoForm = document.querySelector('.promo-form');
  const promoInput = document.getElementById('promo-code');

  let currentItems = [];
  let filterTerm = '';
  let appliedDiscount = 0;
  let promoCodeName = '';

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch {}
  }

  function itemHTML(line) {
    const { product, qty, variant } = line;
    const imgTag = product.image
      ? `<img src="${product.image}" alt="${product.title} poster">`
      : `<div class="card__placeholder-art">${product.title.charAt(0)}</div>`;

    return `
      <li>
        <article class="cart-item" data-id="${product.id}">
          <a href="${product.href || 'shopping.html'}" class="cart-item__art ${product.art || 'cart-item__art--1'}" aria-label="View ${product.title} details">
            ${imgTag}
          </a>
          <div>
            <h3 class="cart-item__title"><a href="${product.href || 'shopping.html'}">${product.title}</a></h3>
            <p class="cart-item__variant">${variant || product.variant || (product.category === 'physical' ? 'Physical Merch' : 'Digital Game')}</p>
          </div>
          <div class="cart-item__qty">
            <label for="qty-${product.id}">Quantity</label>
            <input id="qty-${product.id}" name="qty-${product.id}" type="number" min="1" value="${qty}" data-id="${product.id}">
          </div>
          <span class="cart-item__price">${money(product.price * qty)}</span>
          <button type="button" class="cart-item__remove" data-id="${product.id}">Remove</button>
        </article>
      </li>`;
  }

  function sortAndFilterItems(items) {
    let filtered = [...items];

    if (filterTerm) {
      filtered = filtered.filter(line => {
        const title = line.product.title.toLowerCase();
        const variant = (line.variant || line.product.variant || '').toLowerCase();
        return title.includes(filterTerm) || variant.includes(filterTerm);
      });
    }

    const sortVal = sortSelect ? sortSelect.value : 'title';
    if (sortVal === 'title') {
      filtered.sort((a, b) => a.product.title.localeCompare(b.product.title));
    } else if (sortVal === 'quantity') {
      filtered.sort((a, b) => b.qty - a.qty);
    } else if (sortVal === 'price') {
      filtered.sort((a, b) => (b.product.price * b.qty) - (a.product.price * a.qty));
    }

    return filtered;
  }

  function updateSummary(items) {
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
    const hasPhysical = items.some(i => i.product.category === 'physical');
    const shipping = items.length === 0 ? 0 : (hasPhysical ? 6.00 : 0.00);
    const discountVal = Number((subtotal * appliedDiscount).toFixed(2));
    const taxable = Math.max(0, subtotal - discountVal);
    const tax = Number((taxable * 0.083).toFixed(2));
    const total = Number((taxable + shipping + tax).toFixed(2));
    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);

    if (itemCountHeader) itemCountHeader.textContent = `${totalQty} item${totalQty === 1 ? '' : 's'}`;
    if (toolbarCountEl) toolbarCountEl.textContent = `${totalQty} item${totalQty === 1 ? '' : 's'} in your cart`;

    if (window.Playnex && typeof window.Playnex.updateCartBadge === 'function') {
      window.Playnex.updateCartBadge(totalQty);
    }

    if (summarySubtotal) summarySubtotal.textContent = money(subtotal);
    if (summaryShipping) summaryShipping.textContent = money(shipping);
    if (summaryTax) summaryTax.textContent = money(tax);
    if (summaryTotal) summaryTotal.textContent = money(total);

    if (checkoutBtn) {
      if (items.length === 0) {
        checkoutBtn.classList.add('is-disabled');
        checkoutBtn.setAttribute('aria-disabled', 'true');
        checkoutBtn.onclick = (e) => {
          e.preventDefault();
          showToast('Your cart is empty. Add items before checking out!', 'info');
        };
      } else {
        checkoutBtn.classList.remove('is-disabled');
        checkoutBtn.removeAttribute('aria-disabled');
        checkoutBtn.onclick = null;
      }
    }
  }

  function render(items) {
    currentItems = items;
    writeCache(items);

    const displayItems = sortAndFilterItems(items);

    if (list) {
      list.innerHTML = displayItems.length
        ? displayItems.map(itemHTML).join('')
        : (items.length === 0
            ? '<li class="shelf-empty">Your cart is currently empty. <a href="shopping.html">Browse games &amp; merch →</a></li>'
            : '<li class="shelf-empty">No cart items match your filter.</li>');
    }

    updateSummary(items);
  }

  async function loadCart() {
    // 1. Initial paint from local cache
    render(readCache());

    // 2. Restore saved promo if available
    try {
      const savedPromo = sessionStorage.getItem(PROMO_KEY);
      if (savedPromo) {
        const parsed = JSON.parse(savedPromo);
        appliedDiscount = parsed.discount || 0;
        promoCodeName = parsed.code || '';
        if (promoInput) promoInput.value = promoCodeName;
      }
    } catch (e) {}

    // 3. Authoritative sync with server API
    try {
      const data = await api('/api/cart');
      render(data.items);
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  }

  // Sort change listener
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      render(currentItems);
    });
  }

  // Live filter listener
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      filterTerm = e.target.value.trim().toLowerCase();
      render(currentItems);
    });
  }

  // Quantity change listener (with validation & error prevention)
  if (list) {
    list.addEventListener('change', async (e) => {
      const input = e.target.closest('input[type="number"]');
      if (!input) return;

      const productId = input.dataset.id;
      let qty = parseInt(input.value, 10);

      // Validation & clamp
      if (isNaN(qty) || qty < 1) {
        qty = 1;
        input.value = 1;
      }

      try {
        const data = await api(`/api/cart/${productId}`, {
          method: 'PUT',
          body: { qty }
        });
        render(data.items);
        showToast('Quantity updated.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
        loadCart();
      }
    });

    // Remove item listener
    list.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.cart-item__remove');
      if (!removeBtn) return;

      const productId = removeBtn.dataset.id;
      try {
        const data = await api(`/api/cart/${productId}`, {
          method: 'DELETE'
        });
        render(data.items);
        showToast('Item removed from cart.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Promo code form validation & application
  if (promoForm) {
    promoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = promoInput ? promoInput.value.trim() : '';

      if (!code) {
        showToast('Please enter a promo code.', 'error');
        if (promoInput) promoInput.classList.add('is-invalid');
        return;
      }

      try {
        const data = await api('/api/cart/promo', {
          method: 'POST',
          body: { code }
        });

        appliedDiscount = data.discountPercent / 100;
        promoCodeName = data.promoCode;

        sessionStorage.setItem(PROMO_KEY, JSON.stringify({
          code: promoCodeName,
          discount: appliedDiscount
        }));

        if (promoInput) {
          promoInput.classList.remove('is-invalid');
          promoInput.classList.add('is-valid');
        }
        showToast(data.message, 'success');
        updateSummary(currentItems);
      } catch (err) {
        if (promoInput) promoInput.classList.add('is-invalid');
        showToast(err.message, 'error');
      }
    });
  }

  loadCart();
})();
