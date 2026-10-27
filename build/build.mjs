// Builds the static site in dist/ from the Obsidian vault (site.config.json → contentDir).
//
// The vault follows the MKD standard (CODES/MKD/_instructions): every член is its own
// note in "<КОД>-Членови/" and is the stable link target; "<КОД> - консолидиран.md" is the
// master with the full text; "-Архива/" holds earlier redactions; "-ПЗО/" transitional
// provisions. Notes that keep several членови as headings ("## Член 5") or bare lines are
// also split into членови, so other vault layouts keep working.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import * as pagefind from 'pagefind';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const CONTENT = path.join(ROOT, config.contentDir || 'content');

const ignoreRes = (config.ignore || []).map((s) => new RegExp(s, 'u'));
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif', '.pdf']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
const META_SECTIONS = new Set(config.metaSections || []);

// ---------- helpers ----------

const MEMBER_RE = /^член\s+(\d+)\s*(?:-\s*)?([а-шѓќџљњѕјa-z])?(?=$|[\s.,:;)\]])/iu;
const BARE_MEMBER_RE = /^\s*(?:\*\*|__)?\s*(Член\s+\d+\s*(?:-\s*)?[а-шѓќџљњѕјa-z]?)\s*(?:\*\*|__)?\s*$/iu;

function anchorFor(text) {
  const t = text.replace(/[*_`]/g, '').trim();
  const m = t.match(MEMBER_RE);
  if (m) return `член-${m[1]}${m[2] ? '-' + m[2].toLowerCase() : ''}`;
  return t.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stripTags = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** Visible text of a heading or paragraph source: wikilinks → their label, footnote refs dropped. */
const plainOf = (src) =>
  stripTags(
    src
      .replace(/!?\[\[([^\]|]+)(?:\\?\|([^\]]+))?\]\]/g, (_, t, a) => a || t.replace(/^#/, '').replace(/#/g, ' › '))
      .replace(/\[\^[^\]]+\]/g, '')
  ).replace(/[*_`]/g, '').trim();

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(CONTENT, full).split(path.sep).join('/');
    if (ignoreRes.some((re) => re.test(entry.isDirectory() ? rel + '/' : rel))) continue;
    if (entry.isDirectory()) walk(full, out);
    else out.push(rel);
  }
  return out;
}

const fmDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
const fmString = (v) => (Array.isArray(v) ? v.map(fmDate).join(', ') : String(fmDate(v)));

// ---------- 1. read notes ----------

if (!fs.existsSync(CONTENT)) throw new Error(`Content folder not found: ${CONTENT}`);
const files = walk(CONTENT);
const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md')).sort((a, b) => a.localeCompare(b, 'mk', { numeric: true }));
const assetFiles = files.filter((f) => ASSET_EXT.has(path.posix.extname(f).toLowerCase()));

