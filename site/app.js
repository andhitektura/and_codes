import MiniSearch from './vendor/minisearch.js';

// ---------- small helpers ----------

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6zM12 13v8"/></svg>',
  tree: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 12h10"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
};

// Session memory: sessionStorage lives as long as the browser tab. Falls back
// to memory when storage is blocked (private mode, embedded previews).
const memory = {};
const session = {
  get(key, def) {
    try { const v = sessionStorage.getItem('and_codes.' + key); if (v != null) return JSON.parse(v); } catch (e) { /* blocked */ }
    return key in memory ? memory[key] : def;
  },
  set(key, value) {
    memory[key] = value;
    try { sessionStorage.setItem('and_codes.' + key, JSON.stringify(value)); } catch (e) { /* blocked */ }
  },
};
const local = {
  get(key) { try { return localStorage.getItem('and_codes.' + key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem('and_codes.' + key, value); } catch (e) { /* blocked */ } },
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// ---------- data ----------

const index = await fetch('data/index.json').then((r) => r.json());
const notes = index.notes;
const noteIdx = new Map(notes.map((n, i) => [n.s, i]));
const outAdj = new Map();
const inAdj = new Map();
const order = new Map();
const addTo = (map, a, b) => { if (!map.has(a)) map.set(a, new Set()); map.get(a).add(b); };
for (const [a, b] of index.edges) { addTo(outAdj, a, b); addTo(inAdj, b, a); }
notes.forEach((n, i) => {
  order.set(n.s, i * 1e5);
  n.m.forEach((m, j) => order.set(`${n.s}#${m[0]}`, i * 1e5 + j + 1));
});

function split(k) {
  const i = k.indexOf('#');
  return i < 0 ? { slug: k, anchor: '' } : { slug: k.slice(0, i), anchor: k.slice(i + 1) };
}
const noteOf = (slug) => notes[noteIdx.get(slug)];
function memberOf(k) {
  const { slug, anchor } = split(k);
  const n = noteOf(slug);
  return n && anchor ? n.m.find((m) => m[0] === anchor) : null;
}
function labelOf(k) {
  const { slug } = split(k);
  const n = noteOf(slug);
  if (!n) return k;
  const m = memberOf(k);
  return m ? `${n.t} › ${m[1]}` : n.t;
}
function citationOf(k) {
  const n = noteOf(split(k).slug);
  const m = memberOf(k);
  const g = n?.f?.gazette;
  return `${n ? n.t : k}${m ? ', ' + m[1] : ''}${g ? ` (${g})` : ''}`;
}
const hrefOf = (k) => {
  const { slug, anchor } = split(k);
  return '#/' + encodeURIComponent(slug) + (anchor ? '/' + encodeURIComponent(anchor) : '');
};
const keysOfNote = (slug) => [slug, ...noteOf(slug).m.map((m) => `${slug}#${m[0]}`)];
const byOrder = (a, b) => (order.get(a) ?? 1e12) - (order.get(b) ?? 1e12);

/** Keys that k links to. For a whole note, its internal links are left out. */
function outgoing(k) {
  const { slug, anchor } = split(k);
  if (!noteIdx.has(slug)) return [];
  const sources = anchor ? [k] : keysOfNote(slug);
  const res = new Set();
  for (const s of sources) for (const t of outAdj.get(s) || []) res.add(t);
  res.delete(k);
  if (!anchor) for (const t of [...res]) if (split(t).slug === slug) res.delete(t);
  return [...res].sort(byOrder);
}
/** Keys that link to k. For a whole note, its internal links are left out. */
function incoming(k) {
  const { slug, anchor } = split(k);
  if (!noteIdx.has(slug)) return [];
  const targets = anchor ? [k] : keysOfNote(slug);
  const res = new Set();
  for (const t of targets) for (const s of inAdj.get(t) || []) res.add(s);
  res.delete(k);
  if (!anchor) for (const s of [...res]) if (split(s).slug === slug) res.delete(s);
  return [...res].sort(byOrder);
}

const noteCache = new Map();
function loadNote(slug) {
  if (!noteCache.has(slug)) {
    const i = noteIdx.get(slug);
    noteCache.set(slug, i == null ? Promise.resolve(null) : fetch(`data/notes/${i}.json`).then((r) => r.json()));
  }
  return noteCache.get(slug);
}
/** Sections to show for a key: the one член, or the whole note. */
async function sectionsOf(k) {
  const { slug, anchor } = split(k);
  const data = await loadNote(slug);
  if (!data) return [];
  return anchor ? data.sec.filter((s) => s.a === anchor) : data.sec;
}
function sectionsHtml(secs) {
  return secs.map((s) => (s.k === 'member' ? `<h4 class="mtitle">${esc(s.l)}</h4>` : '') + s.h).join('');
}
function plainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html.replace(/<\/(p|li|h\d|tr|blockquote|div)>/g, '$&\n').replace(/<br\s*\/?>/g, '\n');
  return div.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

const STATUS_CLASS = { важечки: 'ok', важи: 'ok', изменет: 'warn', укинат: 'bad', престанал: 'bad', пример: 'muted' };
function chips(f = {}) {
  return Object.entries(f)
    .filter(([key]) => key !== 'sample')
    .map(([key, v]) => `<span class="chip ${key === 'status' ? STATUS_CLASS[String(v).toLowerCase()] || '' : ''}" title="${esc(key)}">${esc(v)}</span>`)
    .join('');
}

// ---------- routing & note view ----------

const main = $('#main');
let current = { slug: null, anchor: '' };

function parseHash() {
  const p = location.hash.replace(/^#\/?/, '');
  if (!p) return { slug: index.site.home, anchor: '' };
  const [s, a] = p.split('/');
  try {
    return { slug: decodeURIComponent(s), anchor: a ? decodeURIComponent(a) : '' };
  } catch (e) {
    return { slug: s, anchor: a || '' };
  }
}

async function route() {
  closePopovers(0);
  document.body.classList.remove('show-left', 'show-right');
  const { slug, anchor } = parseHash();
  if (!noteIdx.has(slug)) {
    current = { slug: null, anchor: '' };
    renderMissing(slug);
  } else if (slug !== current.slug) {
    current = { slug, anchor };
    await renderNote(slug);
  }
  current.anchor = anchor;
  highlightExplorer();
  renderLinks();
  markTreeCurrent();
  if (anchor) {
    const el = document.getElementById('s-' + anchor);
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    }
  } else {
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  }
}

function renderMissing(slug) {
  const list = notes.map((n) => `<li><a class="wl" href="${hrefOf(n.s)}" data-k="${esc(n.s)}">${esc(n.t)}</a></li>`).join('');
  main.innerHTML = `<article class="note"><h1>${slug && slug !== index.site.home ? 'Не е пронајдено' : esc(index.site.title)}</h1>
    ${slug && slug !== index.site.home ? `<p>Нема белешка „${esc(slug)}“.</p>` : ''}<ul>${list}</ul></article>`;
  $('#toc').innerHTML = '';
}

function actionButtons(k) {
  const pinned = pins.includes(k);
  return `<span class="acts">
    <button class="act" data-act="pin" data-k="${esc(k)}" aria-pressed="${pinned}" title="Закачи во сесија">${ICON.pin}</button>
    <button class="act" data-act="tree" data-k="${esc(k)}" title="Истражи врски">${ICON.tree}</button>
    <button class="act" data-act="link" data-k="${esc(k)}" title="Копирај линк">${ICON.link}</button>
  </span>`;
}
function refCounts(k) {
  const o = outgoing(k).length;
  const i = incoming(k).length;
  if (!o && !i) return '';
  return `<button class="refs" data-act="tree" data-k="${esc(k)}" title="Упатува на ${o} · Упатено од ${i}">→${o} ←${i}</button>`;
}

async function renderNote(slug) {
  const data = await loadNote(slug);
  const n = noteOf(slug);
  const folders = slug.split('/').slice(0, -1);
  let html = `<article class="note">
    ${folders.length ? `<div class="crumbs">${folders.map(esc).join(' / ')}</div>` : ''}
    <header class="note-head">
      <h1>${esc(n.t)}</h1>
      <div class="note-meta">${chips(n.f)}${refCounts(slug)}${actionButtons(slug)}</div>
      ${n.f.sample ? '<div class="banner">Пример белешка — илустративен текст, не е официјален пропис.</div>' : ''}
    </header>`;
  for (const s of data.sec) {
    const k = s.a ? `${slug}#${s.a}` : slug;
    if (s.k === 'member') {
      html += `<section class="sec member" id="s-${esc(s.a)}" data-k="${esc(k)}">
        <div class="mh"><a class="mlabel" href="${hrefOf(k)}">${esc(s.l)}</a>${refCounts(k)}${actionButtons(k)}</div>
        <div class="body">${s.h}</div></section>`;
    } else {
      html += `<section class="sec" ${s.a ? `id="s-${esc(s.a)}"` : ''} data-k="${esc(k)}">${s.h}</section>`;
    }
  }
  main.innerHTML = html + '</article>';
  // Heading sections get the same actions as членови.
  for (const sec of $$('section.sec:not(.member)[id]', main)) {
    const hEl = sec.querySelector('h1,h2,h3,h4,h5,h6');
    if (hEl) hEl.insertAdjacentHTML('beforeend', refCounts(sec.dataset.k) + actionButtons(sec.dataset.k));
  }
  fillEmbeds(main, 0);
  renderToc(data);
  document.title = `${n.t} — ${index.site.title}`;
}

async function fillEmbeds(root, depth) {
  for (const el of $$('.embed[data-k]', root)) {
    if (el.dataset.filled) continue;
    el.dataset.filled = '1';
    const k = el.dataset.k;
    if (depth > 2) { el.innerHTML = `<a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}">${esc(labelOf(k))}</a>`; continue; }
    const secs = await sectionsOf(k);
    el.innerHTML = `<div class="embed-head"><a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}">${esc(labelOf(k))}</a></div>${sectionsHtml(secs)}`;
    fillEmbeds(el, depth + 1);
  }
}

// ---------- right panel ----------

function showTab(name) {
  for (const b of $$('.tabs [data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === name);
  for (const p of $$('.tab-panel')) p.hidden = p.dataset.panel !== name;
  local.set('tab', name);
}
$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) showTab(b.dataset.tab);
});

let tocObserver;
function renderToc(data) {
  const items = data.sec.filter((s) => s.a);
  $('#toc').innerHTML = items.length
    ? `<ol class="toc">${items.map((s) => `<li class="${s.k === 'member' ? 'm' : 'h'}"><a href="${hrefOf(`${data.s}#${s.a}`)}" data-anchor="${esc(s.a)}">${esc(s.l)}</a></li>`).join('')}</ol>`
    : '<p class="hint">Оваа белешка нема членови или наслови.</p>';
  tocObserver?.disconnect();
  tocObserver = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const a = $(`#toc a[data-anchor="${CSS.escape(en.target.id.slice(2))}"]`);
      if (!a) continue;
      $$('#toc a.active').forEach((x) => x.classList.remove('active'));
      a.classList.add('active');
      a.scrollIntoView({ block: 'nearest' });
    }
  }, { rootMargin: '0px 0px -70% 0px' });
  $$('section.sec[id]', main).forEach((s) => tocObserver.observe(s));
}

