// ---------- small helpers ----------

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ICON = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6zM12 13v8"/></svg>',
  tree: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M6 12h10"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
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
// A key is a note index ("812"), or a note index and a heading anchor ("812#член-5")
// for vaults that keep several членови in one note.

const index = await fetch('data/index.json').then((r) => r.json());
const acts = index.acts;
const KIND = { m: 'master', u: 'unit', a: 'archive', p: 'pzo', c: 'moc', n: 'note' };
const N = index.notes.map(([d, base, label, kind, act, bundle, status], i) => ({
  i, dir: index.folders[d], base, label, kind: KIND[kind], act, bundle, status,
}));
const baseCount = new Map();
for (const n of N) baseCount.set(n.base, (baseCount.get(n.base) || 0) + 1);
const byU = new Map();
for (const n of N) { n.u = baseCount.get(n.base) > 1 ? `${n.dir}/${n.base}` : n.base; byU.set(n.u, n.i); }

const unitPos = new Map();
acts.forEach((a, ai) => a.u.forEach(([i, anchor], j) => unitPos.set(i, { act: ai, j, anchor })));
const actMembers = acts.map(() => []);
for (const n of N) if (n.act >= 0 && n.kind !== 'master' && n.kind !== 'archive') actMembers[n.act].push(n.i);

const outAdj = new Map();
const inAdj = new Map();
const noteSections = new Map(); // note → its section keys that carry links
const addTo = (map, a, b) => { if (!map.has(a)) map.set(a, new Set()); map.get(a).add(b); };
for (const [a0, b0] of index.edges) {
  const a = String(a0);
  const b = String(b0);
  addTo(outAdj, a, b);
  addTo(inAdj, b, a);
  for (const k of [a, b]) if (k.includes('#')) addTo(noteSections, k.split('#')[0], k);
}

function split(k) {
  const s = String(k);
  const p = s.indexOf('#');
  return p < 0 ? { i: Number(s), anchor: '' } : { i: Number(s.slice(0, p)), anchor: s.slice(p + 1) };
}
const noteOf = (k) => N[split(k).i];
const actOf = (n) => (n && n.act >= 0 ? acts[n.act] : null);
const anchorLabel = (a) => {
  const m = a.match(/^член-(\d+)(?:-(.+))?$/);
  return m ? `Член ${m[1]}${m[2] ? '-' + m[2] : ''}` : a.replace(/-/g, ' ');
};
function shortLabel(k) {
  const { i, anchor } = split(k);
  return N[i].label + (anchor ? ' › ' + (index.sections?.[`${i}#${anchor}`] || anchorLabel(anchor)) : '');
}
function labelOf(k) {
  const n = noteOf(k);
  const a = actOf(n);
  return a && n.kind !== 'master' ? `${a.c} · ${shortLabel(k)}` : shortLabel(k);
}
function contextOf(n) {
  const a = actOf(n);
  if (a) return n.kind === 'master' ? a.c : `${a.c} · ${a.t}`;
  return n.dir.split('/').pop();
}
function citationOf(k) {
  const n = noteOf(k);
  const a = actOf(n);
  if (!a) return shortLabel(k);
  if (n.kind === 'master') return `${a.t} (${a.c})`;
  if (n.kind === 'pzo') return `${a.t} (${a.c}) — преодна одредба ${shortLabel(k)}`;
  return `${a.t}, ${shortLabel(k)} (${a.c})`;
}
const hrefOf = (k) => {
  const { i, anchor } = split(k);
  return '#/' + encodeURIComponent(N[i].u) + (anchor ? '/' + encodeURIComponent(anchor) : '');
};
// Pins and the tree root are stored by file name, so they survive a rebuild that renumbers notes.
const toStored = (k) => { const { i, anchor } = split(k); return N[i].u + (anchor ? '#' + anchor : ''); };
const fromStored = (s) => {
  const p = s.lastIndexOf('#');
  const i = byU.get(p < 0 ? s : s.slice(0, p));
  if (i == null) return null;
  return p < 0 ? String(i) : `${i}#${s.slice(p + 1)}`;
};

function orderOf(k) {
  const n = noteOf(k);
  const pos = unitPos.get(n.i);
  const act = n.act >= 0 ? n.act : acts.length;
  return act * 1e7 + (n.kind === 'master' ? 0 : pos ? pos.j + 1 : 1e6 + n.i);
}
const byOrder = (a, b) => orderOf(a) - orderOf(b);

/** What k links to. A whole act (its master) links to the other acts its членови cite. */
function outgoing(k) { return related(k, outAdj); }
/** What links to k. For a whole act: the other acts whose членови cite it. */
function incoming(k) { return related(k, inAdj); }
function related(k, adj) {
  const { i, anchor } = split(k);
  const n = N[i];
  const res = new Set();
  if (n.kind === 'master' && !anchor && n.act >= 0) {
    const from = [...actMembers[n.act].map(String), String(i)];
    for (const s of from) {
      for (const t of adj.get(s) || []) {
        const tn = noteOf(t);
        if (tn.act === n.act) continue;
        res.add(tn.act >= 0 ? String(acts[tn.act].m) : String(tn.i));
      }
    }
  } else {
    const from = anchor ? [String(k)] : [String(i), ...(noteSections.get(String(i)) || [])];
    for (const s of from) for (const t of adj.get(s) || []) res.add(t);
    if (!anchor) for (const t of [...res]) if (split(t).i === i) res.delete(t);
  }
  res.delete(String(k));
  return [...res].sort(byOrder);
}

