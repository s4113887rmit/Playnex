/**
 * confirmation.js — Dynamic order confirmation renderer for Playnex.
 * Fetches order by ?order=ID parameter and displays items, delivery info, and pricing breakdown.
 */
(function () {
  'use strict';

  const { api } = window.Playnex || {};

  const orderNoEl = document.querySelector('.confirmation__order-no');
  const summaryEl = document.getElementById('confirmation-summary') || document.querySelector('.confirmation__summary');
  const deliveryEl = document.getElementById('confirmation-delivery') || document.querySelectorAll('.confirmation__summary')[1];

  function money(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  }

  function formatEta(createdAt) {
    const start = createdAt ? new Date(createdAt) : new Date();
    const from = new Date(start);
    from.setDate(from.getDate() + 3);
    const to = new Date(start);
    to.setDate(to.getDate() + 7);
    const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fmt(from)} – ${fmt(to)}`;
  }

  const countryMap = {
    vn: 'Vietnam', jp: 'Japan', kr: 'South Korea', cn: 'China', sg: 'Singapore',
    th: 'Thailand', my: 'Malaysia', id: 'Indonesia', ph: 'Philippines', in: 'India',
    tw: 'Taiwan', hk: 'Hong Kong', ae: 'United Arab Emirates', sa: 'Saudi Arabia',
    gb: 'United Kingdom', uk: 'United Kingdom', de: 'Germany', fr: 'France', it: 'Italy',
    es: 'Spain', nl: 'Netherlands', se: 'Sweden', ch: 'Switzerland', pl: 'Poland',
    no: 'Norway', dk: 'Denmark', fi: 'Finland', be: 'Belgium', at: 'Austria',
    pt: 'Portugal', ie: 'Ireland', cz: 'Czech Republic', gr: 'Greece',
    us: 'United States', ca: 'Canada', au: 'Australia', nz: 'New Zealand', br: 'Brazil'
  };

  function render(order) {
    if (!order) return;

    if (orderNoEl) {
      const orderId = order.id || 'CONFIRMED';
      orderNoEl.textContent = `Order #${orderId} · A confirmation email has been sent`;
    }

    if (summaryEl && Array.isArray(order.items)) {
      const itemLines = order.items.map(
        (i) => `<div class="confirmation__line"><span>${i.title}${i.qty > 1 ? ` ×${i.qty}` : ''}</span><span>${money(i.price * i.qty)}</span></div>`
      ).join('');

      summaryEl.innerHTML = `
        <h2>Order summary</h2>
        ${itemLines || '<div class="confirmation__line"><span>No items</span><span>$0.00</span></div>'}
        ${order.discount ? `<div class="confirmation__line cart-summary__row--discount"><span>Discount</span><span>-${money(order.discount)}</span></div>` : ''}
        <div class="confirmation__line"><span>Shipping</span><span>${money(order.shipping)}</span></div>
        <div class="confirmation__line"><span>Tax (8.3%)</span><span>${money(order.tax)}</span></div>
        <div class="confirmation__line"><strong>Total</strong><strong>${money(order.total)}</strong></div>
      `;
    }

    if (deliveryEl && order.delivery) {
      const d = order.delivery;
      const countryCode = String(d.country || '').toLowerCase();
      const countryStr = countryMap[countryCode] || String(d.country || '').toUpperCase();
      const addressParts = [d.address, d.city, d.postalCode, countryStr].filter(Boolean).join(', ');
      deliveryEl.innerHTML = `
        <h2>Delivery to</h2>
        <div class="confirmation__line"><span>${d.fullName || ''}</span><span>${d.phone || ''}</span></div>
        <div class="confirmation__line"><span>${addressParts || ''}</span></div>
        <div class="confirmation__line"><span>Estimated delivery</span><span>${formatEta(order.createdAt)}</span></div>
        ${order.payment && order.payment.cardLast4 ? `<div class="confirmation__line"><span>Payment method</span><span>Card ending in ${order.payment.cardLast4}</span></div>` : ''}
      `;
    }
  }

  async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');

    let order = null;

    if (orderId && typeof api === 'function') {
      try {
        const data = await api(`/api/checkout/order/${encodeURIComponent(orderId)}`);
        if (data && data.order) {
          order = data.order;
        }
      } catch (err) {
        console.warn('Could not fetch order from API:', err);
      }
    }

    if (!order) {
      try {
        const raw = sessionStorage.getItem('playnex_last_order') || localStorage.getItem('playnex_last_order');
        if (raw) {
          const cached = JSON.parse(raw);
          if (!orderId || cached.id === orderId) {
            order = cached;
          }
        }
      } catch (e) {}
    }

    if (order) {
      render(order);
    } else {
      if (orderNoEl) orderNoEl.textContent = orderId ? `Order #${orderId} details could not be loaded.` : 'No order specified. Browse our catalogue to place an order.';
      if (summaryEl) summaryEl.innerHTML = '<h2>Order summary</h2><p style="color:var(--text-muted);font-size:14px;margin-top:8px;">No order data found.</p>';
      if (deliveryEl) deliveryEl.innerHTML = '<h2>Delivery to</h2><p style="color:var(--text-muted);font-size:14px;margin-top:8px;">No delivery information available.</p>';
    }
  }

  loadOrder();
})();