function renderLinks() {
  const box = $('#links');
  if (!current.slug) { box.innerHTML = ''; return; }
  const slug = current.slug;
  const inc = [];
  const out = [];
  for (const k of keysOfNote(slug)) {
    for (const s of inAdj.get(k) || []) if (split(s).slug !== slug) inc.push([s, k]);
    for (const t of outAdj.get(k) || []) if (split(t).slug !== slug) out.push([k, t]);
  }
  const row = (link, via) => `<li><a class="wl" href="${hrefOf(link)}" data-k="${esc(link)}">${esc(labelOf(link))}</a>${via ? `<span class="via">${esc(via)}</span>` : ''}</li>`;
  const viaLabel = (k) => memberOf(k)?.[1] || '';
  box.innerHTML = `
    <h3>Упатено од <span class="count">${inc.length}</span></h3>
    ${inc.length ? `<ul class="link-list">${inc.sort((a, b) => byOrder(a[0], b[0])).map(([s, k]) => row(s, viaLabel(k) && '→ ' + viaLabel(k))).join('')}</ul>` : '<p class="hint">Ниедна друга белешка не упатува тука.</p>'}
    <h3>Упатува на <span class="count">${out.length}</span></h3>
    ${out.length ? `<ul class="link-list">${out.sort((a, b) => byOrder(a[1], b[1])).map(([k, t]) => row(t, viaLabel(k) && 'од ' + viaLabel(k))).join('')}</ul>` : '<p class="hint">Нема упатувања кон други белешки.</p>'}`;
}

