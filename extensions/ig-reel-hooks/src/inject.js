// Runs in the page's own JS world (MAIN). Instagram already downloads Reel and
// profile data as you scroll; we copy those responses and hand them to the
// content script. Nothing extra is requested from Instagram.
(() => {
  const SOURCE = 'igrh-capture';
  const INTERESTING = /\/graphql|\/api\/v1\//;

  const post = (url, body) => {
    window.postMessage({ source: SOURCE, url, body }, window.location.origin);
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      if (INTERESTING.test(url)) {
        res.clone().text().then((text) => post(url, text)).catch(() => {});
      }
    } catch (_) {
      // Never break Instagram's own requests.
    }
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__igrhUrl = String(url);
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    if (this.__igrhUrl && INTERESTING.test(this.__igrhUrl)) {
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') {
            post(this.__igrhUrl, this.responseText);
          } else if (this.responseType === 'json' && this.response) {
            post(this.__igrhUrl, JSON.stringify(this.response));
          }
        } catch (_) {
          // Ignore unreadable responses.
        }
      });
    }
    return origSend.apply(this, args);
  };
})();