const bundleCache = new Map();
function loadBundle(id) {
  if (!bundleCache.has(id)) bundleCache.set(id, fetch(`data/b/${id}.json`).then((r) => r.json()));
  return bundleCache.get(id);
}
async function noteData(i) {
  const b = await loadBundle(N[i].bundle);
  return b[i];
}
const META = new Set(index.site.metaSections || []);
const isNorm = (s) => s.k !== 'footnotes' && !(s.k === 'heading' && META.has(s.l));

/** Sections to show for a key. A master without an anchor is cut after its first few членови. */
async function sectionsOf(k, { norm = false } = {}) {
  const { i, anchor } = split(k);
  const data = await noteData(i);
  if (!data) return [];
  let secs = anchor ? data.sec.filter((s) => s.a === anchor) : data.sec;
  if (norm) secs = secs.filter(isNorm);
  return secs;
}
function previewSections(k, secs) {
  if (N[split(k).i].kind !== 'master' || split(k).anchor) return { secs, more: false };
  let members = 0;
  const out = [];
  for (const s of secs) {
    if (s.k === 'footnotes') break;
    if (s.k === 'member' && ++members > 3) return { secs: out, more: true };
    out.push(s);
  }
  return { secs: out, more: false };
}
const sectionsHtml = (secs) => secs.map((s) => s.h).join('');
function normHtml(secs) {
  const div = document.createElement('div');
  div.innerHTML = sectionsHtml(secs.filter(isNorm));
  $$('.callout, sup.footnote-ref', div).forEach((el) => el.remove());
  return div.innerHTML;
}
function plainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html.replace(/<br\s*\/?>/g, '\n').replace(/<\/(p|li|h\d|tr|blockquote|div)>/g, '$&\n');
  return div.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

const STATUS_CLASS = {
  важечки: 'ok', 'избришан': 'bad', 'укинат-од-ус': 'bad', 'престанал да важи': 'bad',
  'заменет': 'warn', 'за проверка': 'warn', 'повлечен-запис': 'warn', 'исцрпен': 'muted',
};
function chips(c = {}) {
  return Object.entries(c)
    .map(([key, v]) => key === 'статус'
      ? `<span class="chip ${STATUS_CLASS[String(v).toLowerCase()] || ''}" title="статус">${esc(v)}</span>`
      : `<span class="chip" title="${esc(key)}"><span class="chip-k">${esc(key)}</span> ${esc(v)}</span>`)
    .join('');
}
function fmLinks(fl = []) {
  return fl.map(([key, k]) => `<span class="chip"><span class="chip-k">${esc(key)}</span> <a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}">${esc(shortLabel(k))}</a></span>`).join('');
}
const statusClass = (n) => (n.status ? `st-${STATUS_CLASS[n.status.toLowerCase()] || ''}` : '');

// ---------- routing & note view ----------

const main = $('#main');
let current = { i: null, anchor: '' };

function parseHash() {
  const p = location.hash.replace(/^#\/?/, '');
  if (!p) return { i: null, anchor: '', home: true };
  const [s, a] = p.split('/');
  let u = s;
  let anchor = a || '';
  try { u = decodeURIComponent(s); anchor = a ? decodeURIComponent(a) : ''; } catch (e) { /* keep raw */ }
  return { i: byU.has(u) ? byU.get(u) : null, anchor };
}

async function route() {
  closePopovers(0);
  document.body.classList.remove('show-left', 'show-right');
  const { i, anchor, home } = parseHash();
  document.body.dataset.view = home ? 'home' : 'note';
  if (home) {
    current = { i: null, anchor: '', home: true };
    renderHome();
  } else if (i == null) {
    current = { i: null, anchor: '' };
    main.innerHTML = '<article class="note"><h1>Не е пронајдено</h1><p>Оваа белешка не постои или не е објавена.</p></article>';
    $('#toc').innerHTML = '';
  } else if (i !== current.i) {
    current = { i, anchor };
    main.innerHTML = '<div class="loading">Се вчитува…</div>';
    await renderNote(i);
  }
  current.anchor = anchor;
  markRail();
  renderLinks();
  markTreeCurrent();
  markTocCurrent();
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
  }
}

