const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');
const { resolveCurrentUser } = require('../middleware/resolveUser');

function formatDate(d) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function publicAdminUser(u) {
  return {
    id: String(u._id),
    username: u.username,
    status: u.isLocked ? 'locked' : 'normal',
    joined: formatDate(u.createdAt),
    lockedDate: u.isLocked ? formatDate(u.lockedAt) : undefined,
    reason: u.isLocked ? (u.lockReason || 'Manual Admin Lock') : undefined,
    avatarSeed: u.username,
    bio: u.description || '',
    flags: '0 active flags'
  };
}

async function requireAdmin(req, res, next) {
  const user = await resolveCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }
  req.admin = user;
  next();
}

// GET /api/users — list every registered account
router.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json(users.map(publicAdminUser));
  } catch (err) {
    console.error('Failed to list users:', err);
    res.status(500).json({ error: 'Failed to load users.' });
  }
});

// GET /api/users/:id — single account detail
router.get('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(publicAdminUser(user));
  } catch (err) {
    console.error('Failed to load user:', err);
    res.status(500).json({ error: 'Failed to load user.' });
  }
});

// POST /api/users/:id/toggle-lock — lock or unlock an account
router.post('/api/users/:id/toggle-lock', requireAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Administrator accounts cannot be locked.' });
    }

    if (target.isLocked) {
      target.isLocked = false;
      target.lockedAt = undefined;
      target.lockReason = undefined;
    } else {
      target.isLocked = true;
      target.lockedAt = new Date();
      target.lockReason = (req.body && req.body.reason) || 'Manual Admin Lock';
    }
    await target.save();

    res.json({
      message: `User status successfully updated to ${target.isLocked ? 'locked' : 'normal'}`,
      user: publicAdminUser(target)
    });
  } catch (err) {
    console.error('Failed to toggle lock:', err);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

module.exports = router;
