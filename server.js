require('dotenv').config();
try { require('dns').setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Game = require('./models/Game');
const Product = require('./models/Product');

const app = express();

app.set("view engine", "ejs");
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname)));

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

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
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

function handleMemoryAuth(req, res, route) {
  const { email, password, confirmPassword, username, name, description, profilePicture } = req.body || {};
  const lowerEmail = String(email || '').toLowerCase();

  if (route === 'signup') {
    const errors = signupValidator(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });
    if (memoryUsers.findMemoryUser((u) => u.email === lowerEmail || u.username === username)) {
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
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(memoryUsers.publicUser(user));
  }

  if (route === 'profile-put') {
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (!user) return res.status(404).json({ error: 'User not found.' });
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
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
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
    const user = memoryUsers.findMemoryUser((u) => u.email === String(req.body.currentEmail || '').toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });
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
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    bcrypt.compare(password || '', user.password).then((isMatch) => {
      if (!isMatch) return res.status(401).json({ error: 'Password is incorrect.' });
      user.isActive = false;
      user.email = user.email + '_deactivated_' + Date.now();
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

// Resolve the logged-in user for modules that need ownership (blog, reviews)
async function resolveCurrentUser(req) {
  const userId = (req.body && req.body.userId) || req.userId || req.header('x-user-id') || '';
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

    var existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      var field = existingUser.email === email.toLowerCase() ? 'Email' : 'Username';
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

    res.status(200).json({
      message: 'Logged in successfully',
      user: { id: user._id, username: user.username, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
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

app.post('/api/auth/profile', authLimiter, authGuard('profile-get'), async (req, res) => {
  try {
    var { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    var user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({
      id: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      description: user.description,
      profilePicture: user.profilePicture,
      role: user.role
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.put('/api/auth/profile', authLimiter, authGuard('profile-put'), async (req, res) => {
  try {
    var { email, name, description, profilePicture } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    var user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
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
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        description: user.description,
        profilePicture: user.profilePicture,
        role: user.role
      }
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
    var { currentEmail, newEmail, password } = req.body;
    if (!currentEmail || !newEmail || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    var user = await User.findOne({ email: currentEmail.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }
    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
    var existing = await User.findOne({ email: newEmail.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'That email address is already in use' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
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
    var { email, currentPassword, newPassword, confirmNewPassword } = req.body;
    if (!email || !currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    var user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
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
    var { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    var user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }
    var isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }
    user.isActive = false;
    user.email = user.email + '_deactivated_' + Date.now();
    await user.save({ validateBeforeSave: false });
    res.status(200).json({ message: 'Your account has been deactivated. We are sorry to see you go.' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// --- FORUM MODULE: IN-MEMORY DATA ---
function timeAgo(ts) {
  if (!ts || isNaN(ts)) return "Just now";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hour" + (hours > 1 ? "s" : "") + " ago";
  const days = Math.floor(hours / 24);
  return days + " day" + (days > 1 ? "s" : "") + " ago";
}

let forumThreads = [
  {
    id: 1,
    title: "[Elden Ring] Fixing co-op connection failures",
    content: "Me and a friend keep failing to summon each other for co-op in Elden Ring. We're both on the same NAT type, passwords match, but the connection keeps timing out. Any tips on fixing this?",
    author: "darknexus",
    authorId: null,
    tag: "support",
    tagClass: "tag--support",
    replies: 2,
    views: 1200,
    lastPostAuthor: "script_master",
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    lastPostAt: Date.now() - 2 * 60 * 60 * 1000,
    deleted: false,
    posts: [
      {
        id: "p1",
        author: "script_master",
        authorId: null,
        content: "Checking scoreboard logic every tick for every connected player over a VPN will drain your TPS. Schedule the check on an event trigger instead of looping it, and verify your VPN routing is not adding packet loss.",
        createdAt: Date.now() - 2 * 60 * 60 * 1000,
        deleted: false
      },
      {
        id: "p2",
        author: "netguru",
        authorId: null,
        content: "Also profile with /tick health to confirm the source. Radmin LAN mode usually adds only 2-5ms; a datapack loop is the likely culprit.",
        createdAt: Date.now() - 90 * 60 * 1000,
        deleted: false
      }
    ]
  },
  {
    id: 2,
    title: "[The Witcher 3: Wild Hunt] Game of the Year Edition Review",
    content: "Just received the Embercrown Saga Collector's Edition throne figure. Sharing photos and thoughts on build quality, paint application, and packaging.",
    author: "cyber_fan",
    authorId: null,
    tag: "review",
    tagClass: "tag--review",
    replies: 1,
    views: 3400,
    lastPostAuthor: "merch_guy",
    createdAt: Date.now() - 6 * 60 * 60 * 1000,
    lastPostAt: Date.now() - 5 * 60 * 60 * 1000,
    deleted: false,
    posts: [
      {
        id: "p3",
        author: "merch_guy",
        authorId: null,
        content: "Paint application is clean on mine too. The throne base is heavier than expected, which is great for display stability.",
        createdAt: Date.now() - 5 * 60 * 60 * 1000,
        deleted: false
      }
    ]
  }
];

function publicThread(t) {
  return {
    id: t.id,
    title: t.title,
    content: t.content,
    author: t.author,
    authorId: t.authorId,
    tag: t.tag,
    tagClass: t.tagClass,
    replies: t.replies,
    views: t.views,
    lastPostAuthor: t.lastPostAuthor,
    lastPostTime: timeAgo(t.lastPostAt),
    image: t.image,
    createdAt: t.createdAt,
    lastPostAt: t.lastPostAt
  };
}

// GET: Retrieve all forum threads
app.get('/api/threads', (req, res) => {
  const visible = forumThreads.filter((t) => !t.deleted).map(publicThread);
  res.json(visible);
});

// POST: Create a new forum thread
app.post('/api/threads', async (req, res) => {
  const { title, game, category, content, image } = req.body;

  const user = await resolveCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "You must be logged in to create a thread." });
  }

  // Server-Side Validation
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: "Thread title is strictly required." });
  }
  if (!category || category.trim() === '') {
    return res.status(400).json({ error: "A category selection is required." });
  }
  if (!content || content.trim() === '') {
    return res.status(400).json({ error: "Post content cannot be empty." });
  }
  if (content.length > 5000) {
    return res.status(400).json({ error: "Post content must be at most 5000 characters." });
  }
  const sanitizedImage = (typeof image === 'string' && image.startsWith('data:image/')) ? image.slice(0, 300000) : undefined;

  // Determine the tag class based on the category for styling
  let tagClass = "tag--general";
  if (category === "support") tagClass = "tag--support";
  if (category === "review") tagClass = "tag--review";

  const authorName = user.name || user.username;

  // Create the new thread object
  const newThread = {
    id: forumThreads.length + 1,
    title: title,
    content: content,
    author: authorName,
    authorId: String(user.id),
    tag: category,
    tagClass: tagClass,
    replies: 0,
    views: 0,
    lastPostAuthor: authorName,
    lastPostTime: "Just now",
    image: sanitizedImage,
    createdAt: Date.now(),
    lastPostAt: Date.now()
  };

  // Save it to our temporary "database"
  forumThreads.unshift(newThread); // unshift adds it to the top of the array

  // Send a success response back to the client
  res.status(201).json({ message: "Thread created successfully!", thread: newThread });
});

// ==========================================
// ADMIN MODULE: IN-MEMORY DATA & ROUTES
// ==========================================

let adminUsers = [
  {
    id: 1,
    username: "John_A",
    status: "normal",
    joined: "Jan 12, 2026",
    avatarSeed: "Ngyuen",
    flags: "0 active flags"
  },
  {
    id: 2,
    username: "jane_B",
    status: "normal",
    joined: "Mar 05, 2026",
    avatarSeed: "Dang",
    flags: "1 resolved warning"
  },
  {
    id: 3,
    username: "spammer_99",
    status: "locked",
    lockedDate: "Jul 21, 2026",
    avatarSeed: "Spam",
    reason: "Forum Abuse"
  }
];

// GET: Retrieve all users for the dashboard
app.get('/api/users', async (req, res) => {
  const user = await resolveCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: "Administrator access required." });
  }
  res.json(adminUsers);
});

// GET: Retrieve a single user by ID
app.get('/api/users/:id', async (req, res) => {
  const user = await resolveCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: "Administrator access required." });
  }
  const userId = parseInt(req.params.id);
  const targetUser = adminUsers.find(u => u.id === userId);
  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }
  res.json(targetUser);
});

// POST: Toggle user lock status
app.post('/api/users/:id/toggle-lock', async (req, res) => {
  const user = await resolveCurrentUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: "Administrator access required." });
  }
  // Grab the ID from the URL and convert it to an integer
  const userId = parseInt(req.params.id);

  // Find the specific user in our in-memory array
  const targetUser = adminUsers.find(u => u.id === userId);

  // Server-side validation: Make sure the user actually exists
  if (!targetUser) {
    return res.status(404).json({ error: "User not found." });
  }

  // Toggle the status
  if (targetUser.status === 'normal') {
    targetUser.status = 'locked';
    targetUser.lockedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    targetUser.reason = req.body.reason || "Manual Admin Lock";
  } else {
    targetUser.status = 'normal';
    // Clean up locked properties
    delete targetUser.lockedDate;
    delete targetUser.reason;
  }

  res.json({ message: `User status successfully updated to ${targetUser.status}`, user: targetUser });
});
// GET: Retrieve a single thread by ID
app.get('/api/threads/:id', (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);

  if (!thread || thread.deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }

  res.json({
    ...publicThread(thread),
    posts: (thread.posts || [])
      .filter((p) => !p.deleted)
      .map((p) => ({
        id: p.id,
        author: p.author,
        authorId: p.authorId,
        content: p.content,
        createdAt: p.createdAt,
        timeAgo: timeAgo(p.createdAt)
      }))
  });
});

// POST: Reply to a thread
app.post('/api/threads/:id/replies', async (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);
  if (!thread || thread.deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const user = await resolveCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "You must be logged in to reply." });
  }

  const content = (req.body.content || "").trim();
  if (!content) {
    return res.status(400).json({ error: "Reply content cannot be empty." });
  }
  if (content.length > 2000) {
    return res.status(400).json({ error: "Reply content must be at most 2000 characters." });
  }

  const reply = {
    id: "p_" + Date.now(),
    author: user.name || user.username,
    authorId: String(user.id),
    content,
    createdAt: Date.now(),
    deleted: false
  };

  thread.posts = thread.posts || [];
  thread.posts.push(reply);
  thread.replies = thread.posts.filter((p) => !p.deleted).length;
  thread.lastPostAuthor = reply.author;
  thread.lastPostAt = reply.createdAt;

  res.status(201).json({ message: "Reply posted successfully.", reply: { ...reply, timeAgo: "Just now" } });
});

// PUT: Edit a thread (owner or admin)
app.put('/api/threads/:id', async (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);
  if (!thread || thread.deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const user = await resolveCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "You must be logged in to edit a thread." });
  }

  const isOwner = thread.authorId && String(thread.authorId) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "You can only edit your own threads." });
  }

  const title = (req.body.title || "").trim();
  const content = (req.body.content || "").trim();
  if (!title) return res.status(400).json({ error: "Thread title is strictly required." });
  if (!content) return res.status(400).json({ error: "Post content cannot be empty." });
  if (title.length > 150) return res.status(400).json({ error: "Thread title must be at most 150 characters." });
  if (content.length > 5000) return res.status(400).json({ error: "Post content must be at most 5000 characters." });

  thread.title = title;
  thread.content = content;
  if (typeof req.body.image === 'string' && req.body.image.startsWith('data:image/')) {
    thread.image = req.body.image.slice(0, 300000);
  }
  thread.lastPostAt = Date.now();

  res.json({ message: "Thread updated successfully.", thread: publicThread(thread) });
});