function actionButtons(k) {
  const pinned = pins.includes(String(k));
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

/** Theme · group · act above the title, each with its dot, as on andhitektura.com. */
function eyebrow(n) {
  const parts = n.dir.split('/');
  const t = themeOf(n);
  const items = [];
  if (t) items.push(t.moc != null ? `<a href="${hrefOf(t.moc)}">${esc(t.name)}</a>` : `<span>${esc(t.name)}</span>`);
  else items.push(`<span>${esc(parts[0])}</span>`);
  if (parts[2] && n.kind !== 'moc') items.push(`<span>${esc(parts[2].toLowerCase())}</span>`);
  const a = actOf(n);
  if (a && n.kind !== 'master') items.push(`<a href="${hrefOf(a.m)}">${esc(a.c)}</a>`);
  return items.join('');
}

function unitNav(n) {
  const pos = unitPos.get(n.i);
  if (!pos) return '';
  const list = acts[pos.act].u;
  const prev = list[pos.j - 1];
  const next = list[pos.j + 1];
  const master = acts[pos.act].m;
  return `<nav class="unit-nav">
    ${prev ? `<a class="wl" href="${hrefOf(prev[0])}" data-k="${prev[0]}">← ${esc(N[prev[0]].label)}</a>` : '<span></span>'}
    <a href="${hrefOf(pos.anchor ? `${master}#${pos.anchor}` : master)}">во консолидираниот текст</a>
    ${next ? `<a class="wl" href="${hrefOf(next[0])}" data-k="${next[0]}">${esc(N[next[0]].label)} →</a>` : '<span></span>'}
  </nav>`;
}

async function renderNote(i) {
  const n = N[i];
  const data = await noteData(i);
  if (current.i !== i) return;
  const key = String(i);
  let html = `<article class="note kind-${n.kind}">
    <div class="eyebrow">${eyebrow(n)}</div>
    <header class="note-head">
      <h1>${esc(n.kind === 'unit' && actOf(n) ? `${actOf(n).c} · ${n.label}` : n.label)}</h1>
      <div class="note-meta">${chips(data.c)}${fmLinks(data.fl)}${refCounts(key)}${actionButtons(key)}</div>
      ${unitNav(n)}
    </header>`;
  for (const s of data.sec) {
    const k = s.x != null ? String(s.x) : s.a ? `${i}#${s.a}` : '';
    const cls = `sec k-${s.k}${s.k === 'heading' && META.has(s.l) ? ' meta' : ''}`;
    html += `<section class="${cls}" ${s.a ? `id="s-${esc(s.a)}"` : ''} ${k ? `data-k="${esc(k)}"` : ''}>${s.h}</section>`;
  }
  main.innerHTML = html + (n.kind === 'unit' ? unitNav(n) : '') + '</article>';
  // Each член gets pin / tree / link actions on its heading line.
  for (const sec of $$('section.k-member[data-k]', main)) {
    const head = sec.firstElementChild;
    if (head) head.insertAdjacentHTML('beforeend', refCounts(sec.dataset.k) + actionButtons(sec.dataset.k));
  }
  if (n.kind === 'note') {
    for (const sec of $$('section.k-heading[data-k]', main)) {
      const head = sec.querySelector('h1,h2,h3,h4,h5,h6');
      if (head) head.insertAdjacentHTML('beforeend', refCounts(sec.dataset.k) + actionButtons(sec.dataset.k));
    }
  }
  fillEmbeds(main, 0);
  renderDiagrams(main);
  renderToc(n, data);
  document.title = `${n.label} — ${index.site.title}`;
}

// ```mermaid blocks become diagrams, drawn in the site's palette and typeface.
let mermaidReady = null;
async function renderDiagrams(root) {
  const blocks = $$('pre > code.language-mermaid', root);
  if (!blocks.length) return;
  mermaidReady ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'vendor/mermaid.min.js';
    script.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        fontFamily: 'and_Lubrifont, system-ui, sans-serif',
        themeVariables: {
          background: '#232323', primaryColor: '#2c2c2c', primaryTextColor: '#e1e1e1', primaryBorderColor: '#afafaf',
          secondaryColor: '#1c1c1c', tertiaryColor: '#1c1c1c', lineColor: '#afafaf', textColor: '#e1e1e1',
          fontSize: '15px', edgeLabelBackground: '#232323',
        },
        // Natural size, scrolled sideways when wider than the page: wide flowcharts stay readable.
        flowchart: { curve: 'basis', padding: 14, useMaxWidth: false },
      });
      resolve(window.mermaid);
    };
    script.onerror = reject;
    document.head.append(script);
  });
  const mermaid = await mermaidReady;
  const nodes = blocks.map((code) => {
    const div = document.createElement('div');
    div.className = 'diagram mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
    return div;
  });
  try { await mermaid.run({ nodes }); } catch (e) { console.warn('diagram', e); }
}

