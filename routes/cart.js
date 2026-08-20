const express = require('express');
const router = express.Router();
const products = require('../data/products');
const { getCart, getStats } = require('../data/store');

function withProductDetails(line) {
  const product = products.find(p => p.id === line.productId);
  if (!product) return null;
  return {
    ...line,
    product,
    lineTotal: Number((product.price * line.qty).toFixed(2))
  };
}

function calculateTotals(items, promoDiscount = 0) {
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const hasPhysical = items.some(i => i.product.category === 'physical');
  const shipping = items.length === 0 ? 0 : (hasPhysical ? 6.00 : 0.00);
  const discountAmount = Number((subtotal * promoDiscount).toFixed(2));
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const tax = Number((taxableAmount * 0.083).toFixed(2));
  const total = Number((taxableAmount + shipping + tax).toFixed(2));
  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  return {
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    tax,
    discount: discountAmount,
    total,
    itemCount
  };
}

// GET /api/cart — get current user's cart
router.get('/', (req, res) => {
  const cart = getCart(req.userId);
  const items = cart.map(withProductDetails).filter(Boolean);
  const totals = calculateTotals(items);
  res.json({ items, ...totals });
});

// POST /api/cart — add item to cart (or increase quantity)
router.post('/', (req, res) => {
  const { productId, qty, variant } = req.body;
  const quantity = Number(qty) || 1;

  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: 'Product ID is required and must be a valid string.' });
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Quantity must be a whole number between 1 and 10.' });
  }

  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: `Product "${productId}" does not exist in the catalogue.` });
  }

  const cart = getCart(req.userId);
  const existing = cart.find(l => l.productId === productId);

  if (existing) {
    if (existing.qty + quantity > 10) {
      return res.status(400).json({ 
        error: `Cannot add ${quantity} more. Maximum allowed quantity per item is 10 (you already have ${existing.qty} in your cart).` 
      });
    }
    existing.qty += quantity;
    if (variant) existing.variant = variant;
  } else {
    cart.push({
      productId,
      qty: quantity,
      variant: variant || product.variant
    });
  }

  // Update product stats
  const stats = getStats(productId);
  stats.cartCount += quantity;

  const items = cart.map(withProductDetails).filter(Boolean);
  const totals = calculateTotals(items);

  res.status(201).json({
    message: `${product.title} added to your cart successfully.`,
    items,
    ...totals
  });
});

// PUT /api/cart/:productId — update quantity of a cart item
router.put('/:productId', (req, res) => {
  const { productId } = req.params;
  const { qty, variant } = req.body;
  const quantity = Number(qty);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'Quantity must be a whole number between 1 and 10.' });
  }

  const cart = getCart(req.userId);
  const line = cart.find(l => l.productId === productId);

  if (!line) {
    return res.status(404).json({ error: 'Item not found in your cart.' });
  }

  line.qty = quantity;
  if (variant) line.variant = variant;

  const items = cart.map(withProductDetails).filter(Boolean);
  const totals = calculateTotals(items);

  res.json({
    message: 'Cart item updated successfully.',
    items,
    ...totals
  });
});

// DELETE /api/cart/:productId — remove item from cart
router.delete('/:productId', (req, res) => {
  const { productId } = req.params;
  const cart = getCart(req.userId);
  const index = cart.findIndex(l => l.productId === productId);

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found in your cart.' });
  }

  cart.splice(index, 1);
  const items = cart.map(withProductDetails).filter(Boolean);
  const totals = calculateTotals(items);

  res.json({
    message: 'Item removed from cart.',
    items,
    ...totals
  });
});

// DELETE /api/cart — clear entire cart
router.delete('/', (req, res) => {
  const cart = getCart(req.userId);
  cart.length = 0;
  res.json({
    message: 'Cart cleared.',
    items: [],
    ...calculateTotals([])
  });
});

// POST /api/cart/promo — validate and apply promo code
router.post('/promo', (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Please enter a promo code.' });
  }

  const cleanCode = code.trim().toUpperCase();
  let discount = 0;

  if (cleanCode === 'PLAYNEX10') {
    discount = 0.10; // 10% off
  } else if (cleanCode === 'PLAYNEX20') {
    discount = 0.20; // 20% off
  } else if (cleanCode === 'FREESHIP') {
    discount = 0.05; // 5% discount
  } else {
    return res.status(400).json({ error: 'Invalid or expired promo code.' });
  }

  const cart = getCart(req.userId);
  const items = cart.map(withProductDetails).filter(Boolean);
  const totals = calculateTotals(items, discount);

  res.json({
    message: `Promo code ${cleanCode} applied (${(discount * 100)}% discount)!`,
    promoCode: cleanCode,
    discountPercent: discount * 100,
    items,
    ...totals
  });
});

module.exports = router;
