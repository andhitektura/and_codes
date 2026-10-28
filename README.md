# and_codes

The studio's regulations vault (`CODES/`) and **and_codes**, the static website built from it. The site follows the design of [andhitektura.com](https://github.com/andhitektura/andhitektura.com): its palette, dot grid, the line and frame-and-card lists, and the studio typeface [and_Lubrifont](https://github.com/andhitektura/and_Lubrifont) (SIL OFL 1.1, `site/fonts/and_Lubrifont/OFL.txt`).

The site reads the vault the way it is organised (see `CODES/MKD/_instructions/`). Each член note (`<КОД>-Членови/<КОД>-Член N.md`) is the unit the site links to, pins and traces. The master (`<КОД> - консолидиран.md`) is the act's page.

- **Hover previews.** Hovering over a link to a член opens it in a popover, the way Obsidian does. Links inside a popover open further popovers. Footnote markers in the masters show their footnote text on hover.
- **Pins (session memory).** The pin button on a член, either on its own page or on its heading in the master, adds it to *Закачени* as a small card (a numbered frame, the член, its act and its category, a status dot). The card's arrow unfolds its text; clicking the card itself opens the whole item. Pins and unfolded cards last as long as the browser tab is open, and they survive a reload or a rebuild of the site. **Копирај сè** copies the text of every pinned член, with its citation ("Закон за градење, Член 59 (ГР-01)"). Callouts, footnote markers and previous redactions are left out of the copy.
- **Category.** Wherever the side panels list a член with its act (Врски, Закачени, Дрво) the category it belongs to is added under it, e.g. a dot in the theme's colour and "02 Градење".
- **Research tree (*Дрво*).** For a член, the tree shows what it links to (→) and what links to it (←); each node expands on click, and loops are marked with ↻. Starting from a whole act, the links are grouped by act. **Копирај** copies the expanded branch as an indented outline with citations.
- **Search.** Full-text search (Ctrl+K) over членови, преодни одредби and notes, with a filter by theme. Previous redactions from `-Архива/` are searched only when that filter is ticked. Masters whose text lives in their член notes are found by name.
- **Root notes.** The notes outside the themes are listed in `rootNotes` in `site.config.json`. They are cards at the top of the menu and on the home page, in the order listed: *За проектот* (what the project is; `CODES/MKD/00 За проектот.md`), Регистар на прописи and Методологија и ограничувања. A note there that isn't listed is added after them.
- **The menu.** It follows the studio's menu (andhitektura.com): the line stays grey with an arm and a dot at each end; the dots, dashes and the small **+** carry the colour of their section. The menu has two views. *Themes*: the themes on the line (00–14, each in its colour); a theme's name opens and closes its list of acts (numbered cards, laws and bylaws apart, its overview page first); the act being read is lit up with the член you're on. *Act*: choosing an act turns the menu into its outline. The act's name is the title, with a back button to the themes; below it the headings (`##` › `###` › `####`) and членови hang from the line as a collapsible tree, open down to the член being read, with the **+** at the part you are in. Deleted членови are struck through. Pages that aren't acts but have a few headings get the same outline.
- **The right panels.** *Врски* (backlinks), *Закачени* (pins) and *Дрво* (research tree) are stacked. Pointing at a panel opens it with an animation; the others shrink to strips above or below it. A click or the keyboard also opens one, and the open panel is remembered.
- **Scrollbars.** Every scrollbar follows the menu's line, simplified: a thin line with a dot that slides along it (yellow when grabbed), in a wider empty gutter so it stays clear of the panel borders. Where the content around is dense (the menu, the panels, popovers, code) the line and the dot are thinner; the one for the main text is the most visible. Firefox falls back to its own thin scrollbar.
- **Corners.** The bottom of the menu holds the GitHub button and the legend button, at the menu's right edge and as far from the bottom of the screen as the corner logo (8 mm). The right panels run from near the top of the window to well above the logo.
- **Navigation.** A член page has previous/next член links and a link to the same place in the consolidated text. Frontmatter links (`котва`, `заменет-со`) are clickable. The legend (bottom left) explains the colours and symbols.
- **AI instructions.** `AI-INSTRUCTIONS.md` at the repository root tells an AI assistant how to read, find and cite the vault (the authority rule, structure, naming, statuses, verification levels, how to answer) and carries the live register of acts with their paths. `npm run build` regenerates it from `site/ai-instructions.md`, so commit it after changing the vault; the site also serves it as `ai-instructions.md`.

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

New countries (`CODES/US`, `CODES/UK`, …) are picked up automatically: each country gets its own button above the rail, its themes on the line and in the search filter.

## Deploying

The build output in `dist/` is plain static files, about 11,000 files and 285 MB, most of it the scanned annex images. Every link is relative and routing uses `#/…`, so the site works from any sub-path.

**GitHub Pages** (`.github/workflows/pages.yml`): every push to `main` builds the site and deploys it. To turn it on, go to Settings → Pages → Source and choose **GitHub Actions**. Pages needs the repo to be public, or a paid GitHub plan for a private repo. For a custom domain such as `codes.andhitektura.com`, set it in the same settings page and add a CNAME record at the DNS provider pointing to `andhitektura.github.io`.

**Cloudflare Pages** is the alternative for a private repo. Connect the repo with build command `npm run build` and output directory `dist`.

## Layout

```
CODES/            the vault
build/build.mjs   vault → dist/data (index, per-act bundles) + dist/pagefind (search)
build/serve.mjs   local preview server
site/             the client: index.html, app.js, style.css
site.config.json  title, what to publish, root notes, which frontmatter fields to show
```
