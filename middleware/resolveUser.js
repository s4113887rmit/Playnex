const mongoose = require('mongoose');
const User = require('../models/User');
const memoryUsers = require('../models/memoryUsers');

/**
 * Resolve the currently authenticated user.
 * Prefers the server-side session set on login, then falls back to the
 * x-user-id / body userId used by guest flows in the A2 prototype.
 * Returns null for guests, locked, or deactivated accounts.
 */
async function resolveCurrentUser(req) {
  const userId =
    (req.session && req.session.userId) ||
    (req.body && req.body.userId) ||
    req.userId ||
    '';
  if (!userId || userId === 'guest-user') return null;

  const mem = memoryUsers.findMemoryUser((u) => u.id === userId);
  if (mem) {
    if (mem.isLocked || !mem.isActive) return null;
    return mem;
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

function userIdOf(user) {
  if (!user) return null;
  return String(user._id || user.id || '');
}

module.exports = { resolveCurrentUser, userIdOf };
