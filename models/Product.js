const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ['digital', 'merch', 'physical'] },
  genre: { type: String, default: '' },
  platform: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, default: null, min: 0 },
  image: { type: String, required: true },
  art: { type: String, default: '' },
  badge: { type: String, default: null },
  availability: { type: String, default: 'in-stock' },
  variant: { type: String, default: '' },
  releaseYear: { type: Number, default: null },
  href: { type: String, default: '' }
}, { timestamps: true });

productSchema.index({ title: 'text', genre: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