// ---------- pins (session memory) ----------

let pins = session.get('pins', []).filter((k) => noteIdx.has(split(k).slug));
const collapsedPins = new Set(session.get('pinsCollapsed', []));

function togglePin(k) {
  pins = pins.includes(k) ? pins.filter((x) => x !== k) : [...pins, k];
  session.set('pins', pins);
  syncPins();
  toast(pins.includes(k) ? 'Закачено' : 'Откачено');
}
function syncPins() {
  for (const b of $$('[data-act="pin"]')) b.setAttribute('aria-pressed', pins.includes(b.dataset.k));
  const badge = $('#pin-count');
  badge.hidden = !pins.length;
  badge.textContent = pins.length;
  renderPins();
}

async function renderPins() {
  const box = $('#pins');
  if (!pins.length) {
    box.innerHTML = `<p class="hint">Закачи членови со ${ICON.pin} за да ги имаш на едно место додека работиш. Се чуваат додека е отворен овој таб.</p>`;
    return;
  }
  box.innerHTML = `<div class="panel-head">
      <button class="btn" data-act="copy-pins">${ICON.copy} Копирај сè</button>
      <button class="btn ghost" data-act="clear-pins">Исчисти</button>
    </div>
    <ol class="pin-list">${pins.map((k, i) => `
      <li class="pin-card${collapsedPins.has(k) ? ' collapsed' : ''}" data-k="${esc(k)}">
        <div class="pc-head">
          <button class="tw" data-act="collapse-pin" data-k="${esc(k)}" aria-label="Собери">▾</button>
          <a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}" title="${esc(labelOf(k))}">${treeLabel(k)}</a>
          <button class="act" data-act="move-pin" data-dir="-1" data-k="${esc(k)}" title="Нагоре" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="act" data-act="tree" data-k="${esc(k)}" title="Истражи врски">${ICON.tree}</button>
          <button class="act" data-act="pin" data-k="${esc(k)}" aria-pressed="true" title="Откачи">${ICON.x}</button>
        </div>
        <div class="pc-body"></div>
      </li>`).join('')}</ol>`;
  for (const card of $$('.pin-card', box)) {
    sectionsOf(card.dataset.k).then((secs) => { card.querySelector('.pc-body').innerHTML = sectionsHtml(secs); });
  }
}

