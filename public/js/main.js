document.addEventListener('DOMContentLoaded', () => {
    // Select elements
    const cartSidebar = document.getElementById('cartSidebar');
    const cartTrigger = document.getElementById('cartTrigger');
    const closeCart = document.getElementById('closeCart');
    const cartItemsList = document.getElementById('cartItemsList');
    const cartTotal = document.getElementById('cartTotal');
    const cartCount = document.querySelector('.cart-count');

    let cart = JSON.parse(localStorage.getItem('azpin_cart')) || [];

    // --- Global Cart Logic ---
    const updateCartUI = () => {
        if (!cartItemsList) return; // Cart might not be on all pages if we didn't include partials everywhere

        cartItemsList.innerHTML = '';
        let total = 0;
        let count = 0;

        cart.forEach((item, index) => {
            total += item.price;
            count++;

            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <div class="cart-item-img">
                    <img src="${item.img}" alt="${item.name}">
                </div>
                <div class="cart-item-info">
                    <h5>${item.name}</h5>
                    <span>${item.price.toFixed(2)} AZN</span>
                </div>
                <div class="modal-close" onclick="removeFromCart(${index})" style="position: static; box-shadow: none; font-size: 12px; height: 24px; width: 24px;">
                    <i class="fa-solid fa-trash"></i>
                </div>
            `;
            cartItemsList.appendChild(itemEl);
        });

        if (cartTotal) cartTotal.textContent = `${total.toFixed(2)} AZN`;
        if (cartCount) cartCount.textContent = count;
        localStorage.setItem('azpin_cart', JSON.stringify(cart));
    };

    window.addToCartFromPage = (product) => {
        console.log('Adding to cart (page):', product);
        cart.push(product);
        updateCartUI();
        openCartSidebar();
    };

    window.removeFromCart = (index) => {
        cart.splice(index, 1);
        updateCartUI();
    };

    const openCartSidebar = () => cartSidebar && cartSidebar.classList.add('active');
    const closeCartSidebar = () => cartSidebar && cartSidebar.classList.remove('active');

    window.addToCart = (product) => {
        console.log('Adding to cart (card):', product);
        cart.push(product);
        updateCartUI();
        if (typeof Toastify !== 'undefined') {
            Toastify({ text: "Səbətə əlavə edildi!", backgroundColor: "#10b981" }).showToast();
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
                            icon.classList.replace('fa-regular', 'fa-solid');
                            icon.style.color = '#ef4444';
                        }
                        Toastify({ text: "İstək listəsinə əlavə edildi!", backgroundColor: "#10b981" }).showToast();
                    } else {
                        if (icon) {
                            icon.classList.replace('fa-solid', 'fa-regular');
                            icon.style.color = 'inherit';
                        }
                        Toastify({ text: "İstək listəsindən çıxarıldı!", backgroundColor: "#64748b" }).showToast();
                    }
                } else {
                    if (data.error === 'Login olun') window.location.href = '/login';
                }
            });
    };

    if (cartTrigger) cartTrigger.onclick = openCartSidebar;
    if (closeCart) closeCart.onclick = closeCartSidebar;

    // Initial UI load
    updateCartUI();

    // --- Slider Logic (Maintain original) ---
    const sliders = document.querySelectorAll('.slider-item');
    if (sliders.length > 1) {
        let current = 0;
        setInterval(() => {
            sliders[current].style.display = 'none';
            current = (current + 1) % sliders.length;
            sliders[current].style.display = 'flex';
        }, 5000);
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
                        <i class="fa-solid fa-clock"></i>
                    </div>
                    <h3 class="hours-popup-title">Hörmətli müştərimiz!</h3>
                    <p class="hours-popup-msg">Hazırda iş saatlarımız bitib. Verdiyiniz sifarişlər <strong>səhər saatlarında</strong> emal edilərək təhvil veriləcək.</p>
                    <div class="hours-popup-schedule">
                        <div class="schedule-row">
                            <i class="fa-regular fa-clock"></i>
                            <span>İş saatları: <strong>12:00 – 00:00</strong></span>
                        </div>
                        <div class="schedule-row">
                            <i class="fa-solid fa-headset"></i>
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
