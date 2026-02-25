document.addEventListener('DOMContentLoaded', () => {
 const AZPINX_ENGINE = 'engine';
 const AZPINX_VERSION = 'v2.0.0';
 const AZPINX_BUILD = '2026-02-25';
 const ASCII_AZPINX = [
 '   ___   ______  ____  ____ _   __   _  __',
 '  /   | /__  / / __ \\/  _// | / /  | |/ /',
 ' / /| |   / / / /_/ // / /  |/ /   |   / ',
 '/ ___ |  / /_/ ____// / / /|  /   /   |  ',
 '/_/  |_| /____/_/  /___//_/ |_/   /_/|_|  '
 ].join('\n');

 const consoleState = {
 ip: 'Unknown',
 city: 'Unknown',
 region: 'Unknown',
 country: 'Unknown',
 timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown',
 updatedAt: new Date().toISOString(),
 source: 'local'
 };

 function fetchWithTimeout(url, timeoutMs) {
 return Promise.race([
 fetch(url, { cache: 'no-store' }),
 new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
 ]);
 }

 async function refreshGeoInfo() {
 try {
 const resp = await fetchWithTimeout('https://ipapi.co/json/', 2200);
 if (!resp || !resp.ok) throw new Error('geo_response_not_ok');
 const data = await resp.json();
 if (!data || typeof data !== 'object') throw new Error('geo_payload_invalid');
 consoleState.ip = String(data.ip || consoleState.ip || 'Unknown');
 consoleState.city = String(data.city || consoleState.city || 'Unknown');
 consoleState.region = String(data.region || data.region_code || consoleState.region || 'Unknown');
 consoleState.country = String(data.country_name || data.country || consoleState.country || 'Unknown');
 consoleState.timezone = String(data.timezone || consoleState.timezone || 'Unknown');
 consoleState.updatedAt = new Date().toISOString();
 consoleState.source = 'ipapi.co';
 } catch (err) {
 consoleState.updatedAt = new Date().toISOString();
 consoleState.source = 'fallback';
 }
 return { ...consoleState };
 }

 function printAzpinxConsoleBanner() {
 const versionLine = `Version: ${AZPINX_VERSION} | Build: ${AZPINX_BUILD}`;
 const ipLine = `IP: ${consoleState.ip}`;
 const locLine = `Location: ${consoleState.city}, ${consoleState.region}, ${consoleState.country}`;
 const tzLine = `Timezone: ${consoleState.timezone}`;
 const srcLine = `Geo source: ${consoleState.source} | Updated: ${consoleState.updatedAt}`;
 console.log('%c' + ASCII_AZPINX, 'color:#3b82f6;font-weight:700;line-height:1.15;font-family:monospace;');
 console.log('%cAZPINX %c' + AZPINX_ENGINE, 'color:#10b981;font-weight:800;font-size:16px;', 'color:#94a3b8;font-size:12px;');
 console.log('%c' + versionLine, 'color:#e2e8f0;font-size:11px;');
 console.log('%c' + ipLine, 'color:#facc15;font-size:11px;');
 console.log('%c' + locLine, 'color:#facc15;font-size:11px;');
 console.log('%c' + tzLine, 'color:#facc15;font-size:11px;');
 console.log('%c' + srcLine, 'color:#94a3b8;font-size:10px;');
 console.log('%cType azpinx.help() for userland console commands.', 'color:#22d3ee;font-size:11px;');
 }

 window.azpinx = {
 help() {
 console.table([
 { command: 'azpinx.help()', description: 'Command list' },
 { command: 'azpinx.status()', description: 'Version + runtime status' },
 { command: 'azpinx.geo()', description: 'Refresh and print IP/location' },
 { command: 'azpinx.cart()', description: 'Current cart snapshot' },
 { command: 'azpinx.clearCart()', description: 'Clear local cart' },
 { command: 'azpinx.banner()', description: 'Reprint ASCII banner' },
 { command: 'azpinx.ping()', description: 'Simple health output' }
 ]);
 },
 status() {
 const snapshot = {
 engine: AZPINX_ENGINE,
 version: AZPINX_VERSION,
 build: AZPINX_BUILD,
 url: window.location.href,
 userAgent: navigator.userAgent,
 language: navigator.language,
 online: navigator.onLine,
 ip: consoleState.ip,
 location: `${consoleState.city}, ${consoleState.region}, ${consoleState.country}`,
 timezone: consoleState.timezone,
 geoSource: consoleState.source,
 geoUpdatedAt: consoleState.updatedAt
 };
 console.table(snapshot);
 return snapshot;
 },
 async geo() {
 const info = await refreshGeoInfo();
 printAzpinxConsoleBanner();
 return info;
 },
 cart() {
 const items = JSON.parse(localStorage.getItem('azpin_cart') || '[]');
 console.table(items);
 return items;
 },
 clearCart() {
 localStorage.removeItem('azpin_cart');
 console.log('azpin_cart cleared.');
 return true;
 },
 banner() {
 printAzpinxConsoleBanner();
 },
 ping() {
 const payload = { ok: true, ts: new Date().toISOString(), path: window.location.pathname };
 console.log(payload);
 return payload;
 }
 };

 refreshGeoInfo().finally(printAzpinxConsoleBanner);

 let devtoolsWasOpen = false;
 function isDevtoolsOpen() {
 const widthGap = window.outerWidth - window.innerWidth;
 const heightGap = window.outerHeight - window.innerHeight;
 return widthGap > 160 || heightGap > 160;
 }

 function watchDevtoolsConsole() {
 const openNow = isDevtoolsOpen();
 if (openNow && !devtoolsWasOpen) {
 printAzpinxConsoleBanner();
 }
 devtoolsWasOpen = openNow;
 }

 window.setInterval(watchDevtoolsConsole, 1200);
 window.addEventListener('resize', watchDevtoolsConsole, { passive: true });
 watchDevtoolsConsole();

 // Select elements
 const cartTrigger = document.getElementById('cartTrigger');
 const cartCount = document.querySelector('.cart-count');
 const cartPageItems = document.getElementById('cartPageItems');
 const cartPageEmpty = document.getElementById('cartPageEmpty');
 const cartPageCount = document.getElementById('cartPageCount');
 const cartPageSubtotal = document.getElementById('cartPageSubtotal');
 const cartPageTotal = document.getElementById('cartPageTotal');
 const clearCartBtn = document.getElementById('clearCartBtn');
 const goCheckoutBtn = document.getElementById('goCheckoutBtn');

 let cart = JSON.parse(localStorage.getItem('azpin_cart')) || [];

 // --- Global Cart Logic ---
 const updateCartUI = () => {
 let total = 0;
 let count = 0;

 cart.forEach((item) => {
 total += Number(item.price) || 0;
 count += 1;
 });

 if (cartCount) cartCount.textContent = count;
 renderCartPage(total, count);
 localStorage.setItem('azpin_cart', JSON.stringify(cart));
 };

 const renderCartPage = (total, count) => {
 if (!cartPageItems) return;

 cartPageItems.innerHTML = '';
 const isEmpty = count === 0;

 if (cartPageEmpty) cartPageEmpty.style.display = isEmpty ? 'flex' : 'none';
 cartPageItems.style.display = isEmpty ? 'none' : 'grid';
 if (goCheckoutBtn) {
 goCheckoutBtn.style.pointerEvents = isEmpty ? 'none' : 'auto';
 goCheckoutBtn.style.opacity = isEmpty ? '0.55' : '1';
 }

 if (cartPageCount) cartPageCount.textContent = String(count);
 if (cartPageSubtotal) cartPageSubtotal.textContent = `${total.toFixed(2)} AZN`;
 if (cartPageTotal) cartPageTotal.textContent = `${total.toFixed(2)} AZN`;
 if (isEmpty) return;

 cart.forEach((item, index) => {
 const row = document.createElement('article');
 row.className = 'cart-page-item';
 row.innerHTML = `
 <div class="cart-page-item-media">
 <img src="${item.img}" alt="${item.name}">
 </div>
 <div class="cart-page-item-body">
 <h4>${item.name}</h4>
 <p>${item.player_id ? `ID: ${item.player_id} • Nick: ${item.player_nickname || '-'}` : 'Ani təhvil verilən rəqəmsal məhsul'}</p>
 </div>
 <div class="cart-page-item-right">
 <strong>${item.price.toFixed(2)} AZN</strong>
 <button class="btn btn-link cart-page-remove" type="button" onclick="removeFromCart(${index})">
 <i class="ri-delete-bin-line"></i> Sil
 </button>
 </div>
 `;
 cartPageItems.appendChild(row);
 });
 };

 window.addToCartFromPage = (product) => {
 console.log('Adding to cart (page):', product);
 cart.push(product);
 updateCartUI();
 if (typeof Toastify !== 'undefined') {
 Toastify({ text:"Səbətə əlavə edildi!", backgroundColor:"#10b981" }).showToast();
 }
 };

 window.removeFromCart = (index) => {
 cart.splice(index, 1);
 updateCartUI();
 };

 window.clearCart = () => {
 cart = [];
 updateCartUI();
 };

 window.addToCart = (product) => {
 console.log('Adding to cart (card):', product);
 cart.push(product);
 updateCartUI();
 if (typeof Toastify !== 'undefined') {
 Toastify({ text:"Səbətə əlavə edildi!", backgroundColor:"#10b981" }).showToast();
 } else {
 console.error('Toastify is not defined!');
 }
 };

 window.addToCartFromAttr = (el) => {
 const product = {
 id: el.getAttribute('data-id'),
 name: el.getAttribute('data-name'),
 price: parseFloat(el.getAttribute('data-price')) || 0,
 img: el.getAttribute('data-img')
 };
 window.addToCart(product);
 };

 window.toggleWishlist = (prodId, btnElement) => {
 fetch('/wishlist/toggle', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ product_id: prodId })
 })
 .then(res => res.json())
 .then(data => {
 if (data.success) {
 const icon = btnElement ? btnElement.querySelector('i') : document.querySelector('.wishlist-btn i');
 if (data.action === 'added') {
 if (icon) {
 icon.classList.remove('ri-heart-line');
 icon.classList.add('ri-heart-fill');
 icon.style.color = '#ef4444';
 }
 Toastify({ text:"İstək listəsinə əlavə edildi!", backgroundColor:"#10b981" }).showToast();
 } else {
 if (icon) {
 icon.classList.remove('ri-heart-fill');
 icon.classList.add('ri-heart-line');
 icon.style.color = 'inherit';
 }
 Toastify({ text:"İstək listəsindən çıxarıldı!", backgroundColor:"#64748b" }).showToast();
 }
 } else {
 if (data.error === 'Login olun') window.location.href = '/login';
 }
 });
 };

 if (cartTrigger) cartTrigger.onclick = () => { window.location.href = '/cart'; };
 if (clearCartBtn) clearCartBtn.onclick = () => window.clearCart();

 // Initial UI load
 updateCartUI();

 // --- Hero Slider (Swiper) ---
 const sliderContainer = document.querySelector('.hero-swiper');
 const sliders = sliderContainer ? sliderContainer.querySelectorAll('.slider-item') : [];

 if (sliderContainer && sliders.length > 1 && window.Swiper) {
 const hasPrev = !!document.getElementById('sliderPrev');
 const hasNext = !!document.getElementById('sliderNext');
 const hasDots = !!document.getElementById('sliderDots');
 const swiperOptions = {
 loop: true,
 speed: 450,
 autoplay: {
 delay: 5000,
 disableOnInteraction: false
 }
 };
 if (hasPrev && hasNext) {
 swiperOptions.navigation = { prevEl: '#sliderPrev', nextEl: '#sliderNext' };
 }
 if (hasDots) {
 swiperOptions.pagination = {
 el: '#sliderDots',
 clickable: true,
 renderBullet: function (index, className) {
 return `<button type="button" class="slider-dot ${className}" aria-label="Banner ${index + 1}"></button>`;
 }
 };
 }
 new Swiper('.hero-swiper', swiperOptions);
 }

 sliders.forEach((slide) => {
 const link = (slide.getAttribute('data-link') || '').trim();
 const hasLink = slide.getAttribute('data-has-link') === 'true' && link && link !== '#';
 if (!hasLink) return;

 slide.addEventListener('click', (event) => {
 if (event.target.closest('.slider-controls') || event.target.closest('a')) return;
 window.location.href = link;
 });
 });

 // --- Category quick actions horizontal scroll controls ---
 const quickIconsRow = document.getElementById('quickIconsRow');
 const quickIconsPrev = document.querySelector('.quick-icons-prev');
 const quickIconsNext = document.querySelector('.quick-icons-next');

 if (quickIconsRow && quickIconsPrev && quickIconsNext) {
 const scrollStep = () => Math.max(220, Math.round(quickIconsRow.clientWidth * 0.7));
 const updateQuickIconsButtons = () => {
 const maxScrollLeft = Math.max(0, quickIconsRow.scrollWidth - quickIconsRow.clientWidth);
 const hasOverflow = maxScrollLeft > 5;

 quickIconsPrev.classList.toggle('is-hidden', !hasOverflow);
 quickIconsNext.classList.toggle('is-hidden', !hasOverflow);

 quickIconsPrev.disabled = !hasOverflow || quickIconsRow.scrollLeft <= 2;
 quickIconsNext.disabled = !hasOverflow || quickIconsRow.scrollLeft >= (maxScrollLeft - 2);
 };

 quickIconsPrev.addEventListener('click', () => {
 quickIconsRow.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
 });
 quickIconsNext.addEventListener('click', () => {
 quickIconsRow.scrollBy({ left: scrollStep(), behavior: 'smooth' });
 });

 quickIconsRow.addEventListener('scroll', updateQuickIconsButtons, { passive: true });
 window.addEventListener('resize', updateQuickIconsButtons);
 updateQuickIconsButtons();
 }

 // --- Working Hours Popup (only off-hours: 00:00 – 07:00) ---
 (function showWorkingHoursPopup() {
 const hour = new Date().getHours();
 const isOffHours = (hour >= 0 && hour < 7);

 // Only show popup during off-hours
 if (!isOffHours) return;
 if (sessionStorage.getItem('azpin_hours_shown')) return;
 sessionStorage.setItem('azpin_hours_shown', '1');

 const overlay = document.createElement('div');
 overlay.className = 'hours-popup-overlay';
 overlay.innerHTML = `
 <div class="hours-popup-box">
 <div class="hours-popup-header">
 <div class="hours-popup-status">
 <span class="status-dot offline"></span>
 <span>İş saatlarından kənar</span>
 </div>
 <button class="hours-popup-close" onclick="this.closest('.hours-popup-overlay').remove()">&times;</button>
 </div>
 <div class="hours-popup-body">
 <div class="hours-popup-icon-wrap">
 <i class="ri-time-line"></i>
 </div>
 <h3 class="hours-popup-title">Hörmətli müştərimiz!</h3>
 <p class="hours-popup-msg">Hazırda iş saatlarımız bitib. Verdiyiniz sifarişlər <strong>səhər saatlarında</strong> emal edilərək təhvil veriləcək.</p>
 <div class="hours-popup-schedule">
 <div class="schedule-row">
 <i class="ri-time-line"></i>
 <span>İş saatları: <strong>07:00 – 00:00</strong></span>
 </div>
 <div class="schedule-row">
 <i class="ri-customer-service-2-line"></i>
 <span>Dəstək: <a href="/tickets">Texniki Dəstək</a></span>
 </div>
 </div>
 </div>
 <div class="hours-popup-footer">
 <button class="hours-popup-btn" onclick="this.closest('.hours-popup-overlay').remove()">Anladım, davam et</button>
 </div>
 </div>
 `;
 document.body.appendChild(overlay);

 overlay.addEventListener('click', (e) => {
 if (e.target === overlay) overlay.remove();
 });
 })();

 console.log('AZPINX Scripts Loaded');
});
