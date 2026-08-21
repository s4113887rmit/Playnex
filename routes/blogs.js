const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const BLOGS_PATH = path.join(__dirname, '..', 'data', 'blogs.json');
const User = require('../models/User');
const memoryUsers = require('../models/memoryUsers');

function readBlogs() {
  let raw = fs.readFileSync(BLOGS_PATH, 'utf-8');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  return JSON.parse(raw);
}

function writeBlogs(blogs) {
  fs.writeFileSync(BLOGS_PATH, JSON.stringify(blogs, null, 2));
}

function newId(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + d.getFullYear();
}

function parseBlocks(content) {
  const blocks = [];
  String(content || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .forEach((block) => {
      if (block.startsWith('## ')) {
        blocks.push({ type: 'h2', text: block.slice(3).trim() });
      } else {
        blocks.push({ type: 'p', text: block.replace(/\n/g, ' ') });
      }
    });
  return blocks;
}

function validateBlogInput(body) {
  const errors = [];
  const title = (body.title || '').trim();
  const summary = (body.summary || '').trim();
  const content = (body.content || '').trim();
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim()).filter(Boolean)
    : String(body.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
  const image = (body.image || '').trim();

  if (!title) errors.push('Title is required');
  else if (title.length < 3) errors.push('Title must be at least 3 characters');
  else if (title.length > 120) errors.push('Title must be at most 120 characters');

  if (!summary) errors.push('Summary is required');
  else if (summary.length < 10) errors.push('Summary must be at least 10 characters');
  else if (summary.length > 300) errors.push('Summary must be at most 300 characters');

  if (!content) errors.push('Content is required');
  else if (content.length < 20) errors.push('Content must be at least 20 characters');
  else if (content.length > 20000) errors.push('Content must be at most 20,000 characters');

  if (!tags.length) errors.push('Add at least one tag');
  else if (tags.length > 5) errors.push('A post can have at most 5 tags');
  else if (tags.some((t) => t.length > 30)) errors.push('Each tag must be at most 30 characters');

  if (image && !/^https?:\/\/.+$/.test(image) && !/^\/?[a-zA-Z0-9_\-/]+\.(png|jpe?g|gif|webp)$/i.test(image)) {
    errors.push('Image must be a valid URL or a local image path');
  }

  return { errors, values: { title, summary, content, tags, image } };
}

async function resolveUser(req) {
  const userId = (req.body && req.body.userId) || req.userId || req.header('x-user-id') || '';
  if (!userId || userId === 'guest-user') return null;

  // 1) In-memory store (A2 prototype, no MongoDB required)
  const mem = memoryUsers.findMemoryUser((u) => u.id === userId);
  if (mem) {
    if (mem.isLocked || !mem.isActive) return null;
    return { _id: mem.id, name: mem.name, username: mem.username, email: mem.email, role: mem.role };
  }

  // 2) MongoDB (optional; used if the database is available)
  if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(userId)) {
    try {
      const user = await User.findById(userId);
      if (user && !user.isLocked && user.isActive) return user;
    } catch (err) {
      return null;
    }
  }
  return null;
}

function listPayload(blogs) {
  return blogs.map((blog) => ({
    id: blog.id,
    title: blog.title,
    summary: blog.summary,
    content: blog.content,
    tags: blog.tags,
    image: blog.image,
    authorName: blog.authorName,
    authorId: blog.authorId,
    date: blog.date,
    views: blog.views,
    commentCount: (blog.comments || []).length
  }));
}

// ============================================================
// Blog pages (EJS views)
// ============================================================

// GET /blog - list view. Posts are rendered server-side; search, sort and
// tag filtering all run client-side (see blog.ejs) without back-end calls.
router.get('/blog', (req, res) => {
  const blogs = readBlogs();
  const allTags = [];
  blogs.forEach((b) => {
    (b.tags || []).forEach((t) => {
      if (allTags.indexOf(t) === -1) allTags.push(t);
    });
  });
  res.render('blog', { posts: listPayload(blogs), allTags: allTags.sort() });
});

// GET /blog/new - write a new post
router.get('/blog/new', (req, res) => {
  res.render('writeblog', { post: null, errors: [], values: {}, isEdit: false });
});

// GET /blog/:id - detailed view with comments
router.get('/blog/:id', (req, res) => {
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');
  post.views = (post.views || 0) + 1;
  writeBlogs(blogs);

  res.render('detailblog', {
    post: post,
    date: formatDate(post.date),
    blocks: parseBlocks(post.content),
    commentErrors: []
  });
});

// GET /blog/:id/edit - edit form (ownership enforced again on POST)
router.get('/blog/:id/edit', (req, res) => {
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');
  res.render('writeblog', {
    post: post,
    errors: [],
    values: { title: post.title, summary: post.summary, tags: (post.tags || []).join(', '), image: post.image || '', content: post.content },
    isEdit: true
  });
});

// POST /blog/create
router.post('/blog/create', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) {
    return res.status(401).render('writeblog', {
      post: null,
      errors: ['You must be logged in to write a post.'],
      values: req.body,
      isEdit: false
    });
  }

  const { errors, values } = validateBlogInput(req.body);
  if (errors.length) {
    return res.status(400).render('writeblog', { post: null, errors, values: req.body, isEdit: false });
  }

  const blogs = readBlogs();
  const post = {
    id: newId('post'),
    title: values.title,
    summary: values.summary,
    content: values.content,
    tags: values.tags,
    image: values.image || null,
    authorName: user.name || user.username,
    authorId: String(user._id),
    date: new Date().toISOString(),
    views: 0,
    comments: []
  };
  blogs.unshift(post);
  writeBlogs(blogs);
  res.redirect('/blog/' + post.id);
});

