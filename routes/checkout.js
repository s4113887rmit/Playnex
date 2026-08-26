const express = require('express');
const router = express.Router();
const products = require('../data/products');
const { getCart, saveOrder, getOrder, getAllOrders } = require('../data/store');

/**
 * Luhn Algorithm for validating credit card numbers
 */
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

/**
 * Server-side validation for checkout
 */
function validateCheckout(body) {
  const errors = {};
  const delivery = body.delivery || {};
  const payment = body.payment || {};

  // Delivery validation
  const fullName = (delivery.fullName || '').trim();
  if (!fullName || fullName.length < 2) {
    errors.fullName = 'Full name is required and must be at least 2 characters.';
  } else if (fullName.length > 100) {
    errors.fullName = 'Full name cannot exceed 100 characters.';
  }

  const phone = (delivery.phone || '').trim();
  if (!phone || !/^[0-9 +()-]{7,20}$/.test(phone)) {
    errors.phone = 'Please enter a valid contact phone number.';
  }

  const address = (delivery.address || '').trim();
  if (!address || address.length < 3) {
    errors.address = 'Street address must be at least 3 characters.';
  } else if (address.length > 200) {
    errors.address = 'Street address cannot exceed 200 characters.';
  }

  const city = (delivery.city || '').trim();
  if (!city || city.length < 2) {
    errors.city = 'City is required.';
  }

  const postalCode = (delivery.postalCode || '').trim();
  if (!postalCode || postalCode.length < 3) {
    errors.postalCode = 'Postal code is required.';
  }

  if (!delivery.country || typeof delivery.country !== 'string') {
    errors.country = 'Please select a delivery country.';
  }

  // Payment validation
  let cardName = (payment.cardName || '').trim();
  cardName = cardName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z\s]/g, '')
    .toUpperCase();

  if (!cardName || cardName.length < 2) {
    errors.cardName = 'Name on card is required and must contain only letters.';
  } else if (!/^[A-Z\s]{2,100}$/.test(cardName)) {
    errors.cardName = 'Name on card must contain only unaccented letters without numbers or special characters.';
  }

  const rawCardNumber = (payment.cardNumber || '').replace(/\s+/g, '');
  if (!rawCardNumber || !/^[0-9]{15,19}$/.test(rawCardNumber)) {
    errors.cardNumber = 'Card number must be between 15 and 19 digits.';
  }

  const expiry = (payment.expiry || '').trim();
  const expiryMatch = expiry.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (!expiryMatch) {
    errors.expiry = 'Expiry date must be in MM/YY format.';
  } else {
    const month = parseInt(expiryMatch[1], 10);
    if (month < 1 || month > 12) {
      errors.expiry = 'Invalid expiry month (01–12).';
    }
  }

  const cvc = (payment.cvc || '').trim();
  if (!cvc || !/^[0-9]{2,6}$/.test(cvc)) {
    errors.cvc = 'CVC / Security code is required.';
  }

  return errors;
}

// POST /api/checkout — process checkout submission
router.post('/', (req, res) => {
  const errors = validateCheckout(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(422).json({
      error: 'Server validation failed. Please check your form entries.',
      fields: errors
    });
  }

  const cart = getCart(req.userId);
  if (!cart || cart.length === 0) {
    return res.status(400).json({
      error: 'Your cart is empty. Please add items before checking out.'
    });
  }

  // Retrieve full product details server-side
  const items = cart.map(line => {
    const product = products.find(p => p.id === line.productId);
    if (!product) return null;
    return {
      productId: line.productId,
      title: product.title,
      price: product.price,
      qty: line.qty,
      variant: line.variant || product.variant,
      category: product.category,
      image: product.image,
      art: product.art,
      lineTotal: Number((product.price * line.qty).toFixed(2))
    };
  }).filter(Boolean);

  if (items.length === 0) {
    return res.status(400).json({ error: 'No valid products found in cart.' });
  }

  // Calculate authoritative totals server-side
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const hasPhysical = items.some(i => i.category === 'physical');
  const shipping = hasPhysical ? 6.00 : 0.00;
  const tax = Number((subtotal * 0.083).toFixed(2));
  const total = Number((subtotal + shipping + tax).toFixed(2));

  // Mask card number for security
  const rawCard = String(req.body.payment.cardNumber).replace(/\s+/g, '');
  const last4 = rawCard.slice(-4);

  const order = saveOrder({
    userId: req.userId,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    tax,
    total,
    delivery: {
      fullName: req.body.delivery.fullName.trim(),
      phone: req.body.delivery.phone.trim(),
      address: req.body.delivery.address.trim(),
      city: req.body.delivery.city.trim(),
      postalCode: req.body.delivery.postalCode.trim(),
      country: req.body.delivery.country.trim()
    },
    payment: {
      cardName: req.body.payment.cardName.trim(),
      cardLast4: `•••• •••• •••• ${last4}`
    },
    status: 'confirmed'
  });

  // Empty cart after successful order placement
  cart.length = 0;

  res.status(201).json({
    message: 'Order created successfully!',
    order
  });
});

// GET /api/checkout/order/:id — retrieve a specific order
router.get('/order/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: `Order #${req.params.id} was not found.` });
  }

  // Ownership verification
  if (order.userId && order.userId !== req.userId && req.userId !== 'admin') {
    return res.status(403).json({ error: 'You do not have permission to view this order.' });
  }

  res.json({ order });
});

// GET /api/checkout/orders — retrieve all orders for current user
router.get('/orders', (req, res) => {
  const userOrders = getAllOrders(req.userId);
  res.json({ orders: userOrders });
});

module.exports = router;
