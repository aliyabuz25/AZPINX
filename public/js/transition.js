(function () {
    const splash = document.getElementById('azpin-splash');
    if (!splash) return;

    const splashInner = splash.querySelector('.azpin-splash-inner');
    const stepsLayer = splash.querySelector('.azpin-steps');
    const minimumVisibleMs = 260;
    const startedAt = Date.now();
    let stepTimer = null;
    let stepIndex = 0;

    function createStep() {
        if (!stepsLayer) return;

        const step = document.createElement('span');
        const isLeft = stepIndex % 2 === 0;
        const baseX = 14 + (stepIndex % 12) * 6.4;
        const jitter = (Math.random() - 0.5) * 1.4;

        step.className = 'azpin-step ' + (isLeft ? 'left' : 'right');
        step.style.left = 'calc(' + (baseX + jitter) + '% - 10px)';
        step.style.bottom = (isLeft ? 10 : 2) + 'px';

        stepsLayer.appendChild(step);
        stepIndex += 1;

        window.setTimeout(() => {
            step.remove();
        }, 1300);
    }

    function startSteps() {
        if (!stepsLayer) return;
        stepsLayer.innerHTML = '';
        stepIndex = 0;
        createStep();
        stepTimer = window.setInterval(createStep, 120);
    }

    function stopSteps() {
        if (stepTimer) {
            window.clearInterval(stepTimer);
            stepTimer = null;
        }
        if (stepsLayer) {
            window.setTimeout(() => {
                stepsLayer.innerHTML = '';
            }, 380);
        }
    }

    function hideSplash() {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, minimumVisibleMs - elapsed);

        window.setTimeout(() => {
            stopSteps();
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
        startSteps();

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
        startSteps();
        hideSplash();
    } else {
        startSteps();
        window.addEventListener('load', hideSplash, { once: true });
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            stopSteps();
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
