const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Blog = require('../models/Blog');
const User = require('../models/User');
const memoryUsers = require('../models/memoryUsers');

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
  // Identity comes from the server-side session only. A body userId or
  // x-user-id header is client controlled and must not be trusted here.
  const sessionId = req.session && req.session.userId;
  if (!sessionId) return null;
  const userId = String(sessionId).trim();
  if (!userId || userId === 'guest-user') return null;

  const mem = memoryUsers.findMemoryUser((u) => u.id === userId);
  if (mem) {
    if (mem.isLocked || !mem.isActive) return null;
    return { _id: mem.id, name: mem.name, username: mem.username, email: mem.email, role: mem.role };
  }

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

function listPayload(blog) {
  return {
    id: blog._id,
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
  };
}

// ============================================================
// Blog pages (EJS views)
// ============================================================

router.get('/blog', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ date: -1 }).lean();
    const allTags = [];
    blogs.forEach((b) => {
      (b.tags || []).forEach((t) => {
        if (allTags.indexOf(t) === -1) allTags.push(t);
      });
    });
    res.render('blog', { posts: blogs.map(listPayload), allTags: allTags.sort() });
  } catch (err) {
    res.render('blog', { posts: [], allTags: [] });
  }
});

router.get('/blog/new', (req, res) => {
  res.render('writeblog', { post: null, errors: [], values: {}, isEdit: false });
});

router.get('/blog/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id).lean();
    if (!post) return res.status(404).send('Post not found');
    await Blog.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    post.views = (post.views || 0) + 1;
    res.render('detailblog', {
      post: { ...post, id: post._id },
      date: formatDate(post.date),
      blocks: parseBlocks(post.content),
      commentErrors: []
    });
  } catch (err) {
    res.status(404).send('Post not found');
  }
});

router.get('/blog/:id/edit', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id).lean();
    if (!post) return res.status(404).send('Post not found');
    res.render('writeblog', {
      post: { ...post, id: post._id },
      errors: [],
      values: { title: post.title, summary: post.summary, tags: (post.tags || []).join(', '), image: post.image || '', content: post.content },
      isEdit: true
    });
  } catch (err) {
    res.status(404).send('Post not found');
  }
});

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

  try {
    const post = await Blog.create({
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
    });
    res.redirect('/blog/' + post._id);
  } catch (err) {
    res.status(500).render('writeblog', { post: null, errors: ['Failed to create post.'], values: req.body, isEdit: false });
  }
});

router.post('/blog/:id/update', async (req, res) => {
  const user = await resolveUser(req);
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');

    if (!user) {
      return res.status(401).render('writeblog', {
        post: { ...post.toObject(), id: post._id },
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
      return res.status(400).render('writeblog', { post: { ...post.toObject(), id: post._id }, errors, values: req.body, isEdit: true });
    }

    post.title = values.title;
    post.summary = values.summary;
    post.content = values.content;
    post.tags = values.tags;
    post.image = values.image || null;
    await post.save();
    res.redirect('/blog/' + post._id);
  } catch (err) {
    res.status(500).send('Failed to update post');
  }
});

router.post('/blog/:id/delete', async (req, res) => {
  const user = await resolveUser(req);
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    if (!user) return res.redirect('/Login.html');
    if (post.authorId !== String(user._id)) {
      return res.status(403).send('You can only delete your own posts');
    }
    await Blog.findByIdAndDelete(req.params.id);
    res.redirect('/blog');
  } catch (err) {
    res.status(500).send('Failed to delete post');
  }
});

router.post('/blog/:id/comment', async (req, res) => {
  const user = await resolveUser(req);
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');

    const content = (req.body.content || '').trim();
    const commentErrors = [];
    if (!user) commentErrors.push('You must be logged in to comment.');
    if (!content) commentErrors.push('Comment cannot be blank.');
    else if (content.length > 1000) commentErrors.push('Comment must be at most 1,000 characters.');

    if (commentErrors.length) {
      return res.status(400).render('detailblog', {
        post: { ...post.toObject(), id: post._id },
        date: formatDate(post.date),
        blocks: parseBlocks(post.content),
        commentErrors
      });
    }

    post.comments.push({
      authorName: user.name || user.username,
      authorId: String(user._id),
      content,
      date: new Date().toISOString()
    });
    await post.save();
    res.redirect('/blog/' + post._id);
  } catch (err) {
    res.status(500).send('Failed to add comment');
  }
});

router.post('/blog/:id/comment/:commentId/delete', async (req, res) => {
  const user = await resolveUser(req);
  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).send('Comment not found');
    if (!user) return res.redirect('/Login.html');

    const isOwner = comment.authorId === String(user._id);
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).send('You can only delete your own comments');
    }

    post.comments.pull(req.params.commentId);
    await post.save();
    res.redirect('/blog/' + post._id);
  } catch (err) {
    res.status(500).send('Failed to delete comment');
  }
});

// ============================================================
// Blog JSON API
// ============================================================

router.get('/api/blogs', async (req, res) => {
  try {
    let query = {};
    const q = (req.query.q || '').trim();
    const tag = (req.query.tag || '').trim();
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { summary: { $regex: safe, $options: 'i' } },
        { content: { $regex: safe, $options: 'i' } },
        { authorName: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } }
      ];
    }
    if (tag) {
      query.tags = { $in: [new RegExp('^' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')] };
    }
    const blogs = await Blog.find(query).sort({ date: -1 }).lean();
    res.json(blogs.map(listPayload));
  } catch (err) {
    res.json([]);
  }
});

router.get('/api/blogs/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ error: 'Blog post not found.' });
    await Blog.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ ...post, id: post._id });
  } catch (err) {
    res.status(404).json({ error: 'Blog post not found.' });
  }
});

router.post('/api/blogs', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to write a post.' });

  const { errors, values } = validateBlogInput(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  try {
    const post = await Blog.create({
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
    });
    res.status(201).json({ message: 'Post published successfully.', post: { ...post.toObject(), id: post._id } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post.' });
  }
});

router.put('/api/blogs/:id', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to edit a post.' });

  try {
    const post = await Blog.findById(req.params.id);
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
    await post.save();
    res.json({ message: 'Post updated successfully.', post: { ...post.toObject(), id: post._id } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update post.' });
  }
});

router.delete('/api/blogs/:id', async (req, res) => {
  const user = await resolveUser(req);
  if (!user) return res.status(401).json({ error: 'You must be logged in to delete a post.' });

  try {
    const post = await Blog.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Blog post not found.' });
    if (post.authorId !== String(user._id)) {
      return res.status(403).json({ error: 'You can only delete your own posts.' });
    }
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post.' });
  }
});

module.exports = router;
