const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', function (req, res) {
  res.redirect('/homepage.html');
});

const MONGODB_URI = 'mongodb+srv://nguyenkhanhnguyen3967_db_user:NkK9r5QtMJOMJgL5@playnex.mzcuobd.mongodb.net/playnex?retryWrites=true&w=majority';

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

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

const User = require('./models/User');

app.post('/api/auth/signup', authLimiter, async (req, res) => {
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

app.post('/api/auth/login', authLimiter, async (req, res) => {
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

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
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

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
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

app.post('/api/auth/profile', authLimiter, async (req, res) => {
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

app.put('/api/auth/profile', authLimiter, async (req, res) => {
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

app.put('/api/auth/email', authLimiter, async (req, res) => {
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

app.put('/api/auth/change-password', authLimiter, async (req, res) => {
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

app.delete('/api/auth/account', authLimiter, async (req, res) => {
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
let forumThreads = [
  {
    id: 1,
    title: "[Nightfall Protocol] Troubleshooting LAN connectivity for SEA players",
    author: "darknexus",
    tag: "Technical Support",
    tagClass: "tag--support",
    replies: 42,
    views: 1200,
    lastPostAuthor: "an_admin",
    lastPostTime: "3 hours ago"
  },
  {
    id: 2,
    title: "[Embercrown Saga] Collector's Edition Throne Figure Review",
    author: "cyber_fan",
    tag: "Merch Review",
    tagClass: "tag--review",
    replies: 85,
    views: 3400,
    lastPostAuthor: "merch_guy",
    lastPostTime: "6 hours ago"
  }
];

// GET: Retrieve all forum threads
app.get('/api/threads', (req, res) => {
  // Send the in-memory array to the frontend as JSON
  res.json(forumThreads);
});

// POST: Create a new forum thread
app.post('/api/threads', (req, res) => {
  const { title, game, category, content } = req.body;

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

  // Determine the tag class based on the category for styling
  let tagClass = "tag--general";
  if (category === "support") tagClass = "tag--support";
  if (category === "review") tagClass = "tag--review";

  // Create the new thread object
  const newThread = {
    id: forumThreads.length + 1,
    title: title,
    content: content,
    // Dynamic behaviour: Pull the actual logged-in user's name if available, otherwise fallback
    author: req.session?.user?.username || "Guest_User", 
    tag: category,
    tagClass: tagClass,
    replies: 0,
    views: 0,
    lastPostAuthor: req.session?.user?.username || "Guest_User",
    lastPostTime: "Just now"
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
app.get('/api/users', (req, res) => {
  res.json(adminUsers);
});

// POST: Toggle user lock status
app.post('/api/users/:id/toggle-lock', (req, res) => {
  // Grab the ID from the URL and convert it to an integer
  const userId = parseInt(req.params.id);
  
  // Find the specific user in our in-memory array
  const user = adminUsers.find(u => u.id === userId);

  // Server-side validation: Make sure the user actually exists
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  // Toggle the status
  if (user.status === 'normal') {
    user.status = 'locked';
    user.lockedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    user.reason = req.body.reason || "Manual Admin Lock";
  } else {
    user.status = 'normal';
    // Clean up locked properties
    delete user.lockedDate;
    delete user.reason;
  }

  res.json({ message: `User status successfully updated to ${user.status}`, user: user });
});
// GET: Retrieve a single thread by ID
app.get('/api/threads/:id', (req, res) => {
  const threadId = parseInt(req.params.id);
  const thread = forumThreads.find(t => t.id === threadId);
  
  if (thread) {
    res.json(thread);
  } else {
    res.status(404).json({ error: "Thread not found." });
  }
});

// DELETE: Remove a forum thread
app.delete('/api/threads/:id', (req, res) => {
  const threadId = parseInt(req.params.id);
  const initialLength = forumThreads.length;
  
  // Filter out the thread with the matching ID
  forumThreads = forumThreads.filter(t => t.id !== threadId);

  if (forumThreads.length < initialLength) {
    res.json({ message: "Thread successfully deleted." });
  } else {
    res.status(404).json({ error: "Thread not found." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log('Playnex server running on http://localhost:' + PORT);
});