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

  function bind(btn, path, doneMessage) {
    if (!btn) return;
    btn.addEventListener('click', function () {
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
  bind(wishBtn, '/api/wishlist', 'Added to your wishlist.');
})();
