# and_codes

The studio's regulations vault (`CODES/`) and a static website built from it.

The site reads the vault the way it is organised (see `CODES/MKD/_instructions/`). Each член note (`<КОД>-Членови/<КОД>-Член N.md`) is the unit the site links to, pins and traces. The master (`<КОД> - консолидиран.md`) is the act's page.

- **Hover previews.** Hovering over a link to a член opens it in a popover, the way Obsidian does. Links inside a popover open further popovers. Footnote markers in the masters show their footnote text on hover.
- **Pins (session memory).** The pin button on a член, either on its own page or on its heading in the master, adds it to *Закачени*. Pins last as long as the browser tab is open, and they survive a reload or a rebuild of the site. **Копирај сè** copies the text of every pinned член, with its citation ("Закон за градење, Член 59 (ГР-01)"). Callouts, footnote markers and previous redactions are left out of the copy.
- **Research tree (*Дрво*).** For a член, the tree shows what it links to (→) and what links to it (←); each node expands on click, and loops are marked with ↻. Starting from a whole act, the links are grouped by act. **Копирај** copies the expanded branch as an indented outline with citations.
- **Search.** Full-text search (Ctrl+K) over членови, преодни одредби and notes, with a filter by theme. Previous redactions from `-Архива/` are searched only when that filter is ticked. Masters whose text lives in their член notes are found by name.
- **Navigation.** A член page has previous/next член links and a link to the same place in the consolidated text. The *Содржина* tab lists all членови of the act, with deleted ones struck through. *Поврзано* shows backlinks. Frontmatter links (`котва`, `заменет-со`) are clickable.

## Running it

```
npm install
npm run dev        # build and serve at http://localhost:4173
```

A full build of `CODES/` takes about 25 s.

## What gets published

Everything under `CODES/` except the paths matched by `ignore` in `site.config.json`. By default that leaves out the internal working material: `_instructions/`, `-Извештаи/`, the audit reports, the second-reading notes and the consolidation-status notes. `.bak` files, the CSV and the JSON are never published. Notes with `publish: false` or `draft: true` in their frontmatter are skipped. Links to notes that aren't published are shown dashed.

How notes are recognised:

| In the vault | On the site |
|---|---|
| `<КОД> - консолидиран.md` | the act; `##### [[ГР-01-Член 5\|Член 5]]` headings get the член's actions |
| note in `-Членови/`, `-Точки/`, `-Класи/` | a член (a link target, pinnable, traceable) |
| note in `-ПЗО/` | a преодна одредба (part of the link graph) |
| note in `-Архива/` | a previous redaction; can be opened, but stays out of the graph and the default search |
| `00 MOC — …` | an overview page |
| anything else | a note; `## Член N` headings or bare `Член N` lines inside it are split into членови |

Masters, archive notes and MOCs don't add links to the graph. The master repeats its членови, the archive is history (т. 5.4), and the MOCs are indexes.

New countries (`CODES/US`, `CODES/UK`, …) are picked up automatically: each country becomes a top-level folder in the explorer and a set of themes in the search filter.

## Deploying

The build output in `dist/` is plain static files, about 11,000 files and 285 MB, most of it the scanned annex images. To use Cloudflare Pages, connect the repo with:

- Build command: `npm run build`
- Output directory: `dist`

Cloudflare Pages allows 20,000 files per deployment on the free plan. Cloudflare Access can put a login in front of the site.

## Layout

```
CODES/            the vault
build/build.mjs   vault → dist/data (index, per-act bundles) + dist/pagefind (search)
build/serve.mjs   local preview server
site/             the client: index.html, app.js, style.css
site.config.json  title, home note, what to publish, which frontmatter fields to show
```
