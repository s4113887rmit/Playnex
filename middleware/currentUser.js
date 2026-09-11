/**
 * currentUser.js - Identifies the active user for store requests.
 *
 * The authoritative identity is the server-side session set at login. When no
 * session exists, the caller is treated as a guest. The per-browser guest id is
 * only accepted when it matches the guest id format issued by the client, so a
 * caller can never claim to be a registered account by sending an id directly.
 */

const GUEST_ID_PATTERN = /^guest_[a-z0-9]+$/;

module.exports = function currentUser(req, res, next) {
  if (req.session && req.session.userId) {
    req.userId = String(req.session.userId).trim();
    return next();
  }

  const claimed = String(req.header('x-user-id') || req.query.userId || '').trim();
  req.userId = GUEST_ID_PATTERN.test(claimed) ? claimed : 'guest-user';
  next();
};