async function fillEmbeds(root, depth) {
  for (const el of $$('.embed[data-k]', root)) {
    if (el.dataset.filled) continue;
    el.dataset.filled = '1';
    const k = el.dataset.k;
    const link = `<a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}">${esc(labelOf(k))}</a>`;
    if (depth > 2) { el.innerHTML = link; continue; }
    const { secs } = previewSections(k, await sectionsOf(k, { norm: true }));
    el.innerHTML = `<div class="embed-head">${link}</div>${sectionsHtml(secs)}`;
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

// The table of contents is the act's outline as a collapsible tree, like Obsidian's: ## > ### > #### > членови.
let tocObserver;
function outlineOf(n, data) {
  if (n.act >= 0) return acts[n.act].o;
  return data.sec.filter((s) => s.a).map((s) => [s.v || (s.k === 'member' ? 7 : 2), s.l, s.a]);
}
function tocTree(items) {
  const root = { level: 0, children: [] };
  const stack = [root];
  for (const it of items) {
    const node = typeof it === 'number' ? { level: 99, unit: it } : { level: it[0], label: it[1], anchor: it[2] };
    node.children = [];
    while (stack.length > 1 && stack[stack.length - 1].level >= node.level) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }
  return root.children;
}
function renderToc(n, data) {
  tocObserver?.disconnect();
  const box = $('#toc');
  const a = actOf(n);
  const onMaster = n.kind === 'master';
  const items = outlineOf(n, data);
  if (!items.length) { box.innerHTML = '<p class="hint">Оваа белешка нема наслови ни членови.</p>'; return; }
  const linkOf = (node) => {
    if (node.unit != null) {
      const u = N[node.unit];
      const anchor = unitPos.get(node.unit)?.anchor;
      const href = onMaster && anchor ? hrefOf(`${n.i}#${anchor}`) : hrefOf(node.unit);
      return `<a class="${statusClass(u)}" href="${href}" data-k="${node.unit}" data-toc="${node.unit}" ${anchor ? `data-anchor="${esc(anchor)}"` : ''}>${esc(u.label)}</a>`;
    }
    const owner = a ? a.m : n.i;
    return `<a class="toc-h" href="${hrefOf(`${owner}#${node.anchor}`)}" data-anchor="${esc(node.anchor)}">${esc(node.label)}</a>`;
  };
  const html = (nodes) => `<ul>${nodes.map((node) => `
    <li class="${node.children.length ? 'has-kids collapsed' : ''} ${node.unit != null ? 'is-unit' : `lvl-${Math.min(node.level, 6)}`}">
      <div class="orow">${node.children.length ? '<button class="tw" data-act="toc-toggle" aria-label="Отвори">▾</button>' : '<span class="tw-space"></span>'}${linkOf(node)}</div>
      ${node.children.length ? html(node.children) : ''}
    </li>`).join('')}</ul>`;
  box.innerHTML = `<div class="panel-head toc-head">
      ${a ? `<a class="toc-act" href="${hrefOf(a.m)}">${esc(a.c)} · ${esc(a.t)}</a>` : ''}
      <span class="toc-tools"><button class="btn ghost" data-act="toc-all" data-open="1">отвори сè</button><button class="btn ghost" data-act="toc-all" data-open="0">собери</button></span>
    </div><div class="otree">${html(tocTree(items))}</div>`;
  // The top level stays open, so the act's parts are visible at once.
  $$('.otree > ul > li.has-kids', box).forEach((li) => li.classList.remove('collapsed'));
  // On a page with its own sections, the entry in view follows the scroll.
  if (!onMaster && n.kind !== 'note') return;
  tocObserver = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) markToc($(`#toc a[data-anchor="${CSS.escape(en.target.id.slice(2))}"]`), false);
  }, { root: main, rootMargin: '0px 0px -70% 0px' });
  $$('section.sec[id]', main).forEach((sec) => tocObserver.observe(sec));
}
/** Highlights a table-of-contents entry and opens the branches above it. */
function markToc(link, center = true) {
  if (!link) return;
  $$('#toc a.active').forEach((x) => x.classList.remove('active'));
  link.classList.add('active');
  for (let li = link.closest('li'); li; li = li.parentElement.closest('li')) if (li !== link.closest('li')) li.classList.remove('collapsed');
  link.scrollIntoView({ block: center ? 'center' : 'nearest' });
}
function markTocCurrent() {
  if (current.i == null) return;
  if (current.anchor) markToc($(`#toc a[data-anchor="${CSS.escape(current.anchor)}"]`));
  else markToc($(`#toc a[data-toc="${current.i}"]`));
}
$('#toc').addEventListener('click', (e) => {
  const t = e.target.closest('[data-act="toc-toggle"]');
  if (t) { t.closest('li').classList.toggle('collapsed'); return; }
  const all = e.target.closest('[data-act="toc-all"]');
  if (all) $$('#toc li.has-kids').forEach((li) => li.classList.toggle('collapsed', all.dataset.open !== '1'));
});

function renderLinks() {
  const box = $('#links');
  if (current.i == null) { box.innerHTML = ''; return; }
  const n = N[current.i];
  const own = n.kind === 'master' && n.act >= 0 ? [String(n.i), ...actMembers[n.act].map(String)] : [String(n.i), ...(noteSections.get(String(n.i)) || [])];
  const ownSet = new Set(own);
  const inner = (k) => (n.kind === 'master' ? noteOf(k).act === n.act : split(k).i === n.i);
  const inc = [];
  const out = [];
  for (const k of own) {
    for (const s of inAdj.get(k) || []) if (!ownSet.has(s) && !inner(s)) inc.push([s, k]);
    for (const t of outAdj.get(k) || []) if (!inner(t)) out.push([k, t]);
  }
  const row = (link, via) => `<li><a class="wl" href="${hrefOf(link)}" data-k="${esc(link)}">${esc(labelOf(link))}</a>${via ? `<span class="via">${esc(via)}</span>` : ''}</li>`;
  const viaOf = (k) => (k === String(n.i) ? '' : shortLabel(k));
  box.innerHTML = `
    <h3>Упатено од <span class="count">${inc.length}</span></h3>
    ${inc.length ? `<ul class="link-list">${inc.sort((a, b) => byOrder(a[0], b[0])).map(([s, k]) => row(s, viaOf(k) && '→ ' + viaOf(k))).join('')}</ul>` : '<p class="hint">Ништо друго не упатува тука.</p>'}
    <h3>Упатува на <span class="count">${out.length}</span></h3>
    ${out.length ? `<ul class="link-list">${out.sort((a, b) => byOrder(a[1], b[1])).map(([k, t]) => row(t, viaOf(k) && 'од ' + viaOf(k))).join('')}</ul>` : '<p class="hint">Нема упатувања надвор од оваа белешка.</p>'}`;
}

// ---------- pins (session memory) ----------

let pins = session.get('pins', []).map(fromStored).filter(Boolean);
const collapsedPins = new Set(session.get('pinsCollapsed', []));
const savePins = () => session.set('pins', pins.map(toStored));

function togglePin(k) {
  k = String(k);
  pins = pins.includes(k) ? pins.filter((x) => x !== k) : [...pins, k];
  savePins();
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

function renderPins() {
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
      <li class="pin-card${collapsedPins.has(toStored(k)) ? ' collapsed' : ''}" data-k="${esc(k)}">
        <div class="pc-head">
          <button class="tw" data-act="collapse-pin" data-k="${esc(k)}" aria-label="Собери">▾</button>
          <a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}" title="${esc(citationOf(k))}">${treeLabel(k)}</a>
          <button class="act" data-act="move-pin" data-dir="-1" data-k="${esc(k)}" title="Нагоре" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="act" data-act="tree" data-k="${esc(k)}" title="Истражи врски">${ICON.tree}</button>
          <button class="act" data-act="pin" data-k="${esc(k)}" aria-pressed="true" title="Откачи">${ICON.x}</button>
        </div>
        <div class="pc-body"></div>
      </li>`).join('')}</ol>`;
  for (const card of $$('.pin-card', box)) {
    const k = card.dataset.k;
    sectionsOf(k).then((secs) => {
      const { secs: shown, more } = previewSections(k, secs);
      card.querySelector('.pc-body').innerHTML = normHtml(shown) + (more ? `<p class="hint"><a href="${hrefOf(k)}">Целиот акт →</a></p>` : '');
    });
  }
}

