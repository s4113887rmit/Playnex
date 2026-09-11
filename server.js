require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Game = require('./models/Game');

const app = express();

app.set("view engine", "ejs");
app.set("trust proxy", 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Baseline security headers. These run before the static handlers, because a
// served file ends the request and later middleware would never execute.
app.use(function (req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Static assets are served from public/ and from the project root so that the
// HTML pages, stylesheet and images resolve. Server-side code and configuration
// must never be downloadable, so those paths are refused before the root
// static handler runs.
const BLOCKED_STATIC_DIRS = /^\/(models|routes|middleware|data|node_modules|\.git|\.vscode)(\/|$)/i;
const BLOCKED_ROOT_FILE = /^\/[^/]+\.(js|json|ya?ml|md|lock|log)$/i;

app.use(function (req, res, next) {
  if (BLOCKED_STATIC_DIRS.test(req.path) || BLOCKED_ROOT_FILE.test(req.path)) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname)));

// Session middleware. The secret should be supplied through SESSION_SECRET; a
// random fallback is used so that an unset value is never predictable.
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set. A random secret was generated, so logins will not survive a restart.');
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // 'auto' marks the cookie Secure only when the request actually arrived over
    // HTTPS. In production TLS terminates at the proxy and trust proxy makes
    // req.secure true, while local HTTP development still works.
    secure: 'auto',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Current User middleware
const currentUser = require('./middleware/currentUser');
app.use(currentUser);

// Store / Shopping Cart / Wishlist / Checkout routes
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const wishlistRouter = require('./routes/wishlist');
const checkoutRouter = require('./routes/checkout');

app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/checkout', checkoutRouter);

// Blog module (EJS pages at /blog + JSON API at /api/blogs)
const blogsRouter = require('./routes/blogs');
app.use('/', blogsRouter);

// Discussion Forum module (MongoDB-backed threads and replies)
const threadsRouter = require('./routes/threads');
app.use('/', threadsRouter);

// Administration module (MongoDB-backed user management)
const adminRouter = require('./routes/admin');
app.use('/', adminRouter);

app.get('/', function (req, res) {
  res.redirect('/homepage.html');
});

const MONGODB_URI = process.env.MONGODB_URI;

function saveBase64Image(base64Data) {
  if (!base64Data) return null;
  var matches = base64Data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
  if (!matches) return null;
  var ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  var data = matches[2];
  var filename = 'profile-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + '.' + ext;
  var filepath = path.join(__dirname, 'uploads', filename);
  if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
  }
  fs.writeFileSync(filepath, data, 'base64');
  return 'uploads/' + filename;
}

// Guards credential endpoints: signup, login, password reset and the sensitive
// account changes. The ceiling is deliberately low because these are the routes
// an attacker would hammer.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Ordinary account navigation. Viewing or saving your own profile is normal use
// and must not consume the credential budget, otherwise a user could be locked
// out of signing in simply by opening their profile page repeatedly.
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false
});

const User = require('./models/User');

let dbReady = false;
mongoose.connection.on('connected', () => { dbReady = true; });
mongoose.connection.on('disconnected', () => { dbReady = false; });

// In-memory user store (A2 prototype: no MongoDB required)
const memoryUsers = require('./models/memoryUsers');

function signupValidator(body) {
  const errors = [];
  const { username, email, password, confirmPassword, description } = body;
  if (!username || !email || !password || !confirmPassword || !description) {
    errors.push('All required fields must be filled in.');
  }
  if (username && !/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    errors.push('Username must be 3-30 characters: letters, numbers, hyphens, underscores.');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please provide a valid email address.');
  }
  if (password && password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }
  if (password && password.length < 8) {
    errors.push('Password must be at least 8 characters.');
  }
  if (description && description.length > 500) {
    errors.push('Description must be at most 500 characters.');
  }
  return errors;
}

// Resolve a memory-store user from the session. Used only when MongoDB is
// unreachable, and still never trusts a client-supplied identifier.
function memorySessionUser(req) {
  const sessionId = req.session && req.session.userId;
  if (!sessionId) return null;
  return memoryUsers.findMemoryUser((u) => u.id === String(sessionId)) || null;
}