// POST /blog/:id/update
router.post('/blog/:id/update', async (req, res) => {
  const user = await resolveUser(req);
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');

  if (!user) {
    return res.status(401).render('writeblog', {
      post,
      errors: ['You must be logged in to edit this post.'],
      values: req.body,
      isEdit: true
    });
  }
  if (post.authorId !== String(user._id)) {
    return res.status(403).send('You can only edit your own posts');
  }

  const { errors, values } = validateBlogInput(req.body);
  if (errors.length) {
    return res.status(400).render('writeblog', { post, errors, values: req.body, isEdit: true });
  }

  post.title = values.title;
  post.summary = values.summary;
  post.content = values.content;
  post.tags = values.tags;
  post.image = values.image || null;
  writeBlogs(blogs);
  res.redirect('/blog/' + post.id);
});

// POST /blog/:id/delete
router.post('/blog/:id/delete', async (req, res) => {
  const user = await resolveUser(req);
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');

  if (!user) return res.redirect('/Login.html');
  if (post.authorId !== String(user._id)) {
    return res.status(403).send('You can only delete your own posts');
  }

  writeBlogs(blogs.filter((b) => b.id !== post.id));
  res.redirect('/blog');
});

// POST /blog/:id/comment
router.post('/blog/:id/comment', async (req, res) => {
  const user = await resolveUser(req);
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');

  const content = (req.body.content || '').trim();
  const commentErrors = [];
  if (!user) commentErrors.push('You must be logged in to comment.');
  if (!content) commentErrors.push('Comment cannot be blank.');
  else if (content.length > 1000) commentErrors.push('Comment must be at most 1,000 characters.');

  if (commentErrors.length) {
    return res.status(400).render('detailblog', {
      post,
      date: formatDate(post.date),
      blocks: parseBlocks(post.content),
      commentErrors
    });
  }

  post.comments = post.comments || [];
  post.comments.push({
    id: newId('comment'),
    authorName: user.name || user.username,
    authorId: String(user._id),
    content,
    date: new Date().toISOString()
  });
  writeBlogs(blogs);
  res.redirect('/blog/' + post.id);
});

// POST /blog/:id/comment/:commentId/delete - comment owner or admin
router.post('/blog/:id/comment/:commentId/delete', async (req, res) => {
  const user = await resolveUser(req);
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).send('Post not found');

  const comment = (post.comments || []).find((c) => c.id === req.params.commentId);
  if (!comment) return res.status(404).send('Comment not found');
  if (!user) return res.redirect('/Login.html');

  const isOwner = comment.authorId === String(user._id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).send('You can only delete your own comments');
  }

  post.comments = post.comments.filter((c) => c.id !== req.params.commentId);
  writeBlogs(blogs);
  res.redirect('/blog/' + post.id);
});

// ============================================================
// Blog JSON API (used for dynamic retrieval / integration)
// ============================================================

// GET /api/blogs - list previews
router.get('/api/blogs', (req, res) => {
  let blogs = readBlogs();
  const q = (req.query.q || '').toLowerCase();
  const tag = (req.query.tag || '').toLowerCase();
  if (q) {
    blogs = blogs.filter((b) =>
      [b.title, b.summary, b.content, b.authorName, ...(b.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  if (tag) {
    blogs = blogs.filter((b) => (b.tags || []).some((t) => t.toLowerCase() === tag));
  }
  res.json(listPayload(blogs));
});

// GET /api/blogs/:id - full post (increments views)
router.get('/api/blogs/:id', (req, res) => {
  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Blog post not found.' });
  post.views = (post.views || 0) + 1;
  writeBlogs(blogs);
  res.json(post);
});

// POST /api/blogs - create (logged-in users only)
router.post('/api/blogs', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to write a post.' });

  const { errors, values } = validateBlogInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const blogs = readBlogs();
  const post = {
    id: newId('post'),
    title: values.title,
    summary: values.summary,
    content: values.content,
    tags: values.tags,
    image: values.image || null,
    authorName: user.name || user.username,
    authorId: String(user._id),
    date: new Date().toISOString(),
    views: 0,
    comments: []
  };
  blogs.unshift(post);
  writeBlogs(blogs);
  res.status(201).json({ message: 'Post published successfully.', post });
});

// PUT /api/blogs/:id - update own post
router.put('/api/blogs/:id', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to edit a post.' });

  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Blog post not found.' });
  if (post.authorId !== String(user._id)) {
    return res.status(403).json({ error: 'You can only edit your own posts.' });
  }

  const { errors, values } = validateBlogInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  post.title = values.title;
  post.summary = values.summary;
  post.content = values.content;
  post.tags = values.tags;
  post.image = values.image || null;
  writeBlogs(blogs);
  res.json({ message: 'Post updated successfully.', post });
});

// DELETE /api/blogs/:id - delete own post
router.delete('/api/blogs/:id', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to delete a post.' });

  const blogs = readBlogs();
  const post = blogs.find((b) => b.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Blog post not found.' });
  if (post.authorId !== String(user._id)) {
    return res.status(403).json({ error: 'You can only delete your own posts.' });
  }

  writeBlogs(blogs.filter((b) => b.id !== post.id));
  res.json({ message: 'Post deleted successfully.' });
});

module.exports = router;