const notes = [];
for (const rel of mdFiles) {
  const raw = fs.readFileSync(path.join(CONTENT, rel), 'utf8');
  let parsed;
  try {
    parsed = matter(raw);
  } catch (e) {
    console.warn(`! frontmatter not parsed, kept as text: ${rel}`);
    parsed = { data: {}, content: raw };
  }
  const fm = parsed.data || {};
  if (fm.draft === true || fm.publish === false) continue;
  const dir = path.posix.dirname(rel);
  const base = path.posix.basename(rel, path.posix.extname(rel));
  const parent = path.posix.basename(dir);
  const h1 = (parsed.content.match(/^#\s+(.+?)\s*#*\s*$/m) || [])[1];
  let kind = 'note';
  if (/ - консолидиран$/.test(base)) kind = 'master';
  else if (/-(Членови|Точки|Класи)$/.test(parent)) kind = 'unit';
  else if (/-Архива$/.test(parent) || fm['котва']) kind = 'archive';
  else if (/-ПЗО$/.test(parent)) kind = 'pzo';
  else if (/^00 MOC/.test(base)) kind = 'moc';
  const label = String(
    (kind === 'master' && fm['назив']) ||
      (h1 && plainOf(h1)) ||
      fm.title ||
      (fm['член'] != null ? `Член ${fm['член']}` : base)
  );
  notes.push({ i: notes.length, rel, slug: rel.replace(/\.md$/i, ''), dir, base, fm, body: parsed.content, kind, label, h1: h1 && plainOf(h1) });
}

// Acts: the folder that holds a master.
const acts = [];
const actByDir = new Map();
for (const n of notes) {
  if (n.kind !== 'master' || actByDir.has(n.dir)) continue;
  const a = { i: acts.length, dir: n.dir, code: String(n.fm['код'] || n.base.replace(/ - консолидиран$/, '')), name: n.label, master: n.i, status: n.fm['статус'] ? String(n.fm['статус']) : '', units: [] };
  acts.push(a);
  actByDir.set(n.dir, a);
}
for (const n of notes) {
  n.act = -1;
  for (let d = n.dir; d && d !== '.'; d = path.posix.dirname(d)) {
    if (actByDir.has(d)) { n.act = actByDir.get(d).i; break; }
  }
}

// ---------- 2. link resolution ----------

const bySlug = new Map(notes.map((n) => [n.slug.toLowerCase(), n]));
const byBase = new Map();
const byAlias = new Map();
for (const n of notes) {
  const b = n.base.toLowerCase();
  if (!byBase.has(b)) byBase.set(b, n);
  for (const alias of [].concat(n.fm.aliases || [])) {
    const k = String(alias).toLowerCase();
    if (!byAlias.has(k)) byAlias.set(k, n);
  }
}
const assetsByName = new Map();
for (const rel of assetFiles) {
  const b = path.posix.basename(rel).toLowerCase();
  if (!assetsByName.has(b)) assetsByName.set(b, rel);
  assetsByName.set(rel.toLowerCase(), rel);
}

/** Anchors each note exposes, computed the same way the renderer does. */
function headingAnchors(body) {
  const out = [];
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) { fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0]; continue; }
    if (fence) continue;
    const h = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    const b = !h && line.match(BARE_MEMBER_RE);
    if (h) out.push(anchorFor(plainOf(h[1])));
    else if (b) out.push(anchorFor(b[1].replace(/\s+/g, ' ')));
  }
  return uniqueAnchors(out);
}
function uniqueAnchors(list) {
  const used = new Set();
  return list.map((a) => {
    let x = a;
    for (let k = 2; x && used.has(x); k++) x = `${a}-${k}`;
    used.add(x);
    return x;
  });
}
for (const n of notes) n.anchors = new Set(headingAnchors(n.body));

function resolveNote(name, from) {
  if (!name) return from;
  const clean = name.replace(/\.md$/i, '').trim().toLowerCase();
  if (bySlug.has(clean)) return bySlug.get(clean);
  if (clean.includes('/')) {
    const hit = notes.find((n) => n.slug.toLowerCase().endsWith('/' + clean));
    if (hit) return hit;
  }
  const b = path.posix.basename(clean);
  return byBase.get(b) || byAlias.get(clean) || byAlias.get(b);
}

// URL id: the file name, which the MKD standard keeps globally unique; else the path.
const baseCount = new Map();
for (const n of notes) baseCount.set(n.base, (baseCount.get(n.base) || 0) + 1);
for (const n of notes) n.u = baseCount.get(n.base) > 1 ? n.slug : n.base;
const hrefFor = (n, anchor) => '#/' + encodeURIComponent(n.u) + (anchor ? '/' + encodeURIComponent(anchor) : '');

function resolveTarget(target, from) {
  const [namePart, ...rest] = target.split('#');
  const note = resolveNote(namePart, from);
  if (!note) return null;
  let anchor = '';
  const heading = rest.join('#').trim();
  if (heading && !heading.startsWith('^')) {
    const want = anchorFor(heading.split('#').pop());
    if (note.anchors.has(want)) anchor = want;
  }
  return { note, anchor, key: anchor ? `${note.i}#${anchor}` : String(note.i), href: hrefFor(note, anchor) };
}

// ---------- 3. render ----------

const md = new MarkdownIt({ html: true, linkify: true, breaks: true }).use(footnote);
md.renderer.rules.footnote_block_open = () => '<section class="footnotes"><ol class="footnotes-list">\n';

