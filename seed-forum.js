/**
 * seed-forum.js - Non-destructive seeder for the Discussion Forum module.
 *
 * Use this on a live database to create the forum categories and demo threads
 * without touching any other collection. Running seed.js instead will clear and
 * rebuild blogs, games and products, which is only appropriate for a fresh setup.
 *
 * Safe to run repeatedly: categories are upserted and threads are only created
 * when the Thread collection is empty.
 */
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();
const mongoose = require('mongoose');

const Thread = require('./models/Thread');
const Category = require('./models/Category');

const MONGODB_URI = process.env.MONGODB_URI;

const CATEGORIES = [
  { slug: 'general', name: 'General', description: 'General discussion about games and the Playnex community.' },
  { slug: 'support', name: 'Technical Support', description: 'Get help with connection, performance and setup issues.' },
  { slug: 'review', name: 'Product Review', description: 'Share and read reviews of games and merchandise.' },
  { slug: 'modding', name: 'Modding & Development', description: 'Mods, tools and game development discussion.' }
];

function demoThreads() {
  const now = Date.now();
  return [
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
}

async function seedForum() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected to MongoDB Atlas');

    for (const c of CATEGORIES) {
      await Category.updateOne({ slug: c.slug }, { $set: c }, { upsert: true });
    }
    console.log(`Upserted ${CATEGORIES.length} forum categories`);

    const existing = await Thread.countDocuments();
    if (existing > 0) {
      console.log(`Thread collection already has ${existing} thread(s); no demo threads added.`);
    } else {
      const threads = demoThreads();
      for (const t of threads) {
        await Thread.create(t);
      }
      console.log(`Seeded ${threads.length} demo forum threads`);
    }

    console.log('Forum seed complete. No other collections were modified.');
    process.exit(0);
  } catch (err) {
    console.error('Forum seed failed:', err.message);
    process.exit(1);
  }
}

seedForum();
