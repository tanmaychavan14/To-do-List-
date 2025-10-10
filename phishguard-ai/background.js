/*
 PhishGuard AI - Background Service Worker (Manifest V3)

 Handles communication between popup and content scripts and integrates with
 the backend phishing detection API at /api/scan.

 Linking to your backend API:
 - Set the API Base URL and API Key in the Options page (PhishGuard AI → Extension options).
 - Or pre-populate defaults below during your build using environment variables.
   NOTE: Do not rely on keeping secrets in extensions. Users can inspect source.
*/

const DEFAULT_SETTINGS = {
  apiBaseUrl: 'http://localhost:8000', // e.g., https://your-backend.tld
  apiKey: '', // Optional. If set, sent as Authorization: Bearer <apiKey>
  threshold: 0.7,
};

/**
 * In-memory cache of the latest scan result by URL for quick retrieval.
 * Shape: { url, score, label, details }
 */
const lastScansByUrl = new Map();

async function getSettings() {
  const stored = await chrome.storage.local.get(['phishguard_settings']);
  return Object.assign({}, DEFAULT_SETTINGS, stored.phishguard_settings || {});
}

async function saveSettings(newSettings) {
  const merged = Object.assign({}, await getSettings(), newSettings);
  await chrome.storage.local.set({ phishguard_settings: merged });
  return merged;
}

chrome.runtime.onInstalled.addListener(async () => {
  await saveSettings({});
});

function labelFromScore(score) {
  if (score > 0.7) return 'malicious';
  if (score >= 0.3) return 'suspicious';
  return 'safe';
}

async function scanUrl(url) {
  const settings = await getSettings();
  const endpoint = `${settings.apiBaseUrl.replace(/\/$/, '')}/api/scan`;
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (settings.apiKey) headers['Authorization'] = `Bearer ${settings.apiKey}`;

  let responseData = null;

  // Prefer POST
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    if (resp.ok) {
      responseData = await resp.json();
    } else {
      try { responseData = await resp.json(); } catch (_) {}
    }
  } catch (_) {
    // fall through to GET retry
  }

  // Fallback GET with query string
  if (!responseData) {
    try {
      const resp = await fetch(`${endpoint}?url=${encodeURIComponent(url)}`, { headers });
      if (resp.ok) responseData = await resp.json();
    } catch (_) {}
  }

  if (!responseData || typeof responseData.score !== 'number') {
    responseData = { score: 0.0, label: 'unknown', details: { error: 'Scan failed or invalid response' } };
  }

  const normalized = {
    url,
    score: responseData.score,
    label: responseData.label || labelFromScore(responseData.score),
    details: responseData.details || {},
  };

  lastScansByUrl.set(url, normalized);

  // Notify any content scripts on tabs with this URL
  try {
    const tabs = await chrome.tabs.query({ url });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'SCAN_RESULT', payload: normalized });
    }
  } catch (_) {}

  return normalized;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case 'SCAN_URL': {
        const url = message.url || sender?.tab?.url;
        if (!url) return sendResponse({ error: 'No URL provided' });
        const result = await scanUrl(url);
        sendResponse({ result });
        break;
      }
      case 'GET_LAST_SCAN': {
        const url = message.url || sender?.tab?.url;
        if (!url) return sendResponse({ error: 'No URL provided' });
        const result = lastScansByUrl.get(url) || null;
        sendResponse({ result });
        break;
      }
      case 'GET_ACTIVE_TAB_URL': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ url: tab?.url ?? null });
        break;
      }
      case 'GET_SETTINGS': {
        const settings = await getSettings();
        sendResponse({ settings });
        break;
      }
      case 'SAVE_SETTINGS': {
        const settings = await saveSettings(message.settings || {});
        sendResponse({ settings });
        break;
      }
      case 'GET_SCAN_DETAILS': {
        const url = message.url || sender?.tab?.url;
        const result = lastScansByUrl.get(url) || null;
        sendResponse({ details: result?.details || null, result });
        break;
      }
      case 'OPEN_REPORT': {
        const encoded = encodeURIComponent(message.url || sender?.tab?.url || '');
        const reportUrl = chrome.runtime.getURL(`report.html?url=${encoded}`);
        await chrome.tabs.create({ url: reportUrl });
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // keep message channel open for async responses
});
