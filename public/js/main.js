document.addEventListener('DOMContentLoaded', () => {
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

 // --- Slider Logic (Enhanced) ---
 const sliders = document.querySelectorAll('.slider-item');
 const sliderPrev = document.getElementById('sliderPrev');
 const sliderNext = document.getElementById('sliderNext');
 const sliderDots = document.querySelectorAll('.slider-dot');

 if (sliders.length > 1) {
 let current = 0;
 let sliderTimer = null;

 const setSlide = (index) => {
 current = (index + sliders.length) % sliders.length;
 sliders.forEach((slide, i) => {
 slide.classList.toggle('active', i === current);
 });
 sliderDots.forEach((dot, i) => {
 const isActive = i === current;
 dot.classList.toggle('active', isActive);
 dot.setAttribute('aria-current', isActive ? 'true' : 'false');
 });
 };

 const startAuto = () => {
 if (sliderTimer) clearInterval(sliderTimer);
 sliderTimer = setInterval(() => {
 setSlide(current + 1);
 }, 6000);
 };

 sliderPrev && sliderPrev.addEventListener('click', () => {
 setSlide(current - 1);
 startAuto();
 });

 sliderNext && sliderNext.addEventListener('click', () => {
 setSlide(current + 1);
 startAuto();
 });

 sliderDots.forEach((dot) => {
 dot.addEventListener('click', () => {
 const index = Number(dot.getAttribute('data-slide-index'));
 if (!Number.isNaN(index)) {
 setSlide(index);
 startAuto();
 }
 });
 });

 setSlide(0);
 startAuto();
 }

 // --- Working Hours Popup (only off-hours: 00:00 – 12:00) ---
 (function showWorkingHoursPopup() {
 const hour = new Date().getHours();
 const isOffHours = (hour >= 0 && hour < 12);

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
 <span>İş saatları: <strong>12:00 – 00:00</strong></span>
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
