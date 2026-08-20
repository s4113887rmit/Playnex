/**
 * confirmation.js — Dynamic order confirmation renderer for Playnex.
 * Fetches order by ?order=ID parameter and displays items, delivery info, and pricing breakdown.
 */
(function () {
  'use strict';

  const { api } = window.Playnex;

  const orderNoEl = document.querySelector('.confirmation__order-no');
  const summaryEl = document.querySelector('.confirmation__summary:nth-of-type(1)');
  const deliveryEl = document.querySelector('.confirmation__summary:nth-of-type(2)');

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
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

  function render(order) {
    if (orderNoEl) {
      orderNoEl.textContent = `Order #${order.id} · A confirmation email has been sent`;
    }

    if (summaryEl && Array.isArray(order.items)) {
      const itemLines = order.items.map(
        (i) => `<div class="confirmation__line"><span>${i.title}${i.qty > 1 ? ` ×${i.qty}` : ''}</span><span>${money(i.price * i.qty)}</span></div>`
      ).join('');

      summaryEl.innerHTML = `
        <h2>Order summary</h2>
        ${itemLines}
        <div class="confirmation__line"><span>Shipping</span><span>${money(order.shipping)}</span></div>
        <div class="confirmation__line"><span>Tax (8.3%)</span><span>${money(order.tax)}</span></div>
        <div class="confirmation__line"><strong>Total</strong><strong>${money(order.total)}</strong></div>
      `;
    }

    if (deliveryEl && order.delivery) {
      const d = order.delivery;
      deliveryEl.innerHTML = `
        <h2>Delivery to</h2>
        <div class="confirmation__line"><span>${d.fullName}</span><span>${d.phone}</span></div>
        <div class="confirmation__line"><span>${d.address}, ${d.city}, ${d.postalCode}, ${String(d.country).toUpperCase()}</span></div>
        <div class="confirmation__line"><span>Estimated delivery</span><span>${formatEta(order.createdAt)}</span></div>
        ${order.payment ? `<div class="confirmation__line"><span>Payment method</span><span>Card ending in ${order.payment.cardLast4}</span></div>` : ''}
      `;
    }
  }

  async function loadOrder() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('order');

    if (!orderId) {
      if (orderNoEl) orderNoEl.textContent = 'No order specified. Browse our catalogue to place an order.';
      return;
    }

    try {
      const data = await api(`/api/checkout/order/${encodeURIComponent(orderId)}`);
      render(data.order);
    } catch (err) {
      if (orderNoEl) orderNoEl.textContent = `Could not find order #${orderId}: ${err.message}`;
    }
  }

  loadOrder();
})();