async function copyPins() {
  const parts = [];
  for (const k of pins) parts.push(`${citationOf(k)}\n${plainText(sectionsHtml((await sectionsOf(k)).map((s) => ({ ...s, k: '' }))))}`);
  await copyText(parts.join('\n\n'));
  toast(`Копирани ${pins.length} членови`);
}

// ---------- research tree ----------

let treeRoot = session.get('treeRoot', null);
let treeDir = session.get('treeDir', 'both');
if (treeRoot && !noteIdx.has(split(treeRoot).slug)) treeRoot = null;

function setTreeRoot(k) {
  treeRoot = k;
  session.set('treeRoot', k);
  renderTree();
  showTab('tree');
  document.body.classList.add('show-right');
}

function renderTree() {
  const box = $('#tree');
  if (!treeRoot) {
    box.innerHTML = `<p class="hint">Кликни на ${ICON.tree} кај член за да ги следиш неговите врски: кон што упатува (→) и што упатува кон него (←). Секое ниво се отвора со клик.</p>`;
    return;
  }
  box.innerHTML = `<div class="panel-head">
      <select id="tree-dir" aria-label="Насока">
        <option value="both">→ и ←</option>
        <option value="out">→ упатува на</option>
        <option value="in">← упатено од</option>
      </select>
      <button class="btn" data-act="copy-tree" title="Копирај ја отворената гранка како текст">${ICON.copy} Копирај</button>
      <button class="btn ghost" data-act="clear-tree">Исчисти</button>
    </div>
    <ul class="tree" role="tree"></ul>`;
  $('#tree-dir').value = treeDir;
  const rootLi = treeNode(treeRoot, new Set(), null);
  $('.tree', box).append(rootLi);
  expandNode(rootLi);
  markTreeCurrent();
}

