/*
 PhishGuard AI - Content Script
 Monitors page URL and links, requests scans, and injects a warning banner when needed.
*/

const BannerIds = {
  container: 'phishguard-banner-container',
};

function removeBanner() {
  const container = document.getElementById(BannerIds.container);
  if (container) container.remove();
}

function ensureStyles() {
  if (document.getElementById('phishguard-style')) return;
  const style = document.createElement('style');
  style.id = 'phishguard-style';
  style.textContent = `
  @keyframes phishguard-slide-in { from { transform: translateY(-100%); } to { transform: translateY(0); } }
  #${BannerIds.container} {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 2147483647;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: #fff;
    background: #b91c1c; /* red-700 */
    border-bottom: 2px solid #7f1d1d; /* red-900 */
    animation: phishguard-slide-in 200ms ease-out;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  #${BannerIds.container} .pg-icon { font-size: 18px; }
  #${BannerIds.container} .pg-text { font-weight: 600; }
  #${BannerIds.container} .pg-close {
    margin-left: auto; cursor: pointer; background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25); color: #fff; border-radius: 6px;
    padding: 4px 8px; font-size: 12px;
  }
  `;
  document.documentElement.appendChild(style);
}

function injectBanner(result) {
  ensureStyles();
  removeBanner();
  const container = document.createElement('div');
  container.id = BannerIds.container;

  const icon = document.createElement('span');
  icon.className = 'pg-icon';
  icon.textContent = '⚠️';
  const text = document.createElement('span');
  text.className = 'pg-text';
  const scorePct = Math.round((result.score || 0) * 100);
  text.textContent = `Suspicious Site Detected (score ${scorePct}%)`;

  const close = document.createElement('button');
  close.className = 'pg-close';
  close.textContent = 'Dismiss';
  close.addEventListener('click', () => container.remove());

  container.appendChild(icon);
  container.appendChild(text);
  container.appendChild(close);

  document.documentElement.appendChild(container);
}

function handleScanResult(result, threshold) {
  if (!result) return;
  const isThreat = (result.score || 0) > (typeof threshold === 'number' ? threshold : 0.7);
  if (isThreat) injectBanner(result); else removeBanner();
}

async function requestScan(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SCAN_URL', url }, (resp) => {
      resolve(resp?.result || null);
    });
  });
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (resp) => resolve(resp?.settings));
  });
}

async function init() {
  const settings = await getSettings();
  const url = location.href;
  const result = await requestScan(url);
  handleScanResult(result, settings.threshold);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SCAN_RESULT' && message.payload?.url === location.href) {
      handleScanResult(message.payload, settings.threshold);
    }
  });

  // Monitor clicks on outgoing links and pre-scan their hrefs
  document.addEventListener('click', async (e) => {
    const anchor = e.target && (e.target.closest ? e.target.closest('a[href]') : null);
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    try {
      const absoluteUrl = new URL(href, location.href).toString();
      const res = await requestScan(absoluteUrl);
      handleScanResult(res, settings.threshold);
    } catch (_) {}
  }, true);
}

try { init(); } catch (_) {}
