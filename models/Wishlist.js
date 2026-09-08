const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  purchased: { type: Boolean, default: false }
}, { _id: true });

const wishlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [wishlistItemSchema]
}, { timestamps: true });

wishlistSchema.index({ userId: 1 });

module.exports = mongoose.model('Wishlist', wishlistSchema);