function treeNode(k, ancestors, rel) {
  const li = document.createElement('li');
  li.className = 'tn';
  li.dataset.k = k;
  li.setAttribute('role', 'treeitem');
  li._ancestors = ancestors;
  const cycle = ancestors.has(k);
  const o = outgoing(k).length;
  const i = incoming(k).length;
  const leaf = cycle || (treeDir === 'out' ? !o : treeDir === 'in' ? !i : !o && !i);
  li.innerHTML = `<div class="row${cycle ? ' cycle' : ''}">
      <button class="tw" data-act="expand" ${leaf ? 'disabled' : ''} aria-label="Отвори">${leaf ? '·' : '▸'}</button>
      ${rel ? `<span class="rel ${rel}" title="${rel === 'out' ? 'упатува на' : 'упатено од'}">${rel === 'out' ? '→' : '←'}</span>` : ''}
      <a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}" title="${esc(labelOf(k))}">${treeLabel(k)}</a>
      ${cycle ? '<span class="cyc" title="Веќе е во оваа гранка">↻</span>' : `<span class="cnt">→${o} ←${i}</span>`}
      <button class="act" data-act="pin" data-k="${esc(k)}" aria-pressed="${pins.includes(k)}" title="Закачи">${ICON.pin}</button>
      <button class="act" data-act="tree" data-k="${esc(k)}" title="Постави како корен">${ICON.tree}</button>
    </div>`;
  return li;
}

function treeLabel(k) {
  const n = noteOf(split(k).slug);
  const m = memberOf(k);
  return m ? `<span class="tl-m">${esc(m[1])}</span><span class="tl-n">${esc(n.t)}</span>` : `<span class="tl-m">${esc(n.t)}</span>`;
}

function expandNode(li) {
  const btn = $(':scope > .row > .tw', li);
  if (btn.disabled) return;
  let ul = $(':scope > ul', li);
  if (ul) {
    ul.hidden = !ul.hidden;
  } else {
    const k = li.dataset.k;
    const anc = new Set(li._ancestors).add(k);
    ul = document.createElement('ul');
    ul.setAttribute('role', 'group');
    const groups = [];
    if (treeDir !== 'in') groups.push(['out', 'Упатува на', outgoing(k)]);
    if (treeDir !== 'out') groups.push(['in', 'Упатено од', incoming(k)]);
    for (const [rel, title, keys] of groups) {
      if (!keys.length) continue;
      if (groups.length > 1) ul.insertAdjacentHTML('beforeend', `<li class="grp ${rel}">${title} · ${keys.length}</li>`);
      for (const t of keys) ul.append(treeNode(t, anc, rel));
    }
    li.append(ul);
  }
  btn.textContent = ul.hidden ? '▸' : '▾';
  btn.setAttribute('aria-expanded', !ul.hidden);
}

function markTreeCurrent() {
  const key = current.slug ? (current.anchor ? `${current.slug}#${current.anchor}` : current.slug) : null;
  for (const row of $$('#tree .tn > .row')) row.classList.toggle('current', row.parentElement.dataset.k === key);
}

function treeAsText() {
  const lines = [];
  const walkLi = (li, depth) => {
    const rel = $(':scope > .row > .rel', li)?.textContent || '';
    const cyc = $(':scope > .row > .cyc', li) ? ' ↻' : '';
    lines.push(`${'  '.repeat(depth)}${rel ? rel + ' ' : ''}${citationOf(li.dataset.k)}${cyc}`);
    const ul = $(':scope > ul', li);
    if (ul && !ul.hidden) for (const c of $$(':scope > li.tn', ul)) walkLi(c, depth + 1);
  };
  const root = $('#tree .tree > li.tn');
  if (root) walkLi(root, 0);
  return lines.join('\n');
}

$('#tree').addEventListener('change', (e) => {
  if (e.target.id !== 'tree-dir') return;
  treeDir = e.target.value;
  session.set('treeDir', treeDir);
  renderTree();
});

// ---------- popovers (Obsidian-style hover preview) ----------

const popLayer = $('#popovers');
const stack = []; // stack[i] is the popover at depth i + 1
let openTimer = null;
let closeTimer = null;

