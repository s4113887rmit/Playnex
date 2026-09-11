const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Game = require('../models/Game');
const { getCart, saveOrder, getOrder, getAllOrders, getOwnedDigitalIds } = require('../data/store');
const { resolveCurrentUser } = require('../middleware/resolveUser');

// Single source of truth for promo codes, shared by checkout so a discount
// shown in the cart is never dropped when the order is created.
const PROMO_CODES = {
  // Grand-opening launch voucher: 50% off every paid game (never free games).
  WELCOME2PLAYNEX: 0.50,
  PLAYNEX10: 0.10,
  PLAYNEX20: 0.20,
  FREESHIP: 0.05
};

async function findItem(productId) {
  let item = await Product.findOne({ id: productId }).lean();
  if (!item) {
    const numId = parseInt(productId);
    if (!isNaN(numId)) {
      item = await Game.findOne({ id: numId }).lean();
    }
  }
  if (!item) {
    const normalized = String(productId).toLowerCase().replace(/-/g, ' ');
    item = await Game.findOne({ $expr: { $eq: [{ $toLower: "$name" }, normalized] } }).lean();
  }
  return item;
}

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

function validateCheckout(body) {
  const errors = {};
  const delivery = body.delivery || {};
  const payment = body.payment || {};

  const fullName = (delivery.fullName || '').trim();
  if (!fullName || fullName.length < 2) errors.fullName = 'Full name is required.';
  else if (fullName.length > 100) errors.fullName = 'Full name cannot exceed 100 characters.';

  const phone = (delivery.phone || '').trim();
  if (!phone || !/^[0-9 +()-]{7,20}$/.test(phone)) errors.phone = 'Please enter a valid phone number.';

  const address = (delivery.address || '').trim();
  if (!address || address.length < 3) errors.address = 'Street address must be at least 3 characters.';
  else if (address.length > 200) errors.address = 'Street address cannot exceed 200 characters.';

  const city = (delivery.city || '').trim();
  if (!city || city.length < 2) errors.city = 'City is required.';

  const postalCode = (delivery.postalCode || '').trim();
  if (!postalCode || postalCode.length < 3) errors.postalCode = 'Postal code is required.';

  if (!delivery.country || typeof delivery.country !== 'string') errors.country = 'Please select a country.';

  let cardName = (payment.cardName || '').trim();
  cardName = cardName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z\s]/g, '').toUpperCase();
  if (!cardName || cardName.length < 2) errors.cardName = 'Name on card is required.';
  else if (!/^[A-Z\s]{2,100}$/.test(cardName)) errors.cardName = 'Name on card must contain only letters.';

  const rawCardNumber = (payment.cardNumber || '').replace(/\s+/g, '');
  if (!rawCardNumber || !/^[0-9]{15,19}$/.test(rawCardNumber)) errors.cardNumber = 'Card number must be 15-19 digits.';
  else if (!isValidLuhn(rawCardNumber)) errors.cardNumber = 'Card number is invalid.';

  const expiry = (payment.expiry || '').trim();
  const expiryMatch = expiry.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (!expiryMatch) errors.expiry = 'Expiry must be MM/YY format.';
  else {
    const month = parseInt(expiryMatch[1], 10);
    if (month < 1 || month > 12) errors.expiry = 'Invalid month.';
    else {
      const rawYear = parseInt(expiryMatch[2], 10);
      const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
      const expiryEnd = new Date(fullYear, month, 1);
      if (expiryEnd.getTime() <= Date.now()) errors.expiry = 'Card has expired.';
    }
  }

  const cvc = (payment.cvc || '').trim();
  if (!cvc || !/^[0-9]{2,6}$/.test(cvc)) errors.cvc = 'CVC is required.';

  return errors;
}

// POST /api/checkout
router.post('/', async (req, res) => {
  try {
    const errors = validateCheckout(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ error: 'Validation failed.', fields: errors });
    }

    const cart = await getCart(req.userId);
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }

    const items = [];
    for (const line of cart.items) {
      const product = await findItem(line.productId);
      if (!product) continue;
      items.push({
        productId: line.productId,
        title: product.title || product.name,
        price: product.price,
        qty: line.qty,
        variant: line.variant || product.variant,
        category: product.category,
        image: product.image,
        lineTotal: Number((product.price * line.qty).toFixed(2))
      });
    }

    if (items.length === 0) {
      return res.status(400).json({ error: 'No valid products found in cart.' });
    }

    // Final guard: a digital game can only be bought once per account. This is
    // checked again here because the cart is the last chance to stop a duplicate
    // purchase, and the cart itself may have been filled before ownership
    // changed (e.g. the same title bought in another tab).
    const ownedDigitalIds = await getOwnedDigitalIds(req.userId);
    const duplicate = items.find(i => ownedDigitalIds.includes(String(i.productId)));
    if (duplicate) {
      return res.status(409).json({
        error: `You already own ${duplicate.title}. A digital game can only be purchased once per account.`
      });
    }

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const hasPhysical = items.some(i => i.category === 'physical');
    const shipping = hasPhysical ? 6.00 : 0.00;

    // Re-validate the promo code server-side. The client only sends the code
    // string; the discount percentage is always looked up here so the totals
    // on the order match what the cart and checkout summary displayed.
    const rawPromo = String(req.body.promoCode || '').trim().toUpperCase();
    const promoPercent = PROMO_CODES[rawPromo] || 0;

    const discount = Number((subtotal * promoPercent).toFixed(2));
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = Number((taxableAmount * 0.083).toFixed(2));
    const total = Number((taxableAmount + shipping + tax).toFixed(2));

    const rawCard = String(req.body.payment.cardNumber).replace(/\s+/g, '');
    const last4 = rawCard.slice(-4);

    const order = await saveOrder({
      userId: req.userId,
      items,
      subtotal: Number(subtotal.toFixed(2)),
      shipping: Number(shipping.toFixed(2)),
      tax,
      discount,
      promoCode: promoPercent > 0 ? rawPromo : '',
      total,
      shippingInfo: {
        firstName: req.body.delivery.fullName.split(' ')[0],
        lastName: req.body.delivery.fullName.split(' ').slice(1).join(' '),
        email: req.body.delivery.email || '',
        phone: req.body.delivery.phone,
        address: req.body.delivery.address,
        city: req.body.delivery.city,
        postalCode: req.body.delivery.postalCode,
        country: req.body.delivery.country
      },
      paymentInfo: {
        cardLast4: last4,
        cardType: 'Credit'
      }
    });

    cart.items = [];
    await cart.save();

    res.status(201).json({ message: 'Order created successfully!', order });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to process checkout.' });
  }
});

// GET /api/checkout/order/:id
router.get('/order/:id', async (req, res) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Admin access is granted by the account role resolved from the server-side
    // session, never by matching a hardcoded user id string.
    let isAdmin = false;
    try {
      const user = await resolveCurrentUser(req);
      isAdmin = !!user && String(user.role).toLowerCase() === 'admin';
    } catch (err) {
      isAdmin = false;
    }

    if (order.userId && order.userId !== req.userId && !isAdmin) {
      return res.status(403).json({ error: 'Permission denied.' });
    }
    res.json({ order });
  } catch (err) {
    res.status(404).json({ error: 'Order not found.' });
  }
});

// GET /api/checkout/orders
router.get('/orders', async (req, res) => {
  try {
    const userOrders = await getAllOrders(req.userId);
    res.json({ orders: userOrders });
  } catch (err) {
    res.json({ orders: [] });
  }
});

module.exports = router;
