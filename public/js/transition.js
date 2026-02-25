(function () {
    const splash = document.getElementById('azpin-splash');
    if (!splash) return;

    const splashInner = splash.querySelector('.azpin-splash-inner');
    const splashLogo = splash.querySelector('.azpin-splash-logo');
    const minimumVisibleMs = 520;
    const maxVisibleMs = 4500;
    const startedAt = Date.now();
    let hideStarted = false;
    let hidden = false;

    function forceHideSplash() {
        hidden = true;
        hideStarted = true;
        splash.classList.add('is-hidden');
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        splash.style.pointerEvents = 'none';
        document.body.classList.remove('is-page-leaving');
    }

    function hideSplash() {
        if (hidden || hideStarted) return;
        hideStarted = true;
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, minimumVisibleMs - elapsed);

        window.setTimeout(() => {
            if (hidden) return;
            if (window.gsap) {
                const pulseTarget = splashLogo || splashInner;
                try {
                    const tl = gsap.timeline({
                        onComplete: () => {
                            if (hidden) return;
                            gsap.to(splash, {
                                opacity: 0,
                                duration: 0.28,
                                ease: 'power2.out',
                                onComplete: forceHideSplash
                            });
                            if (splashInner) {
                                gsap.to(splashInner, { scale: 0.98, opacity: 0.92, duration: 0.28, ease: 'power2.out' });
                            }
                        }
                    });

                    if (pulseTarget) {
                        tl.to(pulseTarget, { scale: 1.08, duration: 0.14, ease: 'sine.out' })
                            .to(pulseTarget, { scale: 1, duration: 0.14, ease: 'sine.inOut' })
                            .to(pulseTarget, { scale: 1.08, duration: 0.14, ease: 'sine.out' })
                            .to(pulseTarget, { scale: 1, duration: 0.14, ease: 'sine.inOut' });
                    } else {
                        forceHideSplash();
                    }
                } catch (err) {
                    forceHideSplash();
                }
            } else {
                forceHideSplash();
            }
        }, wait);

        // Absolute failsafe: never keep splash forever
        window.setTimeout(forceHideSplash, maxVisibleMs);
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
            gsap.fromTo(splash, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power2.inOut' });
            if (splashInner) {
                gsap.fromTo(
                    splashInner,
                    { scale: 0.95, opacity: 0.8 },
                    { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' }
                );
            }
        }

        window.setTimeout(() => {
            window.location.href = nextUrl;
        }, 210);
    }

    if (document.readyState === 'complete') {
        hideSplash();
    } else {
        window.addEventListener('load', hideSplash, { once: true });
        document.addEventListener('DOMContentLoaded', hideSplash, { once: true });
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            forceHideSplash();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') hideSplash();
    });

    document.addEventListener('click', (event) => {
        const anchor = event.target.closest('a[href]');
        if (!isInternalLink(anchor)) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();
        leaveWithSplash(anchor.href);
    });
})();
