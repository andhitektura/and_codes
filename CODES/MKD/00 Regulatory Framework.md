---
type: moc
status: stable
измерено: 2026-09-10
---

# 00 — Regulatory Framework

External mandates — Layer 2. Knowledge we did not write and cannot argue with using physics, only comply with or appeal. If someone else wrote it and can refuse our submittal, it lives here.

> [!important] Меродавен е актот објавен во „Службен весник“ · The gazette is the only source
> Every Macedonian text in this folder is a **reconstruction for working use**. Publisher clean texts, ministry and chamber consolidations, and regulation databases (ЛДБИС) are **controls, never sources**. A difference against an independent text is not automatically an error here — it is checked in the source issue. Rule holder: `MKD/_instructions/`[[ИНСТРУКЦИЈА — Консолидација, структура и линкување|ИНСТРУКЦИЈА]] т. 0.

> [!warning] Rewritten 2026-09-10, after a full audit of the domain
> This note previously described a state that no longer exists — and had not existed for weeks. It claimed 13 category folders (there are 14), the old theme numbering (`03 ГРАДЕЖНО ЗЕМЈИШТЕ`, now `04`), the retired `З-ГР-` / `П-ПРО-` prefixes, that `INT/UK` and `INT/USA` "no longer exist on disk" (they exist, empty), and — worst, because it is a rule and not a count — that master files by rule 3 carry *no frontmatter and no H1*. All 242 masters now carry both. It also built a whole "head-note pattern" argument on that premise; the premise is gone, and so is the need for the pattern: `[[ГР-01 - консолидиран|Закон за градење]]` resolves directly, because masters carry `aliases`.
> Everything below is measured, not remembered.

## What is actually here

```
40 CODES/                                        (measured 2026-09-10)
├── MKD/          North Macedonia — the substantial part of this folder.
│                 14 themes · 241 registered acts (+1 retracted code) · 3.651 .md
│                 39 acts consolidated: 1.817 per-article notes · 863 archive
│                 redactions · 246 transitional-provision notes · 73 per-act
│                 reports · 131 embedded PNG · 51 price-class sheets
├── INT/          International references — CA/ 26 notes (footings, egress, fire
│                 protection, stairs, glazing, sound, schedules, structure).
│                 UK/ and USA/ exist but are EMPTY.
└── Euro-codes/   empty — no notes yet
```

`MKD/_link/` is empty and dead — a leftover, not a plan.

### The Macedonian base, by theme

| # | Theme | Acts | Consolidated |
|---|---|---:|---:|
| 01 | УРБАНИЗАМ И УРБАНИСТИЧКО ПЛАНИРАЊЕ | 12 | **8** |
| 02 | ГРАДЕЊЕ | 25 | **14** |
| 03 | ПРОЕКТИРАЊЕ И ТЕХНИЧКИ НОРМАТИВИ | 17 | **14** |
| 04 | ГРАДЕЖНО ЗЕМЈИШТЕ | 22 | **3** |
| 05 | БЕСПРАВНО ИЗГРАДЕНИ ОБЈЕКТИ | 13 | 0 |
| 06 | ГЕОДЕЗИЈА И КАТАСТАР | 21 | 0 |
| 07 | ЕНЕРГЕТИКА И ЕНЕРГЕТСКА ЕФИКАСНОСТ | 18 | 0 |
| 08 | ЖИВОТНА СРЕДИНА | 27 | 0 |
| 09 | ПОЖАРНА БЕЗБЕДНОСТ | 20 | 0 |
| 10 | БЕЗБЕДНОСТ И ЗДРАВЈЕ ПРИ РАБОТА | 15 | 0 |
| 11 | ДОМУВАЊЕ | 13 | 0 |
| 12 | КУЛТУРНО НАСЛЕДСТВО | 22 | 0 |
| 13 | ПРОСТОРНО ПЛАНИРАЊЕ | 3 | 0 |
| 14 | ИМОТНО-ПРАВНИ ОДНОСИ | 13 | 0 |

Live counts, statuses and per-act state: [[00 MOC — Регистар на прописи]] — its numbers are **derived** by `_екстракт/_алатки/gen_registar.py`, not typed.

## How an act is shaped

