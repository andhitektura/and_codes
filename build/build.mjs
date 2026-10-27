// Builds the static site in dist/ from the Obsidian vault in content/.
//
// Every note is split into sections. A section is a член ("Член 12", as a
// heading or as a bare line the way laws are pasted from the Службен весник),
// another heading, or the preamble before the first heading. Wikilinks are
// resolved to section keys ("path/to/note#член-12") so the client can preview,
// pin and trace links at член level.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const SITE = path.join(ROOT, 'site');
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

const IGNORED_DIRS = new Set(['.obsidian', '.trash', '.git', 'node_modules', ...(config.ignore || [])]);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

// ---------- helpers ----------

const MEMBER_RE = /^член\s+(\d+)\s*(?:-\s*)?([а-шѓќџљњѕјa-z])?(?=$|[\s.,:;)])/iu;

export function anchorFor(text) {
  const t = text.replace(/[*_`]/g, '').trim();
  const m = t.match(MEMBER_RE);
  if (m) return `член-${m[1]}${m[2] ? '-' + m[2].toLowerCase() : ''}`;
  return t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const hrefFor = (slug, anchor) =>
  '#/' + encodeURIComponent(slug) + (anchor ? '/' + encodeURIComponent(anchor) : '');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.isDirectory()) continue;
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------- 1. read and split notes ----------

const files = fs.existsSync(CONTENT) ? walk(CONTENT) : [];
const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
const assetFiles = files.filter((f) => !f.toLowerCase().endsWith('.md'));

const notes = [];
for (const file of mdFiles) {
  const rel = path.relative(CONTENT, file).split(path.sep).join('/');
  const slug = rel.replace(/\.md$/i, '');
  const raw = fs.readFileSync(file, 'utf8');
  const { data: fm, content } = matter(raw);
  if (fm.draft === true || fm.publish === false) continue;
  const title = String(fm.title || path.basename(slug));
  const sections = splitSections(content);
  // An Obsidian-style "# Title" that repeats the note title is shown once, as the page title.
  const dup = sections.find((s) => s.kind === 'heading' && s.level === 1 && s.label === title);
  if (dup) Object.assign(dup, { kind: 'pre', anchor: '', label: '', heading: null });
  notes.push({ slug, title, fm, sections });
}
notes.sort((a, b) => a.slug.localeCompare(b.slug, 'mk'));

function splitSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let cur = { anchor: '', label: '', kind: 'pre', level: 0, heading: null, body: [] };
  let fence = null;
  const used = new Set();
  const push = (sec) => {
    // Duplicate anchors (e.g. a law pasted twice) get a numeric suffix.
    let a = sec.anchor;
    for (let i = 2; a && used.has(a); i++) a = `${sec.anchor}-${i}`;
    sec.anchor = a;
    used.add(a);
    sections.push(sec);
  };

  for (const line of lines) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      cur.body.push(line);
      continue;
    }
    if (fence) { cur.body.push(line); continue; }

    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    const bare = !h && line.match(/^\s*(?:\*\*|__)?\s*(Член\s+\d+\s*(?:-\s*)?[а-шѓќџљњѕјa-z]?)\s*(?:\*\*|__)?\s*$/iu);

    if (h) {
      const level = h[1].length;
      const text = h[2];
      const isMember = MEMBER_RE.test(text.replace(/[*_`]/g, '').trim());
      // A subheading inside a член stays part of that член.
      if (!isMember && cur.kind === 'member' && level > cur.level) { cur.body.push(line); continue; }
      push(cur);
      cur = { anchor: anchorFor(text), label: text.replace(/[*_`]/g, '').trim(), kind: isMember ? 'member' : 'heading', level, heading: line, body: [] };
      continue;
    }
    if (bare) {
      push(cur);
      const text = bare[1].replace(/\s+/g, ' ');
      cur = { anchor: anchorFor(text), label: text, kind: 'member', level: 7, heading: null, body: [] };
      continue;
    }
    cur.body.push(line);
  }
  push(cur);
  // Drop an empty preamble.
  return sections.filter((s) => s.kind !== 'pre' || s.body.join('').trim());
}

// ---------- 2. link resolution ----------

const bySlug = new Map(notes.map((n) => [n.slug, n]));
const byName = new Map();
for (const n of notes) {
  for (const key of [path.posix.basename(n.slug).toLowerCase(), n.title.toLowerCase()]) {
    if (!byName.has(key)) byName.set(key, n);
  }
  for (const alias of [].concat(n.fm.aliases || [])) {
    const k = String(alias).toLowerCase();
    if (!byName.has(k)) byName.set(k, n);
  }
}
const assetsByName = new Map();
for (const f of assetFiles) {
  const rel = path.relative(CONTENT, f).split(path.sep).join('/');
  assetsByName.set(path.posix.basename(rel).toLowerCase(), rel);
  assetsByName.set(rel.toLowerCase(), rel);
}

function resolveNote(name, fromSlug) {
  if (!name) return bySlug.get(fromSlug);
  const clean = name.replace(/\.md$/i, '').trim();
  if (bySlug.has(clean)) return bySlug.get(clean);
  const lower = clean.toLowerCase();
  if (lower.includes('/')) {
    const hit = notes.find((n) => n.slug.toLowerCase().endsWith(lower));
    if (hit) return hit;
  }
  return byName.get(path.posix.basename(lower)) || byName.get(lower);
}

/** Returns { key, href, slug, anchor } or null. */
function resolveTarget(target, fromSlug) {
  const [namePart, ...rest] = target.split('#');
  const heading = rest.join('#').trim();
  const note = resolveNote(namePart, fromSlug);
  if (!note) return null;
  let anchor = '';
  if (heading && !heading.startsWith('^')) {
    const want = anchorFor(heading.split('#').pop());
    const sec = note.sections.find((s) => s.anchor === want);
    anchor = sec ? sec.anchor : '';
  }
  return { slug: note.slug, anchor, key: anchor ? `${note.slug}#${anchor}` : note.slug, href: hrefFor(note.slug, anchor) };
}

// ---------- 3. render ----------

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });

// Relative markdown links to other notes behave like wikilinks.
let currentSlug = '';
let currentLinks = null;
const defaultLinkOpen = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const tok = tokens[idx];
  const href = tok.attrGet('href') || '';
  if (!/^[a-z]+:/i.test(href) && !href.startsWith('#') && /\.md(#|$)/i.test(decodeURIComponent(href))) {
    const r = resolveTarget(decodeURIComponent(href).replace(/\.md(?=#|$)/i, ''), currentSlug);
    if (r) {
      tok.attrSet('href', r.href);
      tok.attrSet('class', 'wl');
      tok.attrSet('data-k', r.key);
      currentLinks.add(r.key);
    }
  } else if (/^https?:/i.test(href)) {
    tok.attrSet('target', '_blank');
    tok.attrSet('rel', 'noopener');
  }
  return defaultLinkOpen(tokens, idx, opts, env, self);
};

const WIKI_RE = /(!?)\[\[([^\]\n]+?)\]\]/g;

function preprocess(text, slug, links) {
  // Protect inline code and fenced blocks from wikilink / highlight rewriting.
  const stash = [];
  text = text.replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)|`[^`\n]+`/g, (m) => {
    stash.push(m);
    return `\u0000${stash.length - 1}\u0000`;
  });

  text = text.replace(WIKI_RE, (_, bang, inner) => {
    const [target, aliasRaw] = inner.replace(/\\\|/g, '|').split('|');
    const t = target.trim();
    const ext = path.posix.extname(t.split('#')[0]).toLowerCase();
    if (bang && ext && ext !== '.md') {
      const asset = assetsByName.get(t.toLowerCase()) || assetsByName.get(path.posix.basename(t).toLowerCase());
      if (!asset) return `<span class="wl broken">${escapeHtml(t)}</span>`;
      const src = 'files/' + asset.split('/').map(encodeURIComponent).join('/');
      if (IMAGE_EXT.has(ext)) {
        const w = aliasRaw && /^\d+$/.test(aliasRaw.trim()) ? ` width="${aliasRaw.trim()}"` : '';
        return `<img src="${src}" alt="${escapeHtml(path.posix.basename(t))}"${w} loading="lazy">`;
      }
      return `<a href="${src}" target="_blank" rel="noopener">${escapeHtml(path.posix.basename(t))}</a>`;
    }
    const r = resolveTarget(t, slug);
    const label = escapeHtml((aliasRaw || t.replace(/^#/, '').replace(/#/g, ' › ')).trim());
    if (!r) return `<span class="wl broken" title="Не постои во базата">${label}</span>`;
    links.add(r.key);
    if (bang) return `<div class="embed" data-k="${escapeHtml(r.key)}"></div>`;
    return `<a class="wl" href="${r.href}" data-k="${escapeHtml(r.key)}">${label}</a>`;
  });

  text = text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

function calloutize(html) {
  return html.replace(
    /<blockquote>\s*<p>\[!([\w-]+)\]([+-]?)\s*([^\n<]*)(?:\n|<br>\n?)?/g,
    (_, type, _fold, title) =>
      `<blockquote class="callout" data-callout="${escapeHtml(type.toLowerCase())}"><p class="callout-title">${title || type}</p><p>`
  );
}

const stripTags = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const edges = new Set();
const searchDocs = [];
const noteFiles = [];

notes.forEach((note, i) => {
  const rendered = [];
  for (const sec of note.sections) {
    const key = sec.anchor ? `${note.slug}#${sec.anchor}` : note.slug;
    const links = new Set();
    currentSlug = note.slug;
    currentLinks = links;
    const source = (sec.kind === 'heading' ? sec.heading + '\n' : '') + sec.body.join('\n');
    const html = calloutize(md.render(preprocess(source, note.slug, links)));
    for (const to of links) if (to !== key) edges.add(`${key}\u0001${to}`);
    rendered.push({ a: sec.anchor, l: sec.label, k: sec.kind, h: html });
    const text = stripTags(html);
    if (text || sec.label) {
      searchDocs.push({ id: searchDocs.length, k: key, t: sec.label ? `${note.title} › ${sec.label}` : note.title, x: text });
    }
  }
  noteFiles.push({ i, data: { s: note.slug, t: note.title, fm: note.fm, sec: rendered } });
});

