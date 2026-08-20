const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_PATH = path.join(__dirname, 'data', 'games.json');

(function loadEnv() {
  var envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  var lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line[0] === '#') continue;
    var eq = line.indexOf('=');
    if (eq === -1) continue;
    var key = line.substring(0, eq).trim();
    var value = line.substring(eq + 1).trim();
    if (value[0] === '"' && value[value.length - 1] === '"') value = value.slice(1, -1);
    if (value[0] === "'" && value[value.length - 1] === "'") value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
})();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();

app.set("view engine", "ejs");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    if (name) user.name = name;
    if (description) user.description = description;
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
    const user = memoryUsers.findMemoryUser((u) => u.email === lowerEmail);
    if (user) {
      user.passwordResetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
      console.log('Password reset token for ' + lowerEmail + ': ' + user.passwordResetToken);
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
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    var user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    }

    var resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    console.log('Password reset token for ' + email + ': ' + resetToken);

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
    if (name) user.name = name;
    if (description) user.description = description;
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

// Game rating
function readGames() {
  const games = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  let changed = false;
  games.forEach((g) => {
    g.reviews.forEach((r) => {
      if (!r.id) {
        r.id = "r_" + Date.now() + Math.random().toString(36).slice(2, 8);
        changed = true;
      }
    });
  });
  if (changed) writeGames(games);
  return games;
}

function writeGames(games) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(games, null, 2));
}

// Calculate avarage rating//
function getAvgRating(game) {
  const totalCount = game.baseCount + game.reviews.length;
  const totalScore =
    game.baseRating * game.baseCount +
    game.reviews.reduce((sum, r) => sum + r.stars, 0);
  const avg = totalCount ? totalScore / totalCount : 0;
  return { avg, count: totalCount };
}

// Calculate the percentage of game rating//
function getDistribution(game) {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  dist[game.baseRating] += game.baseCount;
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
  if (t.length > 80) errors.push("Title maximum 80   characters");
  if (c.length < 10) errors.push("The content must be at least 10 characters long.");
  if (c.length > 2000) errors.push("The content must be no more than 2,000 characters long.");
  if (!Number.isInteger(r) || r < 1 || r > 5) errors.push("The rating must be between 1 and 5.");

  return errors;
}

// RATING
app.get("/rating", (req, res) => {
  let games = readGames();
  games = games.map((g) => ({ ...g, ...getAvgRating(g) }));

  const filterStar = req.query.stars ? parseInt(req.query.stars) : null;
  const q = (req.query.search || "").toLowerCase();

  let filtered = games;
  if (filterStar) {
    filtered = filtered.filter((g) => Math.round(g.avg) === filterStar);
  }
  if (q) {
    filtered = filtered.filter((g) => g.name.toLowerCase().includes(q));
  }

  res.render("rating", { games: filtered, filterStar, search: req.query.search || "" });
});

app.get("/api/games", (req, res) => {
  let games = readGames().map((g) => ({ ...g, ...getAvgRating(g) }));
  const q = (req.query.search || "").toLowerCase();
  if (q) games = games.filter((g) => g.name.toLowerCase().includes(q));
  res.json(games.map(({ id, name, image, avg }) => ({ id, name, image, avg })));
});

// RATINGGAME
app.get("/game/:id", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  const { avg, count } = getAvgRating(game);
  const distribution = getDistribution(game);

  res.render("ratinggame", { game, avg, count, distribution });
});

// Write game review

app.get("/game/:id/review", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  let review = null;
  if (req.query.edit) {
    review = game.reviews.find((r) => r.id === req.query.edit) || null;
  }

  res.render("writegamereview", { game, review, errors: [] });
});


app.post("/game/:id/review", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  const { title, content, rating, image, reviewId } = req.body;
  const errors = validateReviewInput(title, content, rating);

  if (errors.length) {
    const review = reviewId ? game.reviews.find((r) => r.id === reviewId) : null;
    return res.status(400).render("writegamereview", { game, review, errors });
  }

  if (reviewId) {
    // update already exist review
    const review = game.reviews.find((r) => r.id === reviewId);
    if (!review) return res.status(404).send("Review not found");
    review.title = title.trim();
    review.content = content.trim();
    review.stars = parseInt(rating);
    review.image = (image || "").trim();
    review.date = new Date().toLocaleDateString("vi-VN") + " (edited)";
  } else {
    // create new review
    game.reviews.push({
      id: "r_" + Date.now(),
      author: "You", // TODO: replace by req.session.user.username after have login
      date: new Date().toLocaleDateString("vi-VN"),
      stars: parseInt(rating),
      title: title.trim(),
      content: content.trim(),
      image: (image || "").trim(),
    });
  }

  writeGames(games);
  res.redirect("/game/" + game.id);
});

// delete review
app.post("/game/:id/review/:reviewId/delete", (req, res) => {
  const games = readGames();
  const game = games.find((g) => g.id === parseInt(req.params.id));
  if (!game) return res.status(404).send("Game not found");

  const exists = game.reviews.some((r) => r.id === req.params.reviewId);
  if (!exists) return res.status(404).send("Review not found");

  // if have login: check review.userId === req.session.user.id before

  game.reviews = game.reviews.filter((r) => r.id !== req.params.reviewId);
  writeGames(games);
  res.redirect("/game/" + game.id);
});

// Game listing (detail page)
// Linked from the store pages as listing.html?game=<slug> and /listing/:id
function slugifyGame(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const GAME_SLUG_ALIASES = {
  "red-dead-redemption-2": 4,
  "death-standing": 8,
  "cyberpunk": 2,
  "witcher-3": 9
};

function findGameBySlug(games, slug) {
  const normalized = String(slug || "").toLowerCase().trim();
  if (!normalized) return null;
  const byName = games.find((g) => slugifyGame(g.name) === normalized);
  if (byName) return byName;
  const aliasId = GAME_SLUG_ALIASES[normalized];
  if (aliasId) return games.find((g) => g.id === aliasId);
  return null;
}

function renderListing(req, res) {
  const games = readGames();
  let game = null;
  let slug = "";

  if (req.params.id) {
    game = games.find((g) => g.id === parseInt(req.params.id));
  } else if (req.query.game) {
    game = findGameBySlug(games, req.query.game);
    slug = String(req.query.game);
  } else if (req.query.id) {
    game = games.find((g) => g.id === parseInt(req.query.id));
  }

  if (!game) return res.status(404).send("Game not found");

  slug = slug || slugifyGame(game.name);
  const { avg, count } = getAvgRating(game);
  const distribution = getDistribution(game);
  const related = games.filter((g) => g.id !== game.id).slice(0, 4);

  res.render("listing", { game, avg, count, distribution, related, slug });
}

app.get("/listing.html", renderListing);
app.get("/listing/:id", renderListing);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Playnex server running on http://localhost:' + PORT);
});

