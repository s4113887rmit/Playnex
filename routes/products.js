const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { getStatsBatch, getOwnedDigitalIds } = require('../data/store');

const PROJECTION = '-_id -__v -createdAt -updatedAt';

// GET /api/products - list products from MongoDB with filtering and sorting
router.get('/', async (req, res) => {
  try {
    const { q, category, genre, platform, price, availability, sort } = req.query;
    const query = {};

    // Search filter
    if (q && q.trim()) {
      const term = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(term, 'i');
      query.$or = [{ title: re }, { genre: re }, { platform: re }];
    }

    // Category filter ('digital' | 'physical' | 'sale' | 'free')
    // 'deals' is kept as an alias so existing links keep working.
    if (category && category !== 'all') {
      if (category === 'digital' || category === 'physical') {
        query.category = category;
      } else if (category === 'sale' || category === 'deals') {
        // On sale: discounted, but never the free giveaways.
        query.price = { $gt: 0 };
        query.$expr = { $gt: ['$oldPrice', '$price'] };
      } else if (category === 'free') {
        query.price = 0;
      }
    }

    // Genre filter
    if (genre) {
      const genres = Array.isArray(genre) ? genre : [genre];
      query.genre = { $in: genres.map((g) => new RegExp(g.trim(), 'i')) };
    }

    // Platform filter
    if (platform) {
      const platforms = Array.isArray(platform) ? platform : [platform];
      query.platform = { $in: platforms.map((p) => new RegExp(p.trim(), 'i')) };
    }

    // Price filter
    if (price) {
      const prices = Array.isArray(price) ? price : [price];
      const clauses = [];
      prices.forEach((pr) => {
        if (pr === 'under-25') clauses.push({ price: { $lt: 25 } });
        else if (pr === '25-50') clauses.push({ price: { $gte: 25, $lte: 50 } });
        else if (pr === 'over-50') clauses.push({ price: { $gt: 50 } });
      });
      if (clauses.length) query.$and = (query.$and || []).concat([{ $or: clauses }]);
    }

    // Availability filter
    if (availability) {
      const avails = Array.isArray(availability) ? availability : [availability];
      query.availability = { $in: avails };
    }

    // Sorting
    const sortMap = {
      title: { title: 1 },
      name: { title: 1 },
      'price-asc': { price: 1 },
      'price-low': { price: 1 },
      'price-desc': { price: -1 },
      'price-high': { price: -1 },
      newest: { releaseYear: -1 },
      year: { releaseYear: -1 }
    };

    let list = await Product.find(query).select(PROJECTION).sort(sortMap[sort] || { title: 1 }).lean();

    // Attach cross-collection statistics
    const stats = await getStatsBatch(list.map((p) => p.id));

    // Mark the digital titles this account already owns so the storefront can
    // show them as unavailable instead of offering an impossible purchase.
    // Physical goods are never flagged: they can be re-ordered freely.
    const ownedIds = new Set(await getOwnedDigitalIds(req.userId));

    const enriched = list.map((p) => ({
      ...p,
      owned: ownedIds.has(String(p.id)),
      stats: stats[p.id] || { wishlistCount: 0, cartCount: 0, purchasedCount: 0 }
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Failed to list products:', err);
    res.json([]);
  }
});

// GET /api/products/:id - get a single product by id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id }).select(PROJECTION).lean();
    if (!product) {
      return res.status(404).json({ error: `Product with id "${req.params.id}" not found.` });
    }
    const stats = await getStatsBatch([product.id]);
    const ownedIds = await getOwnedDigitalIds(req.userId);
    res.json({
      ...product,
      owned: ownedIds.includes(String(product.id)),
      stats: stats[product.id] || { wishlistCount: 0, cartCount: 0, purchasedCount: 0 }
    });
  } catch (err) {
    console.error('Failed to load product:', err);
    res.status(500).json({ error: 'Failed to load product.' });
  }
});

module.exports = router;
