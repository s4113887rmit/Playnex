const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
