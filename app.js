/* ===== Farmer Marketplace and Advisory Portal – Application Logic =====
   Frontend only. Data lives in the browser:
   - localStorage  : users, products, carts, orders, feedback
   - sessionStorage: current login session (and last placed order)
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Constants & state ---------- */
  var KEYS = {
    users: 'fm_users',
    products: 'fm_products',
    carts: 'fm_carts',
    orders: 'fm_orders',
    feedback: 'fm_feedback',
    session: 'fm_session',
    lastOrder: 'fm_last_order'
  };
  var PROTECTED = ['dashboard', 'marketplace', 'cart', 'payment', 'confirmation',
                   'advisory', 'tracking', 'feedback', 'profile'];
  var STATUS_FLOW = ['Processing', 'Shipped', 'Delivered'];
  var CATEGORY_ICONS = {
    Vegetables: '🥕', Fruits: '🍎', Grains: '🌾', Pulses: '🫘',
    Dairy: '🥛', Spices: '🌶️', Other: '🌱'
  };
  var PAYMENT_LABELS = { cod: 'Cash on Delivery (COD)', upi: 'UPI (Demo)', card: 'Card Payment (Demo)' };
  var PAYMENT_INFO = {
    cod: '💵 <strong>Pay on Delivery</strong> – you will pay the amount in cash when your order arrives.',
    upi: '📱 <strong>UPI (Demo)</strong> – clicking the button below simulates a successful UPI payment. No UPI ID or PIN is required.',
    card: '💳 <strong>Card Payment (Demo)</strong> – clicking the button below simulates a successful card payment. No card number, expiry or CVV is required.'
  };

  var currentPage = 'home';
  var placingOrder = false;      // blocks duplicate order placement
  var selectedPayment = 'cod';
  var selectedStars = 0;
  var feedbackPreselect = null;

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast('Could not save data. Please enable browser storage.', 'error'); return false; }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function toast(message, type) {
    var box = $('toast-container');
    var div = document.createElement('div');
    div.className = 'toast ' + (type || 'info');
    div.textContent = message;
    box.appendChild(div);
    setTimeout(function () { if (div.parentNode) { div.parentNode.removeChild(div); } }, 3800);
  }

  function showMsg(id, text, type) {
    var el = $(id);
    if (!el) { return; }
    el.textContent = text;
    el.className = 'message ' + type;
    el.hidden = false;
  }

  function clearMsg(id) {
    var el = $(id);
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  function setFieldError(inputId, errId, text) {
    var input = $(inputId), err = $(errId);
    if (err) { err.textContent = text || ''; }
    if (input) { input.classList.toggle('invalid', !!text); }
  }

  /* ---------- Seed demo data ---------- */
  function seed() {
    if (!localStorage.getItem(KEYS.users)) {
      save(KEYS.users, [
        { name: 'Ravi Kumar', mobile: '9876543210', username: 'farmer1', password: 'Farmer@123', created: new Date().toISOString() },
        { name: 'Lakshmi Devi', mobile: '9123456780', username: 'farmer2', password: 'Farmer@123', created: new Date().toISOString() }
      ]);
    }
    if (!localStorage.getItem(KEYS.products)) {
      var now = new Date().toISOString();
      save(KEYS.products, [
        { id: 'p1', name: 'Fresh Tomatoes', category: 'Vegetables', qty: 120, price: 28, description: 'Juicy red tomatoes harvested this week, perfect for markets and kitchens.', seller: 'farmer1', sellerName: 'Ravi Kumar', created: now },
        { id: 'p2', name: 'Basmati Rice', category: 'Grains', qty: 500, price: 65, description: 'Long-grain aromatic basmati, sun-dried and cleaned.', seller: 'farmer2', sellerName: 'Lakshmi Devi', created: now },
        { id: 'p3', name: 'Alphonso Mangoes', category: 'Fruits', qty: 80, price: 150, description: 'Naturally ripened sweet mangoes with rich aroma.', seller: 'farmer1', sellerName: 'Ravi Kumar', created: now },
        { id: 'p4', name: 'Toor Dal', category: 'Pulses', qty: 200, price: 110, description: 'High-protein split pigeon peas, unpolished and fresh.', seller: 'farmer2', sellerName: 'Lakshmi Devi', created: now },
        { id: 'p5', name: 'Desi Cow Ghee', category: 'Dairy', qty: 40, price: 520, description: 'Traditional bilona ghee made from desi cow milk.', seller: 'farmer2', sellerName: 'Lakshmi Devi', created: now },
        { id: 'p6', name: 'Turmeric Powder', category: 'Spices', qty: 60, price: 180, description: 'Farm-ground turmeric with deep colour and high curcumin.', seller: 'farmer1', sellerName: 'Ravi Kumar', created: now },
        { id: 'p7', name: 'Red Onions', category: 'Vegetables', qty: 300, price: 22, description: 'Firm, long-lasting red onions graded by size.', seller: 'farmer1', sellerName: 'Ravi Kumar', created: now },
        { id: 'p8', name: 'Nendran Bananas', category: 'Fruits', qty: 150, price: 35, description: 'Naturally grown bananas, ideal for chips and cooking.', seller: 'farmer2', sellerName: 'Lakshmi Devi', created: now }
      ]);
    }
    if (!localStorage.getItem(KEYS.carts)) { save(KEYS.carts, {}); }
    if (!localStorage.getItem(KEYS.orders)) { save(KEYS.orders, []); }
    if (!localStorage.getItem(KEYS.feedback)) { save(KEYS.feedback, []); }
  }

  /* ---------- Session ---------- */
  function currentUsername() { return sessionStorage.getItem(KEYS.session); }

  function currentUser() {
    var uname = currentUsername();
    if (!uname) { return null; }
    var users = load(KEYS.users, []);
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === uname) { return users[i]; }
    }
    return null;
  }

  /* ---------- Cart helpers ---------- */
  function getCart() {
    var carts = load(KEYS.carts, {});
    return carts[currentUsername()] || [];
  }

  function setCart(items) {
    var carts = load(KEYS.carts, {});
    carts[currentUsername()] = items;
    save(KEYS.carts, carts);
    updateCartBadge();
  }

  function findProduct(products, id) {
    for (var i = 0; i < products.length; i++) {
      if (products[i].id === id) { return products[i]; }
    }
    return null;
  }

  function cartDetails() {
    var products = load(KEYS.products, []);
    var lines = [], total = 0, count = 0;
    getCart().forEach(function (item) {
      var p = findProduct(products, item.productId);
      if (!p) { return; }
      var lineTotal = round2(item.qty * p.price);
      lines.push({ product: p, qty: item.qty, price: p.price, line: lineTotal });
      total += lineTotal;
      count += item.qty;
    });
    return { lines: lines, total: round2(total), count: count };
  }

  function updateCartBadge() {
    var badge = $('cart-badge');
    if (!badge) { return; }
    badge.textContent = currentUser() ? String(getCart().length) : '0';
  }

  /* ---------- Navigation ---------- */
  function updateNav() {
    var loggedIn = !!currentUser();
    var items = document.querySelectorAll('#nav-list li');
    for (var i = 0; i < items.length; i++) {
      var vis = items[i].getAttribute('data-visible');
      items[i].hidden = (vis === 'public' && loggedIn) || (vis === 'private' && !loggedIn);
    }
    var activeKey = currentPage;
    if (activeKey === 'payment') { activeKey = 'cart'; }
    if (activeKey === 'confirmation') { activeKey = 'tracking'; }
    var links = document.querySelectorAll('#nav-list a[data-nav]');
    for (var j = 0; j < links.length; j++) {
      links[j].classList.toggle('active', links[j].getAttribute('data-nav') === activeKey);
    }
    var hu = $('header-user');
    var user = currentUser();
    if (user) { hu.textContent = '👤 ' + user.username; hu.hidden = false; } else { hu.hidden = true; }
    updateCartBadge();
  }

  function showPage(name) {
    if (PROTECTED.indexOf(name) > -1 && !currentUser()) {
      toast('Please log in to access this page.', 'error');
      name = 'login';
    }
    if ((name === 'login' || name === 'register') && currentUser()) { name = 'dashboard'; }
    var el = $('page-' + name);
    if (!el) { name = 'home'; el = $('page-home'); }

    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) { pages[i].classList.remove('active'); }
    el.classList.add('active');
    currentPage = name;

    if (renders[name]) { renders[name](); }
    if ($('page-' + currentPage) && !$('page-' + currentPage).classList.contains('active')) {
      $('page-' + currentPage).classList.add('active');
    }
    updateNav();
    $('nav-list').classList.remove('open');
    $('nav-toggle').setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
  }

  /* ---------- Home ---------- */
  function renderHome() {
    var loggedIn = !!currentUser();
    $('home-guest-actions').hidden = loggedIn;
    $('home-user-actions').hidden = !loggedIn;
    if (loggedIn) {
      $('hero-welcome').textContent = '🌾 Welcome back, ' + currentUser().name + '! Manage your produce, orders and farming knowledge below.';
    } else {
      $('hero-welcome').textContent = '🌾 Welcome, farmers! Sell your harvest, buy what you need and learn better farming practices – all in one place.';
    }
  }

  /* ---------- Registration ---------- */
  function handleRegister(e) {
    e.preventDefault();
    clearMsg('reg-message');
    var name = $('reg-name').value.trim();
    var mobile = $('reg-mobile').value.trim();
    var username = $('reg-username').value.trim();
    var password = $('reg-password').value;
    var confirm = $('reg-confirm').value;
    var ok = true;

    setFieldError('reg-name', 'err-reg-name', '');
    setFieldError('reg-mobile', 'err-reg-mobile', '');
    setFieldError('reg-username', 'err-reg-username', '');
    setFieldError('reg-password', 'err-reg-password', '');
    setFieldError('reg-confirm', 'err-reg-confirm', '');

    if (!name) { setFieldError('reg-name', 'err-reg-name', 'Farmer name is required.'); ok = false; }
    else if (!/^[A-Za-z][A-Za-z .'-]{1,49}$/.test(name)) { setFieldError('reg-name', 'err-reg-name', 'Enter a valid name (letters and spaces, 2-50 characters).'); ok = false; }

    if (!mobile) { setFieldError('reg-mobile', 'err-reg-mobile', 'Mobile number is required.'); ok = false; }
    else if (!/^[6-9]\d{9}$/.test(mobile)) { setFieldError('reg-mobile', 'err-reg-mobile', 'Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.'); ok = false; }

    if (!username) { setFieldError('reg-username', 'err-reg-username', 'Username is required.'); ok = false; }
    else if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) { setFieldError('reg-username', 'err-reg-username', 'Username must be 4-20 characters: letters, numbers or underscore.'); ok = false; }

    if (!password) { setFieldError('reg-password', 'err-reg-password', 'Password is required.'); ok = false; }
    else if (password.length < 6) { setFieldError('reg-password', 'err-reg-password', 'Password must be at least 6 characters.'); ok = false; }

    if (!confirm) { setFieldError('reg-confirm', 'err-reg-confirm', 'Please confirm your password.'); ok = false; }
    else if (password && confirm !== password) { setFieldError('reg-confirm', 'err-reg-confirm', 'Passwords do not match.'); ok = false; }

    if (!ok) { showMsg('reg-message', 'Please correct the highlighted fields.', 'error'); return; }

    var users = load(KEYS.users, []);
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === username.toLowerCase()) {
        setFieldError('reg-username', 'err-reg-username', 'This username is already taken.');
        showMsg('reg-message', 'Registration failed: username already exists. Please choose another.', 'error');
        return;
      }
    }
    users.push({ name: name, mobile: mobile, username: username, password: password, created: new Date().toISOString() });
    if (!save(KEYS.users, users)) { return; }

    $('register-form').reset();
    showMsg('reg-message', '✅ Registration successful! You can now log in with username "' + username + '".', 'success');
    $('login-username').value = username;
  }

  /* ---------- Login / Logout ---------- */
  function handleLogin(e) {
    e.preventDefault();
    clearMsg('login-message');
    var username = $('login-username').value.trim();
    var password = $('login-password').value;
    var ok = true;
    setFieldError('login-username', 'err-login-username', '');
    setFieldError('login-password', 'err-login-password', '');

    if (!username) { setFieldError('login-username', 'err-login-username', 'Username is required.'); ok = false; }
    if (!password) { setFieldError('login-password', 'err-login-password', 'Password is required.'); ok = false; }
    if (!ok) { showMsg('login-message', 'Please enter both username and password.', 'error'); return; }

    var users = load(KEYS.users, []);
    var found = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].username.toLowerCase() === username.toLowerCase() && users[i].password === password) { found = users[i]; break; }
    }
    if (!found) { showMsg('login-message', 'Invalid username or password.', 'error'); return; }

    sessionStorage.setItem(KEYS.session, found.username);
    $('login-form').reset();
    toast('Welcome, ' + found.username + '! Login successful.', 'success');
    showPage('dashboard');
  }

  function logout() {
    sessionStorage.removeItem(KEYS.session);
    sessionStorage.removeItem(KEYS.lastOrder);
    selectedPayment = 'cod';
    toast('You have been logged out.', 'info');
    showPage('home');
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    var user = currentUser();
    if (!user) { return; }
    $('dash-welcome-text').textContent = '👋 Welcome, ' + user.username + '!';
    var products = load(KEYS.products, []);
    var available = products.filter(function (p) { return p.qty > 0; });
    var totalKg = 0;
    available.forEach(function (p) { totalKg += p.qty; });
    var cart = cartDetails();
    var myOrders = load(KEYS.orders, []).filter(function (o) { return o.username === user.username; });

    $('dash-stats').innerHTML =
      statCard('stat-products', '📦', available.length, 'Products Available (' + totalKg + ' kg in stock)') +
      statCard('stat-cart', '🧺', cart.lines.length + ' item(s)', 'Cart Summary – ' + money(cart.total)) +
      statCard('stat-orders', '📋', myOrders.length, 'Total Orders') +
      statCard('stat-listings', '🌾', products.filter(function (p) { return p.seller === user.username; }).length, 'My Listings');
  }

  function statCard(id, icon, value, label) {
    return '<div class="card stat" id="' + id + '"><div class="stat-icon">' + icon + '</div>' +
           '<div class="stat-value">' + esc(value) + '</div><div class="stat-label">' + esc(label) + '</div></div>';
  }

  /* ---------- Marketplace ---------- */
  function renderMarketplace() {
    clearMsg('product-message');
    clearMsg('market-message');
    renderProductGrid();
  }

  function renderProductGrid() {
    var q = $('market-search').value.trim().toLowerCase();
    var cat = $('market-category').value;
    var list = load(KEYS.products, []).filter(function (p) {
      var matchCat = cat === 'all' || p.category === cat;
      var hay = (p.name + ' ' + p.description + ' ' + p.sellerName).toLowerCase();
      return matchCat && (!q || hay.indexOf(q) > -1);
    });
    list.sort(function (a, b) {
      if ((a.qty > 0) !== (b.qty > 0)) { return a.qty > 0 ? -1 : 1; }
      return String(b.created).localeCompare(String(a.created));
    });
    $('market-count').textContent = 'Available Products (' + list.length + ')';

    if (!list.length) {
      $('product-grid').innerHTML = '<div class="card empty-state" id="market-empty" style="grid-column:1/-1"><div class="empty-icon">🔍</div><h3>No products found</h3><p class="muted">Try a different search or add a new product.</p></div>';
      return;
    }
    $('product-grid').innerHTML = list.map(function (p) {
      var icon = CATEGORY_ICONS[p.category] || '🌱';
      var buy = p.qty > 0
        ? '<div class="buy-row"><label class="sr-only" for="qty-' + esc(p.id) + '">Quantity in kg</label>' +
          '<input type="number" id="qty-' + esc(p.id) + '" min="1" max="' + p.qty + '" step="1" value="1">' +
          '<button type="button" class="btn btn-primary btn-sm" id="add-' + esc(p.id) + '" data-action="add-cart" data-id="' + esc(p.id) + '">Add to Cart</button></div>'
        : '<button type="button" class="btn btn-outline btn-sm" id="add-' + esc(p.id) + '" disabled>Out of Stock</button>';
      return '<article class="card product-card" id="product-' + esc(p.id) + '">' +
        '<div class="product-img cat-' + esc(String(p.category).toLowerCase()) + '">' + icon + '</div>' +
        '<div class="product-body">' +
        '<span class="tag">' + esc(p.category) + '</span>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="muted small">Seller: ' + esc(p.sellerName) + '</p>' +
        '<p class="desc">' + esc(p.description) + '</p>' +
        '<div class="product-meta"><span>Available: <strong class="' + (p.qty > 0 ? '' : 'out-stock') + '">' + p.qty + ' kg</strong></span>' +
        '<span class="price">' + money(p.price) + '/kg</span></div>' + buy +
        '</div></article>';
    }).join('');
  }

  function handleAddProduct(e) {
    e.preventDefault();
    clearMsg('product-message');
    var user = currentUser();
    if (!user) { showPage('login'); return; }

    var name = $('prod-name').value.trim();
    var category = $('prod-category').value;
    var qtyRaw = $('prod-qty').value.trim();
    var priceRaw = $('prod-price').value.trim();
    var desc = $('prod-desc').value.trim();
    var qty = Number(qtyRaw), price = Number(priceRaw);
    var ok = true;

    ['name', 'category', 'qty', 'price', 'desc'].forEach(function (f) { setFieldError('prod-' + f, 'err-prod-' + f, ''); });

    if (!name) { setFieldError('prod-name', 'err-prod-name', 'Product name is required.'); ok = false; }
    else if (name.length < 2 || name.length > 60) { setFieldError('prod-name', 'err-prod-name', 'Name must be 2-60 characters.'); ok = false; }
    if (!category) { setFieldError('prod-category', 'err-prod-category', 'Please select a category.'); ok = false; }
    if (!qtyRaw) { setFieldError('prod-qty', 'err-prod-qty', 'Quantity is required.'); ok = false; }
    else if (!Number.isInteger(qty) || qty < 1 || qty > 100000) { setFieldError('prod-qty', 'err-prod-qty', 'Enter a whole number of kg between 1 and 100000.'); ok = false; }
    if (!priceRaw) { setFieldError('prod-price', 'err-prod-price', 'Price per kg is required.'); ok = false; }
    else if (isNaN(price) || price <= 0 || price > 1000000) { setFieldError('prod-price', 'err-prod-price', 'Enter a valid price greater than 0.'); ok = false; }
    if (!desc) { setFieldError('prod-desc', 'err-prod-desc', 'Description is required.'); ok = false; }
    else if (desc.length < 5) { setFieldError('prod-desc', 'err-prod-desc', 'Description must be at least 5 characters.'); ok = false; }

    if (!ok) { showMsg('product-message', 'Please correct the highlighted fields.', 'error'); return; }

    var products = load(KEYS.products, []);
    products.push({
      id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36),
      name: name, category: category, qty: qty, price: round2(price), description: desc,
      seller: user.username, sellerName: user.name, created: new Date().toISOString()
    });
    if (!save(KEYS.products, products)) { return; }
    $('product-form').reset();
    showMsg('product-message', '✅ "' + name + '" has been listed successfully!', 'success');
    renderProductGrid();
  }

  function addToCart(id) {
    clearMsg('market-message');
    var input = $('qty-' + id);
    var qty = input ? Number(input.value) : 0;
    if (!Number.isInteger(qty) || qty < 1) {
      showMsg('market-message', 'Please enter a valid whole quantity (1 kg or more).', 'error');
      return;
    }
    var products = load(KEYS.products, []);
    var p = findProduct(products, id);
    if (!p || p.qty < 1) { showMsg('market-message', 'Sorry, this product is out of stock.', 'error'); renderProductGrid(); return; }

    var cart = getCart();
    var line = null;
    for (var i = 0; i < cart.length; i++) { if (cart[i].productId === id) { line = cart[i]; break; } }
    var already = line ? line.qty : 0;
    if (already + qty > p.qty) {
      showMsg('market-message', 'Cannot add ' + qty + ' kg of ' + p.name + '. Only ' + p.qty + ' kg available' +
        (already ? ' (you already have ' + already + ' kg in your cart).' : '.'), 'error');
      return;
    }
    if (line) { line.qty += qty; } else { cart.push({ productId: id, qty: qty }); }
    setCart(cart);
    input.value = 1;
    showMsg('market-message', '✅ Added ' + qty + ' kg of ' + p.name + ' to your cart.', 'success');
  }

  /* ---------- Cart ---------- */
  function renderCart() {
    clearMsg('cart-message');
    var det = cartDetails();
    var box = $('cart-content');
    if (!det.lines.length) {
      box.innerHTML = '<div class="card empty-state" id="cart-empty"><div class="empty-icon">🧺</div><h3>Your cart is empty</h3>' +
        '<p class="muted">Browse the marketplace and add some fresh produce.</p>' +
        '<button type="button" class="btn btn-primary" id="cart-empty-btn" data-nav="marketplace">Go to Marketplace</button></div>';
      return;
    }
    var rows = det.lines.map(function (l) {
      var warn = l.qty > l.product.qty ? '<span class="stock-warn">Only ' + l.product.qty + ' kg in stock now</span>' : '';
      return '<tr id="cart-row-' + esc(l.product.id) + '">' +
        '<td><strong>' + esc(l.product.name) + '</strong>' + warn + '</td>' +
        '<td>' + l.qty + ' kg</td>' +
        '<td>' + money(l.price) + '</td>' +
        '<td>' + money(l.line) + '</td>' +
        '<td><button type="button" class="btn btn-danger btn-sm" id="remove-' + esc(l.product.id) + '" data-action="remove-cart" data-id="' + esc(l.product.id) + '">Remove</button></td></tr>';
    }).join('');
    box.innerHTML =
      '<div class="card"><div class="table-wrap"><table id="cart-table"><thead><tr>' +
      '<th>Product Name</th><th>Quantity</th><th>Price per kg</th><th>Total Price</th><th>Action</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="3">Overall Cart Total</td><td colspan="2" id="cart-total">' + money(det.total) + '</td></tr></tfoot></table></div>' +
      '<div class="cart-actions"><button type="button" class="btn btn-outline" id="cart-continue" data-nav="marketplace">← Continue Shopping</button>' +
      '<button type="button" class="btn btn-primary" id="cart-proceed" data-action="proceed-payment">Proceed to Payment →</button></div></div>';
  }

  function removeFromCart(id) {
    var cart = getCart().filter(function (i) { return i.productId !== id; });
    setCart(cart);
    renderCart();
    showMsg('cart-message', 'Item removed from your cart.', 'success');
  }

  function proceedToPayment() {
    var det = cartDetails();
    if (!det.lines.length) { showMsg('cart-message', 'Your cart is empty.', 'error'); return; }
    for (var i = 0; i < det.lines.length; i++) {
      if (det.lines[i].qty > det.lines[i].product.qty) {
        showMsg('cart-message', 'Not enough stock for ' + det.lines[i].product.name + ' (only ' + det.lines[i].product.qty + ' kg left). Please remove it and add a smaller quantity.', 'error');
        return;
      }
    }
    showPage('payment');
  }

  /* ---------- Payment ---------- */
  function renderPayment() {
    clearMsg('payment-message');
    var det = cartDetails();
    if (!det.lines.length) {
      if (!placingOrder) {
        toast('Your cart is empty. Add products before paying.', 'error');
        showPage('cart');
      }
      return;
    }
    var rows = det.lines.map(function (l) {
      return '<tr><td>' + esc(l.product.name) + '</td><td>' + l.qty + ' kg</td><td>' + money(l.price) + '</td><td>' + money(l.line) + '</td></tr>';
    }).join('');
    $('payment-summary').innerHTML =
      '<div class="table-wrap"><table id="payment-table"><thead><tr><th>Product</th><th>Qty</th><th>Price/kg</th><th>Total</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><td colspan="3">Total Amount</td><td id="payment-total">' + money(det.total) + '</td></tr></tfoot></table></div>';
    $('pay-' + selectedPayment).checked = true;
    updatePaymentUI();
  }

  function updatePaymentUI() {
    ['cod', 'upi', 'card'].forEach(function (m) {
      $('label-pay-' + m).classList.toggle('selected', selectedPayment === m);
    });
    $('payment-info').innerHTML = PAYMENT_INFO[selectedPayment];
    var btn = $('pay-btn');
    btn.disabled = placingOrder;
    if (placingOrder) { btn.textContent = 'Processing…'; }
    else if (selectedPayment === 'cod') { btn.textContent = 'Place Order (Pay on Delivery)'; }
    else { btn.textContent = 'Pay (Demo) & Place Order'; }
  }

  function confirmPayment() {
    if (placingOrder) { return; }              // ignore repeated clicks
    var det = cartDetails();
    if (!det.lines.length) { showMsg('payment-message', 'Your cart is empty.', 'error'); return; }
    placingOrder = true;
    updatePaymentUI();
    var method = selectedPayment;
    if (method === 'cod') {
      showMsg('payment-message', 'Pay on Delivery selected. Placing your order…', 'success');
    } else {
      showMsg('payment-message', 'Processing demo payment… (no real money is charged)', 'success');
    }
    setTimeout(function () { finalizeOrder(method); }, method === 'cod' ? 400 : 1500);
  }

  function generateOrderId(orders) {
    var d = new Date();
    var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    var id, exists;
    do {
      id = 'FM-' + stamp + '-' + (Math.floor(Math.random() * 90000) + 10000);
      exists = orders.some(function (o) { return o.id === id; });
    } while (exists);
    return id;
  }

  function finalizeOrder(method) {
    var user = currentUser();
    if (!user) { placingOrder = false; return; }
    var det = cartDetails();
    if (!det.lines.length) {
      placingOrder = false;
      showPage('cart');
      return;
    }
    var products = load(KEYS.products, []);

    // Re-check stock for every line before touching anything
    for (var i = 0; i < det.lines.length; i++) {
      var check = findProduct(products, det.lines[i].product.id);
      if (!check || det.lines[i].qty > check.qty) {
        placingOrder = false;
        toast('Order not placed: stock changed for ' + det.lines[i].product.name + '.', 'error');
        showPage('cart');
        showMsg('cart-message', 'Order not placed: not enough stock for ' + det.lines[i].product.name + '. Please update your cart.', 'error');
        return;
      }
    }

    var items = [], total = 0;
    det.lines.forEach(function (l) {
      var p = findProduct(products, l.product.id);
      p.qty -= l.qty;                         // update stock
      var lineTotal = round2(l.qty * p.price);
      total += lineTotal;
      items.push({ productId: p.id, name: p.name, qty: l.qty, price: p.price, total: lineTotal });
    });
    total = round2(total);

    var orders = load(KEYS.orders, []);
    var order = {
      id: generateOrderId(orders),
      username: user.username,
      items: items,
      total: total,
      paymentMethod: method,
      paymentMethodLabel: PAYMENT_LABELS[method],
      paymentStatus: method === 'cod' ? 'Pending (Pay on Delivery)' : 'Paid (Demo)',
      status: 'Processing',
      date: new Date().toISOString()
    };
    orders.push(order);

    if (!save(KEYS.products, products) || !save(KEYS.orders, orders)) { placingOrder = false; return; }
    setCart([]);
    sessionStorage.setItem(KEYS.lastOrder, order.id);
    placingOrder = false;
    toast(method === 'cod' ? 'Order placed – pay on delivery.' : 'Demo payment successful!', 'success');
    showPage('confirmation');
  }

  /* ---------- Order confirmation ---------- */
  function renderConfirmation() {
    var id = sessionStorage.getItem(KEYS.lastOrder);
    var user = currentUser();
    var order = null;
    if (id && user) {
      order = load(KEYS.orders, []).filter(function (o) { return o.id === id && o.username === user.username; })[0] || null;
    }
    if (!order) { showPage('tracking'); return; }

    var rows = order.items.map(function (i) {
      return '<tr><td>' + esc(i.name) + '</td><td>' + i.qty + ' kg</td><td>' + money(i.price) + '</td><td>' + money(i.total) + '</td></tr>';
    }).join('');
    var payMsg = order.paymentMethod === 'cod'
      ? '💵 Pay on Delivery – please keep the amount ready when your order arrives.'
      : '✅ Demo payment successful – no real transaction was made.';
    $('confirm-card').innerHTML =
      '<div class="confirm-icon">✓</div>' +
      '<h2 id="confirm-title">Order Placed Successfully!</h2>' +
      '<p class="muted" id="confirm-paymsg">' + payMsg + '</p>' +
      '<div class="detail-grid">' +
      '<div><small>Order ID</small><strong id="confirm-order-id">' + esc(order.id) + '</strong></div>' +
      '<div><small>Order Date</small><strong>' + esc(formatDate(order.date)) + '</strong></div>' +
      '<div><small>Payment Method</small><strong id="confirm-method">' + esc(order.paymentMethodLabel) + '</strong></div>' +
      '<div><small>Payment Status</small><strong id="confirm-pay-status">' + esc(order.paymentStatus) + '</strong></div>' +
      '<div><small>Order Status</small><span class="status-badge status-' + esc(order.status) + '" id="confirm-status">' + esc(order.status) + '</span></div>' +
      '<div><small>Total Amount</small><strong id="confirm-total">' + money(order.total) + '</strong></div>' +
      '</div>' +
      '<div class="confirm-details table-wrap"><table id="confirm-table"><thead><tr><th>Product</th><th>Quantity</th><th>Price/kg</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="btn-row" style="justify-content:center">' +
      '<button type="button" class="btn btn-primary" id="confirm-track" data-nav="tracking">🚚 Track My Order</button>' +
      '<button type="button" class="btn btn-outline" id="confirm-shop" data-nav="marketplace">Continue Shopping</button></div>';
  }

  /* ---------- Tracking ---------- */
  function renderTracking() {
    clearMsg('track-message');
    renderTrackingList();
  }

  function renderTrackingList() {
    var user = currentUser();
    if (!user) { return; }
    var q = $('track-search').value.trim().toLowerCase();
    var feedback = load(KEYS.feedback, []);
    var orders = load(KEYS.orders, []).filter(function (o) {
      return o.username === user.username && (!q || o.id.toLowerCase().indexOf(q) > -1);
    }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

    if (!orders.length) {
      $('tracking-list').innerHTML = '<div class="card empty-state" id="track-empty"><div class="empty-icon">📭</div><h3>No orders found</h3>' +
        '<p class="muted">' + (q ? 'No order matches that ID.' : 'Place your first order from the marketplace.') + '</p>' +
        '<button type="button" class="btn btn-primary" id="track-empty-btn" data-nav="marketplace">Go to Marketplace</button></div>';
      return;
    }

    $('tracking-list').innerHTML = orders.map(function (o) {
      var idx = STATUS_FLOW.indexOf(o.status);
      var steps = STATUS_FLOW.map(function (s, i) {
        var cls = (i < idx || (idx === STATUS_FLOW.length - 1 && i === idx)) ? 'done' : (i === idx ? 'current' : '');
        return '<div class="st ' + cls + '"><span class="dot">' + (cls === 'done' ? '✓' : (i + 1)) + '</span><div>' + s + '</div></div>';
      }).join('');
      var rows = o.items.map(function (i) {
        return '<tr><td>' + esc(i.name) + '</td><td>' + i.qty + ' kg</td><td>' + money(i.price) + '</td><td>' + money(i.total) + '</td></tr>';
      }).join('');
      var given = feedback.some(function (f) { return f.orderId === o.id && f.username === user.username; });
      var actions = '';
      if (o.status !== 'Delivered') {
        actions += '<button type="button" class="btn btn-outline btn-sm" id="adv-' + esc(o.id) + '" data-action="advance-status" data-id="' + esc(o.id) + '">⏩ Move to ' + STATUS_FLOW[idx + 1] + ' (Demo)</button>';
      } else if (given) {
        actions += '<span class="status-badge status-Delivered" id="fbdone-' + esc(o.id) + '">⭐ Feedback submitted</span>';
      } else {
        actions += '<button type="button" class="btn btn-primary btn-sm" id="fbbtn-' + esc(o.id) + '" data-action="give-feedback" data-id="' + esc(o.id) + '">⭐ Give Feedback</button>';
      }
      return '<div class="card order-card" id="order-' + esc(o.id) + '">' +
        '<div class="order-head"><h3>Order ID: ' + esc(o.id) + '</h3><span class="status-badge status-' + esc(o.status) + '">' + esc(o.status) + '</span></div>' +
        '<p class="muted small">Order date: ' + esc(formatDate(o.date)) + ' &nbsp;|&nbsp; Payment: ' + esc(o.paymentMethodLabel) + ' (' + esc(o.paymentStatus) + ')</p>' +
        '<div class="stepper">' + steps + '</div>' +
        '<div class="table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th>Price/kg</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody>' +
        '<tfoot><tr><td colspan="3">Order Total</td><td>' + money(o.total) + '</td></tr></tfoot></table></div>' +
        '<div class="order-actions">' + actions + '</div></div>';
    }).join('');
  }

  function advanceStatus(id) {
    var user = currentUser();
    var orders = load(KEYS.orders, []);
    var order = null;
    for (var i = 0; i < orders.length; i++) { if (orders[i].id === id && orders[i].username === user.username) { order = orders[i]; break; } }
    if (!order) { return; }
    var idx = STATUS_FLOW.indexOf(order.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) { return; }
    order.status = STATUS_FLOW[idx + 1];
    if (order.status === 'Delivered' && order.paymentMethod === 'cod') { order.paymentStatus = 'Paid (Cash on Delivery)'; }
    save(KEYS.orders, orders);
    renderTrackingList();
    showMsg('track-message', 'Order ' + id + ' is now ' + order.status + '.' + (order.status === 'Delivered' ? ' You can now submit feedback.' : ''), 'success');
  }

  /* ---------- Feedback ---------- */
  function eligibleOrders() {
    var user = currentUser();
    var feedback = load(KEYS.feedback, []);
    return load(KEYS.orders, []).filter(function (o) {
      return o.username === user.username && o.status === 'Delivered' &&
        !feedback.some(function (f) { return f.orderId === o.id && f.username === user.username; });
    });
  }

  function renderFeedbackPage() {
    clearMsg('fb-message');
    renderFeedbackForm();
    renderFeedbackList();
  }

  function renderFeedbackForm() {
    var list = eligibleOrders();
    var select = $('fb-order');
    $('fb-empty').hidden = list.length > 0;
    $('feedback-form').hidden = list.length === 0;
    select.innerHTML = '<option value="">-- Select an order --</option>' + list.map(function (o) {
      return '<option value="' + esc(o.id) + '">' + esc(o.id) + ' – ' + money(o.total) + '</option>';
    }).join('');
    if (feedbackPreselect && list.some(function (o) { return o.id === feedbackPreselect; })) { select.value = feedbackPreselect; }
    feedbackPreselect = null;
    setStars(0);
    $('fb-text').value = '';
    setFieldError('fb-order', 'err-fb-order', '');
    setFieldError('fb-text', 'err-fb-text', '');
    $('err-fb-rating').textContent = '';
  }

  function setStars(n) {
    selectedStars = n;
    for (var i = 1; i <= 5; i++) {
      var s = $('fb-star-' + i);
      s.classList.toggle('on', i <= n);
      s.setAttribute('aria-pressed', i <= n ? 'true' : 'false');
    }
    $('fb-star-text').textContent = n ? n + ' / 5' : 'Not rated';
  }

  function renderFeedbackList() {
    var user = currentUser();
    var list = load(KEYS.feedback, []).filter(function (f) { return f.username === user.username; })
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (!list.length) {
      $('fb-list').innerHTML = '<div class="card empty-state" id="fb-none"><p class="muted">You have not submitted any feedback yet.</p></div>';
      return;
    }
    $('fb-list').innerHTML = list.map(function (f) {
      var stars = '★★★★★☆☆☆☆☆'.slice(5 - f.rating, 10 - f.rating);
      return '<div class="card fb-item" id="fb-item-' + esc(f.id) + '"><strong>' + esc(f.orderId) + '</strong> ' +
        '<span class="fb-stars" aria-label="' + f.rating + ' out of 5">' + stars + '</span>' +
        '<p>' + esc(f.message) + '</p><small class="muted">' + esc(formatDate(f.date)) + '</small></div>';
    }).join('');
  }

  function handleFeedback(e) {
    e.preventDefault();
    clearMsg('fb-message');
    var user = currentUser();
    if (!user) { showPage('login'); return; }
    var orderId = $('fb-order').value;
    var text = $('fb-text').value.trim();
    var ok = true;
    setFieldError('fb-order', 'err-fb-order', '');
    setFieldError('fb-text', 'err-fb-text', '');
    $('err-fb-rating').textContent = '';

    if (!orderId) { setFieldError('fb-order', 'err-fb-order', 'Please select a delivered order.'); ok = false; }
    if (selectedStars < 1) { $('err-fb-rating').textContent = 'Please choose a rating from 1 to 5 stars.'; ok = false; }
    if (!text) { setFieldError('fb-text', 'err-fb-text', 'Feedback message is required.'); ok = false; }
    else if (text.length < 5) { setFieldError('fb-text', 'err-fb-text', 'Message must be at least 5 characters.'); ok = false; }
    if (!ok) { showMsg('fb-message', 'Please correct the highlighted fields.', 'error'); return; }

    var order = eligibleOrders().filter(function (o) { return o.id === orderId; })[0];
    if (!order) { showMsg('fb-message', 'Feedback can only be given once for a delivered order.', 'error'); renderFeedbackForm(); return; }

    var feedback = load(KEYS.feedback, []);
    feedback.push({
      id: 'f' + Date.now().toString(36), orderId: orderId, username: user.username,
      rating: selectedStars, message: text, date: new Date().toISOString()
    });
    if (!save(KEYS.feedback, feedback)) { return; }
    renderFeedbackForm();
    renderFeedbackList();
    showMsg('fb-message', '✅ Thank you! Your feedback for ' + orderId + ' was submitted successfully.', 'success');
  }

  /* ---------- Profile ---------- */
  function renderProfile() {
    var user = currentUser();
    if (!user) { return; }
    var orders = load(KEYS.orders, []).filter(function (o) { return o.username === user.username; });
    var listings = load(KEYS.products, []).filter(function (p) { return p.seller === user.username; });
    $('profile-card').innerHTML =
      '<div class="avatar" id="profile-avatar">' + esc(user.name.charAt(0).toUpperCase()) + '</div>' +
      '<h2 id="profile-heading">My Profile</h2>' +
      '<div class="profile-list">' +
      '<div class="profile-row"><span>Farmer Name</span><span id="profile-name">' + esc(user.name) + '</span></div>' +
      '<div class="profile-row"><span>Username</span><span id="profile-username">' + esc(user.username) + '</span></div>' +
      '<div class="profile-row"><span>Mobile Number</span><span id="profile-mobile">' + esc(user.mobile) + '</span></div>' +
      '<div class="profile-row"><span>Member Since</span><span id="profile-since">' + esc(formatDate(user.created)) + '</span></div>' +
      '<div class="profile-row"><span>My Listings</span><span id="profile-listings">' + listings.length + '</span></div>' +
      '<div class="profile-row"><span>My Orders</span><span id="profile-orders">' + orders.length + '</span></div>' +
      '</div>';
  }

  /* ---------- Reset demo data ---------- */
  function resetDemo() {
    if (!window.confirm('This will erase all accounts, products, orders and feedback and restore the demo data. Continue?')) { return; }
    [KEYS.users, KEYS.products, KEYS.carts, KEYS.orders, KEYS.feedback].forEach(function (k) { localStorage.removeItem(k); });
    sessionStorage.clear();
    placingOrder = false;
    seed();
    toast('Demo data has been reset.', 'info');
    showPage('home');
  }

  /* ---------- Page render map ---------- */
  var renders = {
    home: renderHome,
    register: function () { clearMsg('reg-message'); },
    login: function () { clearMsg('login-message'); },
    dashboard: renderDashboard,
    marketplace: renderMarketplace,
    cart: renderCart,
    payment: renderPayment,
    confirmation: renderConfirmation,
    tracking: renderTracking,
    feedback: renderFeedbackPage,
    profile: renderProfile
  };

  /* ---------- Actions (buttons using data-action) ---------- */
  var actions = {
    'logout': function () { logout(); },
    'add-cart': function (el) { addToCart(el.getAttribute('data-id')); },
    'remove-cart': function (el) { removeFromCart(el.getAttribute('data-id')); },
    'proceed-payment': function () { proceedToPayment(); },
    'confirm-payment': function () { confirmPayment(); },
    'advance-status': function (el) { advanceStatus(el.getAttribute('data-id')); },
    'give-feedback': function (el) { feedbackPreselect = el.getAttribute('data-id'); showPage('feedback'); },
    'star': function (el) { setStars(Number(el.getAttribute('data-value'))); $('err-fb-rating').textContent = ''; },
    'reset-demo': function () { resetDemo(); }
  };

  /* ---------- Event wiring ---------- */
  function init() {
    seed();

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-nav],[data-action]') : null;
      if (!t) { return; }
      e.preventDefault();
      if (t.hasAttribute('data-nav')) { showPage(t.getAttribute('data-nav')); return; }
      var fn = actions[t.getAttribute('data-action')];
      if (fn) { fn(t); }
    });

    document.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'payment-method') {
        selectedPayment = e.target.value;
        updatePaymentUI();
      }
    });

    $('register-form').addEventListener('submit', handleRegister);
    $('login-form').addEventListener('submit', handleLogin);
    $('product-form').addEventListener('submit', handleAddProduct);
    $('feedback-form').addEventListener('submit', handleFeedback);
    $('market-search').addEventListener('input', renderProductGrid);
    $('market-category').addEventListener('change', renderProductGrid);
    $('track-search').addEventListener('input', renderTrackingList);

    $('nav-toggle').addEventListener('click', function () {
      var list = $('nav-list');
      var open = list.classList.toggle('open');
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    showPage('home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
