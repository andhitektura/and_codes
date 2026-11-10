# CLAUDE.md

Working notes for Claude sessions in this repository. Read this first.

## What this is

`and_codes` is studio ANDhitektura's vault of consolidated North Macedonian building regulations (`CODES/MKD`, Obsidian markdown), plus the static site built from it (`build/`, `site/`). The README covers the site. `AI-INSTRUCTIONS.md` covers how to read and cite the vault.

The owner is an architect, not a programmer. Explain git and tooling steps in plain words, and handle git yourself.

## Where everything lives

The vault is split across two places since 10 Nov 2026:

| What | Where | In git? |
|---|---|---|
| Notes: themes, acts, членови, MOCs, register CSV, `_instructions/` | `C:\dev\and_codes\CODES\MKD` (also reachable as `~/MKD`) | yes |
| Gazette PDFs `_службени-весници/` (2.7 GB) | `C:\Users\andon\OneDrive - ANDhitecture\and_VAULT\40 CODES\MKD-sources\` (also `~/mnt/40 CODES/MKD-sources`) | no, synced by OneDrive |
| Extraction workspace `_екстракт/`: tools in `_алатки/`, per-act state, validation results | same `MKD-sources` folder | no, synced by OneDrive |

- Never put the repo, or a link to it, inside OneDrive.
- Never copy the PDFs or `_екстракт` into the repo.

## The consolidation workflow

The standard is in `CODES/MKD/_instructions/`:
- `ИНСТРУКЦИЈА — Консолидација, структура и линкување.md`: the rules
- `КОНВЕРЗИЈА_УПАТСТВО (префикси и формат).md`: PDF → markdown
- `ПРОМПТ — Консолидација на еден акт.md`: the per-act brief
- `00 Стратегија — консолидација на актите.md`: the strategy

Follow them, with these updates for the new layout:

- **Paths.** Tools get paths from `_екстракт/_алатки/paths.py`:
  - `paths.MKD` is the notes folder in this repo.
  - `paths.SOURCES` is the OneDrive `MKD-sources` folder.
  - `paths.EX` and `paths.SV` sit under `paths.SOURCES`.
  - Override with the env vars `MKD_ROOT` / `MKD_SOURCES` if needed.

  The path setup in КОНВЕРЗИЈА_УПАТСТВО (`~/mnt/40 CODES/MKD`, `/sessions/<сесија>/mnt/MKD`, the Windows junction block) is out of date. Use the folders above.
- **Links.** Run `python _алатки/paths.py` from `MKD-sources/_екстракт` once per new machine. It recreates the compatibility links `~/MKD`, `~/mnt/MKD`, `~/gr01`, `~/up`, `~/gz01` and the rest.
- **Python.** It isn't on PATH. Use `C:\Users\andon\AppData\Local\Programs\Python\Python313\python.exe` with `-X utf8`.
- **Validation.** Before publishing a consolidation, run `python -X utf8 _алатки/validate_all.py [КОД …]` from `_екстракт`. On 10 Nov 2026 the full run was 117 acts, 2401/2401 checks.
- **No `.bak` files in the repo.** The instructions and scripts make `*.pre-<ознака>.bak` copies before changes. Inside the repo, git history does that job, and `*.bak` is gitignored. Backups inside `_екстракт` on OneDrive are fine.

## Saving and publishing

- **Starting work.** Pull first (`git pull`). The owner may work from more than one computer.
- **Saving.** Commit on a branch, push, and open a PR to `main`. Merge only when the owner says so. Every push to `main` rebuilds and deploys the public site (GitHub Pages, `.github/workflows/pages.yml`).
- **Before a PR.** Run `npm run build`. It must pass, and it regenerates `AI-INSTRUCTIONS.md` from `site/ai-instructions.md`, so commit that file along with vault changes.
- **Line endings.** Keep them LF. Git on this machine converts on checkout (`core.autocrlf`), so CRLF-only differences are not real changes.
