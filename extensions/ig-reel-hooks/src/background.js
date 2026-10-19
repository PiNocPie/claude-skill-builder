// Stores captured Reels/profiles and opens the dashboard when the toolbar
// icon is clicked.
const now = () => new Date().toISOString();

// Captures can arrive several at once; chain writes so none overwrite another.
let writeChain = Promise.resolve();

function mergeFields(prev, next) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  }
  return out;
}

async function storeCapture({ reels = [], profiles = [] }) {
  const data = await chrome.storage.local.get(['reels', 'profiles']);
  const storedReels = data.reels || {};
  const storedProfiles = data.profiles || {};

  for (const r of reels) {
    const prev = storedReels[r.code];
    storedReels[r.code] = prev
      ? { ...mergeFields(prev, r), updatedAt: now() }
      : { ...r, capturedAt: now(), updatedAt: now() };
  }
  for (const p of profiles) {
    const prev = storedProfiles[p.username];
    storedProfiles[p.username] = { ...mergeFields(prev || {}, p), updatedAt: now() };
  }

  await chrome.storage.local.set({ reels: storedReels, profiles: storedProfiles });
  const count = Object.keys(storedReels).length;
  await chrome.action.setBadgeText({ text: count ? String(count) : '' });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'capture') {
    writeChain = writeChain.then(() => storeCapture(msg)).catch((err) => console.error('IGRH store failed', err));
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setBadgeBackgroundColor({ color: '#6d28d9' });
  const { reels } = await chrome.storage.local.get('reels');
  const count = Object.keys(reels || {}).length;
  await chrome.action.setBadgeText({ text: count ? String(count) : '' });
});
