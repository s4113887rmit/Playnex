const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const currentUser = {
  id: "user-nguyen",
  username: "quangdang",
  name: "Nguyen Ngoc Quang Dang",
  email: "quangdang@example.com",
  role: "customer",
  locked: false
};

const products = [
  { id: "embercrown-saga", title: "Embercrown Saga", type: "digital", category: "digital", genre: "rpg", platforms: ["pc", "console"], price: 59.99, variant: "Digital - PC key", artClass: "card__art--1", badge: "", availability: "in-stock", releasedAt: "2026-07-12", wishlistAdds: 128, cartAdds: 61, purchases: 24 },
  { id: "nightfall-protocol", title: "Nightfall Protocol", type: "digital", category: "digital", genre: "strategy", platforms: ["pc", "console"], price: 44.99, variant: "Digital - PC key", artClass: "card__art--1", badge: "", availability: "in-stock", releasedAt: "2026-08-02", wishlistAdds: 87, cartAdds: 42, purchases: 17 },
  { id: "hollow-cartographer", title: "Hollow Cartographer", type: "digital", category: "digital", genre: "puzzle", platforms: ["pc"], price: 20.99, oldPrice: 29.99, variant: "Digital - PC key", artClass: "card__art--2", badge: "-30%", availability: "in-stock", releasedAt: "2026-07-28", wishlistAdds: 63, cartAdds: 31, purchases: 13 },
  { id: "ironvale-racers", title: "Ironvale Racers", type: "digital", category: "digital", genre: "racing", platforms: ["pc", "console"], price: 34.99, variant: "Digital - Console key", artClass: "card__art--3", badge: "", availability: "in-stock", releasedAt: "2026-08-08", wishlistAdds: 94, cartAdds: 38, purchases: 19 },
  { id: "emberkeep-tactics", title: "Emberkeep Tactics", type: "digital", category: "digital", genre: "strategy", platforms: ["pc"], price: 49.99, variant: "Digital - PC key", artClass: "card__art--4", badge: "New", availability: "in-stock", releasedAt: "2026-08-13", wishlistAdds: 111, cartAdds: 54, purchases: 21 },
  { id: "silt-and-static", title: "Silt and Static", type: "digital", category: "digital", genre: "horror", platforms: ["pc", "console"], price: 27.99, variant: "Digital - PC key", artClass: "card__art--5", badge: "", availability: "in-stock", releasedAt: "2026-07-20", wishlistAdds: 52, cartAdds: 25, purchases: 11 },
  { id: "ruinport-chronicles", title: "Ruinport Chronicles", type: "digital", category: "digital", genre: "rpg", platforms: ["pc"], price: 0, variant: "Digital - PC key", artClass: "card__art--6", badge: "Free", availability: "free", releasedAt: "2026-08-15", wishlistAdds: 203, cartAdds: 148, purchases: 92 },
  { id: "embercrown-throne-figure", title: "Embercrown throne figure", type: "physical", category: "merch", genre: "collectible", platforms: [], price: 64, variant: "Physical - 28cm figure", artClass: "card__art--merch-1", badge: "Physical", availability: "in-stock", releasedAt: "2026-07-09", wishlistAdds: 58, cartAdds: 19, purchases: 8 },
  { id: "nightfall-hoodie", title: "Nightfall Protocol hoodie", type: "physical", category: "merch", genre: "apparel", platforms: [], price: 52, variant: "Physical - Size L - Charcoal", artClass: "card__art--merch-2", badge: "Physical", availability: "in-stock", releasedAt: "2026-07-18", wishlistAdds: 75, cartAdds: 33, purchases: 12 },
  { id: "ruinport-vinyl", title: "Ruinport Chronicles vinyl", type: "physical", category: "merch", genre: "soundtrack", platforms: [], price: 38, variant: "Physical - 2xLP", artClass: "card__art--merch-3", badge: "Physical", availability: "in-stock", releasedAt: "2026-07-22", wishlistAdds: 41, cartAdds: 16, purchases: 7 },
  { id: "ironvale-keycaps", title: "Ironvale Racers keycap set", type: "physical", category: "merch", genre: "accessory", platforms: [], price: 29, variant: "Physical - 12-key set - Orange", artClass: "card__art--merch-4", badge: "Physical", availability: "in-stock", releasedAt: "2026-07-26", wishlistAdds: 49, cartAdds: 27, purchases: 10 },
  { id: "emberkeep-art-book", title: "Emberkeep Tactics art book", type: "physical", category: "merch", genre: "book", platforms: [], price: 34, variant: "Physical - Hardcover - 180 pages", artClass: "card__art--merch-5", badge: "Physical", availability: "in-stock", releasedAt: "2026-08-01", wishlistAdds: 37, cartAdds: 14, purchases: 5 }
];

