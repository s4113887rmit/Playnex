(function () {
  const CURRENT_USER = {
    id: "user-nguyen",
    username: "quangdang",
    name: "Nguyen Ngoc Quang Dang",
    email: "quangdang@example.com"
  };

  const PRODUCTS = [
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

  const key = (name) => `playnex:${CURRENT_USER.id}:${name}`;
  const read = (name, fallback) => {
    try {
      const value = localStorage.getItem(key(name));
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };
  const write = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  const productById = (productId) => PRODUCTS.find((product) => product.id === productId);
  const currency = (value) => `$${Number(value || 0).toFixed(2)}`;
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const defaultCart = () => [
    { id: "cart-1", userId: CURRENT_USER.id, productId: "embercrown-saga", quantity: 1, variant: "Digital - PC key" },
    { id: "cart-2", userId: CURRENT_USER.id, productId: "nightfall-hoodie", quantity: 1, variant: "Physical - Size L - Charcoal" },
    { id: "cart-3", userId: CURRENT_USER.id, productId: "ironvale-keycaps", quantity: 2, variant: "Physical - 12-key set - Orange" }
  ];

  const defaultWishlist = () => [
    { id: "wish-1", userId: CURRENT_USER.id, productId: "embercrown-saga", addedAt: "2026-08-16T09:00:00.000Z", purchased: false },
    { id: "wish-2", userId: CURRENT_USER.id, productId: "ironvale-racers", addedAt: "2026-08-12T09:00:00.000Z", purchased: false },
    { id: "wish-3", userId: CURRENT_USER.id, productId: "nightfall-hoodie", addedAt: "2026-08-10T09:00:00.000Z", purchased: false },
    { id: "wish-4", userId: CURRENT_USER.id, productId: "ironvale-keycaps", addedAt: "2026-08-09T09:00:00.000Z", purchased: false },
    { id: "wish-5", userId: CURRENT_USER.id, productId: "emberkeep-tactics", addedAt: "2026-08-05T09:00:00.000Z", purchased: false },
    { id: "wish-6", userId: CURRENT_USER.id, productId: "silt-and-static", addedAt: "2026-07-29T09:00:00.000Z", purchased: true }
  ];

  function cartFromLocal() {
    const items = read("cart", defaultCart()).map((item) => ({ ...item, product: productById(item.productId) })).filter((item) => item.product);
    return { user: CURRENT_USER, items, summary: summary(items) };
  }

  function wishlistFromLocal() {
    const items = read("wishlist", defaultWishlist()).map((item) => ({ ...item, product: productById(item.productId) })).filter((item) => item.product);
    return { user: CURRENT_USER, items };
  }

  function saveCartResponse(cart) {
    write("cart", cart.items.map(({ id, userId, productId, quantity, variant }) => ({ id, userId, productId, quantity, variant })));
    return cart;
  }

  function saveWishlistResponse(wishlist) {
    write("wishlist", wishlist.items.map(({ id, userId, productId, addedAt, purchased }) => ({ id, userId, productId, addedAt, purchased })));
    return wishlist;
  }

  function summary(items) {
    const subtotal = round(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
    const shipping = items.length && items.some((item) => item.product.type === "physical") ? 6 : 0;
    const tax = round(subtotal * 0.0828);
    return { subtotal, shipping, tax, total: round(subtotal + shipping + tax) };
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const json = await response.json();
    if (!response.ok) {
      const error = new Error("Request failed");
      error.payload = json;
      throw error;
    }
    return json;
  }

  async function getProducts() {
    try {
      const data = await request("/api/products");
      return data.products;
    } catch {
      return PRODUCTS;
    }
  }

  async function getCart() {
    try {
      return saveCartResponse(await request("/api/cart"));
    } catch {
      return cartFromLocal();
    }
  }

  async function addToCart(productId, quantity = 1, variant) {
    try {
      const cart = await request("/api/cart", { method: "POST", body: { productId, quantity, variant } });
      return saveCartResponse(cart);
    } catch {
      const product = productById(productId);
      const existingCart = cartFromLocal();
      const cleanVariant = variant || product.variant;
      const existing = existingCart.items.find((item) => item.productId === productId && item.variant === cleanVariant);
      if (existing) existing.quantity = Math.min(10, existing.quantity + Number(quantity || 1));
      else existingCart.items.push({ id: uid("cart"), userId: CURRENT_USER.id, productId, quantity: Number(quantity || 1), variant: cleanVariant, product });
      return saveCartResponse({ ...existingCart, summary: summary(existingCart.items) });
    }
  }

  async function updateCartItem(itemId, quantity) {
    try {
      const cart = await request(`/api/cart/${itemId}`, { method: "PATCH", body: { quantity } });
      return saveCartResponse(cart);
    } catch {
      const cart = cartFromLocal();
      cart.items = cart.items.map((item) => item.id === itemId ? { ...item, quantity } : item);
      return saveCartResponse({ ...cart, summary: summary(cart.items) });
    }
  }

  async function removeCartItem(itemId) {
    try {
      const cart = await request(`/api/cart/${itemId}`, { method: "DELETE" });
      return saveCartResponse(cart);
    } catch {
      const cart = cartFromLocal();
      cart.items = cart.items.filter((item) => item.id !== itemId);
      return saveCartResponse({ ...cart, summary: summary(cart.items) });
    }
  }

  async function getWishlist() {
    try {
      return saveWishlistResponse(await request("/api/wishlist"));
    } catch {
      return wishlistFromLocal();
    }
  }

  async function addToWishlist(productId) {
    try {
      return saveWishlistResponse(await request("/api/wishlist", { method: "POST", body: { productId } }));
    } catch (error) {
      const product = productById(productId);
      const wishlist = wishlistFromLocal();
      if (wishlist.items.some((item) => item.productId === productId)) {
        const duplicate = new Error("Duplicate wishlist item");
        duplicate.payload = { errors: { duplicate: "This product is already in your wishlist." } };
        throw duplicate;
      }
      wishlist.items.push({ id: uid("wish"), userId: CURRENT_USER.id, productId, addedAt: new Date().toISOString(), purchased: false, product });
      return saveWishlistResponse(wishlist);
    }
  }

  async function removeWishlistItem(itemId) {
    try {
      return saveWishlistResponse(await request(`/api/wishlist/${itemId}`, { method: "DELETE" }));
    } catch {
      const wishlist = wishlistFromLocal();
      wishlist.items = wishlist.items.filter((item) => item.id !== itemId);
      return saveWishlistResponse(wishlist);
    }
  }

  async function moveWishlistToCart(itemId) {
    try {
      const data = await request(`/api/wishlist/${itemId}/move-to-cart`, { method: "POST" });
      saveCartResponse(data.cart);
      saveWishlistResponse(data.wishlist);
      return data;
    } catch {
      const wishlist = wishlistFromLocal();
      const item = wishlist.items.find((wish) => wish.id === itemId);
      if (item) await addToCart(item.productId, 1, item.product.variant);
      return { cart: cartFromLocal(), wishlist: await removeWishlistItem(itemId) };
    }
  }

  async function markWishlistPurchased(itemId, purchased) {
    try {
      return saveWishlistResponse(await request(`/api/wishlist/${itemId}`, { method: "PATCH", body: { purchased } }));
    } catch {
      const wishlist = wishlistFromLocal();
      wishlist.items = wishlist.items.map((item) => item.id === itemId ? { ...item, purchased } : item);
      return saveWishlistResponse(wishlist);
    }
  }

  async function checkout(payload) {
    try {
      const data = await request("/api/checkout", { method: "POST", body: payload });
      write("lastOrder", data.order);
      write("cart", []);
      return data;
    } catch (error) {
      if (error.payload && error.payload.errors) throw error;
      const cart = cartFromLocal();
      const order = {
        id: `PLX-${Math.floor(10000 + Math.random() * 90000)}`,
        userId: CURRENT_USER.id,
        items: cart.items,
        summary: cart.summary,
        delivery: {
          fullName: payload.fullName,
          phone: payload.phone,
          address: payload.address,
          city: payload.city,
          postalCode: payload.postalCode,
          country: payload.country
        },
        status: "confirmed",
        createdAt: new Date().toISOString()
      };
      write("lastOrder", order);
      write("cart", []);
      return { order };
    }
  }

  async function getOrder(orderId) {
    try {
      return await request(`/api/orders/${orderId}`);
    } catch {
      return { order: read("lastOrder", null) };
    }
  }

  function productCard(product, options = {}) {
    const badgeClass = product.badge === "Physical" ? "card__badge card__badge--merch" : "card__badge";
    const priceHtml = product.oldPrice
      ? `<span class="card__price-old">${currency(product.oldPrice)}</span><span class="card__price-now">${currency(product.price)}</span>`
      : `<span class="card__price-now">${currency(product.price)}</span>`;
    const meta = product.type === "physical"
      ? product.variant.replace("Physical - ", "")
      : `${titleCase(product.genre)} - ${product.platforms.map(titleCase).join(", ")}`;
    const addText = product.price === 0 ? "Claim free" : "Add to cart";
    const addButton = options.showAdd === false ? "" : `<button type="button" class="btn btn--ghost btn--small card__add" data-action="add-cart" data-product-id="${product.id}">${addText}</button>`;
    return `
      <li>
        <article class="card" data-product-id="${product.id}" data-category="${product.category}" data-price="${product.price}" data-genre="${product.genre}">
          <div class="card__art ${product.artClass}">
            ${product.badge ? `<span class="${badgeClass}">${product.badge}</span>` : ""}
            <button type="button" class="card__wishlist" data-action="add-wishlist" data-product-id="${product.id}" aria-label="Add ${product.title} to wishlist">&hearts;</button>
          </div>
          <div class="card__body">
            <h3 class="card__title">${product.title}</h3>
            <p class="card__meta">${meta}</p>
            <div class="card__price">${priceHtml}</div>
            ${addButton}
          </div>
        </article>
      </li>
    `;
  }

  function titleCase(value) {
    return String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function showToast(message, type = "success") {
    let toast = document.querySelector("[data-toast]");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("data-toast", "");
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle("toast--error", type === "error");
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  async function updateHeaderCounts() {
    const [cart, wishlist] = await Promise.all([getCart(), getWishlist()]);
    const cartCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('a[href="cart.html"].icon-btn').forEach((link) => {
      link.setAttribute("aria-label", `Cart, ${cartCount} items`);
      setBadge(link, cartCount);
    });
    document.querySelectorAll('a[href="wishlist.html"].icon-btn').forEach((link) => {
      link.setAttribute("aria-label", `Wishlist, ${wishlist.items.length} items`);
      setBadge(link, wishlist.items.length);
    });
  }

  function setBadge(link, count) {
    let badge = link.querySelector(".nav-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "nav-count";
      link.appendChild(badge);
    }
    badge.textContent = count;
    badge.hidden = count === 0;
  }

  function bindProductActions(root = document) {
    root.addEventListener("click", async (event) => {
      const cartButton = event.target.closest("[data-action='add-cart']");
      const wishButton = event.target.closest("[data-action='add-wishlist']");
      if (!cartButton && !wishButton) return;
      event.preventDefault();
      const button = cartButton || wishButton;
      const product = productById(button.dataset.productId);
      if (!product) return;
      try {
        if (cartButton) {
          await addToCart(product.id, 1, product.variant);
          showToast(`${product.title} added to cart`);
        } else {
          await addToWishlist(product.id);
          showToast(`${product.title} added to wishlist`);
        }
        updateHeaderCounts();
      } catch (error) {
        const duplicate = error.payload?.errors?.duplicate;
        showToast(duplicate || "Could not update your items.", "error");
      }
    });
  }

  window.Playnex = {
    user: CURRENT_USER,
    products: PRODUCTS,
    productById,
    currency,
    productCard,
    showToast,
    bindProductActions,
    updateHeaderCounts,
    storage: { read, write, key },
    api: {
      getProducts,
      getCart,
      addToCart,
      updateCartItem,
      removeCartItem,
      getWishlist,
      addToWishlist,
      removeWishlistItem,
      moveWishlistToCart,
      markWishlistPurchased,
      checkout,
      getOrder
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindProductActions();
    updateHeaderCounts();
  });
})();
