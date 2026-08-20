const express = require('express');
const router = express.Router();
const products = require('../data/products');
const { getStats } = require('../data/store');

// GET /api/products — list products with optional filtering & sorting
router.get('/', (req, res) => {
  let list = [...products];

  const { q, category, genre, platform, price, availability, sort } = req.query;

  // Search filter
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    list = list.filter(p => 
      p.title.toLowerCase().includes(term) ||
      p.genre.toLowerCase().includes(term) ||
      p.platform.toLowerCase().includes(term)
    );
  }

  // Category filter ('digital' | 'physical' | 'deals' | 'free')
  if (category && category !== 'all') {
    if (category === 'digital' || category === 'physical') {
      list = list.filter(p => p.category === category);
    } else if (category === 'deals') {
      list = list.filter(p => p.oldPrice && p.oldPrice > p.price);
    } else if (category === 'free') {
      list = list.filter(p => p.price === 0);
    }
  }

  // Genre filter
  if (genre) {
    const genres = Array.isArray(genre) ? genre : [genre];
    list = list.filter(p => genres.some(g => p.genre.toLowerCase() === g.toLowerCase()));
  }

  // Platform filter
  if (platform) {
    const platforms = Array.isArray(platform) ? platform : [platform];
    list = list.filter(p => platforms.some(plat => p.platform.toLowerCase().includes(plat.toLowerCase())));
  }

  // Price filter
  if (price) {
    const prices = Array.isArray(price) ? price : [price];
    list = list.filter(p => {
      return prices.some(pr => {
        if (pr === 'under-25') return p.price < 25;
        if (pr === '25-50') return p.price >= 25 && p.price <= 50;
        if (pr === 'over-50') return p.price > 50;
        return true;
      });
    });
  }

  // Availability filter
  if (availability) {
    const avails = Array.isArray(availability) ? availability : [availability];
    list = list.filter(p => avails.some(a => (p.availability || 'in-stock') === a));
  }

  // Sorting
  if (sort) {
    if (sort === 'title' || sort === 'name') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'price-asc' || sort === 'price-low') {
      list.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc' || sort === 'price-high') {
      list.sort((a, b) => b.price - a.price);
    } else if (sort === 'newest') {
      list.sort((a, b) => (b.releaseYear || 0) - (a.releaseYear || 0));
    }
  }

  // Attach stats to products
  const enriched = list.map(p => ({
    ...p,
    stats: getStats(p.id)
  }));

  res.json(enriched);
});

// GET /api/products/:id — get product by id
router.get('/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: `Product with id "${req.params.id}" not found.` });
  }
  res.json({
    ...product,
    stats: getStats(product.id)
  });
});

module.exports = router;
