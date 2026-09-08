require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Blog = require('./models/Blog');
const Game = require('./models/Game');
const Product = require('./models/Product');
const User = require('./models/User');

const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    // Clear existing data
    await Blog.deleteMany({});
    await Game.deleteMany({});
    await Product.deleteMany({});
    console.log('Cleared existing data');

    // Seed Blogs
    const blogsRaw = fs.readFileSync(path.join(__dirname, 'data', 'blogs.json'), 'utf-8');
    const blogsData = JSON.parse(blogsRaw);
    const blogs = blogsData.value || blogsData;
    for (const b of blogs) {
      await Blog.create({
        title: b.title,
        summary: b.summary,
        content: b.content,
        tags: b.tags || [],
        image: b.image || null,
        authorName: b.authorName,
        authorId: b.authorId || null,
        date: b.date || new Date().toISOString(),
        views: b.views || 0,
        comments: (b.comments || []).map((c) => ({
          authorName: c.authorName,
          authorId: c.authorId || null,
          content: c.content,
          date: c.date || new Date().toISOString()
        }))
      });
    }
    console.log(`Seeded ${blogs.length} blog posts`);

    // Seed Games
    const gamesRaw = fs.readFileSync(path.join(__dirname, 'data', 'games.json'), 'utf-8');
    const gamesData = JSON.parse(gamesRaw);
    const games = gamesData.value || gamesData;
    for (const g of games) {
      await Game.create({
        id: g.id,
        name: g.name,
        genre: g.genre,
        releaseDate: g.releaseDate,
        description: g.description,
        longDescription: g.longDescription,
        image: g.image,
        price: g.price,
        oldPrice: g.oldPrice || null,
        platforms: g.platforms || [],
        type: g.type || 'Digital',
        availability: g.availability || 'In stock',
        edition: g.edition || 'Standard edition',
        included: g.included || 'Full game + launcher access',
        features: g.features || [],
        reviews: (g.reviews || []).map((r) => ({
          author: r.author,
          authorId: r.authorId || null,
          date: r.date,
          stars: r.stars,
          title: r.title,
          content: r.content,
          image: r.image || ''
        }))
      });
    }
    console.log(`Seeded ${games.length} games`);

    // Seed Products
    const products = require('./data/products.js');
    for (const p of products) {
      await Product.create({
        id: p.id,
        title: p.title,
        category: p.category,
        genre: p.genre || '',
        platform: p.platform || '',
        price: p.price,
        oldPrice: p.oldPrice || null,
        image: p.image,
        art: p.art || '',
        badge: p.badge || null,
        availability: p.availability || 'in-stock',
        variant: p.variant || '',
        releaseYear: p.releaseYear || null,
        href: p.href || ''
      });
    }
    console.log(`Seeded ${products.length} products`);

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
