function boot(DATA) {
  'use strict';

  var WA_NUMBER = '601125221899';          // WhatsApp 1125221899 with Malaysia country code (60)
  var WECHAT_ID = 'nhlg99999';

  var PRODUCTS = DATA.products;
  var CATS = DATA.cats;
  var BY_ID = {};
  PRODUCTS.forEach(function (p) { BY_ID[p.id] = p; });

  var state = { cat: 'all', q: '', sort: 'default' };
  var cart = {};                                   // id -> qty
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- age gate ----------
  var ok = false;
  try { ok = localStorage.getItem('age18') === '1'; } catch (e) {}
  if (!ok) { $('gate').hidden = false; document.body.classList.add('locked'); }
  $('gateYes').addEventListener('click', function () {
    try { localStorage.setItem('age18', '1'); } catch (e) {}
    $('gate').hidden = true;
    document.body.classList.remove('locked');
  });

  // ---------- toast ----------
  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  // ---------- catalogue ----------
  function waLink(text) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var list = PRODUCTS.filter(function (p) {
      return (state.cat === 'all' || p.cat === state.cat) &&
             (!q || p.name.toLowerCase().indexOf(q) !== -1);
    });
    if (state.sort === 'asc')  list.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'desc') list.sort(function (a, b) { return b.price - a.price; });

    $('grid').innerHTML = list.map(function (p) {
      var inCart = cart[p.id] > 0;
      return '<article class="card stock">' +
        '<div class="pic"><img loading="lazy" src="images/' + encodeURIComponent(p.image) + '" alt="' + esc(p.name) + '"></div>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<div class="price num"><small>RM</small>' + p.price + '</div>' +
        '<div class="card-act">' +
          '<button type="button" class="btn btn-sm' + (inCart ? ' added' : '') + '" data-add="' + p.id + '">' +
            (inCart ? '已加入 ×' + cart[p.id] : '加入清单') + '</button>' +
        '</div></article>';
    }).join('');

    $('count').textContent = '共 ' + list.length + ' 款';
    $('empty').hidden = list.length !== 0;
  }

  function renderTabs() {
    $('tabs').innerHTML = CATS.map(function (c, i) {
      var n = c.key === 'all' ? PRODUCTS.length : PRODUCTS.filter(function (p) { return p.cat === c.key; }).length;
      return '<button type="button" role="tab" class="strip s-' + c.key + '" data-cat="' + c.key + '" aria-selected="' +
        (c.key === state.cat) + '" aria-label="' + c.label + '，' + n + ' 款">' +
        '<span class="s-no">No. ' + (i + 1) + '</span><span class="s-name">' + c.label + '</span></button>';
    }).join('');
  }

  function setCat(key) { state.cat = key; renderTabs(); render(); }

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]');
    if (b) setCat(b.dataset.cat);
  });
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  document.querySelectorAll('[data-jump]').forEach(function (a) {
    a.addEventListener('click', function () { setCat(a.dataset.jump); });
  });

  // ---------- order list ----------
  try {
    var saved = JSON.parse(localStorage.getItem('cart') || '{}');
    Object.keys(saved).forEach(function (id) { if (BY_ID[id] && saved[id] > 0) cart[id] = saved[id] | 0; });
  } catch (e) {}

  function save() { try { localStorage.setItem('cart', JSON.stringify(cart)); } catch (e) {} }

  function lines() {
    return Object.keys(cart).filter(function (id) { return cart[id] > 0; }).map(function (id) {
      return { p: BY_ID[id], qty: cart[id] };
    });
  }

  function listText() {
    var ls = lines(), total = 0;
    var rows = ls.map(function (l, i) {
      total += l.p.price * l.qty;
      return (i + 1) + '. ' + l.p.name + ' ×' + l.qty + '（RM ' + l.p.price + '）';
    });
    return '你好，我想订购：\n' + rows.join('\n') + '\n合计：RM ' + total;
  }

  function renderCart() {
    var ls = lines(), total = 0, count = 0;
    ls.forEach(function (l) { total += l.p.price * l.qty; count += l.qty; });

    ['cartCount', 'dockCount'].forEach(function (id) {
      var b = $(id);
      b.textContent = count;
      b.hidden = count === 0;
    });

    $('lines').innerHTML = ls.map(function (l) {
      return '<li class="line">' +
        '<div class="line-img"><img src="images/' + encodeURIComponent(l.p.image) + '" alt=""></div>' +
        '<div><div class="line-name">' + esc(l.p.name) + '</div>' +
          '<div class="line-price">RM ' + l.p.price + '</div>' +
          '<div class="qty"><button type="button" data-dec="' + l.p.id + '" aria-label="减少">−</button>' +
          '<span>' + l.qty + '</span>' +
          '<button type="button" data-inc="' + l.p.id + '" aria-label="增加">+</button></div></div>' +
        '<button type="button" class="line-rm" data-rm="' + l.p.id + '">移除</button></li>';
    }).join('');

    $('sumTotal').textContent = 'RM ' + total;
    $('drawer').classList.toggle('is-empty', ls.length === 0);
    if (ls.length) $('sendWa').href = waLink(listText());
    // every WhatsApp button on the page carries the order once the list has items
    document.querySelectorAll('[data-contact="wa"]').forEach(function (a) {
      a.href = ls.length ? waLink(listText()) : 'https://wa.me/' + WA_NUMBER;
    });
  }

  function change(id, d) {
    cart[id] = Math.max(0, (cart[id] || 0) + d);
    if (!cart[id]) delete cart[id];
    save(); renderCart(); render();
  }

  $('grid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    change(b.dataset.add, 1);
    toast('已加入：' + BY_ID[b.dataset.add].name);
  });
  $('lines').addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.inc) change(t.dataset.inc, 1);
    if (t.dataset.dec) change(t.dataset.dec, -1);
    if (t.dataset.rm) { cart[t.dataset.rm] = 0; change(t.dataset.rm, 0); }
  });
  $('clearList').addEventListener('click', function () { cart = {}; save(); renderCart(); render(); });
  // Telegram and WeChat cannot take a prefilled message from a link, so copy the list first, then the link opens the chat.
  [['sendTg', 'Telegram'], ['sendWx', '微信 ' + WECHAT_ID]].forEach(function (o) {
    $(o[0]).addEventListener('click', function () {
      copy(listText()).then(function () { toast('清单已复制，请在 ' + o[1] + ' 对话里粘贴'); },
                            function () { toast('复制失败，请点「复制清单」'); });
    });
  });
  $('copyList').addEventListener('click', function () {
    copy(listText()).then(function () { toast('清单已复制，可粘贴到微信或 Telegram'); },
                          function () { toast('复制失败，请手动选择清单文字'); });
  });

  // drawer open / close
  var lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    $('scrim').hidden = false;
    $('drawer').classList.add('open');
    $('drawer').setAttribute('aria-hidden', 'false');
    $('cartClose').focus();
  }
  function closeDrawer() {
    $('scrim').hidden = true;
    $('drawer').classList.remove('open');
    $('drawer').setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('cartOpen').addEventListener('click', openDrawer);
  $('dockCart').addEventListener('click', openDrawer);
  $('cartClose').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('drawer').classList.contains('open')) closeDrawer();
  });

  // ---------- WeChat: copy ID, then let the weixin:// link try to open the app ----------
  function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    } catch (e) {}
    return Promise.reject();
  }
  // With items in the order list, every WeChat / Telegram button hands over the whole order (copied, then paste in the chat).
  // With an empty list, WeChat falls back to copying the ID and Telegram just opens the chat.
  function hasOrder() { return Object.keys(cart).length > 0; }
  document.querySelectorAll('[data-contact="wechat"]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (hasOrder()) {
        copy(listText()).then(
          function () { toast('订购清单已复制，请在微信 ' + WECHAT_ID + ' 对话里粘贴发送'); },
          function () { toast('复制失败，微信号：' + WECHAT_ID); }
        );
        return;
      }
      copy(WECHAT_ID).then(
        function () { toast('微信号 ' + WECHAT_ID + ' 已复制，请在微信中搜索添加'); },
        function () { toast('微信号：' + WECHAT_ID); }
      );
    });
  });
  document.querySelectorAll('[data-contact="tg"]').forEach(function (a) {
    a.addEventListener('click', function () {
      if (!hasOrder()) return;
      copy(listText()).then(
        function () { toast('订购清单已复制，请在 Telegram 对话里粘贴发送'); },
        function () { toast('复制失败，请在清单里点「复制清单」'); }
      );
    });
  });

  // ---------- hero ledger: one row per series, built from the live product list so admin edits show up here too ----------
  (function () {
    var rows = CATS.filter(function (c) { return c.key !== 'all'; }).map(function (c) {
      var ps = PRODUCTS.filter(function (p) { return p.cat === c.key; });
      if (!ps.length) return '';
      var prices = ps.map(function (p) { return p.price; });
      var lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
      return '<li><a class="l-row s-' + c.key + '" href="#catalogue" data-cat="' + c.key + '">' +
        '<span class="l-bar"></span>' +
        '<span><span class="l-name">' + esc(c.label) + '</span><span class="l-meta">' + ps.length + ' 款</span></span>' +
        '<span class="l-price num">RM ' + (lo === hi ? lo : lo + '–' + hi) + '</span></a></li>';
    }).join('');
    $('ledgerList').innerHTML = rows;
    $('ledger').hidden = !rows;
    $('ledgerList').addEventListener('click', function (e) {
      var a = e.target.closest('a[data-cat]');
      if (a) setCat(a.dataset.cat);
    });
  })();

  renderTabs();
  renderCart();
  render();
}

fetch('api/products', { cache: 'no-store' })
  .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(boot)
  .catch(function () {
    var g = document.getElementById('grid');
    if (g) g.innerHTML = '<p class="empty">无法载入产品数据。请通过 start.bat 启动网站（不要直接打开 index.html）。</p>';
  });