function handleMemoryAuth(req, res, route) {
  const { email, password, confirmPassword, username, name, description, profilePicture } = req.body || {};
  const lowerEmail = String(email || '').toLowerCase();

  if (route === 'signup') {
    const errors = signupValidator(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (memoryUsers.findMemoryUser((u) => u.email === lowerEmail || String(u.username).toLowerCase() === String(username).toLowerCase())) {
      return res.status(409).json({ error: 'Username or email already registered.' });
    }
    bcrypt.hash(password, 12).then((hash) => {
      const profilePic = saveBase64Image(profilePicture) || 'uploads/default-profile.svg';
      const user = {
        id: 'mem-' + Date.now(),
        username,
        name: name || '',
        email: lowerEmail,
        password: hash,
        description,
        profilePicture: profilePic,
        role: 'user',
        isLocked: false,
        isActive: true
      };
      memoryUsers.addMemoryUser(user);
      res.status(201).json({ message: 'Account created successfully. You can now log in.', user: memoryUsers.publicUser(user) });
    });
    return;
  }

  if (route === 'login') {
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
    if (user.isLocked) return res.status(403).json({ error: 'Your account has been locked. Contact an administrator.' });
    if (!user.isActive) return res.status(403).json({ error: 'This account has been deactivated.' });
    bcrypt.compare(password || '', user.password).then((isMatch) => {
      if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });
      // Create server-side session
      req.session.userId = user.id;
      res.json({
        message: 'Logged in successfully',
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    });
    return;
  }

  if (route === 'profile-get') {
    const user = memorySessionUser(req);
    if (!user) return res.status(401).json({ error: 'You must be logged in to view your profile.' });
    return res.json(memoryUsers.publicUser(user));
  }

  if (route === 'profile-put') {
    const user = memorySessionUser(req);
    if (!user) return res.status(401).json({ error: 'You must be logged in to update your profile.' });
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedDesc = typeof description === 'string' ? description.trim() : '';
    if (name !== undefined && (!trimmedName || trimmedName.length > 100)) {
      return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
    }
    if (description !== undefined && (!trimmedDesc || trimmedDesc.length > 500)) {
      return res.status(400).json({ error: 'Description must be between 1 and 500 characters.' });
    }
    if (trimmedName) user.name = trimmedName;
    if (trimmedDesc) user.description = trimmedDesc;
    const saved = profilePicture && saveBase64Image(profilePicture);
    if (saved) user.profilePicture = saved;
    return res.json({ message: 'Profile updated successfully.', user: memoryUsers.publicUser(user) });
  }

  if (route === 'change-password') {
    const user = memorySessionUser(req);
    if (!user) return res.status(401).json({ error: 'You must be logged in to change your password.' });
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (newPassword !== confirmNewPassword) return res.status(400).json({ error: 'New passwords do not match.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    bcrypt.compare(currentPassword, user.password).then((isMatch) => {
      if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect.' });
      bcrypt.hash(newPassword, 12).then((hash) => {
        user.password = hash;
        res.json({ message: 'Password changed successfully.' });
      });
    });
    return;
  }

  if (route === 'change-email') {
    const user = memorySessionUser(req);
    if (!user) return res.status(401).json({ error: 'You must be logged in to change your email.' });
    const { newEmail, password: pwd } = req.body;
    if (!newEmail || !pwd) return res.status(400).json({ error: 'All fields are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(newEmail))) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    bcrypt.compare(pwd, user.password).then((isMatch) => {
      if (!isMatch) return res.status(401).json({ error: 'Password is incorrect.' });
      if (memoryUsers.findMemoryUser((u) => u.email === String(newEmail).toLowerCase())) {
        return res.status(409).json({ error: 'That email address is already in use.' });
      }
      user.email = String(newEmail).toLowerCase();
      res.json({ message: 'Email address updated successfully.', email: user.email });
    });
    return;
  }

  if (route === 'delete-account') {
    const user = memorySessionUser(req);
    if (!user) return res.status(401).json({ error: 'You must be logged in to deactivate your account.' });
    bcrypt.compare(password || '', user.password).then((isMatch) => {
      if (!isMatch) return res.status(401).json({ error: 'Password is incorrect.' });
      // Keep the email address. Rewriting it would free the address for someone
      // else to register and would stop the login route recognising the account
      // as deactivated.
      user.isActive = false;
      req.session.destroy(() => {});
      res.json({ message: 'Your account has been deactivated. We are sorry to see you go.' });
    });
    return;
  }

  if (route === 'forgot-password') {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (user) {
      user.passwordResetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
      // Token generated for password reset
    }
    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  }

  if (route === 'reset-password') {
    const { token, password: newPassword, confirmPassword } = req.body;
    const user = memoryUsers.findMemoryUser((u) => u.passwordResetToken === token && u.passwordResetExpires > Date.now());
    if (!user || !token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }
    if (newPassword !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    bcrypt.hash(newPassword, 12).then((hash) => {
      user.password = hash;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      res.json({ message: 'Password has been reset successfully. You can now log in.' });
    });
    return;
  }

  res.status(404).json({ error: 'Unknown auth route.' });
}

function authGuard(route) {
  return function (req, res, next) {
    if (!dbReady) return handleMemoryAuth(req, res, route);
    return next();
  };
}

// Resolve the logged-in user for modules that need ownership (reviews)
const { resolveCurrentUser } = require('./middleware/resolveUser');

async function seedDemoAccounts() {
  const demoAccounts = [
    { username: 'admin', name: 'Playnex Admin', email: 'admin@playnex.com', password: 'admin12345', description: 'Playnex site administrator.', role: 'admin' },
    { username: 'john', name: 'John A', email: 'john@example.com', password: 'password123', description: 'Casual gamer and community regular.', role: 'user' }
  ];
  for (const demo of demoAccounts) {
    const existing = await User.findOne({ email: demo.email });
    if (!existing) await User.create(demo);
  }
}

if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
    .then(() => {
      console.log('Connected to MongoDB Atlas');
      return seedDemoAccounts().catch((err) => console.log('Demo seed skipped:', err.message));
    })
    .catch((err) => console.log('MongoDB unreachable, using in-memory users (A2 prototype):', err.message));
} else {
  console.log('MONGODB_URI not set; running with in-memory users (A2 prototype)');
}

app.post('/api/auth/signup', authLimiter, authGuard('signup'), async (req, res) => {
  try {
    const { username, name, email, password, confirmPassword, description, subscribe, profilePicture } = req.body;

    if (!username || !email || !password || !confirmPassword || !description) {
      var missing = [];
      if (!username) missing.push('Username');
      if (!email) missing.push('Email');
      if (!password) missing.push('Password');
      if (!confirmPassword) missing.push('Confirm password');
      if (!description) missing.push('Short description');
      return res.status(400).json({ error: 'Missing: ' + missing.join(', ') });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: 'Description must be at most 500 characters' });
    }

    // Usernames must be unique regardless of letter case, otherwise a second
    // account can be created as "Admin" while "admin" already exists and the
    // two are impossible to tell apart on screen.
    var emailNormalised = String(email).toLowerCase();
    var usernamePattern = String(username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var existingUser = await User.findOne({
      $or: [
        { email: emailNormalised },
        { username: { $regex: '^' + usernamePattern + '$', $options: 'i' } }
      ]
    });
    if (existingUser) {
      var field = String(existingUser.email).toLowerCase() === emailNormalised ? 'Email' : 'Username';
      return res.status(409).json({ error: field + ' is already registered' });
    }

    var profilePic = 'uploads/default-profile.svg';
    var saved = saveBase64Image(profilePicture);
    if (saved) profilePic = saved;

    var user = await User.create({
      username: username,
      name: name || '',
      email: email,
      password: password,
      description: description,
      profilePicture: profilePic,
      isVerified: true,
      subscribe: !!subscribe
    });

    res.status(201).json({
      message: 'Account created successfully. You can now log in.',
      user: { id: user._id, username: user.username, email: user.email, name: user.name }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      var messages = Object.values(err.errors).map(function (e) { return e.message; }).join('. ');
      return res.status(400).json({ error: messages });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/login', authLimiter, authGuard('login'), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.isLocked) {
      return res.status(403).json({ error: 'Your account has been locked. Contact an administrator.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'This account has been deactivated.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create server-side session
    req.session.userId = String(user._id);

    res.status(200).json({
      message: 'Logged in successfully',
      user: { id: user._id, username: user.username, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Failed to log out.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

app.post('/api/auth/forgot-password', authLimiter, authGuard('forgot-password'), async (req, res) => {
  try {
    var { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    var user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    var resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    // Token generated for password reset

    res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/reset-password', authLimiter, authGuard('reset-password'), async (req, res) => {
  try {
    var { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword) {
      var m = [];
      if (!token) m.push('Reset token');
      if (!password) m.push('New password');
      if (!confirmPassword) m.push('Confirm password');
      return res.status(400).json({ error: 'Missing: ' + m.join(', ') });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    var hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    var user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// The logged-in user is taken from the server-side session. Client-supplied
// identifiers such as a body email are never used to select the account.
async function findSessionUser(req, withPassword) {
  const sessionId = req.session && req.session.userId;
  if (!sessionId || !mongoose.isValidObjectId(sessionId)) return null;
  const query = User.findById(sessionId);
  if (withPassword) query.select('+password');
  return query;
}

function profilePayload(user) {
  return {
    id: user._id,
    username: user.username,
    name: user.name,
    email: user.email,
    description: user.description,
    profilePicture: user.profilePicture,
    role: user.role
  };
}

app.post('/api/auth/profile', profileLimiter, authGuard('profile-get'), async (req, res) => {
  try {
    var user = await findSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to view your profile.' });
    }
    res.status(200).json(profilePayload(user));
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.put('/api/auth/profile', profileLimiter, authGuard('profile-put'), async (req, res) => {
  try {
    var { name, description, profilePicture } = req.body;
    var user = await findSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to update your profile.' });
    }
    if (name !== undefined) {
      var trimmedName = String(name).trim();
      if (!trimmedName || trimmedName.length > 100) {
        return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
      }
      user.name = trimmedName;
    }
    if (description !== undefined) {
      var trimmedDesc = String(description).trim();
      if (!trimmedDesc || trimmedDesc.length > 500) {
        return res.status(400).json({ error: 'Description must be between 1 and 500 characters.' });
      }
      user.description = trimmedDesc;
    }
    if (profilePicture) {
      var saved = saveBase64Image(profilePicture);
      if (saved) user.profilePicture = saved;
    }
    await user.save({ validateBeforeSave: false });
    res.status(200).json({
      message: 'Profile updated successfully.',
      user: profilePayload(user)
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      var messages = Object.values(err.errors).map(function (e) { return e.message; }).join('. ');
      return res.status(400).json({ error: messages });
    }
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.put('/api/auth/email', authLimiter, authGuard('change-email'), async (req, res) => {
  try {
    var { newEmail, password } = req.body;
    if (!newEmail || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    var user = await findSessionUser(req, true);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to change your email.' });
    }
    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    var existing = await User.findOne({ email: newEmail.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'That email address is already in use' });
    }
    user.email = newEmail;
    await user.save({ validateBeforeSave: false });
    res.status(200).json({
      message: 'Email address updated successfully.',
      email: user.email
    });
  } catch (err) {
    console.error('Email change error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.put('/api/auth/change-password', authLimiter, authGuard('change-password'), async (req, res) => {
  try {
    var { currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    var user = await findSessionUser(req, true);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to change your password.' });
    }
    var isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.delete('/api/auth/account', authLimiter, authGuard('delete-account'), async (req, res) => {
  try {
    var { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    var user = await findSessionUser(req, true);
    if (!user) {
      return res.status(401).json({ error: 'You must be logged in to deactivate your account.' });
    }
    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
    // Keep the email address so the address cannot be claimed by another
    // account and so the login route reports the account as deactivated rather
    // than as unknown.
    user.isActive = false;
    await user.save({ validateBeforeSave: false });
    // Destroy session on account deletion
    req.session.destroy(() => {});
    res.status(200).json({ message: 'Your account has been deactivated. We are sorry to see you go.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ============================================================
// FORUM & ADMIN MODULES
// Both modules are now MongoDB-backed and live in their own routers:
//   routes/threads.js  -> /api/threads (+ /api/threads/:id/replies)
//   routes/admin.js    -> /api/users  (+ lock / unlock)
// ============================================================
function getAvgRating(game) {
  const count = game.reviews.length;
  const totalScore = game.reviews.reduce((sum, r) => sum + r.stars, 0);
  const avg = count ? totalScore / count : 0;
  return { avg, count };
}

function getDistribution(game) {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  game.reviews.forEach((r) => (dist[r.stars] += 1));
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const percent = {};
  for (const star in dist) {
    percent[star] = Math.round((dist[star] / total) * 100);
  }
  return percent;
}

function validateReviewInput(title, content, rating) {
  const errors = [];
  const t = (title || "").trim();
  const c = (content || "").trim();
  const rawRating = parseFloat(rating);
  if (Number.isNaN(rawRating) || rawRating < 1 || rawRating > 5) {
    errors.push("The rating must be between 1 and 5.");
  } else if (!Number.isInteger(rawRating)) {
    errors.push("The rating must be a whole number (1-5).");
  }
  if (!t) errors.push("Cant leave blank");
  if (t.length > 80) errors.push("Title maximum 80 characters");
  if (c.length < 10) errors.push("The content must be at least 10 characters long.");
  if (c.length > 2000) errors.push("The content must be no more than 2,000 characters long.");
  return errors;
}

// RATING
app.get("/rating", async (req, res) => {
  try {
    let games = await Game.find().lean();
    games = games.map((g) => ({ ...g, id: g.id || g._id, ...getAvgRating(g) }));
    const filterStar = req.query.stars ? parseInt(req.query.stars) : null;
    const q = (req.query.search || "").toLowerCase();
    let filtered = games;
    if (filterStar) filtered = filtered.filter((g) => Math.round(g.avg) === filterStar);
    if (q) filtered = filtered.filter((g) => g.name.toLowerCase().includes(q));
    res.render("rating", { games: filtered, filterStar, search: req.query.search || "" });
  } catch (err) {
    res.render("rating", { games: [], filterStar: null, search: "" });
  }
});

app.get("/api/games", async (req, res) => {
  try {
    let games = await Game.find().lean();
    games = games.map((g) => ({ id: g.id, name: g.name, image: g.image, ...getAvgRating(g) }));
    const q = (req.query.search || "").toLowerCase();
    if (q) games = games.filter((g) => g.name.toLowerCase().includes(q));
    res.json(games.map(({ id, name, image, avg }) => ({ id, name, image, avg })));
  } catch (err) {
    res.json([]);
  }
});

app.get("/game/:id", async (req, res) => {
  try {
    const game = await Game.findOne({ id: parseInt(req.params.id) }).lean();
    if (!game) return res.status(404).send("Game not found");
    const { avg, count } = getAvgRating(game);
    const distribution = getDistribution(game);
    res.render("ratinggame", { game, avg, count, distribution });
  } catch (err) {
    res.status(404).send("Game not found");
  }
});

app.get("/game/:id/review", async (req, res) => {
  try {
    const game = await Game.findOne({ id: parseInt(req.params.id) }).lean();
    if (!game) return res.status(404).send("Game not found");
    let review = null;
    if (req.query.edit) {
      review = game.reviews.find((r) => String(r._id) === String(req.query.edit)) || null;
      if (!review) return res.status(404).send("Review not found");
      const user = await resolveCurrentUser(req);
      if (user && review.authorId && String(review.authorId) !== String(user.id) && user.role !== 'admin') {
        return res.status(403).send("You can only edit your own reviews");
      }
    }
    res.render("writegamereview", { game, review, errors: [] });
  } catch (err) {
    res.status(404).send("Game not found");
  }
});

app.post("/game/:id/review", async (req, res) => {
  try {
    const game = await Game.findOne({ id: parseInt(req.params.id) });
    if (!game) return res.status(404).send("Game not found");
    const user = await resolveCurrentUser(req);
    if (!user) return res.redirect("/Login.html");
    const { title, content, rating, image, reviewId } = req.body;
    const errors = validateReviewInput(title, content, rating);
    if (errors.length) {
      const reviewObj = reviewId ? game.reviews.find((r) => String(r._id) === String(reviewId)) : null;
      return res.status(400).render("writegamereview", { game: game.toObject(), review: reviewObj, errors });
    }
    let imagePath = (image || "").trim();
    if (imagePath.startsWith("data:image")) {
      const saved = saveBase64Image(imagePath);
      if (saved) imagePath = saved;
    }
    if (reviewId) {
      const review = game.reviews.find((r) => String(r._id) === String(reviewId));
      if (!review) return res.status(404).send("Review not found");
      const isOwner = review.authorId && user && String(review.authorId) === String(user.id);
      const isAdmin = user && user.role === 'admin';
      if (!isOwner && !isAdmin) return res.status(403).send("You can only edit your own reviews");
      review.title = title.trim();
      review.content = content.trim();
      review.stars = parseInt(rating);
      review.image = (image || "").trim();
      review.editedAt = new Date();
    } else {
      // Block duplicate reviews from same user on same game
      const existingReview = game.reviews.find((r) => r.authorId && String(r.authorId) === String(user.id));
      if (existingReview && user.role !== 'admin') {
        const errors = ["You have already reviewed this game. You can edit your existing review instead."];
        return res.status(400).render("writegamereview", { game: game.toObject(), review: null, errors });
      }
      game.reviews.push({
        id: "r_" + Date.now(),
        author: user.name || user.username,
        authorId: String(user.id),
        date: new Date().toISOString(),
        stars: parseInt(rating),
        title: title.trim(),
        content: content.trim(),
        image: (image || "").trim(),
      });
    }
    await game.save();
    res.redirect("/listing.html?game=" + slugifyGame(game.name));
  } catch (err) {
    res.status(500).send("Failed to save review");
  }
});

app.post("/game/:id/review/:reviewId/delete", async (req, res) => {
  try {
    const game = await Game.findOne({ id: parseInt(req.params.id) });
    if (!game) return res.status(404).send("Game not found");
    const review = game.reviews.find((r) => String(r._id) === String(req.params.reviewId));
    if (!review) return res.status(404).send("Review not found");
    const user = await resolveCurrentUser(req);
    const isOwner = review.authorId && user && String(review.authorId) === String(user.id);
    const isAdmin = user && user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).send("You can only delete your own reviews");
    game.reviews.pull(review._id);
    await game.save();
    res.redirect("/listing.html?game=" + slugifyGame(game.name));
  } catch (err) {
    res.status(500).send("Failed to delete review");
  }
});

function slugifyGame(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const GAME_SLUG_ALIASES = {
  "red-dead-redemption-2": 4,
  "death-standing": 8,
  "death-stranding": 8,
  "cyberpunk": 2,
  "witcher-3": 9,
  "the-witcher-3": 9
};

async function renderListing(req, res) {
  try {
    let game = null;
    let slug = "";
    if (req.params.id) {
      game = await Game.findOne({ id: parseInt(req.params.id) }).lean();
    } else if (req.query.game) {
      const normalized = String(req.query.game).toLowerCase().trim();
      game = await Game.findOne({ $expr: { $eq: [{ $toLower: "$name" }, normalized.replace(/-/g, " ")] } }).lean();
      if (!game) {
        const aliasId = GAME_SLUG_ALIASES[normalized];
        if (aliasId) game = await Game.findOne({ id: aliasId }).lean();
      }
      slug = String(req.query.game);
    } else if (req.query.id) {
      game = await Game.findOne({ id: parseInt(req.query.id) }).lean();
    }
    if (!game) return res.status(404).send("Game not found");
    slug = slug || slugifyGame(game.name);
    const { avg, count } = getAvgRating(game);
    const distribution = getDistribution(game);
    const allGames = await Game.find().lean();
    const fcGameIds = new Set([10, 11, 12, 13]);
    const related = fcGameIds.has(game.id)
      ? allGames.filter((g) => fcGameIds.has(g.id) && g.id !== game.id).slice(0, 3)
      : allGames.filter((g) => g.id !== game.id).slice(0, 4);
    const newReleaseFreeIds = new Set([4, 13]);
    const isNewReleaseFree = newReleaseFreeIds.has(game.id);
    res.render("listing", { game, avg, count, distribution, related, slug, isNewReleaseFree });
  } catch (err) {
    res.status(500).send("Failed to load listing");
  }
}

app.get("/listing.html", renderListing);
app.get("/listing/:id", renderListing);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Playnex server running on http://localhost:' + PORT);
});

// Sitemap — generated automatically from the database
app.get('/sitemap', async (req, res) => {
  try {
    const Blog = require('./models/Blog');
    const Thread = require('./models/Thread');
    const games = await Game.find().select('id name').lean();
    const blogPosts = await Blog.find().select('_id title').lean();
    const threads = await Thread.find({ deleted: false }).select('_id title').lean();

    res.render('sitemap', {
      games: games.map(g => ({ id: g.id, name: g.name })),
      blogPosts: blogPosts.map(p => ({ id: p._id, title: p.title })),
      threads: threads.map(t => ({ id: t._id, title: t.title }))
    });
  } catch (err) {
    console.error('Error rendering sitemap:', err);
    res.status(500).send('Failed to load sitemap');
  }
});
