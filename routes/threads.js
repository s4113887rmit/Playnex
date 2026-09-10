const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Thread = require('../models/Thread');
const Category = require('../models/Category');
const { resolveCurrentUser, userIdOf } = require('../middleware/resolveUser');

function timeAgo(date) {
  const ts = date ? new Date(date).getTime() : NaN;
  if (!ts || isNaN(ts)) return 'Just now';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + ' hour' + (hours > 1 ? 's' : '') + ' ago';
  const days = Math.floor(hours / 24);
  return days + ' day' + (days > 1 ? 's' : '') + ' ago';
}

function tagClassFor(tag) {
  if (tag === 'support') return 'tag--support';
  if (tag === 'review') return 'tag--review';
  if (tag === 'modding') return 'tag--modding';
  return 'tag--general';
}

function visibleReplies(thread) {
  return (thread.replies || []).filter((r) => !r.deleted);
}

function isOwnerOrAdmin(ownerId, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!ownerId && String(ownerId) === userIdOf(user);
}

function publicThread(thread) {
  const replies = visibleReplies(thread);
  return {
    id: String(thread._id),
    title: thread.title,
    content: thread.content,
    game: thread.game || '',
    author: thread.author,
    authorId: thread.authorId,
    tag: thread.tag,
    tagClass: tagClassFor(thread.tag),
    replies: replies.length,
    views: thread.views || 0,
    lastPostAuthor: thread.lastPostAuthor || thread.author,
    lastPostTime: timeAgo(thread.lastPostAt),
    image: thread.image || undefined,
    createdAt: thread.createdAt,
    lastPostAt: thread.lastPostAt
  };
}

function publicPosts(thread) {
  return visibleReplies(thread).map((r) => ({
    id: String(r._id),
    author: r.author,
    authorId: r.authorId,
    content: r.content,
    image: r.image || undefined,
    createdAt: r.createdAt,
    timeAgo: timeAgo(r.createdAt)
  }));
}

async function loadThread(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Thread.findById(id);
}

async function isValidCategory(tag) {
  try {
    return !!(await Category.findOne({ slug: tag }));
  } catch (err) {
    return ['general', 'support', 'review', 'modding'].indexOf(tag) !== -1;
  }
}

// GET /api/threads — list threads with optional search, category filter and sort
router.get('/api/threads', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const tag = (req.query.tag || '').trim().toLowerCase();
    const sort = (req.query.sort || 'latest').trim();

    const query = { deleted: false };
    if (tag) query.tag = tag;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: re }, { content: re }, { author: re }];
    }

    const sortMap = {
      latest: { lastPostAt: -1 },
      'oldest-activity': { lastPostAt: 1 },
      newest: { createdAt: -1 },
      'newest-thread': { createdAt: -1 },
      'oldest-thread': { createdAt: 1 },
      oldest: { createdAt: 1 },
      views: { views: -1 },
      title: { title: 1 }
    };

    const threads = await Thread.find(query).sort(sortMap[sort] || sortMap.latest);
    res.json(threads.map(publicThread));
  } catch (err) {
    console.error('Failed to list threads:', err);
    res.json([]);
  }
});

// POST /api/threads — create a new thread
router.post('/api/threads', async (req, res) => {
  try {
    const user = await resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to create a thread.' });
    }

    const { title, game, category, content, image } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Thread title is strictly required.' });
    }
    if (title.trim().length > 150) {
      return res.status(400).json({ error: 'Thread title must be at most 150 characters.' });
    }
    if (!category || !String(category).trim()) {
      return res.status(400).json({ error: 'A category selection is required.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Post content must be at most 5000 characters.' });
    }

    const tag = String(category).trim().toLowerCase();
    if (!(await isValidCategory(tag))) {
      return res.status(400).json({ error: 'That category does not exist.' });
    }

    const sanitizedImage =
      typeof image === 'string' && image.startsWith('data:image/')
        ? image.slice(0, 300000)
        : null;

    const authorName = user.name || user.username;
    const thread = await Thread.create({
      title: title.trim(),
      content: content.trim(),
      game: game || '',
      tag,
      image: sanitizedImage,
      author: authorName,
      authorId: userIdOf(user),
      views: 0,
      replies: [],
      lastPostAuthor: authorName,
      lastPostAt: new Date()
    });

    res.status(201).json({ message: 'Thread created successfully!', thread: publicThread(thread) });
  } catch (err) {
    console.error('Failed to create thread:', err);
    res.status(500).json({ error: 'Failed to create thread.' });
  }
});

// GET /api/threads/:id — single thread with its replies
router.get('/api/threads/:id', async (req, res) => {
  try {
    const thread = await loadThread(req.params.id);
    if (!thread || thread.deleted) {
      return res.status(404).json({ error: 'Thread not found.' });
    }
    thread.views = (thread.views || 0) + 1;
    await thread.save();

    res.json({ ...publicThread(thread), posts: publicPosts(thread) });
  } catch (err) {
    console.error('Failed to load thread:', err);
    res.status(404).json({ error: 'Thread not found.' });
  }
});

