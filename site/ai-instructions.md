# and_codes — instructions for an AI assistant

You are working with **and_codes**, the regulations vault of studio ANDhitektura: consolidated texts of the regulations of the Republic of North Macedonia on construction, urban planning, land, cadastre, energy, fire safety and related fields. {{ACT_COUNT}} acts, {{UNIT_COUNT}} членови (articles).

## 1. The authority rule — read this first

The texts are **unofficial reconstructions** for working use. The only authoritative text is the act as published in **„Службен весник“** (the Official Gazette). Therefore:

- When you quote or rely on a член, say that the text is the consolidated text from and_codes, and give the gazette numbers of the act (frontmatter `сите-броеви` in the master).
- Never invent an article number, a paragraph (став) or a gazette number. If you cannot find it in the vault, say so.
- Respect the verification level of each член (`проверка`, section 6). For a legally relevant answer, recommend checking the gazette issue.

## 2. How to reach the vault

| What | Where |
|---|---|
| Website (for people) | `{{SITE}}#/<file name>`, e.g. `{{SITE}}#/ГР-01-Член 59` |
| Raw markdown (for you) | `https://raw.githubusercontent.com/{{REPO}}/{{BRANCH}}/{{CONTENT}}/<path>` (percent-encode the path) |
| Browse the repository | `https://github.com/{{REPO}}/tree/{{BRANCH}}/{{CONTENT}}` |
| Machine index (all notes, acts and links) | `{{SITE}}data/index.json` |

Take paths from the **register** at the end of this file. Do not build folder names yourself: act folders are cut to 44 characters and end in `…`.

## 3. Structure

```
{{CONTENT}}/MKD/
├── 00 MOC — Регистар на прописи.md        overview of all acts by theme
├── 00 Методологија и ограничувања.md      sources, statuses, known gaps
└── NN <ТЕМА>/                             14 themes (00 is the Constitution)
    ├── 00 MOC — <ТЕМА>.md                 the theme's acts with status
    └── ЗАКОНИ | ПОДЗАКОНСКИ АКТИ | НАСЛЕДЕНИ АКТИ (СФРЈ-СРМ)/
        └── <КОД> <НАСЛОВ>…/                one folder per act
            ├── <КОД> - консолидиран.md     the master: the whole consolidated text, footnotes with the history
            ├── <КОД>-Членови/<КОД>-Член N.md   one note per член: the current text (the unit to read and cite)
            ├── <КОД>-ПЗО/                  transitional and final provisions of the amending acts
            ├── <КОД>-Архива/               earlier redactions of членови
            └── <КОД> — Дневник на интервенции.md   corrections made during consolidation
```

## 4. Codes and file names

The code is `<theme prefix>-<NN>`: У Constitution · УП urban planning · ГР construction · ПР design and technical norms · ГЗ construction land · БО illegally built objects · ГК geodesy and cadastre · ЕН energy and energy efficiency · ЖС environment · ПБ fire safety · БЗ health and safety at work · ДМ housing · КН cultural heritage · ПП spatial planning · ИП property relations.

File names are unique across the vault and always start with the code:

- `ГР-01-Член 59.md` — the current text of член 59 of ГР-01. Suffixes as in the act: `ГР-01-Член 59-а.md`.
- `ГР-01-Член 59 (Сл.в. 124-2010).md` — in `-Архива/`: the redaction that was in force until gazette 124/2010.
- `ГР-01-ПЗО 28-2014 чл. 8.md` — член 8 of the amending act 28/2014, a transitional provision. It is **not** a член of ГР-01.
- Some acts are divided into точки (`<КОД>-Точка N.md`) or into class sheets (`-Класи/`) instead of членови.

## 5. What a член note contains

```yaml
припаѓа-на: "Закон за градење"   # the act
код: ГР-01
член: 59
секција: "V. ОДОБРЕНИЕ ЗА ГРАДЕЊЕ"
поднаслов: "3. Постапка за издавање одобрение за градење"
статус: важечки                  # важечки | избришан | заменет | укинат-од-УС
воведен: "130/2009"              # gazette that introduced the член
проверка: В                      # verification level, section 6
редакции: 14                     # number of earlier redactions in -Архива/
```

The body is the text: ставови `(1) …`, `(2) …`, алинеи as `- `, numbered points as `1 - ` (the dash replaces the point; the number is exact). Cross-references are links: `членот [[ГР-01-Член 58|58]]`. After the text:

- a callout `Степен на проверка` (only for level В),
- a callout `Преодни одредби` listing the ПЗО notes that govern how the член applies — **always read these**, they can postpone or limit the член,
- `## Претходни редакции` — links to the archived redactions, oldest first.

A deleted член keeps its note (the link target never disappears) with `статус: избришан`, `важел-до` and a link to its last text; a replaced one has `заменет-со`. An archive note has `важел-од`, `важел-до`, `котва` (the live note) and `причина`. Archive notes contain **no links**: references in old text are plain text, because they pointed to the text of that time.

## 6. Statuses and verification

Act status (master `статус`): ✅ `важечки` in force · ⚠️ `за проверка` needs confirmation · ⛔ `престанал да важи` no longer in force, kept as a historical reference · ↪ `повлечен-запис` withdrawn code, see `водечки-запис`.

Член verification (`проверка`):

| | Meaning |
|---|---|
| А | The current text traces to a single source and was checked word by word against it. |
| Б | Checked against an official consolidated text (пречистен текст) of the Legislative Committee. |
| В | Built by applying amendments in a chain; no edition contains the finished text. Look for `рачно-проверен` (read against the sources), `вкрстена-контрола` / `верига-проверена` (matched an independent text). Without either, treat with care. |

## 7. How to answer a question

1. Find the act in the register (by code, name or theme) and open its член notes, not the master, for the current text.
2. Check `статус`. If the член is deleted or replaced, follow `заменет-со` or the archive link and say so.
3. Read the `Преодни одредби` callout and the linked ПЗО notes.
4. For the law as it stood on a date, use the archived redactions: pick the one whose `важел-од`–`важел-до` covers the date.
5. Follow the links in the text to the членови it refers to. References to other acts are often plain text ("членот 58 од Законот за …"); find that act in the register.
6. Cite as: *член 59 став (2) од Законот за градење (ГР-01; Сл. весник …), консолидиран текст во and_codes, проверка В* and give the website link.

## 8. Register

| Код | Акт | Статус | Членови | Path to the master |
|---|---|---|---|---|
{{REGISTER}}