async function copyPins() {
  const parts = [];
  for (const k of pins) {
    const { secs } = previewSections(k, await sectionsOf(k, { norm: true }));
    parts.push(`${citationOf(k)}\n${plainText(normHtml(secs))}`);
  }
  await copyText(parts.join('\n\n'));
  toast(`Копирани: ${pins.length}`);
}

// ---------- research tree ----------

let treeRoot = fromStored(session.get('treeRoot', '') || '');
let treeDir = session.get('treeDir', 'both');

function setTreeRoot(k) {
  treeRoot = String(k);
  session.set('treeRoot', toStored(treeRoot));
  renderTree();
  showTab('tree');
  document.body.classList.add('show-right');
}

function treeLabel(k) {
  const n = noteOf(k);
  return `<span class="tl-m">${esc(shortLabel(k))}</span><span class="tl-n">${esc(contextOf(n))}</span>`;
}

function renderTree() {
  const box = $('#tree');
  if (!treeRoot) {
    box.innerHTML = `<p class="hint">Кликни на ${ICON.tree} кај член за да ги следиш неговите врски: кон што упатува (→) и што упатува кон него (←). Секое ниво се отвора со клик. Кај цел акт, врските се собрани по акти.</p>`;
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
  li.innerHTML = `<div class="row${cycle ? ' cycle' : ''} ${statusClass(noteOf(k))}">
      <button class="tw" data-act="expand" ${leaf ? 'disabled' : ''} aria-label="Отвори">${leaf ? '·' : '▸'}</button>
      ${rel ? `<span class="rel ${rel}" title="${rel === 'out' ? 'упатува на' : 'упатено од'}">${rel === 'out' ? '→' : '←'}</span>` : ''}
      <a class="wl" href="${hrefOf(k)}" data-k="${esc(k)}" title="${esc(citationOf(k))}">${treeLabel(k)}</a>
      ${cycle ? '<span class="cyc" title="Веќе е во оваа гранка">↻</span>' : `<span class="cnt">→${o} ←${i}</span>`}
      <button class="act" data-act="pin" data-k="${esc(k)}" aria-pressed="${pins.includes(k)}" title="Закачи">${ICON.pin}</button>
      <button class="act" data-act="tree" data-k="${esc(k)}" title="Постави како корен">${ICON.tree}</button>
    </div>`;
  return li;
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
  const key = current.i == null ? null : current.anchor ? `${current.i}#${current.anchor}` : String(current.i);
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
const POP_LINK = 'a.wl[data-k]:not(.no-pop), sup.footnote-ref a';

function closePopovers(keep) {
  while (stack.length > keep) stack.pop().el.remove();
}

function positionPopover(el, rect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  const left = Math.min(Math.max(8, rect.left), vw - w - 8);
  let top = rect.bottom + 6;
  if (top + hgt > vh - 8 && rect.top - hgt - 6 > 8) top = rect.top - hgt - 6;
  top = Math.max(8, Math.min(top, vh - hgt - 8));
  el.style.left = left + 'px';
  el.style.top = top + 'px';
}

function footnoteTarget(link) {
  const id = decodeURIComponent((link.getAttribute('href') || '').slice(1));
  const root = link.closest('.pop-body, .note, .pc-body, .embed') || document;
  return root.querySelector(`[id="${CSS.escape(id)}"]`) || document.getElementById(id);
}

async function openPopover(link, depth) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.dataset.depth = depth;
  const entry = { el, owner: link };
  const rect = link.getBoundingClientRect();

  if (!link.dataset.k) {
    const fn = footnoteTarget(link);
    if (!fn) return;
    el.classList.add('pop-fn');
    el.innerHTML = `<div class="pop-body">${fn.innerHTML.replace(/<a[^>]*footnote-backref[^>]*>.*?<\/a>/g, '')}</div>`;
    popLayer.append(el);
    stack.push(entry);
    positionPopover(el, rect);
    return;
  }

  const k = link.dataset.k;
  el.innerHTML = `<div class="pop-head">
      <div class="pop-title">
        <a class="wl no-pop" href="${hrefOf(k)}" data-k="${esc(k)}">${esc(labelOf(k))}</a>
        <span class="pop-sub">${esc(contextOf(noteOf(k)))}</span>
        <span class="pop-chips"></span>
      </div>
      ${actionButtons(k)}
    </div>
    <div class="pop-body"><p class="hint">Се вчитува…</p></div>`;
  popLayer.append(el);
  stack.push(entry);
  positionPopover(el, rect);
  const data = await noteData(split(k).i);
  if (!stack.includes(entry)) return;
  const { secs, more } = previewSections(k, await sectionsOf(k));
  $('.pop-chips', el).innerHTML = chips(data?.c) + fmLinks(data?.fl);
  $('.pop-body', el).innerHTML = (sectionsHtml(secs) || '<p class="hint">Празно.</p>') +
    (more ? `<p class="hint"><a href="${hrefOf(k)}">Отвори го целиот акт →</a></p>` : '');
  fillEmbeds(el, 1);
  positionPopover(el, rect);
}

function aliveDepth(target) {
  let d = 0;
  const popEl = target.closest?.('.pop');
  if (popEl) d = Number(popEl.dataset.depth);
  const link = target.closest?.('a');
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
  const link = e.target.closest(POP_LINK);
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

// Footnote links ("#fn12") scroll within the page instead of changing the route.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#fn"]');
  if (!a) return;
  e.preventDefault();
  const t = footnoteTarget(a);
  if (!t) return;
  t.scrollIntoView({ block: 'center' });
  t.classList.remove('flash');
  void t.offsetWidth;
  t.classList.add('flash');
});

