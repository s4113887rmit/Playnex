const express = require('express');
const router = express.Router();
const products = require('../data/products');
const { getWishlist, getCart, getStats } = require('../data/store');

function withWishlistDetails(entry) {
  const productId = typeof entry === 'string' ? entry : entry.productId;
  const purchased = typeof entry === 'object' ? !!entry.purchased : false;
  const addedAt = typeof entry === 'object' && entry.addedAt ? entry.addedAt : new Date().toISOString();

  const product = products.find(p => p.id === productId);
  if (!product) return null;

  return {
    ...product,
    purchased,
    addedAt,
    stats: getStats(productId)
  };
}

// GET /api/wishlist — retrieve user's wishlist
router.get('/', (req, res) => {
  const list = getWishlist(req.userId);
  const items = list.map(withWishlistDetails).filter(Boolean);
  const totalValue = items.reduce((sum, p) => sum + p.price, 0);
  const purchasedCount = items.filter(i => i.purchased).length;

  res.json({
    items,
    totalCount: items.length,
    savedCount: items.length - purchasedCount,
    purchasedCount,
    totalValue: Number(totalValue.toFixed(2))
  });
});

// POST /api/wishlist — add a product to wishlist
router.post('/', (req, res) => {
  const { productId } = req.body;

  if (!productId || typeof productId !== 'string') {
    return res.status(400).json({ error: 'Product ID is required and must be a valid string.' });
  }

  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: `Product "${productId}" does not exist in the catalogue.` });
  }

  const list = getWishlist(req.userId);
  const existing = list.find(entry => {
    const id = typeof entry === 'string' ? entry : entry.productId;
    return id === productId;
  });

  if (existing) {
    return res.status(409).json({ error: `${product.title} is already in your wishlist.` });
  }

  list.push({
    productId,
    addedAt: new Date().toISOString(),
    purchased: false
  });

  // Update global wishlist stats
  const stats = getStats(productId);
  stats.wishlistCount += 1;

  const items = list.map(withWishlistDetails).filter(Boolean);
  const totalValue = items.reduce((sum, p) => sum + p.price, 0);

  res.status(201).json({
    message: `${product.title} added to your wishlist.`,
    items,
    totalCount: items.length,
    totalValue: Number(totalValue.toFixed(2))
  });
});

// DELETE /api/wishlist/:productId — remove product from wishlist
router.delete('/:productId', (req, res) => {
  const { productId } = req.params;
  const list = getWishlist(req.userId);
  const index = list.findIndex(entry => {
    const id = typeof entry === 'string' ? entry : entry.productId;
    return id === productId;
  });

  if (index === -1) {
    return res.status(404).json({ error: 'Item not found in your wishlist.' });
  }

  list.splice(index, 1);
  const items = list.map(withWishlistDetails).filter(Boolean);
  const totalValue = items.reduce((sum, p) => sum + p.price, 0);

  res.json({
    message: 'Item removed from wishlist.',
    items,
    totalCount: items.length,
    totalValue: Number(totalValue.toFixed(2))
  });
});

// POST /api/wishlist/:productId/move-to-cart — move wishlist item to cart
router.post('/:productId/move-to-cart', (req, res) => {
  const { productId } = req.params;
  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: `Product "${productId}" not found.` });
  }

  const wishlist = getWishlist(req.userId);
  const wIndex = wishlist.findIndex(entry => {
    const id = typeof entry === 'string' ? entry : entry.productId;
    return id === productId;
  });

  if (wIndex === -1) {
    return res.status(404).json({ error: 'Item not found in your wishlist.' });
  }

  // Add to cart
  const cart = getCart(req.userId);
  const existingCartItem = cart.find(l => l.productId === productId);
  if (existingCartItem) {
    existingCartItem.qty += 1;
  } else {
    cart.push({ productId, qty: 1, variant: product.variant });
  }

  // Remove from wishlist
  wishlist.splice(wIndex, 1);

  // Update stats
  const stats = getStats(productId);
  stats.cartCount += 1;

  res.json({
    message: `${product.title} moved to your cart.`,
    cart,
    wishlist: wishlist.map(withWishlistDetails).filter(Boolean)
  });
});

// PUT /api/wishlist/:productId/purchased — toggle or mark as purchased
router.put('/:productId/purchased', (req, res) => {
  const { productId } = req.params;
  const { purchased } = req.body;

  const wishlist = getWishlist(req.userId);
  const entry = wishlist.find(e => {
    const id = typeof e === 'string' ? e : e.productId;
    return id === productId;
  });

  if (!entry) {
    return res.status(404).json({ error: 'Item not found in your wishlist.' });
  }

  if (typeof entry === 'object') {
    entry.purchased = purchased !== undefined ? !!purchased : !entry.purchased;
  }

  const items = wishlist.map(withWishlistDetails).filter(Boolean);
  res.json({
    message: 'Wishlist item updated.',
    items
  });
});

module.exports = router;
