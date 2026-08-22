/**
 * checkout.js — Full Checkout controller for Playnex.
 * Features:
 *   - Live & responsive form validation on input & blur
 *   - Error prevention: Input masking (Card, Expiry MM/YY, CVC, Phone)
 *   - Web Storage API: Auto-saves and restores draft inputs via sessionStorage
 *   - Dynamic Order Summary fetched from server cart
 *   - Server-side validation integration & error handling
 */
(function () {
  'use strict';

  const { api, showToast } = window.Playnex;
  const DRAFT_KEY = 'playnex_checkout_draft';

  const form = document.querySelector('.checkout-form');
  const submitBtn = document.querySelector('.checkout-form button[type="submit"]');
  const summaryLines = document.querySelector('.cart-summary');
  const headerCountEl = document.querySelector('.page-header__count');

  const getCurrentUser = () => {
    try {
      return window.Playnex && typeof window.Playnex.getCurrentUser === 'function'
        ? window.Playnex.getCurrentUser()
        : JSON.parse(localStorage.getItem('playnex_user') || 'null');
    } catch (e) {
      return null;
    }
  };

  const isLoggedIn = !!getCurrentUser();

  if (!isLoggedIn && form) {
    const notice = document.createElement('p');
    notice.className = 'auth-server-msg is-error';
    notice.style.marginBottom = '16px';
    notice.innerHTML = 'You are checking out as a guest. <a href="Login.html" class="text-link">Log in</a> to place an order.';
    form.insertBefore(notice, form.firstChild);
  }

  const fields = [
    'full-name',
    'phone',
    'address',
    'city',
    'postal-code',
    'country',
    'card-name',
    'card-number',
    'card-expiry',
    'card-cvc'
  ];

  let cartSubtotal = 0;
  let cartTotal = 0;
  const touched = new Set();

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  // Luhn algorithm for client-side card validation
  function isValidLuhn(numberStr) {
    const digits = numberStr.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  // Validation rules
  const validators = {
    'full-name': (v) => (v.trim().length >= 2 ? '' : 'Full name must be at least 2 characters.'),
    'phone': (v) => (/^[0-9 +()-]{7,20}$/.test(v.trim()) ? '' : 'Enter a valid phone number.'),
    'address': (v) => (v.trim().length >= 3 ? '' : 'Street address must be at least 3 characters.'),
    'city': (v) => (v.trim().length >= 2 ? '' : 'Please enter your city.'),
    'postal-code': (v) => (v.trim().length >= 3 ? '' : 'Enter a valid postal code.'),
    'country': (v) => (v ? '' : 'Please select a delivery country.'),
    'card-name': (v) => {
      const clean = v.trim();
      if (clean.length < 2) return 'Enter the cardholder name.';
      if (!/^[A-Z\s]{2,100}$/.test(clean)) return 'Name on card must contain only unaccented uppercase letters (no numbers or special characters).';
      return '';
    },
    'card-number': (v) => {
      const clean = v.replace(/\s+/g, '');
      if (clean.length < 15) return 'Card number must be at least 15 digits.';
      if (clean.length > 19) return 'Card number cannot exceed 19 digits.';
      if (!/^[0-9]{15,19}$/.test(clean)) return 'Card number must contain only numbers (15 to 19 digits).';
      return '';
    },
    'card-expiry': (v) => {
      const clean = v.trim();
      const m = clean.match(/^(\d{1,2})\/(\d{2,4})$/);
      if (!m) return 'Enter expiry in MM/YY format.';
      const month = parseInt(m[1], 10);
      if (month < 1 || month > 12) return 'Invalid expiry month (01–12).';
      return '';
    },
    'card-cvc': (v) => (/^[0-9]{2,6}$/.test(v.trim()) ? '' : 'Security code must be digits (e.g. 3 or 4 digits).')
  };

  function getOrCreateErrorElement(input) {
    let err = input.parentElement.querySelector('.form-group__error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'form-group__error';
      err.setAttribute('role', 'alert');
      input.parentElement.appendChild(err);
    }
    return err;
  }

  function validateField(id) {
    const input = document.getElementById(id);
    if (!input) return true;

    const errorEl = getOrCreateErrorElement(input);
    const msg = validators[id] ? validators[id](input.value) : '';
    const isTouched = touched.has(id);

    if (isTouched && msg) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      errorEl.textContent = msg;
      return false;
    } else if (isTouched && !msg && input.value.trim().length > 0) {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      errorEl.textContent = '';
      return true;
    } else {
      input.classList.remove('is-invalid');
      input.classList.remove('is-valid');
      errorEl.textContent = '';
      return msg === '';
    }
  }

  function checkFormValid() {
    return fields.every((id) => {
      const el = document.getElementById(id);
      return el && validators[id] && validators[id](el.value) === '';
    });
  }

  function updateSubmitState() {
    const isValid = checkFormValid();
    if (submitBtn) {
      submitBtn.disabled = !isValid;
      submitBtn.classList.toggle('is-disabled', !isValid);
    }
  }

  // --- Web Storage (sessionStorage draft) ---
  function saveDraft() {
    const draft = {};
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) draft[id] = el.value;
    });
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el && draft[id] !== undefined) {
          el.value = draft[id];
        }
      });
    } catch (e) {}
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  // --- Error Prevention Input Masking ---
  const cardNameInput = document.getElementById('card-name');
  if (cardNameInput) {
    cardNameInput.addEventListener('input', (e) => {
      e.target.value = e.target.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z\s]/g, '')
        .toUpperCase();
    });
  }

  const cardNumberInput = document.getElementById('card-number');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 19);
      e.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
    });
  }

  const cardExpiryInput = document.getElementById('card-expiry');
  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      let digits = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        digits = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
      }
      e.target.value = digits;
    });
  }

  const cardCvcInput = document.getElementById('card-cvc');
  if (cardCvcInput) {
    cardCvcInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9 +()-]/g, '');
    });
  }

  // Setup live validation triggers on fields
  fields.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', () => {
      touched.add(id);
      validateField(id);
      updateSubmitState();
      saveDraft();
    });

    input.addEventListener('blur', () => {
      touched.add(id);
      validateField(id);
      updateSubmitState();
    });
  });

  // --- Load Cart Order Summary ---
  async function loadOrderSummary() {
    try {
      const data = await api('/api/cart');
      const items = data.items || [];

      if (items.length === 0) {
        showToast('Your cart is empty. Redirecting to store...', 'info');
        if (submitBtn) submitBtn.disabled = true;
        setTimeout(() => {
          window.location.href = 'shopping.html';
        }, 1500);
        return;
      }

      cartSubtotal = data.subtotal;
      cartTotal = data.total;

      if (headerCountEl) {
        headerCountEl.textContent = `${data.itemCount} items · ${money(data.total)}`;
      }

      if (summaryLines) {
        const itemRows = items.map(
          (i) => `<div class="cart-summary__row"><span>${i.product.title}${i.qty > 1 ? ` ×${i.qty}` : ''}</span><span>${money(i.product.price * i.qty)}</span></div>`
        ).join('');

        summaryLines.innerHTML = `
          <h2>Order summary</h2>
          ${itemRows}
          <div class="cart-summary__row"><span>Shipping</span><span>${money(data.shipping)}</span></div>
          <div class="cart-summary__row"><span>Tax (8.3%)</span><span>${money(data.tax)}</span></div>
          ${data.discount ? `<div class="cart-summary__row cart-summary__row--discount"><span>Discount</span><span>-${money(data.discount)}</span></div>` : ''}
          <div class="cart-summary__row cart-summary__row--total"><span>Total</span><span>${money(data.total)}</span></div>
        `;
      }

      if (submitBtn) {
        submitBtn.textContent = `Place order — ${money(data.total)}`;
      }
    } catch (err) {
      console.error('Error loading checkout summary:', err);
    }
  }

  // --- Form Submission ---
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!isLoggedIn) {
        showToast('Please log in to place an order. <a href="Login.html" class="playnex-toast__link">Log In -&gt;</a>', 'error');
        setTimeout(() => { window.location.href = 'Login.html'; }, 2000);
        return;
      }

      // Mark all fields touched
      fields.forEach((id) => touched.add(id));
      const allValid = fields.map(validateField).every(Boolean);

      if (!allValid) {
        showToast('Please fix the highlighted errors before submitting.', 'error');
        updateSubmitState();
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Processing order...';

      const payload = {
        delivery: {
          fullName: document.getElementById('full-name').value.trim(),
          phone: document.getElementById('phone').value.trim(),
          address: document.getElementById('address').value.trim(),
          city: document.getElementById('city').value.trim(),
          postalCode: document.getElementById('postal-code').value.trim(),
          country: document.getElementById('country').value
        },
        payment: {
          cardName: document.getElementById('card-name').value.trim(),
          cardNumber: document.getElementById('card-number').value.replace(/\s+/g, ''),
          expiry: document.getElementById('card-expiry').value.trim(),
          cvc: document.getElementById('card-cvc').value.trim()
        }
      };

      try {
        const res = await api('/api/checkout', {
          method: 'POST',
          body: payload
        });

        if (res && res.order) {
          try {
            sessionStorage.setItem('playnex_last_order', JSON.stringify(res.order));
            localStorage.setItem('playnex_last_order', JSON.stringify(res.order));
          } catch (e) {}
        }

        clearDraft();
        localStorage.removeItem('playnex_cart_cache');
        showToast('Order confirmed successfully!', 'success');

        setTimeout(() => {
          const orderId = (res && res.order && res.order.id) ? res.order.id : '';
          window.location.href = orderId ? `confirmation.html?order=${encodeURIComponent(orderId)}` : 'confirmation.html';
        }, 500);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (err.fields) {
          // Highlight server-side validation error fields
          Object.entries(err.fields).forEach(([fieldKey, errorMsg]) => {
            const inputId = fieldKey === 'fullName' ? 'full-name'
              : fieldKey === 'postalCode' ? 'postal-code'
              : fieldKey === 'cardName' ? 'card-name'
              : fieldKey === 'cardNumber' ? 'card-number'
              : fieldKey === 'expiry' ? 'card-expiry'
              : fieldKey;

            const input = document.getElementById(inputId);
            if (input) {
              touched.add(inputId);
              input.classList.add('is-invalid');
              const errorEl = getOrCreateErrorElement(input);
              errorEl.textContent = errorMsg;
            }
          });
        }
        showToast(err.message || 'Error processing your order.', 'error');
      }
    });
  }

  // Initialize
  restoreDraft();
  loadOrderSummary();
  updateSubmitState();
})();