// ---------- rail: countries, themes on the line, acts as cards ----------

const naturally = (a, b) => a.localeCompare(b, 'mk', { numeric: true });
// One colour per theme along the line: the studio's four accents and the hues between them.
const THEME_COLORS = ['#e1e1e1', '#e14b4b', '#e8833a', '#f0c84b', '#a9c25a', '#46a064', '#3db39e', '#64aaaa', '#5b9bd5', '#7d84d8', '#a77ed6', '#d278bd', '#e07a8f', '#c09a6b', '#9fb0bf'];
const sentence = (s) => s.charAt(0) + s.slice(1).toLowerCase();

const countries = [...new Set(index.folders.map((f) => f.split('/')[0]))].sort(naturally);
const themes = [];
const themeByDir = new Map();
for (const f of index.folders) {
  const p = f.split('/');
  if (p.length < 2) continue;
  const dir = `${p[0]}/${p[1]}`;
  if (themeByDir.has(dir)) continue;
  const m = p[1].match(/^(\d+)\s+(.+)$/);
  const num = m ? m[1] : '';
  const t = {
    dir, country: p[0], num, name: sentence(m ? m[2] : p[1]),
    accent: num ? THEME_COLORS[Number(num) % THEME_COLORS.length] : 'var(--ink)',
    moc: null, groups: new Map(), acts: 0, units: 0,
  };
  themes.push(t);
  themeByDir.set(dir, t);
}
themes.sort((a, b) => naturally(a.dir, b.dir));
for (const n of N) if (n.kind === 'moc' && themeByDir.get(n.dir)) themeByDir.get(n.dir).moc = n.i;
acts.forEach((a, ai) => {
  const p = N[a.m].dir.split('/');
  const t = themeByDir.get(`${p[0]}/${p[1]}`);
  if (!t) return;
  const g = p.length > 3 ? p[2] : '';
  if (!t.groups.has(g)) t.groups.set(g, []);
  t.groups.get(g).push(ai);
  t.acts++;
  t.units += a.u.length;
});
for (const t of themes) {
  for (const list of t.groups.values()) list.sort((x, y) => naturally(acts[x].c, acts[y].c));
  t.groups = new Map([...t.groups.entries()].sort((x, y) => naturally(x[0], y[0])));
}
function themeOf(n) {
  if (!n) return null;
  const p = n.dir.split('/');
  return themeByDir.get(`${p[0]}/${p[1]}`) || null;
}
const ACT_STATUS = { важечки: 'st-ok', 'за проверка': 'st-warn', 'престанал да важи': 'st-bad' };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function actCard(ai) {
  const a = acts[ai];
  const [pre, ...rest] = a.c.split('-');
  const num = rest.join('-');
  const text = a.u.length ? plural(a.u.length, 'член', 'членови') : 'консолидиран текст';
  return `<li class="pt" data-act-i="${ai}"><a href="${hrefOf(a.m)}" title="${esc(a.c)} ${esc(a.t)}">
    <span class="pt-frame">${num ? `<small>${esc(pre)}</small>${esc(num)}` : esc(a.c)}</span>
    <span class="pt-card"><span class="pt-dot ${ACT_STATUS[a.s] || ''}" title="${esc(a.s)}"></span>
      <span class="pt-title">${esc(a.t)}</span><span class="pt-text">${esc(text)}</span><span class="pt-here"></span></span>
  </a></li>`;
}

let railCountry = countries[0];