function closePopovers(keep) {
  while (stack.length > keep) stack.pop().el.remove();
}

function positionPopover(el, rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  let left = Math.min(Math.max(8, rect.left), vw - w - 8);
  let top = rect.bottom + 6;
  if (top + hgt > vh - 8 && rect.top - hgt - 6 > 8) top = rect.top - hgt - 6;
  top = Math.max(8, Math.min(top, vh - hgt - 8));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

async function openPopover(link, depth) {
  const k = link.dataset.k;
  const n = noteOf(split(k).slug);
  if (!n) return;
  const el = document.createElement('div');
  el.className = 'pop';
  el.dataset.depth = depth;
  el.innerHTML = `<div class="pop-head">
      <div class="pop-title">
        <a class="wl no-pop" href="${hrefOf(k)}" data-k="${esc(k)}">${esc(labelOf(k))}</a>
        <span class="pop-chips">${chips(n.f)}</span>
      </div>
      ${actionButtons(k)}
    </div>
    <div class="pop-body"><p class="hint">Се вчитува…</p></div>`;
  popLayer.append(el);
  const entry = { el, owner: link };
  stack.push(entry);
  const rect = link.getBoundingClientRect();
  positionPopover(el, rect);
  const secs = await sectionsOf(k);
  if (!stack.includes(entry)) return;
  $('.pop-body', el).innerHTML = sectionsHtml(secs) || '<p class="hint">Празно.</p>';
  fillEmbeds(el, 1);
  positionPopover(el, rect);
}

function aliveDepth(target) {
  let d = 0;
  const popEl = target.closest?.('.pop');
  if (popEl) d = Number(popEl.dataset.depth);
  const link = target.closest?.('a.wl');
  if (link) {
    const i = stack.findIndex((p) => p.owner === link);
    if (i >= 0) d = Math.max(d, i + 1);
  }
  return d;
}

document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const keep = aliveDepth(e.target);
  clearTimeout(closeTimer);
  if (keep < stack.length) closeTimer = setTimeout(() => closePopovers(keep), 300);
  clearTimeout(openTimer);
  const link = e.target.closest('a.wl[data-k]:not(.no-pop)');
  if (link && !stack.some((p) => p.owner === link)) {
    const parent = link.closest('.pop');
    const parentDepth = parent ? Number(parent.dataset.depth) : 0;
    openTimer = setTimeout(() => {
      clearTimeout(closeTimer);
      closePopovers(parentDepth);
      openPopover(link, parentDepth + 1);
    }, 350);
  }
});

// ---------- explorer ----------

function renderExplorer() {
  const rootDir = { dirs: new Map(), files: [] };
  for (const n of notes) {
    const parts = n.s.split('/');
    let d = rootDir;
    for (const p of parts.slice(0, -1)) {
      if (!d.dirs.has(p)) d.dirs.set(p, { dirs: new Map(), files: [] });
      d = d.dirs.get(p);
    }
    d.files.push(n);
  }
  const renderDir = (d, prefix) =>
    [...d.dirs.entries()].sort((a, b) => a[0].localeCompare(b[0], 'mk')).map(([name, sub]) =>
      `<details data-dir="${esc(prefix + name)}"><summary>${esc(name)}</summary>${renderDir(sub, prefix + name + '/')}</details>`).join('') +
    `<ul>${d.files.map((n) => `<li><a href="${hrefOf(n.s)}" data-slug="${esc(n.s)}">${esc(n.t)}</a></li>`).join('')}</ul>`;
  $('#explorer').innerHTML = renderDir(rootDir, '');
}
function highlightExplorer() {
  for (const a of $$('#explorer a')) {
    const on = a.dataset.slug === current.slug;
    a.classList.toggle('active', on);
    if (on) {
      for (let p = a.parentElement; p && p.id !== 'explorer'; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true;
      a.scrollIntoView({ block: 'nearest' });
    }
  }
}

// ---------- search ----------

const searchInput = $('#search');
const resultsBox = $('#search-results');
let mini = null;
let docs = null;
let searchTimer = null;
let activeResult = -1;

async function ensureSearch() {
  if (mini) return;
  docs = await fetch('data/search.json').then((r) => r.json());
  mini = new MiniSearch({
    fields: ['t', 'x'],
    storeFields: ['k', 't'],
    processTerm: (term) => term.toLowerCase(),
    searchOptions: { boost: { t: 3 }, prefix: true, fuzzy: 0.15 },
  });
  mini.addAll(docs);
}

function snippet(text, terms) {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const t of terms) { const p = lower.indexOf(t); if (p >= 0 && (pos < 0 || p < pos)) pos = p; }
  const start = Math.max(0, pos - 60);
  let s = (start > 0 ? '…' : '') + text.slice(start, start + 200) + (start + 200 < text.length ? '…' : '');
  s = esc(s);
  for (const t of terms.filter((x) => x.length > 1)) {
    s = s.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'), (m) => `<mark>${m}</mark>`);
  }
  return s;
}

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) { resultsBox.hidden = true; return; }
  await ensureSearch();
  let res = mini.search(q, { combineWith: 'AND' });
  if (!res.length) res = mini.search(q);
  const terms = [...new Set(res.flatMap((r) => r.terms))].sort((a, b) => b.length - a.length);
  activeResult = -1;
  resultsBox.innerHTML = res.length
    ? res.slice(0, 40).map((r) => `<a class="result wl" href="${hrefOf(r.k)}" data-k="${esc(r.k)}">
        <span class="rt">${esc(r.t)}</span><span class="rs">${snippet(docs[r.id].x, terms)}</span></a>`).join('')
      + (res.length > 40 ? `<div class="more">+ уште ${res.length - 40}</div>` : '')
    : '<div class="more">Нема резултати.</div>';
  resultsBox.hidden = false;
}

