const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  author: { type: String, required: true, trim: true },
  authorId: { type: String, default: null },
  date: { type: String, required: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  image: { type: String, default: '' }
}, { _id: true });

const gameSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  genre: { type: String, required: true, trim: true },
  releaseDate: { type: String, required: true },
  description: { type: String, required: true, trim: true },
  longDescription: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  oldPrice: { type: Number, default: null, min: 0 },
  platforms: [{ type: String }],
  type: { type: String, default: 'Digital' },
  availability: { type: String, default: 'In stock' },
  edition: { type: String, default: 'Standard edition' },
  included: { type: String, default: 'Full game + launcher access' },
  features: [{ type: String }],
  reviews: [reviewSchema]
}, { timestamps: true });

gameSchema.index({ name: 'text', genre: 'text', description: 'text' });
gameSchema.index({ genre: 1 });
gameSchema.index({ price: 1 });

module.exports = mongoose.model('Game', gameSchema);
