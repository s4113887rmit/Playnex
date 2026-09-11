const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
  purchased: { type: Boolean, default: false }
}, { _id: true });

const removedItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  addedAt: { type: Date },
  removedAt: { type: Date, default: Date.now }
}, { _id: true });

const wishlistSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: [wishlistItemSchema],
  removedItems: [removedItemSchema]
}, { timestamps: true });

module.exports = mongoose.model('Wishlist', wishlistSchema);