let currentNote = null;
const defaultLinkOpen = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const tok = tokens[idx];
  const href = tok.attrGet('href') || '';
  let decoded = href;
  try { decoded = decodeURIComponent(href); } catch (e) { /* keep raw */ }
  if (!/^[a-z]+:/i.test(href) && !href.startsWith('#') && /\.md(#|$)/i.test(decoded)) {
    const r = resolveTarget(decoded.replace(/\.md(?=#|$)/i, ''), currentNote);
    if (r) {
      tok.attrSet('href', r.href);
      tok.attrSet('class', 'wl');
      tok.attrSet('data-k', r.key);
    }
  } else if (/^https?:/i.test(href)) {
    tok.attrSet('target', '_blank');
    tok.attrSet('rel', 'noopener');
  }
  return defaultLinkOpen(tokens, idx, opts, env, self);
};

const WIKI_RE = /(!?)\[\[([^\]\n]+?)\]\]/g;
const assetSrc = (rel) => 'files/' + rel.split('/').map(encodeURIComponent).join('/');

function wikiToHtml(bang, inner, from) {
  const [target, aliasRaw] = inner.replace(/\\\|/g, '|').split('|');
  const t = target.trim();
  const ext = path.posix.extname(t.split('#')[0]).toLowerCase();
  if (ext && ext !== '.md' && ASSET_EXT.has(ext)) {
    const asset = assetsByName.get(t.toLowerCase()) || assetsByName.get(path.posix.basename(t).toLowerCase());
    if (!asset) return `<span class="wl broken">${escapeHtml(t)}</span>`;
    if (bang && IMAGE_EXT.has(ext)) {
      const w = aliasRaw && /^\d+$/.test(aliasRaw.trim()) ? ` width="${aliasRaw.trim()}"` : '';
      return `<img src="${assetSrc(asset)}" alt="${escapeHtml(path.posix.basename(t))}"${w} loading="lazy">`;
    }
    return `<a href="${assetSrc(asset)}" target="_blank" rel="noopener">${escapeHtml(aliasRaw || path.posix.basename(t))}</a>`;
  }
  const r = resolveTarget(t, from);
  const label = escapeHtml((aliasRaw || t.replace(/^#/, '').replace(/#/g, ' › ')).trim());
  if (!r) return `<span class="wl broken" title="Не постои во базата">${label}</span>`;
  if (bang) return `<div class="embed" data-k="${r.key}"></div>`;
  return `<a class="wl" href="${r.href}" data-k="${r.key}">${label}</a>`;
}

function preprocess(text, from) {
  // Protect code from wikilink / highlight rewriting.
  const stash = [];
  text = text.replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)|`[^`\n]+`/g, (m) => {
    stash.push(m);
    return `\u0000${stash.length - 1}\u0000`;
  });
  text = text.replace(WIKI_RE, (_, bang, inner) => wikiToHtml(bang, inner, from));
  text = text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

function calloutize(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!([\w-]+)\][+-]?[ \t]*([^\n<]*)(?:<br>\n?|\n)?/g,
    (_, type, title) =>
      `<blockquote class="callout" data-callout="${escapeHtml(type.toLowerCase())}"><p class="callout-title">${title || type}</p><p>`
  ).replace(/<p><\/p>/g, '');
}

const DATA_K = /data-k="([^"]+)"/g;
const unitAnchorInMaster = new Map(); // unit note i → anchor in its master
const sectionLabels = new Map(); // "i#anchor" → heading text

function renderNote(n) {
  currentNote = n;
  const env = {};
  const tokens = md.parse(preprocess(n.body, n), env);

  // The H1 that repeats the note's label is shown once, as the page title.
  const h1 = tokens.findIndex((t) => t.type === 'heading_open' && t.tag === 'h1' && t.level === 0);
  if (h1 >= 0 && plainOf(tokens[h1 + 1].content) === n.label) tokens.splice(h1, 3);

  const sections = [];
  const anchors = [];
  let cur = { kind: 'pre', label: '', level: 0, start: 0 };
  const close = (end) => { cur.end = end; if (end > cur.start) sections.push(cur); };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.level !== 0) continue;
    if (t.type === 'heading_open') {
      const level = Number(t.tag.slice(1));
      const src = tokens[i + 1].content;
      const text = plainOf(src);
      // A "##### [[ГР-01-Член 5|Член 5]]" heading in a master is the член note's section.
      let unit;
      for (const m of src.matchAll(DATA_K)) {
        const target = notes[Number(m[1])];
        if (target && target.kind === 'unit' && !m[1].includes('#')) { unit = target.i; break; }
      }
      const isMember = unit != null || MEMBER_RE.test(text);
      if (!isMember && cur.kind === 'member' && level > cur.level) continue;
      close(i);
      cur = { kind: isMember ? 'member' : 'heading', label: text, level, start: i, unit };
      anchors.push(anchorFor(text));
    } else if (t.type === 'paragraph_open' && tokens[i + 1]?.type === 'inline') {
      const b = tokens[i + 1].content.match(BARE_MEMBER_RE);
      if (!b) continue;
      close(i);
      const text = b[1].replace(/\s+/g, ' ');
      cur = { kind: 'member', label: text, level: 7, start: i };
      anchors.push(anchorFor(text));
    } else if (t.type === 'footnote_block_open') {
      close(i);
      cur = { kind: 'footnotes', label: '', level: 0, start: i };
    }
  }
  close(tokens.length);

  const unique = uniqueAnchors(anchors);
  let ai = 0;
  const out = [];
  for (const s of sections) {
    const anchor = s.kind === 'member' || s.kind === 'heading' ? unique[ai++] : '';
    const html = calloutize(md.renderer.render(tokens.slice(s.start, s.end), md.options, env));
    if (s.kind === 'pre' && !stripTags(html) && !/<img|class="embed"/.test(html)) continue;
    if (s.unit != null && n.kind === 'master') unitAnchorInMaster.set(s.unit, anchor);
    if (anchor) sectionLabels.set(`${n.i}#${anchor}`, s.label);
    out.push({ a: anchor, l: s.label, k: s.kind, h: html, ...(s.unit != null ? { x: s.unit } : {}) });
  }
  return out;
}

// ---------- 4. graph, bundles, search records ----------

const KIND_CHAR = { master: 'm', unit: 'u', archive: 'a', pzo: 'p', moc: 'c', note: 'n' };
const SOURCE_KINDS = new Set(['unit', 'pzo', 'note']);
const NOTE_LEVEL_KINDS = new Set(['unit', 'pzo', 'archive']);
const edges = new Set();
const bundles = new Map(); // bundle key → { id, items: {} }
const records = [];
const chipKeys = config.chips || {};
const fmLinkKeys = config.frontmatterLinks || [];

function bundleOf(n) {
  const key = n.kind === 'master' ? `m:${n.i}` : n.act >= 0 ? `${n.kind === 'archive' ? 'a' : 'u'}:${n.act}` : `d:${n.dir}`;
  if (!bundles.has(key)) bundles.set(key, { id: bundles.size, items: {} });
  return bundles.get(key);
}

const themeOf = (n) => n.rel.split('/').slice(0, 2).join('/');
const isNorm = (s) => s.k !== 'footnotes' && !(s.k === 'heading' && META_SECTIONS.has(s.l));
const searchText = (secs) =>
  stripTags(secs.filter(isNorm).map((s) => s.h.replace(/<blockquote class="callout"[\s\S]*?<\/blockquote>/g, ' ')).join(' '));

let rendered = 0;
for (const n of notes) {
  const sec = renderNote(n);
  rendered++;

  if (SOURCE_KINDS.has(n.kind)) {
    for (const s of sec) {
      if (s.k === 'footnotes') continue;
      const from = NOTE_LEVEL_KINDS.has(n.kind) || !s.a ? String(n.i) : `${n.i}#${s.a}`;
      for (const m of s.h.matchAll(DATA_K)) {
        const to = m[1];
        const target = notes[Number(to.split('#')[0])];
        if (!target || target.kind === 'archive' || target.i === n.i) continue;
        edges.add(`${from}\u0001${to}`);
      }
    }
  }

  const chips = {};
  for (const key of chipKeys[n.kind] || chipKeys.default || []) {
    if (n.fm[key] != null && n.fm[key] !== '') chips[key] = fmString(n.fm[key]);
  }
  const links = [];
  for (const key of fmLinkKeys) {
    const v = n.fm[key];
    if (!v) continue;
    for (const m of fmString(v).matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
      const r = resolveTarget(m[1], n);
      if (r) {
        links.push([key, r.key]);
        if (SOURCE_KINDS.has(n.kind) && r.note.kind !== 'archive') edges.add(`${n.i}\u0001${r.key}`);
      }
    }
  }
  bundleOf(n).items[n.i] = { sec, ...(Object.keys(chips).length ? { c: chips } : {}), ...(links.length ? { fl: links } : {}) };

  // Search: masters whose text lives in член notes are indexed by name only.
  const act = acts[n.act];
  const hasUnits = n.kind === 'master' && notes.some((x) => x.act === n.act && x.kind === 'unit');
  const content = n.kind === 'master' && hasUnits
    ? [n.label, ...[].concat(n.fm.aliases || []), act?.code].filter(Boolean).join(' ')
    : searchText(sec);
  if (content || n.kind === 'master') {
    const prefix = act && n.kind !== 'master' ? `${act.code} · ` : '';
    records.push({
      url: '#/' + encodeURIComponent(n.u),
      content: content || n.label,
      language: config.language || 'mk',
      meta: { title: prefix + n.label, ...(act && n.kind !== 'master' ? { act: act.name } : {}) },
      filters: { вид: [config.searchKinds?.[n.kind] || n.kind], тема: [themeOf(n)] },
    });
  }
}

// Units in the order of their master; anything the master doesn't list goes after.
const unitNum = (n) => String(n.fm['член'] ?? n.fm['точка'] ?? n.label);
for (const a of acts) {
  const masterSecs = bundles.get(`m:${a.master}`).items[a.master].sec;
  const seen = new Set();
  for (const s of masterSecs) if (s.x != null && !seen.has(s.x)) { seen.add(s.x); a.units.push(s.x); }
  const rest = notes.filter((n) => n.act === a.i && n.kind === 'unit' && !seen.has(n.i))
    .sort((x, y) => unitNum(x).localeCompare(unitNum(y), 'mk', { numeric: true }));
  for (const n of rest) a.units.push(n.i);
}

// ---------- 5. write dist ----------

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'data', 'b'), { recursive: true });