let cartItems = [
  { id: "cart-1", userId: currentUser.id, productId: "embercrown-saga", quantity: 1, variant: "Digital - PC key" },
  { id: "cart-2", userId: currentUser.id, productId: "nightfall-hoodie", quantity: 1, variant: "Physical - Size L - Charcoal" },
  { id: "cart-3", userId: currentUser.id, productId: "ironvale-keycaps", quantity: 2, variant: "Physical - 12-key set - Orange" }
];

let wishlistItems = [
  { id: "wish-1", userId: currentUser.id, productId: "embercrown-saga", addedAt: "2026-08-16T09:00:00.000Z", purchased: false },
  { id: "wish-2", userId: currentUser.id, productId: "ironvale-racers", addedAt: "2026-08-12T09:00:00.000Z", purchased: false },
  { id: "wish-3", userId: currentUser.id, productId: "nightfall-hoodie", addedAt: "2026-08-10T09:00:00.000Z", purchased: false },
  { id: "wish-4", userId: currentUser.id, productId: "ironvale-keycaps", addedAt: "2026-08-09T09:00:00.000Z", purchased: false },
  { id: "wish-5", userId: currentUser.id, productId: "emberkeep-tactics", addedAt: "2026-08-05T09:00:00.000Z", purchased: false },
  { id: "wish-6", userId: currentUser.id, productId: "silt-and-static", addedAt: "2026-07-29T09:00:00.000Z", purchased: true }
];

let orders = [];

function findProduct(productId) {
  return products.find((product) => product.id === productId);
}

function money(value) {
  return Math.round(value * 100) / 100;
}

function calculateSummary(items) {
  const subtotal = money(items.reduce((sum, item) => {
    const product = findProduct(item.productId);
    return product ? sum + product.price * item.quantity : sum;
  }, 0));
  const hasPhysical = items.some((item) => findProduct(item.productId)?.type === "physical");
  const shipping = items.length && hasPhysical ? 6 : 0;
  const tax = money(subtotal * 0.0828);
  return { subtotal, shipping, tax, total: money(subtotal + shipping + tax) };
}

function publicCart(userId = currentUser.id) {
  const items = cartItems
    .filter((item) => item.userId === userId)
    .map((item) => ({ ...item, product: findProduct(item.productId) }))
    .filter((item) => item.product);
  return { user: currentUser, items, summary: calculateSummary(items) };
}

function publicWishlist(userId = currentUser.id) {
  const items = wishlistItems
    .filter((item) => item.userId === userId)
    .map((item) => ({ ...item, product: findProduct(item.productId) }))
    .filter((item) => item.product);
  return { user: currentUser, items };
}

function validateCartPayload(body) {
  const errors = {};
  if (!body.productId || !findProduct(body.productId)) errors.productId = "Choose a valid product.";
  const quantity = Number(body.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) errors.quantity = "Quantity must be between 1 and 10.";
  return { errors, quantity };
}

