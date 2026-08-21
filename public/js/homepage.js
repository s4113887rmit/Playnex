/**
 * homepage.js — Dynamic homepage logic for Playnex.
 * Renders digital & merchandise shelves dynamically, supports live search, category toggles, sorting, and cart/wishlist additions.
 */
(function () {
  'use strict';

  const { api, showToast, requireLogin } = window.Playnex;

  let allProducts = [];
  let wishlistIds = new Set();
  let activeCategory = 'all'; // 'all' | 'digital' | 'physical'
  let searchTerm = '';

  const newReleasesList = document.querySelector('#new-releases .shelf__row');
  const merchList = document.querySelector('#merch .shelf__row');
  const newSection = document.getElementById('new-releases');
  const merchSection = document.getElementById('merch');
  const searchInput = document.getElementById('site-search');

  // ==========================================
  // HERO CAROUSEL DATA & STATE
  // ==========================================
  const heroGames = [
    {
      id: 'elden-ring',
      title: 'Elden Ring',
      genre: 'Action RPG',
      platform: 'PC, Console',
      price: 59.99,
      oldPrice: null,
      image: 'public/img/eldenringposter.jpg',
      href: 'listing.html?game=elden-ring',
      desc: 'The journey on becoming the Elden Lord. Venture through ruined kingdoms and conquer legendary bosses across the Lands Between.',
      tags: ['RPG', 'Action', 'Open World', 'Souls-like']
    },
    {
      id: 'cyberpunk-2077',
      title: 'Cyberpunk 2077',
      genre: 'Action RPG',
      platform: 'PC',
      price: 20.99,
      oldPrice: 29.99,
      image: 'public/img/cyberpunkposter.jpg',
      href: 'listing.html?game=cyberpunk-2077',
      desc: 'Step into the role of V, a mercenary outlaw going after a one-of-a-kind implant that is the key to immortality in Night City.',
      tags: ['RPG', 'Action', 'Sci-Fi', 'Open World']
    },
    {
      id: 'ghost-of-tsushima',
      title: 'Ghost of Tsushima',
      genre: 'Action Adventure',
      platform: 'PC, Console',
      price: 34.99,
      oldPrice: null,
      image: 'public/img/ghostposter.jpg',
      href: 'listing.html?game=ghost-of-tsushima',
      desc: 'An open-world samurai adventure set during the Mongol invasion of Japan in 1274. Master the katana and forge a new path as the Ghost.',
      tags: ['Action', 'Adventure', 'Open World', 'Samurai']
    },
    {
      id: 'red-dead-redemption-2',
      title: 'Red Dead Redemption II',
      genre: 'Action Adventure',
      platform: 'PC',
      price: 49.99,
      oldPrice: null,
      image: 'public/img/reddeadposter.jpg',
      href: 'listing.html?game=red-dead-redemption-2',
      desc: 'Arthur Morgan and the Van der Linde gang are outlaws on the run in the vast and rugged heartland of America.',
      tags: ['Action', 'Adventure', 'Western', 'Open World']
    },
    {
      id: 'hades',
      title: 'Hades',
      genre: 'Roguelike',
      platform: 'PC, Console',
      price: 27.99,
      oldPrice: null,
      image: 'public/img/hadesposter.png',
      href: 'listing.html?game=hades',
      desc: 'Defy the god of the dead as you hack and slash out of the Underworld in this god-like rogue-like dungeon crawler.',
      tags: ['Roguelike', 'Action', 'Indie', 'Mythology']
    },
    {
      id: 'hollow-knight',
      title: 'Hollow Knight',
      genre: 'Metroidvania',
      platform: 'PC, Console',
      price: 29.99,
      oldPrice: null,
      image: 'public/img/hollowposter.jpg',
      href: 'listing.html?game=hollow-knight',
      desc: 'Explore a vast interconnected subterranean world of insects and heroes. Unravel ancient mysteries and conquer forgotten evils.',
      tags: ['Metroidvania', 'Action', '2D', 'Atmospheric']
    },
    {
      id: 'nier-automata',
      title: 'NieR Automata',
      genre: 'Action RPG',
      platform: 'PC, Console',
      price: 39.99,
      oldPrice: null,
      image: 'public/img/nierposter.jpg',
      href: 'listing.html?game=nier-automata',
      desc: 'Humanity has been driven from the Earth by mechanical beings from another world. Android soldiers 2B and 9S fight to reclaim it.',
      tags: ['Action', 'RPG', 'Sci-Fi', 'Hack and Slash']
    },
    {
      id: 'death-standing',
      title: 'Death Stranding',
      genre: 'Action',
      platform: 'PC, Console',
      price: 24.99,
      oldPrice: null,
      image: 'public/img/deathstandposter.jpg',
      href: 'listing.html?game=death-standing',
      desc: 'Sam Bridges must brave a world utterly transformed by the Death Stranding to reconnect the isolated cities of a fractured nation.',
      tags: ['Action', 'Adventure', 'Sci-Fi', 'Open World']
    },
    {
      id: 'witcher-3',
      title: 'The Witcher 3: Wild Hunt',
      genre: 'Action RPG',
      platform: 'PC, Console',
      price: 39.99,
      oldPrice: null,
      image: 'public/img/witcherposter.jpg',
      href: 'listing.html?game=the-witcher-3',
      desc: 'Track down the Child of Prophecy in a monster-infested world as Geralt of Rivia in this epic fantasy open-world RPG.',
      tags: ['RPG', 'Action', 'Open World', 'Dark Fantasy']
    }
  ];

  let currentHeroIndex = 0;
  let heroTimer = null;
  const heroStage = document.getElementById('hero-stage');
  let heroCardElements = [];

  function initHeroCarousel() {
    if (!heroStage) return;

    heroStage.innerHTML = heroGames.map((game, idx) => `
      <a href="${game.href}" class="hero-card" data-index="${idx}" data-id="${game.id}" aria-label="View ${game.title}">
        <div class="hero-card__art">
          <img src="${game.image}" alt="${game.title} poster" class="hero-card__img" loading="eager">
        </div>
      </a>
    `).join('');

    heroCardElements = Array.from(heroStage.querySelectorAll('.hero-card'));

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

    const heroVisual = document.getElementById('hero-visual');
    if (heroVisual) {
      heroVisual.addEventListener('mouseenter', stopHeroTimer);
      heroVisual.addEventListener('mouseleave', startHeroTimer);
    }
  }

  function updateHeroCarousel(index, animate = true) {
    if (!heroCardElements.length) return;

    currentHeroIndex = (index + heroGames.length) % heroGames.length;
    const total = heroGames.length;
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

    const activeGame = heroGames[currentHeroIndex];
    const heroContent = document.getElementById('hero-content');

    if (heroContent && animate) {
      heroContent.classList.add('is-changing');
      setTimeout(() => {
        renderHeroInfo(activeGame);
        heroContent.classList.remove('is-changing');
      }, 140);
    } else if (heroContent) {
      renderHeroInfo(activeGame);
    }
  }

  function renderHeroInfo(game) {
    const titleEl = document.getElementById('hero-title');
    const descEl = document.getElementById('hero-desc');
    const genreEl = document.getElementById('hero-genre');
    const platformEl = document.getElementById('hero-platform');
    const tagsEl = document.getElementById('hero-tags');
    const buyBtn = document.getElementById('hero-buy-btn');
    const wishBtn = document.getElementById('hero-wishlist-btn');

    if (titleEl) titleEl.textContent = game.title;
    if (descEl) descEl.textContent = game.desc;
    if (genreEl) genreEl.textContent = game.genre;
    if (platformEl) platformEl.textContent = game.platform;

    if (tagsEl && game.tags) {
      tagsEl.innerHTML = game.tags.map(tag => {
        const slug = tag.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        return `<li><a href="shopping.html?genre=${slug}" class="hero__tag" title="Filter by ${tag}">${tag}</a></li>`;
      }).join('');
    }

    if (buyBtn) {
      const priceText = game.price === 0 ? 'Claim now — Free' : `Buy now — $${Number(game.price).toFixed(2)}`;
      buyBtn.textContent = priceText;
      buyBtn.href = game.href || `listing.html?game=${game.id}`;
    }

    if (wishBtn) {
      wishBtn.dataset.id = game.id;
      const isSaved = wishlistIds.has(game.id);
      wishBtn.classList.toggle('is-saved', isSaved);
      wishBtn.textContent = isSaved ? 'Saved in wishlist' : 'Add to wishlist';
    }
  }

  function startHeroTimer() {
    stopHeroTimer();
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

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function cardHTML(p) {
    const priceHTML = p.oldPrice
      ? `<span class="card__price-old">${money(p.oldPrice)}</span><span class="card__price-now">${money(p.price)}</span>`
      : `<span class="card__price-now">${p.price === 0 ? 'Free' : money(p.price)}</span>`;

    const badge = p.badge
      ? `<span class="card__badge${p.category === 'physical' ? ' card__badge--merch' : (p.badge === 'New' ? ' card__badge--new' : '')}">${p.badge}</span>`
      : (p.category === 'physical' ? '<span class="card__badge card__badge--merch">Physical</span>' : '');

    const imgTag = p.image
      ? `<img src="${p.image}" alt="${p.title} poster" loading="lazy">`
      : `<div class="card__placeholder-art">${p.title.charAt(0)}</div>`;

    const isSaved = wishlistIds.has(p.id);

    return `
      <li>
        <article class="card" data-id="${p.id}">
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
            <div class="card__price">${priceHTML}</div>
            <button type="button" class="btn btn--ghost btn--small card__add" data-action="add-to-cart" data-id="${p.id}">Add to cart</button>
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
    const merchSortEl = document.getElementById('sort-merch');
    const digitalSort = digitalSortEl ? digitalSortEl.value : 'title';
    const merchSort = merchSortEl ? merchSortEl.value : 'title';

    const digital = applySort(
      allProducts.filter(p => p.category === 'digital' && matchesSearch(p)),
      digitalSort
    );
    const physical = applySort(
      allProducts.filter(p => p.category === 'physical' && matchesSearch(p)),
      merchSort
    );

    if (newReleasesList) {
      newReleasesList.innerHTML = digital.length
        ? digital.map(cardHTML).join('')
        : '<li class="shelf-empty">No digital games match your search.</li>';
    }

    if (merchList) {
      merchList.innerHTML = physical.length
        ? physical.map(cardHTML).join('')
        : '<li class="shelf-empty">No physical merch matches your search.</li>';
    }

    if (newSection) newSection.style.display = activeCategory === 'physical' ? 'none' : '';
    if (merchSection) merchSection.style.display = activeCategory === 'digital' ? 'none' : '';
  }

  async function loadProducts() {
    try {
      const [productsData, wishlistData] = await Promise.all([
        api('/api/products'),
        api('/api/wishlist').catch(() => ({ items: [] }))
      ]);
      allProducts = productsData;
      wishlistIds = new Set((wishlistData.items || []).map(item => item.id));
      render();
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

  window.addEventListener('pageshow', refreshWishlist);
  window.addEventListener('focus', refreshWishlist);

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

  // Category filter tabs in subnav
  document.querySelectorAll('.subnav__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === 'homepage.html' || href === 'homepage.html#') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activeCategory = 'all';
        document.querySelectorAll('.subnav__link').forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        render();
      });
    } else if (href === 'shopping.html?cat=digital') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activeCategory = 'digital';
        document.querySelectorAll('.subnav__link').forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        render();
      });
    } else if (href === 'shopping.html?cat=merch') {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        activeCategory = 'physical';
        document.querySelectorAll('.subnav__link').forEach(l => l.classList.remove('is-active'));
        link.classList.add('is-active');
        render();
      });
    }
  });

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
          body: { productId: 'ruinport-chronicles', qty: 1 }
        });
        showToast('Claimed Ruinport Chronicles for free!', 'success');
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
