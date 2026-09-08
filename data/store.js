/**
 * store.js — MongoDB-backed datastore for Assessment 3.
 * Uses Cart, Wishlist, Order models for persistent storage.
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
  const id = `PLX-${Date.now()}`;
  const record = await Order.create({
    userId: order.userId,
    items: order.items,
    subtotal: order.subtotal,
    shipping: order.shipping,
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

function getStats(productId) {
  return { wishlistCount: 0, cartCount: 0, purchasedCount: 0 };
}

module.exports = {
  getCart,
  getWishlist,
  saveOrder,
  getOrder,
  getAllOrders,
  getStats
};