// PUT: Edit a reply (owner or admin)
app.put('/api/threads/:id/replies/:replyId', async (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);
  if (!thread || thread.deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const reply = (thread.posts || []).find((p) => p.id === req.params.replyId && !p.deleted);
  if (!reply) {
    return res.status(404).json({ error: "Reply not found." });
  }

  const user = await resolveCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "You must be logged in to edit a reply." });
  }

  const isOwner = reply.authorId && String(reply.authorId) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "You can only edit your own replies." });
  }

  const content = (req.body.content || "").trim();
  if (!content) return res.status(400).json({ error: "Reply content cannot be empty." });
  if (content.length > 2000) return res.status(400).json({ error: "Reply content must be at most 2000 characters." });

  reply.content = content;

  res.json({ message: "Reply updated successfully.", reply: { ...reply, timeAgo: timeAgo(reply.createdAt) } });
});

// DELETE: Soft-delete a thread (retained for auditing)
app.delete('/api/threads/:id', async (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);
  if (!thread || thread.deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const user = await resolveCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "You must be logged in to delete a thread." });
  }

  const isOwner = thread.authorId && String(thread.authorId) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "You can only delete your own threads." });
  }

  thread.deleted = true;
  res.json({ message: "Thread successfully deleted." });
});

// DELETE: Soft-delete a reply (retained for auditing)
app.delete('/api/threads/:id/replies/:replyId', async (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);
  if (!thread || thread.deleted) {
    return res.status(404).json({ error: "Thread not found." });
  }

  const reply = (thread.posts || []).find((p) => p.id === req.params.replyId && !p.deleted);
  if (!reply) {
    return res.status(404).json({ error: "Reply not found." });
  }

  const user = await resolveCurrentUser(req);
  if (!user) {
    return res.status(401).json({ error: "You must be logged in to delete a reply." });
  }

  const isOwner = reply.authorId && String(reply.authorId) === String(user.id);
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "You can only delete your own replies." });
  }

  reply.deleted = true;
  thread.replies = thread.posts.filter((p) => !p.deleted).length;
  thread.lastPostAt = Date.now();

  res.json({ message: "Reply successfully deleted." });
});

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
  const r = parseInt(rating);
  if (!t) errors.push("Cant leave blank");
  if (t.length > 80) errors.push("Title maximum 80 characters");
  if (c.length < 10) errors.push("The content must be at least 10 characters long.");
  if (c.length > 2000) errors.push("The content must be no more than 2,000 characters long.");
  if (!Number.isInteger(r) || r < 1 || r > 5) errors.push("The rating must be between 1 and 5.");
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
      review.date = new Date().toLocaleDateString("vi-VN") + " (edited)";
    } else {
      game.reviews.push({
        id: "r_" + Date.now(),
        author: user.name || user.username,
        authorId: String(user.id),
        date: new Date().toLocaleDateString("vi-VN"),
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
  "witcher-3": 9
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

// Sitemap
app.get('/sitemap', async (req, res) => {
  try {
    const Blog = require('./models/Blog');
    const games = await Game.find().select('id name').lean();
    const blogPosts = await Blog.find().select('_id title').lean();
    const threads = forumThreads;

    res.render('sitemap', {
      games: games.map(g => ({ id: g.id, name: g.name })),
      blogPosts: blogPosts.map(p => ({ id: p._id, title: p.title })),
      threads: threads.map(t => ({ id: t.id, title: t.title }))
    });
  } catch (err) {
    console.error('Error rendering sitemap:', err);
    res.status(500).send('Failed to load sitemap');
  }
});