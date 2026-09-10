const mongoose = require('mongoose');
const User = require('../models/User');
const memoryUsers = require('../models/memoryUsers');

/**
 * Resolve the authenticated user for ownership and role checks.
 *
 * Identity comes from the server-side session only. Client-supplied values such
 * as an x-user-id header or a userId body field are never trusted here, because
 * accepting them would let any caller act as another account, including an
 * administrator. Returns null for guests, locked, or deactivated accounts.
 */
async function resolveCurrentUser(req) {
  const sessionId = req.session && req.session.userId;
  if (!sessionId) return null;

  const userId = String(sessionId).trim();
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
