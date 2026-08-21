(function () {
  'use strict';

  function updateHeader() {
    var page = window.location.pathname.split('/').pop() || 'homepage.html';
    if (page === 'Login.html' || page === 'Profile.html') return;

    var wrapper = document.querySelector('.topbar__actions');
    if (!wrapper || wrapper.getAttribute('data-auth-synced') === 'true') return;

    var user = null;
    try {
      var raw = localStorage.getItem('playnex_user');
      if (raw) user = JSON.parse(raw);
    } catch (e) {}

    if (!user) {
      localStorage.removeItem('playnex_user');
      wrapper.setAttribute('data-auth-synced', 'true');
      return;
    }

    wrapper.setAttribute('data-auth-synced', 'true');

    var loginBtn = wrapper.querySelector('.btn--ghost');
    var signupBtn = wrapper.querySelector('.btn--primary.btn--small');
    var hardcoded = wrapper.querySelector('.profile-icon, a[data-auth-logout]');

    if (loginBtn) loginBtn.remove();
    if (signupBtn) signupBtn.remove();
    if (hardcoded) hardcoded.remove();

    var profileLink = document.createElement('a');
    profileLink.href = 'Profile.html';
    profileLink.className = 'icon-btn profile-icon';
    profileLink.setAttribute('aria-label', 'Profile');
    profileLink.title = 'Profile';

    var letter = ((user.name || user.username || 'U') + '').charAt(0).toUpperCase();
    profileLink.innerHTML = '<span class="profile-icon__letter">' + letter + '</span>';

    var logoutBtn = document.createElement('a');
    logoutBtn.href = 'Login.html';
    logoutBtn.className = 'btn btn--ghost btn--small';
    logoutBtn.setAttribute('data-auth-logout', 'true');
    logoutBtn.textContent = 'Log out';
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      localStorage.removeItem('playnex_user');
      window.location.href = 'Login.html';
    });

    wrapper.insertBefore(logoutBtn, wrapper.firstElementChild);
    wrapper.insertBefore(profileLink, wrapper.firstElementChild);
  }

  var fallbackProducts = [
    { id: 'elden-ring', title: 'Elden Ring', genre: 'RPG', platform: 'PC, Console', price: 59.99, image: 'public/img/eldenringposter.jpg', href: 'listing.html?game=elden-ring' },
    { id: 'cyberpunk-2077', title: 'Cyberpunk', genre: 'RPG', platform: 'PC', price: 20.99, badge: '-30%', image: 'public/img/cyberpunkposter.jpg', href: 'listing.html?game=cyberpunk-2077' },
    { id: 'ghost-of-tsushima', title: 'Ghost of Tsushima', genre: 'RPG', platform: 'PC, Console', price: 34.99, image: 'public/img/ghostposter.jpg', href: 'listing.html?game=ghost-of-tsushima' },
    { id: 'red-dead-redemption-2', title: 'Red Dead Redemption II', genre: 'RPG', platform: 'PC', price: 49.99, badge: 'New', image: 'public/img/reddeadposter.jpg', href: 'listing.html?game=red-dead-redemption-2' },
    { id: 'hades', title: 'Hades', genre: 'RPG', platform: 'PC, Console', price: 27.99, image: 'public/img/hadesposter.png', href: 'listing.html?game=hades' },
    { id: 'hollow-knight', title: 'Hollow Knight', genre: 'Puzzle', platform: 'PC, Console', price: 29.99, image: 'public/img/hollowposter.jpg', href: 'listing.html?game=hollow-knight' },
    { id: 'nier-automata', title: 'NieR Automata', genre: 'RPG', platform: 'PC, Console', price: 39.99, image: 'public/img/nierposter.jpg', href: 'listing.html?game=nier-automata' },
    { id: 'death-standing', title: 'Death Standing', genre: 'Horror', platform: 'PC, Console', price: 24.99, image: 'public/img/deathstandposter.jpg', href: 'listing.html?game=death-standing' },
    { id: 'witcher-3', title: 'The Witcher 3: Wild Hunt', genre: 'RPG', platform: 'PC, Console', price: 39.99, image: 'public/img/witcherposter.jpg', href: 'listing.html?game=the-witcher-3' },
    { id: 'ruinport-chronicles', title: 'Ruinport Chronicles', genre: 'Strategy', platform: 'PC', price: 0, badge: 'Free', href: 'shopping.html?cat=free' },
    { id: 'embercrown-saga', title: 'Embercrown Saga', genre: 'RPG', platform: 'PC, Console', price: 59.99, badge: 'Featured', href: 'shopping.html' },
    { id: 'nightfall-protocol', title: 'Nightfall Protocol', genre: 'Strategy', platform: 'PC, Console', price: 44.99, href: 'shopping.html' },
    { id: 'ironvale-racers', title: 'Ironvale Racers', genre: 'Racing', platform: 'PC, Console', price: 34.99, href: 'shopping.html' },
    { id: 'embercrown-throne-figure', title: 'Embercrown throne figure', genre: 'Merch', platform: 'Collectible', price: 64.00, badge: 'Physical', href: 'shopping.html?cat=merch' },
    { id: 'nightfall-hoodie', title: 'Nightfall Protocol hoodie', genre: 'Merch', platform: 'Apparel', price: 52.00, badge: 'Physical', href: 'shopping.html?cat=merch' },
    { id: 'ruinport-vinyl', title: 'Ruinport Chronicles vinyl', genre: 'Merch', platform: 'Soundtrack', price: 38.00, badge: 'Physical', href: 'shopping.html?cat=merch' },
    { id: 'ironvale-racers-keycap', title: 'Ironvale Racers keycap set', genre: 'Merch', platform: 'Accessory', price: 29.00, badge: 'Physical', href: 'shopping.html?cat=merch' },
    { id: 'emberkeep-artbook', title: 'Emberkeep Tactics art book', genre: 'Merch', platform: 'Collectible', price: 34.00, badge: 'Physical', href: 'shopping.html?cat=merch' }
  ];

  var cachedProducts = fallbackProducts;

  function fetchProductCatalogue() {
    return fetch('/api/products')
      .then(function (res) {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then(function (data) {
        if (Array.isArray(data) && data.length) {
          cachedProducts = data;
        }
        return cachedProducts;
      })
      .catch(function () {
        return cachedProducts;
      });
  }

  // Preload catalogue in background
  fetchProductCatalogue();

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initSearchAdvanced() {
    var searchForms = document.querySelectorAll('.search');
    searchForms.forEach(function (form) {
      if (form.getAttribute('data-advanced-init') === 'true') return;
      form.setAttribute('data-advanced-init', 'true');

      var input = form.querySelector('input[type="search"], input[name="q"], #site-search');
      if (!input) return;

      form.classList.add('search--has-dropdown');

      var dropdown = document.createElement('div');
      dropdown.className = 'search__dropdown';
      dropdown.setAttribute('role', 'region');
      dropdown.setAttribute('aria-label', 'Search results and filters');
      dropdown.innerHTML =
        '<div class="search__dropdown-content">' +
          '<div class="search__empty">No items found</div>' +
        '</div>' +
        '<div class="search__dropdown-footer">' +
          '<a href="shopping.html" class="search__advanced-btn" aria-label="Open Advanced Search">' +
            '<span class="search__advanced-left">' +
              '<svg class="search__advanced-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>' +
              '</svg>' +
              '<span class="search__advanced-title">Advanced</span>' +
            '</span>' +
            '<span class="search__advanced-desc">Filters &rarr;</span>' +
          '</a>' +
        '</div>';

      form.appendChild(dropdown);

      var contentEl = dropdown.querySelector('.search__dropdown-content');
      var advancedBtn = dropdown.querySelector('.search__advanced-btn');

      function getFilteredProducts(rawQuery) {
        var q = (rawQuery || '').trim().toLowerCase();
        if (!q || !cachedProducts || !cachedProducts.length) {
          return [];
        }

        // 1. Starting with typed query first (alphabetically sorted)
        var startsWithMatches = cachedProducts.filter(function (p) {
          return p.title && p.title.toLowerCase().startsWith(q);
        });
        startsWithMatches.sort(function (a, b) {
          return a.title.localeCompare(b.title);
        });

        // 2. Containing typed query second (alphabetically sorted)
        var containsMatches = cachedProducts.filter(function (p) {
          return p.title && !p.title.toLowerCase().startsWith(q) && p.title.toLowerCase().includes(q);
        });
        containsMatches.sort(function (a, b) {
          return a.title.localeCompare(b.title);
        });

        return startsWithMatches.concat(containsMatches);
      }

      function renderDropdownContent() {
        var query = input.value.trim();
        var matches = getFilteredProducts(query);
        var isEjs = window.location.pathname.startsWith('/views/') || window.location.pathname.startsWith('/blog') || window.location.pathname.startsWith('/rating');
        var basePath = isEjs ? '/shopping.html' : 'shopping.html';

        if (query) {
          advancedBtn.href = basePath + '?q=' + encodeURIComponent(query);
        } else {
          advancedBtn.href = basePath;
        }

        // When empty query or no matching items found -> "No items found"
        if (!matches || matches.length === 0) {
          contentEl.innerHTML = '<div class="search__empty">No items found</div>';
          return;
        }

        var html = '<ul class="search__results-list list-reset">';
        matches.forEach(function (p) {
          var priceText = p.price === 0 ? 'Free' : '$' + Number(p.price).toFixed(2);
          var badgeHtml = p.badge ? '<span class="search__item-badge">' + escapeHTML(p.badge) + '</span>' : '';
          var metaText = (p.genre || '') + (p.genre && p.platform ? ' · ' : '') + (p.platform || '');
          var targetHref = p.href || ('listing.html?game=' + p.id);
          if (isEjs && !targetHref.startsWith('/')) {
            targetHref = '/' + targetHref;
          }

          var initialLetter = (p.title || 'G').charAt(0).toUpperCase();
          var thumbHtml = p.image
            ? '<img src="' + p.image + '" alt="' + escapeHTML(p.title) + '" class="search__item-img" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';">' +
              '<div class="search__item-placeholder" style="display:none">' + initialLetter + '</div>'
            : '<div class="search__item-placeholder">' + initialLetter + '</div>';

          html +=
            '<li class="search__result-item">' +
              '<a href="' + targetHref + '" class="search__result-link" data-product-id="' + p.id + '">' +
                '<div class="search__item-thumb">' + thumbHtml + '</div>' +
                '<div class="search__item-info">' +
                  '<div class="search__item-title-row">' +
                    '<span class="search__item-title">' + escapeHTML(p.title) + '</span>' +
                    badgeHtml +
                  '</div>' +
                  '<span class="search__item-meta">' + escapeHTML(metaText) + '</span>' +
                '</div>' +
                '<span class="search__item-price">' + priceText + '</span>' +
              '</a>' +
            '</li>';
        });
        html += '</ul>';

        contentEl.innerHTML = html;
      }

      function showDropdown() {
        renderDropdownContent();
        dropdown.classList.add('is-open');
      }

      function hideDropdown() {
        dropdown.classList.remove('is-open');
      }

      input.addEventListener('focus', function () {
        fetchProductCatalogue().then(showDropdown);
      });

      input.addEventListener('click', function () {
        fetchProductCatalogue().then(showDropdown);
      });

      input.addEventListener('input', function () {
        renderDropdownContent();
        dropdown.classList.add('is-open');
      });

      // Handle clicking a search result item
      contentEl.addEventListener('mousedown', function (e) {
        var link = e.target.closest('.search__result-link');
        if (link && link.href) {
          e.preventDefault();
          window.location.href = link.href;
        }
      });

      // Handle clicking "Advanced"
      advancedBtn.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var query = input.value.trim();
        var isShopping = window.location.pathname.endsWith('shopping.html') || window.location.pathname === '/shopping.html';
        if (isShopping) {
          var filtersSidebar = document.querySelector('.filters');
          if (filtersSidebar) {
            filtersSidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
            var firstInput = filtersSidebar.querySelector('input');
            if (firstInput) firstInput.focus();
          }
          hideDropdown();
        } else {
          window.location.href = advancedBtn.href;
        }
      });

      document.addEventListener('click', function (e) {
        if (!form.contains(e.target)) {
          hideDropdown();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          hideDropdown();
        }
      });
    });
  }

  function init() {
    updateHeader();
    initSearchAdvanced();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