Every act, consolidated or not, is one folder named `<КОД> <TRUNCATED TITLE>…` (≤ 44 chars) holding:

| | |
|---|---|
| `<КОД> - консолидиран.md` | the master — **with** YAML frontmatter, an H1, the full gazette trail, the unofficial-text disclaimer, the gazette-is-the-source callout, and the consolidated text with a footnote apparatus |
| `<КОД>-Членови/` | one note per article, on a **stable anchor**: an article number that ever existed keeps its note forever, deleted ones included. Frontmatter carries `секција`, `поднаслов`, `статус`, `проверка`, `редакции` |
| `<КОД>-Архива/` | previous redactions — one per amending act, never a link target from provision text |
| `<КОД>-ПЗО/` | transitional and final provisions of each amending act, plus authentic interpretations |
| `<КОД>-Слики/` | table and drawing pages that the gazette published as image, not text — cut literally, never retyped |
| `<КОД>-Извештаи/` | per-act diff report of what each amendment did |

One exception, named in the standard: an act with `облик: КЛАСЕН` is not divided into articles at all (a price list by class) and carries `<КОД>-Класи/` instead. `ПР-18` is the only one.

## Linking in from the rest of the vault

Link the act, not the article: `[[ГР-01 - консолидиран|Закон за градење]]`. Masters carry `aliases`, so the act's name resolves. Article-level links are `[[ГР-01-Член 59|членот 59]]` and are meant for use inside the base; from studio notes prefer the act plus the article number in prose, so a renumbering does not silently retarget a claim.

**Never link into `-Архива/`.** A redaction is reached only from its own anchor note or from a master footnote (т. 5.1).

## Governing documents — three, each the sole holder of its rules

| Document | Answers | Holds |
|---|---|---|
[[ИНСТРУКЦИЈА — Консолидација, структура и линкување\|ИНСТРУКЦИЈА]] (в. 2.11) | what a finished act looks like | codes · master and note format · archive and anchors · linking · statuses · **validation (т. 11)** |
[[КОНВЕРЗИЈА_УПАТСТВО (префикси и формат)\|КОНВЕРЗИЈА_УПАТСТВО]] | how clean text is won from a PDF | extraction · cutting per act · noise table · **technical stack and paths** |
[[00 Стратегија — консолидација на актите\|00 Стратегија]] | in what order, with what controls | corpus diagnosis · phases · priorities · risks |

All three live in `MKD/_instructions/`. A rule is changed **only at its holder** — a copy of normative text in another document is an error, because it drifts silently.

## What does NOT live here

**Our reading of a code is not the code.** The base states requirements by reproducing the gazette; it does not interpret them. A studio reading of a borderline classification belongs in `Practice Interpretations`, which still does not exist — the gap is real and unchanged since 2026-07.

## Working machinery

`MKD/_екстракт/` holds the pipeline and the per-act state: 43 act folders, 52 scripts in `_алатки/`, and each consolidated act's `state.json` / `applied.json` — **the state is the source of everything derived**; masters, notes, archive and reports are generated from it and never hand-edited.

`MKD/_службени-весници/` holds 454 gazette PDFs plus the 2026 ЛДБИС set (60), the download-status note and the missing-issues list.

Before working on an act, **check ЛДБИС first** for a newer amendment. ЛДБИС is indexed only up to a given issue and does not list every constitutional-court decision — it is a starting point, never proof.

## Known open items

- **`_екстракт/_стара-архива/`** — 654 notes from the retired redaction model (5,1 MB), kept since 2026-08-31 for manual deletion. Nothing in the base links to them.
- **`INT/UK`, `INT/USA`, `Euro-codes`, `MKD/_link`** — empty folders. UK/USA/CA's place in the practice is still unanswered: the studio's markets are MK and INT, so it is worth deciding whether these are live references or residue.
- **Constitutional-court decisions** have no full-text source anywhere in the base — a gap across all 14 themes, named in ИНСТРУКЦИЈА т. 10.2 but not closed by it.
- **Two acts cannot be consolidated at all** (`ПР-06`, `ПР-14`): the gazette published them as scans without a text layer, and OCR is not an admissible source under т. 0.

Full audit, findings and running order: `claude/АУДИТ на домејнот CODES — 10.09.2026` in the CODES-MKD project.