// ---------- 4. write dist ----------

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'data', 'notes'), { recursive: true });

const pickFm = (fm) => {
  const out = {};
  for (const k of config.frontmatterChips || []) if (fm[k] != null && fm[k] !== '') out[k] = fm[k];
  if (fm.sample) out.sample = true;
  return out;
};

const index = {
  site: { title: config.title, home: config.home },
  notes: notes.map((n) => ({
    s: n.slug,
    t: n.title,
    f: pickFm(n.fm),
    m: n.sections.filter((s) => s.anchor).map((s) => [s.anchor, s.label, s.kind === 'member' ? 1 : 0]),
  })),
  edges: [...edges].map((e) => e.split('\u0001')),
  built: new Date().toISOString(),
};

const json = (o) => JSON.stringify(o, (k, v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v));
fs.writeFileSync(path.join(DIST, 'data', 'index.json'), json(index));
for (const { i, data } of noteFiles) fs.writeFileSync(path.join(DIST, 'data', 'notes', `${i}.json`), json(data));
fs.writeFileSync(path.join(DIST, 'data', 'search.json'), JSON.stringify(searchDocs));

for (const f of assetFiles) {
  const rel = path.relative(CONTENT, f);
  const dest = path.join(DIST, 'files', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f, dest);
}

fs.cpSync(SITE, DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'vendor'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'node_modules', 'minisearch', 'dist', 'es', 'index.js'), path.join(DIST, 'vendor', 'minisearch.js'));
const indexHtml = path.join(DIST, 'index.html');
fs.writeFileSync(indexHtml, fs.readFileSync(indexHtml, 'utf8').replaceAll('{{TITLE}}', escapeHtml(config.title)));

const memberCount = notes.reduce((n, x) => n + x.sections.filter((s) => s.kind === 'member').length, 0);
console.log(`Built ${notes.length} notes, ${memberCount} членови, ${edges.size} links, ${assetFiles.length} files → dist/`);
