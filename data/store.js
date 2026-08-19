/**
 * store.js — In-memory datastore for Assessment 2.
 * Keyed by userId so every user has their own isolated Cart, Wishlist, and Order history.
 */

const carts = {};      // { [userId]: [{ productId, qty, variant }] }
const wishlists = {};  // { [userId]: [{ productId, addedAt, purchased }] }
const orders = {};     // { [orderId]: order }

// Global wishlist & cart counters for statistics
const productStats = {}; // { [productId]: { wishlistCount: number, cartCount: number, purchasedCount: number } }

let nextOrderNumber = 48213;

function getStats(productId) {
  if (!productStats[productId]) {
    productStats[productId] = { wishlistCount: 0, cartCount: 0, purchasedCount: 0 };
  }
  return productStats[productId];
}

function getCart(userId) {
  if (!carts[userId]) {
    // Initial demo default cart for realistic testing if newly created
    carts[userId] = [];
  }
  return carts[userId];
}

function getWishlist(userId) {
  if (!wishlists[userId]) {
    wishlists[userId] = [];
  }
  return wishlists[userId];
}

function saveOrder(order) {
  const id = `PLX-${nextOrderNumber++}`;
  const record = { id, ...order, createdAt: new Date().toISOString() };
  orders[id] = record;
  
  // Update purchase statistics
  if (Array.isArray(order.items)) {
    order.items.forEach(item => {
      const stats = getStats(item.productId || (item.product && item.product.id));
      stats.purchasedCount += (item.qty || 1);
    });
  }
  
  return record;
}

function getOrder(id) {
  return orders[id] || null;
}

function getAllOrders(userId) {
  return Object.values(orders).filter(o => o.userId === userId);
}

module.exports = {
  getCart,
  getWishlist,
  saveOrder,
  getOrder,
  getAllOrders,
  getStats
};
