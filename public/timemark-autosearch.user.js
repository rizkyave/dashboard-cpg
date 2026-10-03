// ==UserScript==
// @name         Dashboard CPG - TimeMark Auto Search FSTB
// @namespace    dashboard-cpg
// @version      1.0.0
// @description  Otomatis mengisi kolom pencarian TimeMark Teamspace dengan kode FSTB yang dikirim dari Dashboard CPG (tanpa copy-paste).
// @match        https://teamspace.timemark.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var STORAGE_KEY = '__cpg_fstb_query';
  var MAX_AGE_MS = 5 * 60 * 1000; // berlaku 5 menit (cukup untuk login ulang jika sesi habis)
  var GIVE_UP_MS = 30 * 1000;

  // 1. Tangkap kode dari URL SEBELUM router SPA TimeMark menghapus query string
  try {
    var params = new URLSearchParams(window.location.search);
    var hashParams = new URLSearchParams((window.location.hash.split('?')[1]) || '');
    var incoming =
      params.get('fstb') || params.get('search') || params.get('keyword') || params.get('q') ||
      hashParams.get('fstb') || hashParams.get('search');
    if (incoming) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ q: incoming, t: Date.now() }));
    }
  } catch (e) {
    /* abaikan */
  }

  function readPending() {
    try {
      var v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (v && v.q && Date.now() - v.t < MAX_AGE_MS) return String(v.q);
    } catch (e) {
      /* abaikan */
    }
    return null;
  }

  var code = readPending();
  if (!code) return;

  // 2. Kandidat selector kolom pencarian (sengaja TIDAK memakai input teks generik
  //    agar tidak salah mengisi kolom email di halaman login)
  var SELECTORS = [
    'input[type="search"]',
    'input[placeholder*="search" i]',
    'input[placeholder*="cari" i]',
    'input[placeholder*="keyword" i]',
    'input[placeholder*="搜索"]',
    'input[aria-label*="search" i]',
    '.ant-input-search input',
    '[class*="search" i] input[type="text"]',
    '[class*="search" i] input:not([type])',
  ];

  function isVisible(el) {
    return !!(el && !el.disabled && !el.readOnly && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function findInput() {
    for (var i = 0; i < SELECTORS.length; i++) {
      var list = document.querySelectorAll(SELECTORS[i]);
      for (var j = 0; j < list.length; j++) {
        if (isVisible(list[j])) return list[j];
      }
    }
    return null;
  }

  // Set value dengan native setter agar terdeteksi oleh React / Vue
  function fillAndSubmit(el, value) {
    var proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'value');
    el.focus();
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    ['keydown', 'keypress', 'keyup'].forEach(function (type) {
      el.dispatchEvent(
        new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })
      );
    });
    var form = el.closest('form');
    if (form && typeof form.requestSubmit === 'function') {
      try { form.requestSubmit(); } catch (e) { /* abaikan */ }
    }
  }

  function toast(msg, ok) {
    try {
      var box = document.createElement('div');
      box.textContent = msg;
      box.style.cssText =
        'position:fixed;z-index:2147483647;right:16px;bottom:16px;padding:10px 14px;border-radius:10px;' +
        'font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);color:#0f172a;' +
        'background:' + (ok ? '#fbbf24' : '#fecaca') + ';';
      document.body.appendChild(box);
      setTimeout(function () { box.remove(); }, 4500);
    } catch (e) {
      /* abaikan */
    }
  }

  var done = false;
  var settleTimer = null;
  var observer = null;

  function finish() {
    if (observer) observer.disconnect();
    clearTimeout(giveUpTimer);
  }

  function attempt() {
    if (done || !findInput()) return;
    // Tunggu sebentar agar halaman SPA selesai render (elemen sering di-render ulang)
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      var el = findInput();
      if (!el || done) return;
      done = true;
      fillAndSubmit(el, code);
      sessionStorage.removeItem(STORAGE_KEY);
      finish();
      toast('🔎 FSTB "' + code + '" otomatis dicari (Dashboard CPG)', true);
    }, 800);
  }

  var giveUpTimer = setTimeout(function () {
    if (done) return;
    finish();
    toast('Kolom pencarian TimeMark tidak ditemukan. Kode "' + code + '" ada di clipboard, tekan Ctrl+V.', false);
  }, GIVE_UP_MS);

  function start() {
    observer = new MutationObserver(attempt);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    attempt();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
