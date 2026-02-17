(function () {
  const STORAGE_CURRENCY = 'azpin_currency';
  const STORAGE_RATES = 'azpin_fx_rates_v1';
  const SUPPORTED = ['AZN', 'TRY', 'USD'];
  const FALLBACK_RATES = { AZN: 1, TRY: 21, USD: 0.588235 };
  const PRICE_RE = /(\d+(?:[.,]\d{1,2})?)\s*(AZN|₼)\b/g;

  const originalTextMap = new WeakMap();
  const trackedTextNodes = new Set();

  const state = {
    currency: 'AZN',
    rates: { ...FALLBACK_RATES }
  };

  function detectDefaultCurrency() {
    const lang = String(navigator.language || '').toLowerCase();
    const tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (lang.startsWith('tr') || tz.includes('istanbul')) return 'TRY';
    if (lang.startsWith('az') || tz.includes('baku')) return 'AZN';
    return 'AZN';
  }

  function parseAmount(value) {
    const n = Number(String(value || '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : 0;
  }

  function formatAmount(value, currency) {
    const amount = Number(value || 0);
    const formatter = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${formatter.format(amount)} ${currency}`;
  }

  function convertFromAzn(amount, currency) {
    const base = Number(amount || 0);
    const rate = Number(state.rates[currency] || 1);
    return base * rate;
  }

  function convertTextFromAzn(originalText) {
    const raw = String(originalText || '');
    return raw.replace(PRICE_RE, (_, numberPart) => {
      const aznAmount = parseAmount(numberPart);
      const converted = convertFromAzn(aznAmount, state.currency);
      return formatAmount(converted, state.currency);
    });
  }

  function trackPriceTextNodes(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
        const text = String(node.nodeValue || '');
        if (!text || !PRICE_RE.test(text)) return NodeFilter.FILTER_REJECT;
        PRICE_RE.lastIndex = 0;

        const parent = node.parentElement;
        if (parent.closest('script,style,noscript,textarea,option,select')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-azn-value]')) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-no-currency-convert], .no-auto-currency')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let current;
    while ((current = walker.nextNode())) {
      if (!originalTextMap.has(current)) {
        originalTextMap.set(current, current.nodeValue || '');
      }
      trackedTextNodes.add(current);
    }
  }

  function applyDataAznNodes(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const nodes = scope.querySelectorAll('[data-azn-value]');
    nodes.forEach((node) => {
      const aznValue = parseAmount(node.getAttribute('data-azn-value'));
      const converted = convertFromAzn(aznValue, state.currency);
      node.textContent = formatAmount(converted, state.currency);
    });
  }

  function applyTrackedTextNodes() {
    trackedTextNodes.forEach((node) => {
      if (!node.isConnected) {
        trackedTextNodes.delete(node);
        return;
      }
      const original = originalTextMap.get(node);
      if (original === undefined) return;
      node.nodeValue = convertTextFromAzn(original);
    });
  }

  function applyAllPrices(root) {
    trackPriceTextNodes(root || document.body);
    applyDataAznNodes(root || document);
    applyTrackedTextNodes();
    window.dispatchEvent(new CustomEvent('azpin:currency-change', {
      detail: {
        currency: state.currency,
        rates: state.rates
      }
    }));
  }

  function normalizeRates(incoming) {
    const azn = Number(incoming?.AZN || 1);
    const tr = Number(incoming?.TRY || 0);
    const usd = Number(incoming?.USD || 0);
    if (azn <= 0 || tr <= 0 || usd <= 0) return null;
    return {
      AZN: 1,
      TRY: tr,
      USD: usd
    };
  }

  function loadCachedRates() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_RATES) || '{}');
      const normalized = normalizeRates(parsed?.rates || parsed);
      if (normalized) state.rates = normalized;
    } catch (e) {
      // Ignore corrupt cache
    }
  }

  async function refreshRates() {
    try {
      const response = await fetch('/api/fx-rates', { credentials: 'same-origin' });
      const payload = await response.json();
      const normalized = normalizeRates(payload?.rates);
      if (!normalized) return;
      state.rates = normalized;
      localStorage.setItem(STORAGE_RATES, JSON.stringify({ rates: normalized, updatedAt: Date.now() }));
      applyAllPrices(document.body);
    } catch (e) {
      // Keep fallback/cached rates
    }
  }

  function setCurrency(nextCurrency) {
    const chosen = SUPPORTED.includes(nextCurrency) ? nextCurrency : 'AZN';
    state.currency = chosen;
    localStorage.setItem(STORAGE_CURRENCY, chosen);
    const selector = document.getElementById('currencySelector');
    if (selector && selector.value !== chosen) selector.value = chosen;
    applyAllPrices(document.body);
  }

  function initSelector() {
    const selector = document.getElementById('currencySelector');
    if (!selector) return;
    selector.value = state.currency;
    selector.addEventListener('change', function () {
      setCurrency(this.value);
    });
  }

  function initObserver() {
    if (!document.body) return;
    let scheduled = false;
    const scheduleApply = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        applyAllPrices(document.body);
      });
    };

    const observer = new MutationObserver(() => scheduleApply());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadCachedRates();

    const storedCurrency = localStorage.getItem(STORAGE_CURRENCY);
    state.currency = SUPPORTED.includes(storedCurrency) ? storedCurrency : detectDefaultCurrency();

    initSelector();
    applyAllPrices(document.body);
    initObserver();
    refreshRates();
  });
})();
