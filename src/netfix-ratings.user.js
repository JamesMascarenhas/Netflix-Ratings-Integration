// ==UserScript==
// @name         Netflix Ratings Integration (IMDb & RT)
// @namespace    netflix-ratings
// @version      2025-10-26
// @description  Show IMDb & Rotten Tomatoes ratings on Netflix title pages
// @author       James Mascarenhas
// @match        *://*.netflix.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      omdbapi.com
// ==/UserScript==

(function () {
  'use strict';

  // ---- CONFIG ----
  const OMDB_KEY = 'YOUR_OMDB_KEY';          // insert your own OMDb key here
  const BADGE    = 'nr-rating-badge';

  // jbv -> injected?
  const SEEN = new Map();

  GM_addStyle(`
    .${BADGE}{
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial;
      font-size:14px;color:#fff;background:rgba(0,0,0,.6);
      border:1px solid rgba(255,255,255,.15);border-radius:8px;
      padding:6px 10px;margin-top:10px;display:inline-flex;gap:10px
    }
  `);

  // Utilities 
  const getJBV = () => {
    const jbv = new URL(location.href).searchParams.get('jbv');
    return jbv && /^\d+$/.test(jbv) ? jbv : null;
  };

  const cleanTitle = (t) => t ? t.replace(/\s*-\s*Netflix$/i, '').trim() : null;

  // Prefer JSON-LD (exact), then og:title (stable), return {title, year, kind}
  function getStableTitleYearKind() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const arr = Array.isArray(data) ? data : [data];
        for (const it of arr) {
          if (it?.name) {
            const title = cleanTitle(it.name);
            const y = (it.datePublished || it.uploadDate || it.startDate || '').match(/\b(19|20)\d{2}\b/);
            const t = (it['@type'] || '').toString().toLowerCase();
            const kind = t.includes('tv') ? 'series' : (t.includes('movie') ? 'movie' : null);
            return { title, year: y ? y[0] : null, kind };
          }
        }
      } catch {}
    }
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const title = cleanTitle(og || document.title);
    return title ? { title, year: null, kind: null } : null;
  }

  // Where to mount: action row variants only
  function findActionRow() {
    return (
      document.querySelector('div.default-ltr-iqcdef-cache-vs9l2l.epdsfzu0') ||
      document.querySelector('div.billboard-links.button-layer.forward-leaning') ||
      document.querySelector('.previewModal--detailsContainer .button-layer') ||
      null
    );
  }

  function injectBadge(text) {
    const mount = findActionRow();
    if (!mount) return; 
    const old = mount.querySelector(`.${BADGE}`);
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = BADGE;
    box.textContent = text;
    mount.appendChild(box);
  }

  // Smart OMDb matching (title + year + type, with search fallback)
  function normTitle(s) {
    return (s || '').toLowerCase()
      .replace(/[’‘']/g, "'")
      .replace(/[^a-z0-9']+/g, ' ')
      .replace(/\b(the|a|an)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function pickBestMatch(queryTitle, year, kind, list) {
    const q = normTitle(queryTitle);
    let best = null, bestScore = -1;

    for (const it of list || []) {
      const t = normTitle(it.Title);
      let score = 0;

      if (t === q) score += 100;
      else if (t.includes(q) || q.includes(t)) score += 60;
      else {
        const qWords = new Set(q.split(' '));
        const overlap = t.split(' ').filter(w => qWords.has(w)).length;
        score += overlap;
      }

      if (year && it.Year && it.Year.startsWith(year)) score += 20;
      if (kind && it.Type && it.Type.toLowerCase() === kind) score += 15;

      if (score > bestScore) { bestScore = score; best = it; }
    }
    return best;
  }

  function fetchRatingsOnce(title, year, jbv, kind) {
    if (SEEN.get(jbv)) return;

    const direct = (t, y, k, cb) => {
      const url = `https://www.omdbapi.com/?t=${encodeURIComponent(t)}${y ? `&y=${y}` : ''}${k ? `&type=${k}` : ''}&apikey=${OMDB_KEY}`;
      GM_xmlhttpRequest({
        method: 'GET', url,
        onload: r => { try { const d = JSON.parse(r.responseText); cb(null, d.Response === 'True' ? d : null); } catch { cb(null, null); } },
        onerror: () => cb(null, null)
      });
    };

    const searchThenId = (t, y, k, cb) => {
      const url = `https://www.omdbapi.com/?s=${encodeURIComponent(t)}${k ? `&type=${k}` : ''}&apikey=${OMDB_KEY}`;
      GM_xmlhttpRequest({
        method: 'GET', url,
        onload: r => {
          try {
            const d = JSON.parse(r.responseText);
            if (d.Response !== 'True' || !Array.isArray(d.Search)) return cb(null, null);
            const best = pickBestMatch(t, y, k, d.Search);
            if (!best?.imdbID) return cb(null, null);
            const byId = `https://www.omdbapi.com/?i=${best.imdbID}&apikey=${OMDB_KEY}`;
            GM_xmlhttpRequest({
              method: 'GET', url: byId,
              onload: rr => { try { const dd = JSON.parse(rr.responseText); cb(null, dd.Response === 'True' ? dd : null); } catch { cb(null, null); } },
              onerror: () => cb(null, null)
            });
          } catch { cb(null, null); }
        },
        onerror: () => cb(null, null)
      });
    };

    const render = (d) => {
      const imdb = d.imdbRating && d.imdbRating !== 'N/A' ? `⭐ ${d.imdbRating}/10` : null;
      const rtObj = (d.Ratings || []).find(x => x.Source === 'Rotten Tomatoes');
      const rt = rtObj ? `🍅 ${rtObj.Value}` : null;
      const text = [imdb, rt].filter(Boolean).join('  |  ');
      if (text) { injectBadge(text); SEEN.set(jbv, true); }
    };

    // Try direct (with year/type)then search then direct without constraints
    direct(title, year, kind, (_e1, d1) => {
      if (d1) return render(d1);
      searchThenId(title, year, kind, (_e2, d2) => {
        if (d2) return render(d2);
        direct(title, null, null, (_e3, d3) => { if (d3) render(d3); });
      });
    });
  }

  // Navigation handling (SPA)
  function cleanupBadges() {
    document.querySelectorAll(`.${BADGE}`).forEach(n => n.remove());
  }

  function onUrlChange() {
    cleanupBadges();                 // remove any old badge
    const jbv = getJBV();
    if (!jbv) return;                // no modal/title open then do nothing

    // Small delay so <head> metadata settles
    setTimeout(() => {
      const info = getStableTitleYearKind();
      if (!info || !info.title) return;
      fetchRatingsOnce(info.title, info.year, jbv, info.kind);
    }, 250);
  }

  // Observe SPA URL changes
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onUrlChange();
    }
  }).observe(document, { childList: true, subtree: true });

  // Initial run
  onUrlChange();
})();
