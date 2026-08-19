/**
 * currentUser.js — Middleware to identify the currently active user for API requests.
 * Compatible with the shared User Account module (which saves user details in localStorage / x-user-id header).
 */

module.exports = function currentUser(req, res, next) {
  const userId = req.header('x-user-id') || req.query.userId || req.body?.userId || 'guest-user';
  req.userId = String(userId).trim();
  next();
};
