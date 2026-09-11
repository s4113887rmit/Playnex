/**
 * homepage.js — Dynamic homepage logic for Playnex.
 * Renders digital & merchandise shelves dynamically, supports live search, sorting, and cart/wishlist additions.
 */
(function () {
  'use strict';

  const { api, showToast, requireLogin } = window.Playnex;

  let allProducts = [];
  let wishlistIds = new Set();
  let searchTerm = '';

  const newReleasesList = document.querySelector('#new-releases .shelf__row');
  const merchList = document.querySelector('#merch .shelf__row');
  const searchInput = document.getElementById('site-search');

  // ==========================================
  // HERO CAROUSEL DATA & STATE
  // ==========================================
  // The hero stage now runs three advertising slides instead of games:
  //   1. Website launch — 50% launch voucher (Welcome2Playnex)
  //   2. Games currently on sale  -> shopping.html?cat=sale
  //   3. Games currently free     -> shopping.html?cat=free
  const heroSlides = [
    {
      id: 'launch-voucher',
      kind: 'Launch offer',
      title: 'Playnex is open — 50% off every game',
      desc: 'To celebrate our grand opening, Playnex gives you a 50% discount voucher on every game in the store. Use voucher code Welcome2Playnex — the offer cannot be applied to games that are already free.',
      cta: 'See the launch offer',
      href: 'offers.html',
      code: 'Welcome2Playnex',
      badge: '-50%',
      tags: ['Launch deal', '50% off', 'Every game'],
      cssClass: 'hero-card--ad hero-card--launch',
      image: 'public/img/ad-launch.svg'
    },
    {
      id: 'on-sale',
      kind: 'On sale now',
      title: 'Games on sale this week',
      desc: 'Big price drops across PC and console titles. Browse everything currently discounted in the store and grab the lowest prices of the season.',
      cta: 'Shop the sale',
      href: 'shopping.html?cat=sale',
      badge: 'SALE',
      tags: ['Discounted', 'Limited time', 'PC & Console'],
      cssClass: 'hero-card--ad hero-card--sale',
      image: 'public/img/ad-sale.svg'
    },
    {
      id: 'free-week',
      kind: 'Free this week',
      title: 'Free games to claim',
      desc: 'Free titles you can add to your library at no cost. Claim them while the giveaway lasts — voucher discounts do not apply to free games.',
      cta: 'Claim free games',
      href: 'shopping.html?cat=free',
      badge: 'FREE',
      tags: ['Free giveaway', 'No cost', 'Claim now'],
      cssClass: 'hero-card--ad hero-card--free',
      image: 'public/img/ad-free.svg'
    }
  ];

  let currentHeroIndex = 0;
  let heroTimer = null;
  let heroPaused = false;
  const heroStage = document.getElementById('hero-stage');
  let heroCardElements = [];
  let heroDotElements = [];

  function initHeroCarousel() {
    if (!heroStage) return;

    heroStage.innerHTML = heroSlides.map((slide, idx) => `
      <a href="${slide.href}" class="hero-card ${slide.cssClass}" data-index="${idx}" data-id="${slide.id}" aria-label="${slide.title}">
        <div class="hero-card__art">
          <img src="${slide.image}" alt="" class="hero-card__img" loading="eager">
          <div class="hero-card__ad-overlay"></div>
          <div class="hero-card__ad-body">
            <span class="hero-card__ad-kind">${slide.kind}</span>
            <span class="hero-card__ad-title">${slide.title}</span>
            ${slide.code
              ? `<span class="hero-card__ad-code">${slide.code}</span>`
              : (slide.badge ? `<span class="hero-card__ad-badge">${slide.badge}</span>` : '')}
            <span class="hero-card__ad-cta">${slide.cta} &rarr;</span>
          </div>
        </div>
      </a>
    `).join('');

    heroCardElements = Array.from(heroStage.querySelectorAll('.hero-card'));

    const heroVisual = document.getElementById('hero-visual');
    let heroDotsContainer = document.getElementById('hero-dots');
    if (!heroDotsContainer && heroVisual) {
      heroDotsContainer = document.createElement('div');
      heroDotsContainer.id = 'hero-dots';
      heroDotsContainer.className = 'hero__dots';
      heroDotsContainer.setAttribute('role', 'tablist');
      heroDotsContainer.setAttribute('aria-label', 'Featured games pagination');
      heroVisual.appendChild(heroDotsContainer);
    }

    if (heroDotsContainer) {
      heroDotsContainer.innerHTML = heroSlides.map((slide, idx) => `
        <button type="button" class="hero__dot${idx === 0 ? ' is-active' : ''}" data-index="${idx}" role="tab" aria-label="Go to slide ${idx + 1}: ${slide.title}" aria-selected="${idx === 0 ? 'true' : 'false'}"></button>
      `).join('');

      heroDotElements = Array.from(heroDotsContainer.querySelectorAll('.hero__dot'));

      heroDotElements.forEach((dot) => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          const targetIndex = parseInt(dot.dataset.index, 10);
          if (!isNaN(targetIndex) && targetIndex !== currentHeroIndex) {
            updateHeroCarousel(targetIndex, true);
            startHeroTimer();
          }
        });
      });
    }

    updateHeroCarousel(0, false);
    startHeroTimer();

    const prevBtn = document.getElementById('hero-prev-btn');
    const nextBtn = document.getElementById('hero-next-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        updateHeroCarousel(currentHeroIndex - 1, true);
        startHeroTimer();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        updateHeroCarousel(currentHeroIndex + 1, true);
        startHeroTimer();
      });
    }

    // Respect the user's motion preference: do not auto-advance when reduced
    // motion is requested, and resume automatically if the preference changes.
    const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (motionQuery && motionQuery.matches) {
      heroPaused = true;
    }

    const pauseBtn = document.getElementById('hero-pause-btn');
    setPauseButtonState(pauseBtn);

    if (pauseBtn) {
      pauseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        heroPaused = !heroPaused;
        setPauseButtonState(pauseBtn);
        if (heroPaused) stopHeroTimer();
        else startHeroTimer();
      });
    }

    if (motionQuery) {
      const onMotionChange = (event) => {
        heroPaused = event.matches;
        setPauseButtonState(pauseBtn);
        if (heroPaused) stopHeroTimer();
        else startHeroTimer();
      };
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
      else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
    }

    if (heroVisual) {
      // Pause while the carousel is hovered or holds keyboard focus.
      heroVisual.addEventListener('mouseenter', stopHeroTimer);
      heroVisual.addEventListener('mouseleave', () => { if (!heroPaused) startHeroTimer(); });
      heroVisual.addEventListener('focusin', stopHeroTimer);
      heroVisual.addEventListener('focusout', () => { if (!heroPaused) startHeroTimer(); });
    }
  }

  function updateHeroCarousel(index, animate = true) {
    if (!heroCardElements.length) return;

    currentHeroIndex = (index + heroSlides.length) % heroSlides.length;
    const total = heroSlides.length;
    const prevIdx = (currentHeroIndex - 1 + total) % total;
    const nextIdx = (currentHeroIndex + 1) % total;

    heroCardElements.forEach((card, i) => {
      card.classList.remove(
        'hero-card--active',
        'hero-card--prev',
        'hero-card--next',
        'hero-card--hidden-left',
        'hero-card--hidden-right'
      );

      if (i === currentHeroIndex) {
        card.classList.add('hero-card--active');
      } else if (i === prevIdx) {
        card.classList.add('hero-card--prev');
      } else if (i === nextIdx) {
        card.classList.add('hero-card--next');
      } else {
        const diff = (i - currentHeroIndex + total) % total;
        if (diff > total / 2) {
          card.classList.add('hero-card--hidden-left');
        } else {
          card.classList.add('hero-card--hidden-right');
        }
      }
    });

    // Update pagination dots
    heroDotElements.forEach((dot, i) => {
      const isActive = i === currentHeroIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const activeSlide = heroSlides[currentHeroIndex];
    const heroContent = document.getElementById('hero-content');

    if (heroContent && animate) {
      heroContent.classList.add('is-changing');
      setTimeout(() => {
        renderHeroInfo(activeSlide);
        heroContent.classList.remove('is-changing');
        refreshCart();
        refreshWishlist();
      }, 140);
    } else if (heroContent) {
      renderHeroInfo(activeSlide);
      refreshCart();
      refreshWishlist();
    }
  }

  // Renders the text column beside the hero carousel for the active advert.
  // The carousel no longer features individual games, so the per-game meta,
  // wishlist and add-to-cart controls are hidden and the primary button becomes
  // a single call-to-action that leads to the advertised destination.
  function renderHeroInfo(slide) {
    const eyebrowEl = document.getElementById('hero-eyebrow');
    const titleEl = document.getElementById('hero-title');
    const descEl = document.getElementById('hero-desc');
    const metaEl = document.getElementById('hero-meta');
    const tagsEl = document.getElementById('hero-tags');
    const buyBtn = document.getElementById('hero-buy-btn');
    const wishBtn = document.getElementById('hero-wishlist-btn');
    const cartBtn = document.getElementById('hero-cart-btn');

    if (eyebrowEl) eyebrowEl.textContent = slide.kind;
    if (titleEl) titleEl.textContent = slide.title;
    if (descEl) descEl.textContent = slide.desc;

    if (metaEl) metaEl.style.display = 'none';
    if (cartBtn) cartBtn.style.display = 'none';
    if (wishBtn) wishBtn.style.display = 'none';

    if (tagsEl) {
      tagsEl.innerHTML = (slide.tags || [])
        .map(tag => `<li><span class="hero__tag">${tag}</span></li>`)
        .join('');
    }

    if (buyBtn) {
      buyBtn.textContent = slide.cta;
      buyBtn.href = slide.href;
    }
  }

  function startHeroTimer() {
    stopHeroTimer();
    if (heroPaused) return;
    // Each advert slide holds for 3s before the carousel advances.
    heroTimer = setInterval(() => {
      updateHeroCarousel(currentHeroIndex + 1, true);
    }, 3000);
  }

  function stopHeroTimer() {
    if (heroTimer) {
      clearInterval(heroTimer);
      heroTimer = null;
    }
  }

  function setPauseButtonState(btn) {
    if (!btn) return;
    btn.textContent = heroPaused ? 'Play' : 'Pause';
    btn.setAttribute('aria-pressed', heroPaused ? 'true' : 'false');
    btn.setAttribute('aria-label', heroPaused ? 'Play featured offers carousel' : 'Pause featured offers carousel');
  }

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  // Promotion state — mirrors shopping.js so both pages highlight promos the
  // same way: gold for free giveaways, silver for discounted (on sale) games.
  function isFreeThisWeek(p) {
    return Number(p.price) === 0;
  }

  function isDiscounted(p) {
    return !isFreeThisWeek(p) && Number(p.oldPrice) > Number(p.price);
  }

  function discountPercent(p) {
    const oldPrice = Number(p.oldPrice);
    const price = Number(p.price);
    if (!oldPrice || oldPrice <= price) return 0;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  }

  function cardHTML(p) {
    const isFree = isFreeThisWeek(p);
    const isDeal = isDiscounted(p);
    // Digital titles already owned by this account are no longer purchasable.
    const isOwned = !!p.owned;

    const priceHTML = isFree
      ? `<span class="card__price-free">Free this week</span>`
      : p.oldPrice
        ? `<span class="card__price-old">${money(p.oldPrice)}</span><span class="card__price-now card__price-now--deal">${money(p.price)}</span>`
        : `<span class="card__price-now">${money(p.price)}</span>`;

    let badge = '';
    if (isOwned) {
      badge = `<span class="card__badge card__badge--owned">Owned</span>`;
    } else if (isFree) {
      badge = `<span class="card__badge card__badge--free">Free this week</span>`;
    } else if (isDeal) {
      badge = `<span class="card__badge card__badge--deal">-${discountPercent(p)}%</span>`;
    } else if (p.badge && p.badge !== 'Physical') {
      badge = `<span class="card__badge${p.badge === 'New' ? ' card__badge--new' : ''}">${p.badge}</span>`;
    }

    const imgTag = p.image
      ? `<img src="${p.image}" alt="${p.title} poster" loading="lazy">`
      : `<div class="card__placeholder-art">${p.title.charAt(0)}</div>`;

    const isSaved = wishlistIds.has(p.id);

    return `
      <li>
        <article class="card${isOwned ? ' card--owned' : isFree ? ' card--free' : isDeal ? ' card--deal' : ''}" data-id="${p.id}">
          <div class="card__art ${p.art || 'card__art--1'}">
            <a href="${p.href || 'shopping.html'}" aria-label="View ${p.title} details">
              ${imgTag}
            </a>
            ${badge}
            <button class="card__wishlist${isSaved ? ' is-saved' : ''}" aria-label="${isSaved ? 'Remove ' + p.title + ' from wishlist' : 'Add ' + p.title + ' to wishlist'}" type="button" data-action="wishlist" data-id="${p.id}">&hearts;</button>
          </div>
          <div class="card__body">
            <h3 class="card__title"><a href="${p.href || 'shopping.html'}">${p.title}</a></h3>
            <p class="card__meta">${p.genre} · ${p.platform}</p>
            <div class="card__price${isFree ? ' card__price--free' : isDeal ? ' card__price--deal' : ''}">${priceHTML}</div>
            <button type="button" class="btn btn--ghost btn--small card__add" data-action="add-to-cart" data-id="${p.id}" ${isOwned ? 'disabled' : ''}>${isOwned ? 'Already owned' : 'Add to cart'}</button>
          </div>
        </article>
      </li>`;
  }

  function applySort(list, sortValue) {
    const sorted = [...list];
    if (sortValue === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sortValue === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sortValue === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    return sorted;
  }

  function matchesSearch(product) {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return product.title.toLowerCase().includes(term) ||
           product.genre.toLowerCase().includes(term) ||
           product.platform.toLowerCase().includes(term);
  }

  function render() {
    const digitalSortEl = document.getElementById('sort-digital');
    const digitalSort = digitalSortEl ? digitalSortEl.value : 'title';

    const sortedDigitalProducts = applySort(
      allProducts.filter(p => p.category === 'digital' && p.image && p.image.trim() !== '' && matchesSearch(p)),
      digitalSort
    );
    const digitalProducts = [
      ...sortedDigitalProducts.filter(p => p.badge === 'New'),
      ...sortedDigitalProducts.filter(p => p.badge !== 'New')
    ];
    const fc26 = allProducts.find(p => p.id === 'ea-sports-fc-26' && matchesSearch(p));
    const digital = fc26 ? [fc26, ...digitalProducts] : digitalProducts;

    const physicalProducts = allProducts.filter(p => p.category === 'physical' && matchesSearch(p));
    const featuredFc26 = physicalProducts.find(p => p.id === 'ea-sports-fc-26');
    const otherPhysical = physicalProducts.filter(p => p.id !== 'ea-sports-fc-26');
    const physical = (featuredFc26 ? [featuredFc26, ...otherPhysical] : otherPhysical).slice(0, 5);

    if (newReleasesList) {
      newReleasesList.innerHTML = digital.length
        ? digital.map(cardHTML).join('')
        : '<li class="shelf-empty">No games match your search.</li>';
    }

    if (merchList) {
      merchList.innerHTML = physical.length
        ? physical.map(cardHTML).join('')
        : '<li class="shelf-empty">No physical merch matches your search.</li>';
    }
  }

  async function loadProducts() {
    try {
      const [productsData, wishlistData] = await Promise.all([
        api('/api/products'),
        api('/api/wishlist').catch(() => ({ items: [] }))
      ]);
      // Only keep real games with images and legitimate physical products
      allProducts = (productsData || []).filter(p => {
        if (p.category === 'digital') {
          return p.image && p.image.trim() !== '';
        }
        return true;
      });
      wishlistIds = new Set((wishlistData.items || []).map(item => item.id));
      render();
      refreshCart();
      refreshWishlist();
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  async function refreshWishlist() {
    try {
      const wishlistData = await api('/api/wishlist').catch(() => ({ items: [] }));
      wishlistIds = new Set((wishlistData.items || []).map(item => item.id));
      document.querySelectorAll('[data-action="wishlist"]').forEach(btn => {
        const id = btn.dataset.id;
        if (id) {
          btn.classList.toggle('is-saved', wishlistIds.has(id));
          if (btn.id === 'hero-wishlist-btn') {
            btn.textContent = wishlistIds.has(id) ? 'Saved in wishlist' : 'Add to wishlist';
          }
        }
      });
    } catch {}
  }

  async function refreshCart() {
    try {
      const cartData = await api('/api/cart').catch(() => ({ items: [] }));
      const cartIds = new Set((cartData.items || []).map(item => item.productId));
      document.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
        const id = btn.dataset.id;
        if (id && cartIds.has(id)) {
          const product = allProducts.find(p => p.id === id);
          const isDigital = product && (product.category === 'digital' || product.type === 'Digital');
          if (isDigital) {
            btn.textContent = 'Already in cart';
            btn.disabled = true;
          }
        }
      });
      // The hero carousel now shows adverts rather than games, so the stage's
      // cart button is hidden and only shelf/card buttons are synced above.
      const heroCartBtn = document.getElementById('hero-cart-btn');
      if (heroCartBtn) heroCartBtn.style.display = 'none';
    } catch {}
  }

  window.addEventListener('pageshow', refreshWishlist);
  window.addEventListener('focus', refreshWishlist);
  window.addEventListener('pageshow', refreshCart);
  window.addEventListener('focus', refreshCart);

  // Live search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.trim();
      render();
    });
    const searchForm = searchInput.closest('form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        if (window.location.pathname.endsWith('homepage.html') || window.location.pathname === '/') {
          e.preventDefault();
        }
      });
    }
  }

  // Hero action buttons (Buy now & Add to wishlist) require login
  const heroBuyBtn = document.querySelector('.hero__actions .btn--primary');
  if (heroBuyBtn) {
    heroBuyBtn.addEventListener('click', (e) => {
      if (!requireLogin()) e.preventDefault();
    });
  }
  const heroWishBtn = document.querySelector('.hero__actions .btn--outline');
  if (heroWishBtn) {
    heroWishBtn.addEventListener('click', (e) => {
      if (!requireLogin()) e.preventDefault();
    });
  }

  // Event delegation for adding to cart & wishlist
  document.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('[data-action="add-to-cart"]');
    if (addBtn) {
      if (!requireLogin()) return;
      // Owned digital titles are rendered disabled; guard the click as well.
      const ownedProduct = allProducts.find(p => p.id === addBtn.dataset.id);
      if (ownedProduct && ownedProduct.owned) {
        showToast(`You already own ${ownedProduct.title}. A digital game can only be purchased once per account.`, 'info');
        return;
      }
      const productId = addBtn.dataset.id;
      addBtn.disabled = true;
      const originalText = addBtn.textContent;
      try {
        await api('/api/cart', {
          method: 'POST',
          body: { productId, qty: 1 }
        });
        addBtn.textContent = 'Added ✓';
        showToast('Added item to your cart!', 'success');
        if (window.Playnex.syncCartBadge) window.Playnex.syncCartBadge();
        refreshCart();
        setTimeout(() => {
          addBtn.textContent = originalText;
          addBtn.disabled = false;
        }, 1200);
      } catch (err) {
        showToast(err.message, 'error');
        addBtn.disabled = false;
      }
      return;
    }

    const wishBtn = e.target.closest('[data-action="wishlist"]');
    if (wishBtn) {
      if (!requireLogin()) return;
      const productId = wishBtn.dataset.id;
      if (!productId) return;
      wishBtn.disabled = true;

      const isAlreadySaved = wishBtn.classList.contains('is-saved') || wishlistIds.has(productId);

      if (isAlreadySaved) {
        try {
          await api(`/api/wishlist/${productId}`, {
            method: 'DELETE'
          });
          wishlistIds.delete(productId);
          document.querySelectorAll(`[data-action="wishlist"][data-id="${productId}"]`).forEach(btn => {
            btn.classList.remove('is-saved');
            if (btn.id === 'hero-wishlist-btn') btn.textContent = 'Add to wishlist';
          });
          showToast('Removed item from your wishlist.', 'info');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          wishBtn.disabled = false;
        }
      } else {
        try {
          await api('/api/wishlist', {
            method: 'POST',
            body: { productId }
          });
          wishlistIds.add(productId);
          if (window.Playnex.blinkWishlistIcon) window.Playnex.blinkWishlistIcon();
          document.querySelectorAll(`[data-action="wishlist"][data-id="${productId}"]`).forEach(btn => {
            btn.classList.add('is-saved');
            if (btn.id === 'hero-wishlist-btn') btn.textContent = 'Saved in wishlist';
          });
          showToast('Added item to your wishlist!', 'info');
        } catch (err) {
          showToast(err.message, err.status === 409 ? 'info' : 'error');
        } finally {
          wishBtn.disabled = false;
        }
      }
      return;
    }

    const claimBtn = e.target.closest('.promo-strip a, .promo-strip button');
    if (claimBtn) {
      e.preventDefault();
      if (!requireLogin()) return;
      try {
        await api('/api/cart', {
          method: 'POST',
          body: { productId: 'death-standing', qty: 1 }
        });
        showToast('Claimed Death Stranding for your cart!', 'success');
        if (window.Playnex.syncCartBadge) window.Playnex.syncCartBadge();
        setTimeout(() => {
          window.location.href = 'cart.html';
        }, 600);
      } catch (err) {
        showToast(err.message, 'info');
      }
    }
  });

  initHeroCarousel();
  loadProducts();
})();
