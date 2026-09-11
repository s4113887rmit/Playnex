/**
 * offers.js — Grand-opening voucher page for Playnex.
 * Lets visitors copy the launch voucher (Welcome2Playnex, 50% off every paid game)
 * straight to the clipboard so they can paste it into the Voucher field on cart.html.
 */
(function () {
  'use strict';

  const { showToast } = window.Playnex || {};

  const codeEl = document.getElementById('voucher-code');
  const copyBtn = document.getElementById('copy-voucher-btn');
  const statusEl = document.getElementById('voucher-copy-status');

  const VOUCHER_CODE = (codeEl && codeEl.dataset.code) || 'Welcome2Playnex';

  function setStatus(message, ok) {
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.classList.toggle('is-error', !ok);
      statusEl.classList.toggle('is-success', !!ok);
    }
    if (typeof showToast === 'function') {
      showToast(message, ok ? 'success' : 'error');
    }
  }

  // Modern clipboard API first; fall back to a hidden textarea + execCommand for
  // browsers or non-secure contexts where navigator.clipboard is unavailable.
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      try {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.top = '-1000px';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        helper.setSelectionRange(0, helper.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(helper);
        ok ? resolve() : reject(new Error('Copy command was rejected.'));
      } catch (err) {
        reject(err);
      }
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await copyText(VOUCHER_CODE);
        copyBtn.textContent = 'Voucher copied ✓';
        setStatus(`Voucher "${VOUCHER_CODE}" copied — paste it into the Voucher field on the cart page.`, true);
        setTimeout(() => { copyBtn.textContent = 'Copy voucher'; }, 2000);
      } catch (err) {
        // Clipboard access can be denied; tell the user to copy it manually.
        setStatus(`Could not copy automatically — please select and copy "${VOUCHER_CODE}" manually.`, false);
        if (codeEl && window.getSelection) {
          const range = document.createRange();
          range.selectNodeContents(codeEl);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    });
  }
})();