// The notes outside the themes. site.config.json → rootNotes names them and sorts them into
// "start" (cards at the top of the rail) and "about" (links at the bottom); any other note there goes to "about".
const ROOT_ICONS = {
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4"/><circle cx="4.5" cy="12" r="1.4"/><circle cx="4.5" cy="18" r="1.4"/></svg>',
  flow: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="7" height="5" rx="1.2"/><rect x="14.5" y="15.5" width="7" height="5" rx="1.2"/><path d="M6 8.5v5a2.5 2.5 0 0 0 2.5 2.5h6M12 13.5l2.5 2.5-2.5 2.5"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
};
const START_ACCENTS = ['var(--red)', 'var(--yellow)', 'var(--teal)', 'var(--green)'];
function rootNotesOf(country) {
  const cfg = (index.site.rootNotes || []).filter((r) => N[r.i]?.dir === country);
  const named = new Set(cfg.map((r) => r.i));
  const start = cfg.filter((r) => r.group === 'start').map((r, k) => ({ ...r, accent: START_ACCENTS[k % START_ACCENTS.length] }));
  const about = [
    ...cfg.filter((r) => r.group !== 'start'),
    ...N.filter((n) => n.dir === country && !named.has(n.i)).sort((a, b) => naturally(a.base, b.base)).map((n) => ({ i: n.i, label: n.label })),
  ];
  return { start, about };
}
function renderRail() {
  $('#countries').innerHTML = countries.map((c) => `<a class="country${c === railCountry ? ' is-active' : ''}" href="#/" data-country="${esc(c)}">${esc(c)}</a>`).join('');
  const { start, about } = rootNotesOf(railCountry);
  $('#rail-start').innerHTML = start.length ? `<p class="rail-label">Почни тука</p>
    <ul class="act-list start-list">${start.map((r) => `<li class="pt" data-root-i="${r.i}" style="--accent:${r.accent}"><a href="${hrefOf(r.i)}">
      <span class="pt-frame pt-icon">${ROOT_ICONS[r.icon] || ROOT_ICONS.note}</span>
      <span class="pt-card"><span class="pt-title">${esc(r.label)}</span>${r.text ? `<span class="pt-text">${esc(r.text)}</span>` : ''}</span>
    </a></li>`).join('')}</ul>` : '';
  $('#rail-about').innerHTML = about.length ? `<p class="rail-label">За базата</p>
    <ul class="about-list">${about.map((r) => `<li><a href="${hrefOf(r.i)}" data-i="${r.i}">${esc(r.label)}</a></li>`).join('')}</ul>` : '';
  $('#themes').innerHTML = themes.filter((t) => t.country === railCountry).map((t) => `
    <li class="theme" data-theme="${esc(t.dir)}" style="--accent:${t.accent}">
      <button class="th-head" type="button" data-theme-head="${esc(t.dir)}" aria-expanded="false">
        <span class="th-num">${esc(t.num)}</span><span class="th-dot"></span><span class="th-name">${esc(t.name)}</span><span class="th-chev" aria-hidden="true"></span>
      </button>
      <div class="th-body">
        ${t.moc != null ? `<a class="th-overview" href="${hrefOf(t.moc)}" data-i="${t.moc}">Преглед на темата</a>` : ''}${[...t.groups.entries()].map(([g, list]) => `
        ${g ? `<p class="grp-label">${esc(g)}</p>` : ''}
        <ul class="act-list">${list.map(actCard).join('')}</ul>`).join('')}
      </div>
    </li>`).join('');
}

function setThemeOpen(el, open) {
  el.classList.toggle('is-open', open);
  $('.th-head', el).setAttribute('aria-expanded', open);
}
let autoOpened = null; // the theme last opened by navigation; closing it by hand keeps it closed while reading in it

/** Marks the current note's theme, opens it once on arrival, lights up its act and names the член next to the card. */
function markRail() {
  const n = current.i != null ? N[current.i] : null;
  const t = themeOf(n);
  if (t && t.country !== railCountry) { railCountry = t.country; renderRail(); }
  document.documentElement.style.setProperty('--accent', t ? t.accent : 'var(--ink)');
  for (const el of $$('#themes .theme')) el.classList.toggle('is-active', !!t && el.dataset.theme === t.dir);
  if (t && autoOpened !== t.dir) {
    autoOpened = t.dir;
    const el = $(`#themes .theme[data-theme="${CSS.escape(t.dir)}"]`);
    if (el) { setThemeOpen(el, true); $('.th-head', el).scrollIntoView({ block: 'nearest' }); }
  }
  for (const el of $$('#themes .th-overview')) el.classList.toggle('is-current', n != null && Number(el.dataset.i) === n.i);
  for (const el of $$('#themes .pt.is-current')) { el.classList.remove('is-current'); $('.pt-here', el).textContent = ''; }
  for (const el of $$('#rail-about a')) el.classList.toggle('is-current', n != null && Number(el.dataset.i) === n.i);
  for (const el of $$('#rail-start .pt')) el.classList.toggle('is-current', n != null && Number(el.dataset.rootI) === n.i);
  if (!n || n.act < 0) return;
  const card = $(`#themes .pt[data-act-i="${n.act}"]`);
  if (!card) return;
  card.classList.add('is-current');
  if (n.kind !== 'master') $('.pt-here', card).textContent = n.label;
  card.scrollIntoView({ block: 'nearest' });
}

$('#themes').addEventListener('click', (e) => {
  // A theme's name opens and closes its list of acts; its overview page is the first entry inside.
  const head = e.target.closest('[data-theme-head]');
  if (head) setThemeOpen(head.parentElement, !head.parentElement.classList.contains('is-open'));
});
$('#countries').addEventListener('click', (e) => {
  const c = e.target.closest('[data-country]');
  if (!c || c.dataset.country === railCountry) return;
  e.preventDefault();
  railCountry = c.dataset.country;
  autoOpened = null;
  renderRail();
  markRail();
});

// ---------- home ----------

