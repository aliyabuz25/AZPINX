(function () {
    const splash = document.getElementById('azpin-splash');
    if (!splash) return;

    const splashInner = splash.querySelector('.azpin-splash-inner');
    const minimumVisibleMs = 260;
    const startedAt = Date.now();

    function hideSplash() {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, minimumVisibleMs - elapsed);

        window.setTimeout(() => {
            if (window.gsap) {
                gsap.to(splash, {
                    opacity: 0,
                    duration: 0.32,
                    ease: 'power2.out',
                    onComplete: () => splash.classList.add('is-hidden')
                });
                if (splashInner) {
                    gsap.fromTo(
                        splashInner,
                        { scale: 1, opacity: 1 },
                        { scale: 0.92, opacity: 0.88, duration: 0.32, ease: 'power2.out' }
                    );
                }
            } else {
                splash.classList.add('is-hidden');
            }
        }, wait);
    }

    function isInternalLink(anchor) {
        if (!anchor || !anchor.href) return false;
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return false;
        if (url.pathname === window.location.pathname && url.hash) return false;
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('#') || href.startsWith('javascript:')) return false;
        if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
        if (anchor.hasAttribute('download')) return false;
        if (anchor.target && anchor.target !== '_self') return false;
        return true;
    }

    function leaveWithSplash(nextUrl) {
        if (document.body.classList.contains('is-page-leaving')) return;

        document.body.classList.add('is-page-leaving');
        splash.classList.remove('is-hidden');
        splash.style.opacity = '1';
        splash.style.visibility = 'visible';

        if (window.gsap) {
            gsap.fromTo(splash, { opacity: 0 }, { opacity: 1, duration: 0.26, ease: 'power2.inOut' });
            if (splashInner) {
                gsap.fromTo(
                    splashInner,
                    { scale: 0.9, opacity: 0.7 },
                    { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }
                );
            }
        }

        window.setTimeout(() => {
            window.location.href = nextUrl;
        }, 260);
    }

    if (document.readyState === 'complete') {
        hideSplash();
    } else {
        window.addEventListener('load', hideSplash, { once: true });
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            splash.classList.add('is-hidden');
            document.body.classList.remove('is-page-leaving');
        }
    });

    document.addEventListener('click', (event) => {
        const anchor = event.target.closest('a[href]');
        if (!isInternalLink(anchor)) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        leaveWithSplash(anchor.href);
    });
})();