function validateCheckout(body) {
  const errors = {};
  const required = ["fullName", "phone", "address", "city", "postalCode", "country", "cardName", "cardNumber", "cardExpiry", "cardCvc"];
  required.forEach((field) => {
    if (!String(body[field] || "").trim()) errors[field] = "This field is required.";
  });
  if (body.fullName && String(body.fullName).trim().length < 2) errors.fullName = "Enter your full name.";
  if (body.phone && !/^[0-9 +()-]{8,15}$/.test(body.phone)) errors.phone = "Enter a valid phone number.";
  if (body.address && String(body.address).trim().length < 8) errors.address = "Enter a complete street address.";
  if (body.postalCode && !/^[0-9A-Za-z -]{4,10}$/.test(body.postalCode)) errors.postalCode = "Enter a valid postal code.";
  const cardNumber = String(body.cardNumber || "").replace(/\s/g, "");
  if (cardNumber && !/^\d{13,19}$/.test(cardNumber)) errors.cardNumber = "Enter 13 to 19 card digits.";
  if (body.cardExpiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(body.cardExpiry)) errors.cardExpiry = "Use MM/YY format.";
  if (body.cardCvc && !/^\d{3,4}$/.test(body.cardCvc)) errors.cardCvc = "Use 3 or 4 digits.";
  if (!publicCart().items.length) errors.cart = "Your cart is empty.";
  return errors;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/homepage.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml"
    }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/session") return sendJson(res, 200, { user: currentUser });
    if (req.method === "GET" && pathname === "/api/products") return sendJson(res, 200, { products });
    if (req.method === "GET" && pathname === "/api/cart") return sendJson(res, 200, publicCart());
    if (req.method === "GET" && pathname === "/api/wishlist") return sendJson(res, 200, publicWishlist());

    if (req.method === "POST" && pathname === "/api/cart") {
      const body = await readBody(req);
      const { errors, quantity } = validateCartPayload(body);
      if (Object.keys(errors).length) return sendJson(res, 400, { errors });
      const product = findProduct(body.productId);
      const variant = String(body.variant || product.variant);
      const existing = cartItems.find((item) => item.userId === currentUser.id && item.productId === product.id && item.variant === variant);
      if (existing) {
        existing.quantity = Math.min(10, existing.quantity + quantity);
      } else {
        cartItems.push({ id: `cart-${Date.now()}`, userId: currentUser.id, productId: product.id, quantity, variant });
      }
      product.cartAdds += 1;
      return sendJson(res, 201, publicCart());
    }

    const cartMatch = pathname.match(/^\/api\/cart\/([^/]+)$/);
    if (cartMatch && req.method === "PATCH") {
      const body = await readBody(req);
      const item = cartItems.find((cartItem) => cartItem.id === cartMatch[1] && cartItem.userId === currentUser.id);
      if (!item) return sendJson(res, 404, { errors: { item: "Cart item not found." } });
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        return sendJson(res, 400, { errors: { quantity: "Quantity must be between 1 and 10." } });
      }
      item.quantity = quantity;
      if (body.variant) item.variant = String(body.variant).slice(0, 80);
      return sendJson(res, 200, publicCart());
    }
    if (cartMatch && req.method === "DELETE") {
      cartItems = cartItems.filter((item) => !(item.id === cartMatch[1] && item.userId === currentUser.id));
      return sendJson(res, 200, publicCart());
    }

    if (req.method === "POST" && pathname === "/api/wishlist") {
      const body = await readBody(req);
      const product = findProduct(body.productId);
      if (!product) return sendJson(res, 400, { errors: { productId: "Choose a valid product." } });
      const duplicate = wishlistItems.find((item) => item.userId === currentUser.id && item.productId === product.id);
      if (duplicate) return sendJson(res, 409, { errors: { duplicate: "This product is already in your wishlist." }, wishlist: publicWishlist() });
      wishlistItems.push({ id: `wish-${Date.now()}`, userId: currentUser.id, productId: product.id, addedAt: new Date().toISOString(), purchased: false });
      product.wishlistAdds += 1;
      return sendJson(res, 201, publicWishlist());
    }

    const wishMoveMatch = pathname.match(/^\/api\/wishlist\/([^/]+)\/move-to-cart$/);
    if (wishMoveMatch && req.method === "POST") {
      const wish = wishlistItems.find((item) => item.id === wishMoveMatch[1] && item.userId === currentUser.id);
      if (!wish) return sendJson(res, 404, { errors: { item: "Wishlist item not found." } });
      const product = findProduct(wish.productId);
      const existing = cartItems.find((item) => item.userId === currentUser.id && item.productId === product.id && item.variant === product.variant);
      if (existing) existing.quantity = Math.min(10, existing.quantity + 1);
      else cartItems.push({ id: `cart-${Date.now()}`, userId: currentUser.id, productId: product.id, quantity: 1, variant: product.variant });
      wishlistItems = wishlistItems.filter((item) => item.id !== wish.id);
      product.cartAdds += 1;
      return sendJson(res, 200, { cart: publicCart(), wishlist: publicWishlist() });
    }

    const wishMatch = pathname.match(/^\/api\/wishlist\/([^/]+)$/);
    if (wishMatch && req.method === "PATCH") {
      const body = await readBody(req);
      const item = wishlistItems.find((wish) => wish.id === wishMatch[1] && wish.userId === currentUser.id);
      if (!item) return sendJson(res, 404, { errors: { item: "Wishlist item not found." } });
      item.purchased = Boolean(body.purchased);
      return sendJson(res, 200, publicWishlist());
    }
    if (wishMatch && req.method === "DELETE") {
      wishlistItems = wishlistItems.filter((item) => !(item.id === wishMatch[1] && item.userId === currentUser.id));
      return sendJson(res, 200, publicWishlist());
    }

    if (req.method === "POST" && pathname === "/api/checkout") {
      const body = await readBody(req);
      const errors = validateCheckout(body);
      if (Object.keys(errors).length) return sendJson(res, 400, { errors });
      const cart = publicCart();
      const order = {
        id: `PLX-${Math.floor(10000 + Math.random() * 90000)}`,
        userId: currentUser.id,
        items: cart.items,
        summary: cart.summary,
        delivery: {
          fullName: body.fullName,
          phone: body.phone,
          address: body.address,
          city: body.city,
          postalCode: body.postalCode,
          country: body.country
        },
        status: "confirmed",
        createdAt: new Date().toISOString()
      };
      orders.push(order);
      cart.items.forEach((item) => {
        const product = findProduct(item.productId);
        if (product) product.purchases += item.quantity;
      });
      cartItems = cartItems.filter((item) => item.userId !== currentUser.id);
      return sendJson(res, 201, { order });
    }

    const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch && req.method === "GET") {
      const order = orders.find((item) => item.id === orderMatch[1] && item.userId === currentUser.id);
      if (!order) return sendJson(res, 404, { errors: { order: "Order not found." } });
      return sendJson(res, 200, { order });
    }

    return sendJson(res, 404, { errors: { route: "API route not found." } });
  } catch (error) {
    return sendJson(res, 500, { errors: { server: error.message } });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Playnex prototype running at http://localhost:${PORT}/homepage.html`);
});
