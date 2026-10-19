// Isolated-world content script: receives responses copied by inject.js,
// extracts Reels/profiles, and sends them to the background worker to store.
(() => {
  const { parseBodies, extract, mightContainData } = globalThis.IGRH;
  const RESERVED = new Set(['explore', 'reel', 'reels', 'p', 'stories', 'direct', 'accounts', 'about', 'legal', 'tv']);

  // On /<username>/ or /<username>/reels/ we know whose page this is, which
  // fills in Reels whose payload left the owner out.
  function pageUsername() {
    const m = window.location.pathname.match(/^\/([A-Za-z0-9._]+)\/?(reels\/?)?$/);
    return m && !RESERVED.has(m[1]) ? m[1] : null;
  }

  function send(docs) {
    if (!docs.length) return;
    const { reels, profiles } = extract(docs);
    if (!reels.length && !profiles.length) return;
    const fallback = pageUsername();
    for (const r of reels) if (!r.username && fallback) r.username = fallback;
    chrome.runtime.sendMessage({ type: 'capture', reels, profiles }).catch(() => {
      // Extension was reloaded; this tab needs a refresh to reconnect.
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'igrh-capture') return;
    const { body } = event.data;
    if (!mightContainData(body)) return;
    send(parseBodies(body));
  });

  // The first page load ships its data inside <script type="application/json">
  // tags instead of a network response.
  function scanEmbedded() {
    const docs = [];
    for (const el of document.querySelectorAll('script[type="application/json"]')) {
      const text = el.textContent;
      if (mightContainData(text)) docs.push(...parseBodies(text));
    }
    send(docs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanEmbedded, { once: true });
  } else {
    scanEmbedded();
  }
})();
