const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getCart } = require('../data/store');

async function withProductDetails(line) {
  const product = await Product.findOne({ id: line.productId }).lean();
  if (!product) return null;
  return {
    productId: line.productId,
    qty: line.qty,
    variant: line.variant || '',
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

// GET /api/cart
router.get('/', async (req, res) => {
  try {
    const cart = await getCart(req.userId);
    const items = [];
    for (const line of cart.items) {
      const detail = await withProductDetails(line);
      if (detail) items.push(detail);
    }
    const totals = calculateTotals(items);
    res.json({ items, ...totals });
  } catch (err) {
    res.json({ items: [], subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0, itemCount: 0 });
  }
});

// POST /api/cart
router.post('/', async (req, res) => {
  try {
    const { productId, qty, variant } = req.body;
    const quantity = Number(qty) || 1;

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ error: 'Product ID is required.' });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be a whole number greater than 0.' });
    }

    const product = await Product.findOne({ id: productId }).lean();
    if (!product) {
      return res.status(404).json({ error: `Product "${productId}" does not exist.` });
    }

    const isDigital = product.category === 'digital' || !product.category;
    const cart = await getCart(req.userId);
    const existing = cart.items.find(l => l.productId === productId);

    if (existing) {
      if (!isDigital) existing.qty += quantity;
      if (variant) existing.variant = variant;
    } else {
      cart.items.push({
        productId,
        qty: isDigital ? 1 : quantity,
        variant: variant || product.variant
      });
    }
    await cart.save();

    const items = [];
    for (const line of cart.items) {
      const detail = await withProductDetails(line);
      if (detail) items.push(detail);
    }
    const totals = calculateTotals(items);

    res.status(201).json({
      message: `${product.title} added to your cart successfully.`,
      items,
      ...totals
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to cart.' });
  }
});

// PUT /api/cart/:productId
router.put('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { qty, variant } = req.body;
    const quantity = Number(qty);

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be a whole number greater than 0.' });
    }

    const cart = await getCart(req.userId);
    const line = cart.items.find(l => l.productId === productId);
    if (!line) return res.status(404).json({ error: 'Item not found in your cart.' });

    const product = await Product.findOne({ id: productId }).lean();
    if (!product) return res.status(404).json({ error: `Product "${productId}" does not exist.` });

    const isDigital = product.category === 'digital' || !product.category;
    line.qty = isDigital ? 1 : quantity;
    if (variant) line.variant = variant;
    await cart.save();

    const items = [];
    for (const c of cart.items) {
      const detail = await withProductDetails(c);
      if (detail) items.push(detail);
    }
    const totals = calculateTotals(items);

    res.json({ message: 'Cart item updated successfully.', items, ...totals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart.' });
  }
});

// DELETE /api/cart/:productId
router.delete('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await getCart(req.userId);
    const index = cart.items.findIndex(l => l.productId === productId);
    if (index === -1) return res.status(404).json({ error: 'Item not found in your cart.' });

    cart.items.splice(index, 1);
    await cart.save();

    const items = [];
    for (const line of cart.items) {
      const detail = await withProductDetails(line);
      if (detail) items.push(detail);
    }
    const totals = calculateTotals(items);

    res.json({ message: 'Item removed from cart.', items, ...totals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item.' });
  }
});

// DELETE /api/cart
router.delete('/', async (req, res) => {
  try {
    const cart = await getCart(req.userId);
    cart.items = [];
    await cart.save();
    res.json({ message: 'Cart cleared.', items: [], ...calculateTotals([]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cart.' });
  }
});

// POST /api/cart/promo
router.post('/promo', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Please enter a promo code.' });
    }

    const cleanCode = code.trim().toUpperCase();
    let discount = 0;
    if (cleanCode === 'PLAYNEX10') discount = 0.10;
    else if (cleanCode === 'PLAYNEX20') discount = 0.20;
    else if (cleanCode === 'FREESHIP') discount = 0.05;
    else return res.status(400).json({ error: 'Invalid or expired promo code.' });

    const cart = await getCart(req.userId);
    const items = [];
    for (const line of cart.items) {
      const detail = await withProductDetails(line);
      if (detail) items.push(detail);
    }
    const totals = calculateTotals(items, discount);

    res.json({
      message: `Promo code ${cleanCode} applied (${(discount * 100)}% discount)!`,
      promoCode: cleanCode,
      discountPercent: discount * 100,
      items,
      ...totals
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply promo.' });
  }
});

module.exports = router;