// POST /api/threads/:id/replies — reply to a thread
router.post('/api/threads/:id/replies', async (req, res) => {
  try {
    const thread = await loadThread(req.params.id);
    if (!thread || thread.deleted) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const user = await resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to reply.' });
    }

    const content = (req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'Reply content cannot be empty.' });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Reply content must be at most 2000 characters.' });
    }

    const authorName = user.name || user.username;
    thread.replies.push({
      author: authorName,
      authorId: userIdOf(user),
      content,
      image: null,
      deleted: false,
      createdAt: new Date()
    });
    thread.lastPostAuthor = authorName;
    thread.lastPostAt = new Date();
    await thread.save();

    const reply = thread.replies[thread.replies.length - 1];
    res.status(201).json({
      message: 'Reply posted successfully.',
      reply: { id: String(reply._id), author: reply.author, authorId: reply.authorId, content: reply.content, createdAt: reply.createdAt, timeAgo: 'Just now' }
    });
  } catch (err) {
    console.error('Failed to add reply:', err);
    res.status(500).json({ error: 'Failed to add reply.' });
  }
});

// PUT /api/threads/:id — edit a thread (owner or admin)
router.put('/api/threads/:id', async (req, res) => {
  try {
    const thread = await loadThread(req.params.id);
    if (!thread || thread.deleted) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const user = await resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to edit a thread.' });
    }
    if (!isOwnerOrAdmin(thread.authorId, user)) {
      return res.status(403).json({ error: 'You can only edit your own threads.' });
    }

    const title = (req.body.title || '').trim();
    const content = (req.body.content || '').trim();
    if (!title) return res.status(400).json({ error: 'Thread title is strictly required.' });
    if (!content) return res.status(400).json({ error: 'Post content cannot be empty.' });
    if (title.length > 150) return res.status(400).json({ error: 'Thread title must be at most 150 characters.' });
    if (content.length > 5000) return res.status(400).json({ error: 'Post content must be at most 5000 characters.' });

    thread.title = title;
    thread.content = content;
    if (typeof req.body.image === 'string' && req.body.image.startsWith('data:image/')) {
      thread.image = req.body.image.slice(0, 300000);
    }
    thread.lastPostAt = new Date();
    await thread.save();

    res.json({ message: 'Thread updated successfully.', thread: publicThread(thread) });
  } catch (err) {
    console.error('Failed to update thread:', err);
    res.status(500).json({ error: 'Failed to update thread.' });
  }
});

// PUT /api/threads/:id/replies/:replyId — edit a reply (owner or admin)
router.put('/api/threads/:id/replies/:replyId', async (req, res) => {
  try {
    const thread = await loadThread(req.params.id);
    if (!thread || thread.deleted) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const reply = thread.replies.id(req.params.replyId);
    if (!reply || reply.deleted) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    const user = await resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to edit a reply.' });
    }
    if (!isOwnerOrAdmin(reply.authorId, user)) {
      return res.status(403).json({ error: 'You can only edit your own replies.' });
    }

    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Reply content cannot be empty.' });
    if (content.length > 2000) return res.status(400).json({ error: 'Reply content must be at most 2000 characters.' });

    reply.content = content;
    await thread.save();

    res.json({
      message: 'Reply updated successfully.',
      reply: { id: String(reply._id), author: reply.author, authorId: reply.authorId, content: reply.content, createdAt: reply.createdAt, timeAgo: timeAgo(reply.createdAt) }
    });
  } catch (err) {
    console.error('Failed to update reply:', err);
    res.status(500).json({ error: 'Failed to update reply.' });
  }
});

// DELETE /api/threads/:id — soft-delete a thread (retained for auditing)
router.delete('/api/threads/:id', async (req, res) => {
  try {
    const thread = await loadThread(req.params.id);
    if (!thread || thread.deleted) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const user = await resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to delete a thread.' });
    }
    if (!isOwnerOrAdmin(thread.authorId, user)) {
      return res.status(403).json({ error: 'You can only delete your own threads.' });
    }

    thread.deleted = true;
    await thread.save();
    res.json({ message: 'Thread successfully deleted.' });
  } catch (err) {
    console.error('Failed to delete thread:', err);
    res.status(500).json({ error: 'Failed to delete thread.' });
  }
});

// DELETE /api/threads/:id/replies/:replyId — soft-delete a reply (retained for auditing)
router.delete('/api/threads/:id/replies/:replyId', async (req, res) => {
  try {
    const thread = await loadThread(req.params.id);
    if (!thread || thread.deleted) {
      return res.status(404).json({ error: 'Thread not found.' });
    }

    const reply = thread.replies.id(req.params.replyId);
    if (!reply || reply.deleted) {
      return res.status(404).json({ error: 'Reply not found.' });
    }

    const user = await resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to delete a reply.' });
    }
    if (!isOwnerOrAdmin(reply.authorId, user)) {
      return res.status(403).json({ error: 'You can only delete your own replies.' });
    }

    reply.deleted = true;
    thread.lastPostAt = new Date();
    await thread.save();
    res.json({ message: 'Reply successfully deleted.' });
  } catch (err) {
    console.error('Failed to delete reply:', err);
    res.status(500).json({ error: 'Failed to delete reply.' });
  }
});

module.exports = router;
