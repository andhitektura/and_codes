# and_codes

Searchable website for the studio's regulations vault. It reads the Obsidian vault in `content/` and builds a static site in `dist/` that works like Obsidian, at член level:

- **Hover previews.** Hovering over a link opens the linked член in a popover. Links inside the popover open further popovers, as in Obsidian.
- **Pins (session memory).** The pin button on any член adds it to the *Закачени* panel. Pins are kept for as long as the browser tab is open, and they survive a reload. **Копирај сè** copies all pinned членови as text, each with its citation (title, член, gazette).
- **Research tree.** The tree button on a член makes it the root of a tree in the *Дрво* panel. The tree shows what the член links to (→) and what links to it (←). Each node expands on click, and loops are marked with ↻. **Копирај** copies the expanded branch as an indented outline.
- **Search.** Full-text search across every член (Ctrl+K). Results also have hover previews.
- **Other panels.** A file explorer, a table of contents with scroll tracking, backlinks (*Поврзано*), embeds (`![[...]]`), callouts, `==highlights==`, and light/dark themes.

## Adding the vault

Copy the vault (or the part you want published) into `content/` and delete `content/_примери/`. `content/index.md` is the home page; edit it or replace it.

```
npm install
npm run dev        # build and serve at http://localhost:4173
```

### What the build recognises

| In the vault | Becomes |
|---|---|
| `## Член 12` / `### Член 12-а` (any heading level) | a член; subheadings inside it stay part of it |
| A line containing only `Член 12` or `**Член 12**` (text pasted from Службен весник) | a член |
| `[[Закон за градење]]`, `[[Закон за градење#Член 12]]`, `[[#Член 12]]`, `[[...\|alias]]` | a link resolved to the note or the член |
| `![[Note#Член 12]]` / `![[plan.png]]` | an embedded член / an image |
| `[text](Other%20note.md#Член 12)` | same as a wikilink |
| Other headings | sections that can be linked, pinned and traced |

Note names resolve the way Obsidian does them: by file name, by `title` or `aliases` in the frontmatter, or by a partial path. Links to notes that don't exist are shown dashed.

Frontmatter fields listed in `site.config.json` → `frontmatterChips` appear as chips on the page:

```yaml
---
title: Закон за градење
type: закон
gazette: "Сл. весник 130/09 … 72/25"
status: важечки        # важечки / изменет / укинат
aliases: [ЗГ]
---
```

Notes with `draft: true` or `publish: false` are skipped, as are the folders listed under `ignore` in `site.config.json` (`.obsidian` and `.trash` are always skipped).

## Deploying

The build output is plain static files, so any static host works. To use Cloudflare Pages, connect the repo with:

- Build command: `npm run build`
- Output directory: `dist`

Every push then rebuilds the site. Cloudflare Access can put a login in front of it if the site shouldn't be public.

## Layout

```
build/build.mjs   vault → dist/data (index, per-note JSON, search docs)
build/serve.mjs   local preview server
site/             the client: index.html, app.js, style.css
content/          the vault
```