const folders = [...new Set(notes.map((n) => n.dir))].sort((a, b) => a.localeCompare(b, 'mk', { numeric: true }));
const folderIdx = new Map(folders.map((f, i) => [f, i]));
const homeNote = resolveNote(config.home, null);

const json = (o) => JSON.stringify(o, (k, v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));
const index = {
  site: { title: config.title, home: homeNote ? homeNote.i : null, metaSections: [...META_SECTIONS] },
  folders,
  acts: acts.map((a) => ({ c: a.code, t: a.name, m: a.master, s: a.status, u: a.units.map((i) => [i, unitAnchorInMaster.get(i) || '']) })),
  // [folder, file name, label, kind, act, bundle, status]
  notes: notes.map((n) => [folderIdx.get(n.dir), n.base, n.label, KIND_CHAR[n.kind], n.act, bundleOf(n).id, n.fm['статус'] ? String(n.fm['статус']) : '']),
  edges: [...edges].map((e) => e.split('\u0001').map((k) => (/^\d+$/.test(k) ? Number(k) : k))),
  // Heading text of the sections that appear in links, for labels.
  sections: Object.fromEntries([...edges].flatMap((e) => e.split('\u0001')).filter((k) => k.includes('#') && sectionLabels.has(k)).map((k) => [k, sectionLabels.get(k)])),
  built: new Date().toISOString(),
};
fs.writeFileSync(path.join(DIST, 'data', 'index.json'), json(index));
for (const b of bundles.values()) fs.writeFileSync(path.join(DIST, 'data', 'b', `${b.id}.json`), json(b.items));

for (const rel of assetFiles) {
  const dest = path.join(DIST, 'files', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(CONTENT, rel), dest);
}

fs.cpSync(SITE, DIST, { recursive: true });
const indexHtml = path.join(DIST, 'index.html');
fs.writeFileSync(indexHtml, fs.readFileSync(indexHtml, 'utf8').replaceAll('{{TITLE}}', escapeHtml(config.title)));

const { index: pf } = await pagefind.createIndex({ forceLanguage: config.language || 'mk' });
for (const r of records) await pf.addCustomRecord(r);
await pf.writeFiles({ outputPath: path.join(DIST, 'pagefind') });
await pagefind.close();

const count = (k) => notes.filter((n) => n.kind === k).length;
console.log(
  `Built ${notes.length} notes (${acts.length} acts, ${count('unit')} членови, ${count('pzo')} ПЗО, ${count('archive')} archived), ` +
    `${edges.size} links, ${bundles.size} bundles, ${assetFiles.length} files, ${records.length} search records → dist/`
);