function renderHome() {
  const { start, about } = rootNotesOf(railCountry);
  const list = themes.filter((t) => t.country === railCountry);
  const totalActs = list.reduce((s, t) => s + t.acts, 0);
  const totalUnits = list.reduce((s, t) => s + t.units, 0);
  main.innerHTML = `<div class="home">
    <div class="eyebrow"><span>Прописи</span><span>Членови</span><span>Врски</span><span>Белешки</span></div>
    <p class="lead">Консолидираните прописи на студиото: ${plural(totalActs, 'акт', 'акти')} и ${plural(totalUnits, 'член', 'членови')}, секој член со своите врски. Лебди врз упатување за преглед, закачи членови во сесијата и следи ги врските во дрвото.</p>
    <div class="home-start">${start.map((r) => `
      <a class="tile tile-start" href="${hrefOf(r.i)}" style="--accent:${r.accent}">
        <span class="tile-frame">${ROOT_ICONS[r.icon] || ROOT_ICONS.note}</span>
        <span class="tile-card"><span class="tile-dot"></span><span class="tile-title">${esc(r.label)}</span>${r.text ? `<span class="tile-text">${esc(r.text)}</span>` : ''}</span>
      </a>`).join('')}
    </div>
    ${about.length ? `<p class="home-about">За базата: ${about.map((r) => `<a href="${hrefOf(r.i)}">${esc(r.label)}</a>`).join(' · ')}</p>` : ''}
    <p class="rail-label home-themes">Теми</p>
    <div class="tiles">${list.map((t) => `
      <a class="tile" href="${t.moc != null ? hrefOf(t.moc) : '#/'}" style="--accent:${t.accent}">
        <span class="tile-frame">${esc(t.num)}</span>
        <span class="tile-card"><span class="tile-dot"></span><span class="tile-title">${esc(t.name)}</span>
          <span class="tile-text">${plural(t.acts, 'акт', 'акти')} · ${plural(t.units, 'член', 'членови')}</span></span>
      </a>`).join('')}
    </div>
  </div>`;
  $('#toc').innerHTML = '<p class="hint">Отвори акт или член за да ја видиш неговата содржина.</p>';
  document.title = index.site.title;
}

// ---------- search (Pagefind) ----------

const searchInput = $('#search');
const resultsBox = $('#search-results');
let pf = null;
let searchSeq = 0;
let activeResult = -1;
const searchState = { theme: '', archive: false };

async function ensureSearch() {
  if (pf) return pf;
  pf = await import(new URL('pagefind/pagefind.js', location.href).href);
  await pf.options({ excerptLength: 26 });
  pf.init();
  const filters = await pf.filters();
  const themes = Object.keys(filters['тема'] || {}).sort(naturally);
  $('#search-theme').innerHTML = '<option value="">Сите теми</option>' + themes.map((t) => `<option value="${esc(t)}">${esc(t.split('/').pop())}</option>`).join('');
  return pf;
}

async function runSearch() {
  const q = searchInput.value.trim();
  const seq = ++searchSeq;
  if (!q) { $('#search-list').innerHTML = ''; resultsBox.hidden = !document.activeElement?.closest('.search-wrap'); return; }
  resultsBox.hidden = false;
  await ensureSearch();
  const filters = {};
  if (searchState.theme) filters['тема'] = searchState.theme;
  if (!searchState.archive) filters['вид'] = { none: ['архива'] };
  const search = await pf.search(q, { filters });
  if (seq !== searchSeq) return;
  const top = await Promise.all(search.results.slice(0, 30).map((r) => r.data()));
  if (seq !== searchSeq) return;
  activeResult = -1;
  $('#search-list').innerHTML = top.length
    ? top.map((r) => {
        const u = decodeURIComponent(r.url.replace(/^#\//, ''));
        const i = byU.get(u);
        return `<a class="result wl" href="${esc(r.url)}" ${i != null ? `data-k="${i}"` : ''}>
          <span class="rt">${esc(r.meta.title)}</span>${r.meta.act ? `<span class="ra">${esc(r.meta.act)}</span>` : ''}<span class="rs">${r.excerpt}</span></a>`;
      }).join('') + (search.results.length > 30 ? `<div class="more">+ уште ${search.results.length - 30} — стесни го пребарувањето</div>` : '')
    : '<div class="more">Нема резултати.</div>';
}

let searchTimer = null;
searchInput.addEventListener('focus', () => { ensureSearch(); if (searchInput.value.trim()) resultsBox.hidden = false; });
searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 160); });
resultsBox.addEventListener('change', (e) => {
  if (e.target.id === 'search-theme') searchState.theme = e.target.value;
  if (e.target.id === 'search-archive') searchState.archive = e.target.checked;
  runSearch();
});
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
    case 'clear-tree': treeRoot = null; session.set('treeRoot', ''); renderTree(); break;
    case 'copy-pins': await copyPins(); break;
    case 'clear-pins': pins = []; savePins(); syncPins(); break;
    case 'collapse-pin': {
      const card = b.closest('.pin-card');
      card.classList.toggle('collapsed');
      if (card.classList.contains('collapsed')) collapsedPins.add(toStored(k)); else collapsedPins.delete(toStored(k));
      session.set('pinsCollapsed', [...collapsedPins]);
      break;
    }
    case 'move-pin': {
      const i = pins.indexOf(k);
      const j = i + Number(b.dataset.dir);
      if (i < 0 || j < 0 || j >= pins.length) break;
      [pins[i], pins[j]] = [pins[j], pins[i]];
      savePins();
      renderPins();
      break;
    }
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
  if (e.key === 'Escape') closePopovers(0);
});

$('#toggle-left').addEventListener('click', () => document.body.classList.toggle('show-left'));
$('#toggle-right').addEventListener('click', () => document.body.classList.toggle('show-right'));

// ---------- start ----------

renderRail();
// The legend floats over the page from the bottom-left corner: its button, the ×, Esc or a click elsewhere closes it.
const legend = $('#legend');
const legendBtn = $('#legend-btn');
function setLegend(open) {
  legend.hidden = !open;
  legendBtn.setAttribute('aria-expanded', open);
}
legendBtn.addEventListener('click', () => setLegend(legend.hidden));
$('#legend-close').addEventListener('click', () => { setLegend(false); legendBtn.focus(); });
document.addEventListener('click', (e) => {
  if (!legend.hidden && !e.target.closest('#legend, #legend-btn')) setLegend(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !legend.hidden) setLegend(false); });
showTab(local.get('tab') || 'toc');
syncPins();
renderTree();
window.addEventListener('hashchange', route);
route();
