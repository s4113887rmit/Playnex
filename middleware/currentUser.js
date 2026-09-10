/**
 * currentUser.js — Middleware to identify the currently active user for API requests.
 * Uses server-side session (req.session.userId) when available.
 * Falls back to x-user-id header for guest users.
 */

module.exports = function currentUser(req, res, next) {
  // Prefer server-side session (set on login)
  if (req.session && req.session.userId) {
    req.userId = String(req.session.userId).trim();
    return next();
  }
  // Fallback to header for guest users
  const userId = req.header('x-user-id') || req.query.userId || 'guest-user';
  req.userId = String(userId).trim();
  next();
};
