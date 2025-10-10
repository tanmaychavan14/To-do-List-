/* PhishGuard AI - Popup UI */

function getColorClass(score) {
  if (score > 0.7) return 'malicious';
  if (score >= 0.3) return 'suspicious';
  return 'safe';
}

function formatScore(score) {
  if (typeof score !== 'number') return '—';
  return `${Math.round(score * 100)}%`;
}

async function getActiveTabUrl() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB_URL' }, (resp) => resolve(resp?.url || null));
  });
}

async function getLastScan(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_LAST_SCAN', url }, (resp) => resolve(resp?.result || null));
  });
}

async function scanUrl(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'SCAN_URL', url }, (resp) => resolve(resp?.result || null));
  });
}

async function openReport(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'OPEN_REPORT', url }, (resp) => resolve(resp));
  });
}

function setStatus(score, label) {
  const labelEl = document.getElementById('status-label');
  const scoreEl = document.getElementById('status-score');
  const dotEl = document.getElementById('status-dot');
  const barEl = document.getElementById('confidence-bar');

  const cls = getColorClass(score ?? -1);
  labelEl.textContent = label ? label.toUpperCase() : 'UNKNOWN';
  labelEl.className = `value ${cls}`;
  scoreEl.textContent = formatScore(score);

  const pct = Math.max(0, Math.min(100, Math.round((score || 0) * 100)));
  barEl.style.width = pct + '%';

  dotEl.style.background = cls === 'safe' ? '#10b981' : cls === 'suspicious' ? '#f59e0b' : cls === 'malicious' ? '#ef4444' : '#6b7280';
}

async function init() {
  const urlInput = document.getElementById('url-input');
  const scanBtn = document.getElementById('scan-btn');
  const detailsLink = document.getElementById('view-details');
  const optionsLink = document.getElementById('open-options');

  const activeUrl = await getActiveTabUrl();
  if (activeUrl) urlInput.value = activeUrl;

  const last = activeUrl ? await getLastScan(activeUrl) : null;
  if (last) setStatus(last.score, last.label);

  scanBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    setStatus(0, 'Scanning...');
    const result = await scanUrl(url);
    setStatus(result?.score, result?.label);
  });

  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') scanBtn.click();
  });

  detailsLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;
    await openReport(url);
  });

  optionsLink.addEventListener('click', async (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

document.addEventListener('DOMContentLoaded', init);
