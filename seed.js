require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Blog = require('./models/Blog');
const Game = require('./models/Game');
const Product = require('./models/Product');
const User = require('./models/User');
const Thread = require('./models/Thread');
const Category = require('./models/Category');

const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    // Clear existing data
    await Blog.deleteMany({});
    await Game.deleteMany({});
    await Product.deleteMany({});
    await Thread.deleteMany({});
    await Category.deleteMany({});
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

    // Seed Forum Categories
    const categories = [
      { slug: 'general', name: 'General', description: 'General discussion about games and the Playnex community.' },
      { slug: 'support', name: 'Technical Support', description: 'Get help with connection, performance and setup issues.' },
      { slug: 'review', name: 'Product Review', description: 'Share and read reviews of games and merchandise.' },
      { slug: 'modding', name: 'Modding & Development', description: 'Mods, tools and game development discussion.' }
    ];
    for (const c of categories) {
      await Category.create(c);
    }
    console.log(`Seeded ${categories.length} forum categories`);

    // Seed Discussion Forum threads
    const now = Date.now();
    const threads = [
      {
        title: '[Elden Ring] Fixing co-op connection failures',
        content: "Me and a friend keep failing to summon each other for co-op in Elden Ring. We're both on the same NAT type, passwords match, but the connection keeps timing out. Any tips on fixing this?",
        game: 'elden-ring',
        tag: 'support',
        author: 'darknexus',
        authorId: null,
        views: 1200,
        createdAt: new Date(now - 3 * 60 * 60 * 1000),
        lastPostAuthor: 'netguru',
        lastPostAt: new Date(now - 90 * 60 * 1000),
        replies: [
          {
            author: 'script_master',
            content: 'Checking scoreboard logic every tick for every connected player over a VPN will drain your TPS. Schedule the check on an event trigger instead of looping it, and verify your VPN routing is not adding packet loss.',
            createdAt: new Date(now - 2 * 60 * 60 * 1000)
          },
          {
            author: 'netguru',
            content: 'Also profile with /tick health to confirm the source. Radmin LAN mode usually adds only 2-5ms; a datapack loop is the likely culprit.',
            createdAt: new Date(now - 90 * 60 * 1000)
          }
        ]
      },
      {
        title: '[The Witcher 3: Wild Hunt] Game of the Year Edition Review',
        content: "Just received the Embercrown Saga Collector's Edition throne figure. Sharing photos and thoughts on build quality, paint application, and packaging.",
        game: 'the-witcher-3',
        tag: 'review',
        author: 'cyber_fan',
        authorId: null,
        views: 3400,
        createdAt: new Date(now - 6 * 60 * 60 * 1000),
        lastPostAuthor: 'merch_guy',
        lastPostAt: new Date(now - 5 * 60 * 60 * 1000),
        replies: [
          {
            author: 'merch_guy',
            content: 'Paint application is clean on mine too. The throne base is heavier than expected, which is great for display stability.',
            createdAt: new Date(now - 5 * 60 * 60 * 1000)
          }
        ]
      }
    ];
    for (const t of threads) {
      await Thread.create(t);
    }
    console.log(`Seeded ${threads.length} forum threads`);

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
