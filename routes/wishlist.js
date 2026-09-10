const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Game = require('../models/Game');
const { getWishlist, getCart, getStats } = require('../data/store');

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

async function withWishlistDetails(entry) {
  const productId = typeof entry === 'string' ? entry : entry.productId;
  const purchased = typeof entry === 'object' ? !!entry.purchased : false;
  const addedAt = typeof entry === 'object' && entry.addedAt ? entry.addedAt : new Date().toISOString();

  const product = await findItem(productId);
  if (!product) return null;

  return {
    ...product,
    purchased,
    addedAt,
    stats: await getStats(productId)
  };
}

async function withRemovedDetails(entry) {
  const productId = entry.productId;
  const addedAt = entry.addedAt;
  const removedAt = entry.removedAt;

  const product = await findItem(productId);
  if (!product) return null;

  return {
    ...product,
    addedAt,
    removedAt
  };
}

// GET /api/wishlist
router.get('/', async (req, res) => {
  try {
    const wishlist = await getWishlist(req.userId);
    const items = [];
    for (const entry of wishlist.items) {
      const detail = await withWishlistDetails(entry);
      if (detail) items.push(detail);
    }
    const totalValue = items.reduce((sum, p) => sum + p.price, 0);
    const purchasedCount = items.filter(i => i.purchased).length;

    res.json({
      items,
      totalValue: Number(totalValue.toFixed(2)),
      itemCount: items.length,
      purchasedCount
    });
  } catch (err) {
    res.json({ items: [], totalValue: 0, itemCount: 0, purchasedCount: 0 });
  }
});

// GET /api/wishlist/history (removed items bin)
router.get('/history', async (req, res) => {
  try {
    const wishlist = await getWishlist(req.userId);
    const items = [];
    for (const entry of (wishlist.removedItems || [])) {
      const detail = await withRemovedDetails(entry);
      if (detail) items.push(detail);
    }
    res.json({ items, itemCount: items.length });
  } catch (err) {
    res.json({ items: [], itemCount: 0 });
  }
});

// POST /api/wishlist
router.post('/', async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ error: 'Product ID is required.' });
    }

    const product = await findItem(productId);
    if (!product) {
      return res.status(404).json({ error: `Product "${productId}" does not exist.` });
    }

    const wishlist = await getWishlist(req.userId);
    const existing = wishlist.items.find(e => (typeof e === 'string' ? e : e.productId) === productId);
    if (existing) {
      return res.status(409).json({ error: 'Product is already in your wishlist.' });
    }

    // Remove from bin if it was there
    const removedIndex = (wishlist.removedItems || []).findIndex(e => e.productId === productId);
    if (removedIndex !== -1) {
      wishlist.removedItems.splice(removedIndex, 1);
    }

    wishlist.items.push({ productId, addedAt: new Date().toISOString(), purchased: false });
    await wishlist.save();

    const items = [];
    for (const entry of wishlist.items) {
      const detail = await withWishlistDetails(entry);
      if (detail) items.push(detail);
    }

    res.status(201).json({
      message: `${product.title} added to your wishlist.`,
      items,
      itemCount: items.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to wishlist.' });
  }
});

// POST /api/wishlist/:productId/move-to-cart
router.post('/:productId/move-to-cart', async (req, res) => {
  try {
    const { productId } = req.params;
    const wishlist = await getWishlist(req.userId);
    const index = wishlist.items.findIndex(e => (typeof e === 'string' ? e : e.productId) === productId);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found in your wishlist.' });
    }

    const product = await findItem(productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const cart = await getCart(req.userId);
    const existing = cart.items.find(l => l.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.items.push({ productId, qty: 1, variant: product.variant || '' });
    }
    await cart.save();

    // Move to bin before removing from active list
    const entry = wishlist.items[index];
    if (!wishlist.removedItems) wishlist.removedItems = [];
    wishlist.removedItems.unshift({
      productId,
      addedAt: entry.addedAt || new Date(),
      removedAt: new Date()
    });

    wishlist.items.splice(index, 1);
    await wishlist.save();

    res.json({ message: `${product.title} moved to cart.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to move to cart.' });
  }
});

// POST /api/wishlist/:productId/purchase
router.post('/:productId/purchase', async (req, res) => {
  try {
    const { productId } = req.params;
    const wishlist = await getWishlist(req.userId);
    const entry = wishlist.items.find(e => (typeof e === 'string' ? e : e.productId) === productId);
    if (!entry) {
      return res.status(404).json({ error: 'Product not found in your wishlist.' });
    }
    if (typeof entry === 'object') entry.purchased = true;
    await wishlist.save();

    res.json({ message: 'Item marked as purchased.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as purchased.' });
  }
});

// DELETE /api/wishlist/:productId (soft-delete: move to bin)
router.delete('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const wishlist = await getWishlist(req.userId);
    const index = wishlist.items.findIndex(e => (typeof e === 'string' ? e : e.productId) === productId);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found in your wishlist.' });
    }

    const entry = wishlist.items[index];
    if (!wishlist.removedItems) wishlist.removedItems = [];
    wishlist.removedItems.unshift({
      productId,
      addedAt: entry.addedAt || new Date(),
      removedAt: new Date()
    });

    wishlist.items.splice(index, 1);
    await wishlist.save();

    res.json({ message: 'Item removed from wishlist.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item.' });
  }
});

// POST /api/wishlist/history/:productId/restore (restore from bin)
router.post('/history/:productId/restore', async (req, res) => {
  try {
    const { productId } = req.params;
    const wishlist = await getWishlist(req.userId);
    const removedItems = wishlist.removedItems || [];
    const index = removedItems.findIndex(e => e.productId === productId);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found in bin.' });
    }

    // Check if already in active wishlist
    const alreadyActive = wishlist.items.find(e => (typeof e === 'string' ? e : e.productId) === productId);
    if (alreadyActive) {
      // Just remove from bin
      removedItems.splice(index, 1);
      await wishlist.save();
      return res.json({ message: 'Item is already in your wishlist.' });
    }

    removedItems.splice(index, 1);
    wishlist.items.push({ productId, addedAt: new Date().toISOString(), purchased: false });
    await wishlist.save();

    res.json({ message: 'Item restored to your wishlist.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore item.' });
  }
});

// DELETE /api/wishlist/history/:productId (permanent delete from bin)
router.delete('/history/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const wishlist = await getWishlist(req.userId);
    const removedItems = wishlist.removedItems || [];
    const index = removedItems.findIndex(e => e.productId === productId);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found in bin.' });
    }

    removedItems.splice(index, 1);
    await wishlist.save();

    res.json({ message: 'Item permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});

module.exports = router;