searchInput.addEventListener('focus', ensureSearch, { once: true });
searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 120); });
searchInput.addEventListener('keydown', (e) => {
  const items = $$('.result', resultsBox);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    activeResult = Math.max(0, Math.min(items.length - 1, activeResult + (e.key === 'ArrowDown' ? 1 : -1)));
    items.forEach((el, i) => el.classList.toggle('active', i === activeResult));
    items[activeResult]?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    const target = items[Math.max(0, activeResult)];
    if (target) { location.hash = target.getAttribute('href'); resultsBox.hidden = true; searchInput.blur(); }
  } else if (e.key === 'Escape') {
    resultsBox.hidden = true;
    searchInput.blur();
  }
});
resultsBox.addEventListener('click', (e) => { if (e.target.closest('.result')) resultsBox.hidden = true; });
document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) resultsBox.hidden = true; });

// ---------- global actions ----------

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const k = b.dataset.k;
  switch (b.dataset.act) {
    case 'pin': togglePin(k); break;
    case 'tree': closePopovers(0); setTreeRoot(k); break;
    case 'link':
      await copyText(location.origin + location.pathname + hrefOf(k));
      toast('Линкот е копиран');
      break;
    case 'expand': expandNode(b.closest('li.tn')); break;
    case 'copy-tree': await copyText(treeAsText()); toast('Дрвото е копирано'); break;
    case 'clear-tree': treeRoot = null; session.set('treeRoot', null); renderTree(); break;
    case 'copy-pins': await copyPins(); break;
    case 'clear-pins': pins = []; session.set('pins', pins); syncPins(); break;
    case 'collapse-pin': {
      const card = b.closest('.pin-card');
      card.classList.toggle('collapsed');
      if (card.classList.contains('collapsed')) collapsedPins.add(k); else collapsedPins.delete(k);
      session.set('pinsCollapsed', [...collapsedPins]);
      break;
    }
    case 'move-pin': {
      const i = pins.indexOf(k);
      const j = i + Number(b.dataset.dir);
      if (i < 0 || j < 0 || j >= pins.length) break;
      [pins[i], pins[j]] = [pins[j], pins[i]];
      session.set('pins', pins);
      renderPins();
      break;
    }
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  if (e.key === 'Escape') closePopovers(0);
});

$('#toggle-theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  local.set('theme', dark ? 'light' : 'dark');
});
$('#toggle-left').addEventListener('click', () => document.body.classList.toggle('show-left'));
$('#toggle-right').addEventListener('click', () => document.body.classList.toggle('show-right'));

// ---------- start ----------

renderExplorer();
showTab(local.get('tab') || 'toc');
syncPins();
renderTree();
window.addEventListener('hashchange', route);
route();
