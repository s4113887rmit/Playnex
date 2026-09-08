const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  qty: { type: Number, required: true, min: 1, default: 1 },
  variant: { type: String, default: '' }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: [cartItemSchema]
}, { timestamps: true });

cartSchema.index({ userId: 1 });

module.exports = mongoose.model('Cart', cartSchema);
