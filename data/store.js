/**
 * store.js - MongoDB-backed datastore for Assessment 3.
 * Uses Cart, Wishlist and Order models for persistent storage, and
 * computes real cross-collection statistics for wishlist items.
 */

const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const Order = require('../models/Order');

async function getCart(userId) {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }
  return cart;
}

async function getWishlist(userId) {
  let wishlist = await Wishlist.findOne({ userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, items: [] });
  }
  return wishlist;
}

async function saveOrder(order) {
  const record = await Order.create({
    userId: order.userId,
    items: order.items,
    subtotal: order.subtotal,
    shipping: order.shipping,
    tax: order.tax || 0,
    total: order.total,
    shippingInfo: order.shippingInfo,
    paymentInfo: order.paymentInfo,
    status: 'completed'
  });
  return { id: record._id, ...order, createdAt: record.createdAt };
}

async function getOrder(id) {
  return await Order.findById(id).lean();
}

async function getAllOrders(userId) {
  return await Order.find({ userId }).sort({ createdAt: -1 }).lean();
}

const EMPTY_STATS = { wishlistCount: 0, cartCount: 0, purchasedCount: 0 };

function toMap(rows) {
  const map = {};
  rows.forEach((row) => {
    map[row._id] = row.count;
  });
  return map;
}

/**
 * Compute wishlist, cart and purchase statistics for a set of product ids.
 * Runs three aggregations in total rather than one query per product.
 */
async function getStatsBatch(productIds) {
  const ids = (productIds || []).map(String);
  if (!ids.length || mongoose.connection.readyState !== 1) return {};

  const [wishRow, cartRows, orderRows] = await Promise.all([
    Wishlist.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.productId': { $in: ids } } },
      { $group: { _id: '$items.productId', count: { $sum: 1 } } }
    ]),
    Cart.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.productId': { $in: ids } } },
      { $group: { _id: '$items.productId', count: { $sum: '$items.qty' } } }
    ]),
    Order.aggregate([
      { $unwind: '$items' },
      { $match: { 'items.productId': { $in: ids } } },
      { $group: { _id: '$items.productId', count: { $sum: '$items.qty' } } }
    ])
  ]);

  const wishMap = toMap(wishRow);
  const cartMap = toMap(cartRows);
  const orderMap = toMap(orderRows);

  const stats = {};
  ids.forEach((id) => {
    stats[id] = {
      wishlistCount: wishMap[id] || 0,
      cartCount: cartMap[id] || 0,
      purchasedCount: orderMap[id] || 0
    };
  });
  return stats;
}

/**
 * Statistics for a single item, used by the wishlist and cart routes.
 */
async function getStats(productId) {
  const stats = await getStatsBatch([productId]);
  return stats[String(productId)] || { ...EMPTY_STATS };
}

module.exports = {
  getCart,
  getWishlist,
  saveOrder,
  getOrder,
  getAllOrders,
  getStats,
  getStatsBatch
};
