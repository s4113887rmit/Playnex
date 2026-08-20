/**
 * listing.js - Game listing (detail) page behaviour.
 * Wires the hero action buttons to the cart and wishlist APIs using the
 * game slug exposed by the server-rendered page.
 */
(function () {
  'use strict';

  var cartBtn = document.getElementById('listing-add-cart');
  var wishBtn = document.getElementById('listing-add-wishlist');
  if (!cartBtn && !wishBtn) return;

  var slug = (cartBtn || wishBtn).getAttribute('data-game-slug') || '';
  var buyNowBtn = document.getElementById('listing-buy-now');
  var isSaved = false;

  function updateWishBtn(saved) {
    isSaved = saved;
    if (wishBtn) {
      if (isSaved) {
        wishBtn.classList.add('is-saved');
        wishBtn.textContent = 'In your wishlist ✓';
      } else {
        wishBtn.classList.remove('is-saved');
        wishBtn.textContent = 'Add to wishlist';
      }
    }
  }

  function checkWishlist() {
    if (!slug || typeof window.Playnex.api !== 'function') return;
    window.Playnex.api('/api/wishlist')
      .then(function (data) {
        var found = (data.items || []).some(function (item) { return item.id === slug; });
        updateWishBtn(found);
      })
      .catch(function () { });
  }

  function isLoggedIn() {
    return typeof window.Playnex.getCurrentUser === 'function' && !!window.Playnex.getCurrentUser();
  }

  function requireLogin(event) {
    if (!isLoggedIn()) {
      event.preventDefault();
      window.Playnex.showToast('Please log in to continue.', 'info');
      return false;
    }
    return true;
  }

  function bind(btn, path, doneMessage) {
    if (!btn) return;
    btn.addEventListener('click', function (event) {
      if (!requireLogin(event)) return;
      if (!slug) {
        window.Playnex.showToast('Game not found in the catalogue.', 'error');
        return;
      }
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Adding...';

      window.Playnex.api(path, {
        method: 'POST',
        body: { productId: slug, qty: 1 }
      })
        .then(function () {
          window.Playnex.showToast(doneMessage, 'success');
        })
        .catch(function (err) {
          window.Playnex.showToast(err.message || 'Something went wrong.', 'error');
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = original;
        });
    });
  }

  bind(cartBtn, '/api/cart', 'Added to your cart.');

  if (wishBtn) {
    wishBtn.addEventListener('click', function (event) {
      if (!requireLogin(event)) return;
      if (!slug) {
        window.Playnex.showToast('Game not found in the catalogue.', 'error');
        return;
      }
      wishBtn.disabled = true;
      if (isSaved) {
        window.Playnex.api('/api/wishlist/' + encodeURIComponent(slug), {
          method: 'DELETE'
        })
          .then(function () {
            updateWishBtn(false);
            window.Playnex.showToast('Removed item from your wishlist.', 'info');
          })
          .catch(function (err) {
            window.Playnex.showToast(err.message || 'Something went wrong.', 'error');
          })
          .finally(function () {
            wishBtn.disabled = false;
          });
      } else {
        window.Playnex.api('/api/wishlist', {
          method: 'POST',
          body: { productId: slug }
        })
          .then(function () {
            updateWishBtn(true);
            window.Playnex.showToast('Added to your wishlist.', 'success');
          })
          .catch(function (err) {
            window.Playnex.showToast(err.message || 'Something went wrong.', 'error');
          })
          .finally(function () {
            wishBtn.disabled = false;
          });
      }
    });
  }

  checkWishlist();
  window.addEventListener('pageshow', checkWishlist);
  window.addEventListener('focus', checkWishlist);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkWishlist();
  });

  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', requireLogin);
  }
})();
