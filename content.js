// Calm YouTube — swaps the home feed for a quiet search bar.
// Runs at document_start so the feed never flashes on screen.
(() => {
  'use strict';

  const KEY = 'calmyt:enabled';
  const root = document.documentElement;
  const ext = typeof browser !== 'undefined' ? browser : null;

  const FAVICON =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
      '<defs>' +
      '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#EB8D70"/>' +
      '<stop offset="1" stop-color="#B54F3B"/>' +
      '</linearGradient>' +
      '<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#fff" stop-opacity=".16"/>' +
      '<stop offset=".5" stop-color="#fff" stop-opacity="0"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect width="96" height="96" rx="26" fill="url(#g)"/>' +
      '<rect width="96" height="96" rx="26" fill="url(#s)"/>' +
      '<circle cx="42" cy="42" r="20" fill="none" stroke="#FFF6EE" stroke-width="9"/>' +
      '<path d="M57.5 57.5 73 73" stroke="#FFF6EE" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M37.5 34v16l12.5-8z" fill="#FFF6EE" stroke="#FFF6EE" stroke-width="4.5" stroke-linejoin="round"/>' +
      '</svg>'
    );

  const readEnabled = () => {
    try {
      return localStorage.getItem(KEY) !== '0';
    } catch {
      return true;
    }
  };
  const writeEnabled = (v) => {
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {}
  };

  let enabled = readEnabled();
  let ui = null;
  let lastHref = '';

  const isHome = () => location.pathname === '/';
  const isCalm = () => enabled && isHome();

  // ---------- DOM helpers ----------

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    for (const c of children) el.append(c);
    return el;
  }
  function svg(viewBox, paths, cls) {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('aria-hidden', 'true');
    if (cls) s.setAttribute('class', cls);
    for (const attrs of paths) {
      const p = document.createElementNS(SVG_NS, attrs.tag || 'path');
      for (const [k, v] of Object.entries(attrs)) if (k !== 'tag') p.setAttribute(k, v);
      s.append(p);
    }
    return s;
  }

  const loupe = () =>
    svg('0 0 24 24', [
      { tag: 'circle', cx: '10.5', cy: '10.5', r: '6.5' },
      { d: 'M15.5 15.5 20 20' },
    ], 'calmyt-loupe');

  const greeting = () => {
    const hr = new Date().getHours();
    if (hr < 5) return 'Good night';
    if (hr < 12) return 'Good morning';
    if (hr < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // ---------- UI ----------

  // Places you chose to go — not places chosen for you.
  const LINKS = [
    ['Subscriptions', '/feed/subscriptions'],
    ['Watch later', '/playlist?list=WL'],
    ['History', '/feed/history'],
  ];

  function buildUI() {
    const input = h('input', {
      id: 'calmyt-q',
      type: 'text',
      name: 'search_query',
      placeholder: 'Search',
      autocomplete: 'off',
      spellcheck: 'false',
      enterkeyhint: 'search',
      'aria-label': 'Search YouTube',
    });

    const form = h(
      'form',
      { id: 'calmyt-form', role: 'search', action: '/results', method: 'get' },
      h('p', { class: 'calmyt-greeting' }, greeting()),
      h('div', { class: 'calmyt-field' },
        h('div', { class: 'calmyt-box' }, loupe(), input),
        h('button', { class: 'calmyt-submit', type: 'submit', title: 'Search', 'aria-label': 'Search' }, loupe())),
      h('p', { class: 'calmyt-hint', 'aria-hidden': 'true' },
        h('span', { class: 'calmyt-hint-idle' }, 'just start typing'),
        h('span', { class: 'calmyt-hint-ready' }, 'press ', h('kbd', {}, 'enter'), ' to search')),
      h('nav', { class: 'calmyt-links', 'aria-label': 'Your library' },
        ...LINKS.map(([label, href]) => h('a', { href }, label)))
    );

    const overlay = h('div', { id: 'calmyt-overlay' }, form);

    const toggleLabel = h('span', { class: 'calmyt-toggle-label' });
    const toggle = h(
      'button',
      { id: 'calmyt-toggle', type: 'button' },
      h('span', { class: 'calmyt-toggle-dot', 'aria-hidden': 'true' }),
      toggleLabel
    );

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) {
        form.classList.remove('calmyt-nudge');
        void form.offsetWidth; // restart animation
        form.classList.add('calmyt-nudge');
        input.focus();
        return;
      }
      form.classList.add('calmyt-leaving');
      location.assign('/results?search_query=' + encodeURIComponent(q).replace(/%20/g, '+'));
    });

    // Keep YouTube's global shortcuts from reacting while typing here.
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        if (input.value) input.value = '';
        else input.blur();
      }
    });

    toggle.addEventListener('click', () => setEnabled(!enabled));

    return { overlay, form, input, toggle, toggleLabel };
  }

  function mount() {
    if (!document.body) return false;
    if (!ui) ui = buildUI();
    if (!ui.overlay.isConnected) document.body.append(ui.overlay);
    if (!ui.toggle.isConnected) document.body.append(ui.toggle);
    return true;
  }

  // ---------- favicon ----------

  function swapFavicon(on) {
    const head = document.head;
    if (!head) return;
    for (const link of head.querySelectorAll('link[rel~="icon"]')) {
      if (link.id === 'calmyt-favicon') continue;
      if (on) {
        if (!link.dataset.calmytHref) link.dataset.calmytHref = link.href;
        if (link.href !== FAVICON) link.href = FAVICON;
      } else if (link.dataset.calmytHref) {
        link.href = link.dataset.calmytHref;
        delete link.dataset.calmytHref;
      }
    }
    let ours = document.getElementById('calmyt-favicon');
    if (on && !ours) {
      ours = h('link', { id: 'calmyt-favicon', rel: 'icon', type: 'image/svg+xml', href: FAVICON });
      head.append(ours);
    } else if (!on && ours) {
      ours.remove();
    }
  }

  // ---------- state ----------

  function render() {
    const home = isHome();
    const calm = isCalm();

    if (home) root.setAttribute('data-calmyt', calm ? 'on' : 'off');
    else root.removeAttribute('data-calmyt');

    swapFavicon(calm);

    if (ui) {
      ui.toggleLabel.textContent = calm ? 'Show feed' : 'Calm mode';
      ui.toggle.title = calm
        ? 'Show the regular YouTube home page'
        : 'Hide recommendations and show a simple search bar';
      ui.toggle.setAttribute('aria-pressed', String(calm));
      ui.overlay.setAttribute('aria-hidden', String(!calm));
      ui.overlay.inert = !calm;
      ui.form.classList.remove('calmyt-leaving');
    }

    ext?.runtime.sendMessage({ type: 'calmyt:state', calm, home }).catch(() => {});
  }

  function focusSearch() {
    if (!ui || !isCalm()) return;
    // YouTube likes to grab focus while it boots; ask twice.
    ui.input.focus({ preventScroll: true });
    requestAnimationFrame(() => isCalm() && ui.input.focus({ preventScroll: true }));
  }

  function setEnabled(v) {
    enabled = v;
    writeEnabled(v);
    render();
    if (isCalm()) {
      window.scrollTo(0, 0);
      focusSearch();
    }
  }

  function onRoute() {
    if (location.href === lastHref) return;
    const wasCalm = root.getAttribute('data-calmyt') === 'on';
    lastHref = location.href;
    render();
    if (isCalm() && !wasCalm) {
      if (ui) {
        ui.input.value = '';
        ui.form.querySelector('.calmyt-greeting').textContent = greeting();
      }
      focusSearch();
    }
  }

  // ---------- wiring ----------

  render(); // as early as possible: hides the feed before first paint

  const boot = () => {
    if (!mount()) return;
    lastHref = '';
    onRoute();
    focusSearch();
  };
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });

  // YouTube is a single-page app: watch its navigation events plus a cheap fallback poll.
  for (const evt of ['yt-navigate-finish', 'yt-page-data-updated', 'popstate']) {
    window.addEventListener(evt, onRoute);
    document.addEventListener(evt, onRoute);
  }
  setInterval(() => {
    onRoute();
    if (ui && document.body && (!ui.overlay.isConnected || !ui.toggle.isConnected)) mount();
    if (isCalm()) swapFavicon(true); // YouTube occasionally rewrites its icon links
  }, 500);

  // Type anywhere on the calm page to start searching.
  window.addEventListener(
    'keydown',
    (e) => {
      if (!ui || !isCalm() || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const editable =
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (editable) return;
      if (e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        focusSearch();
      } else if (e.key.length === 1 && e.key !== ' ') {
        e.stopPropagation();
        ui.input.focus({ preventScroll: true }); // the keystroke lands in the input
      }
    },
    true
  );

  // Keep tabs in sync when toggled elsewhere.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    enabled = readEnabled();
    render();
  });

  // Toolbar button / keyboard shortcut.
  ext?.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'calmyt:toolbar') return;
    if (isHome()) setEnabled(!enabled);
    else {
      if (!enabled) setEnabled(true);
      location.assign('/');
    }
  });
})();
