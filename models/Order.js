const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  variant: { type: String, default: '' },
  image: { type: String, default: '' },
  // Snapshotted so we can tell later whether this line was a one-off digital
  // key (never re-buyable) or a physical good (re-orderable any number of times).
  category: { type: String, default: '' }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  shipping: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  promoCode: { type: String, default: '' },
  total: { type: Number, required: true },
  shippingInfo: {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    postalCode: String,
    country: String
  },
  paymentInfo: {
    cardLast4: String,
    cardType: String
  },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'completed' }
}, { timestamps: true });

orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
