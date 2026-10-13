# CHOMP repository updated to describe the CHOMP built in ABRA (chomp 3.0.0, portfolio 1.9.7)

2026-10-13 · historical findings record, not a living document. ABRA was read only; this file is the only thing
written in ABRA, and it is not committed.

## 0. Verdict

- **Done, and local, GitHub and live agree.** `willhoop/chomp` 3.0.0 (`e6b8315`) describes CHOMP v1, the Reg M-C
  team-preview solver in ABRA `solver/chomp/v1/`. The portfolio (`willhoop/willhoop.github.io` 1.9.7, `02fad2d`) serves
  the re-rendered documents and the re-exported deck. The live deck PDF's sha256 equals the local file's (`22b48706…`),
  and the live white paper and card show 3.0.0.
- **Slide 6 rebuilt.** Old tiles (1323, 154%, 0.05 s) withdrawn. New tiles, each in the white paper with its source:
  - **56%** of games won against the most common human bring for that team: SPRT H1 at 524 games, 0.561
    [0.518, 0.603] (`solver/results/2026-09-27-chomp-v1/sprt-chomp1-vs-hprior.json`).
  - **47%** against the bring the human chose after seeing the opponent: 0.470 [0.422, 0.519], 400 games, no clear
    edge (`solver/results/2026-09-27-chomp-v1/gatec-vs-human.json`).
  - **18 ms** mean time to solve the 90 × 90 table once scored, p90 21 ms, 173 test pairs × 2 chairs
    (`docs/_reports/2026-09-27-chomp-v1.md` §4).
  - Left side: v0 failed (0.430 vs the humans' own bring, SPRT H0, `docs/_reports/2026-09-25-chomp-v0.md`); v1 learned
    from 25,008 targeted simulated games with pre-registered gates.
- **CHOMP CI is green for the first time since 2026-07-31.** It had been red on every push.

## 1. What changed in `willhoop/chomp`

| file | change |
|---|---|
| `README.md` | summary of CHOMP v1, component table, document table, retired-userscript section |
| `docs/CHOMP-whitepaper.md` | rewritten: decision, scorer, data, LP solve, bo3 adjustment, gates (a)/(b)/(c), v0 and v2, where it runs, ladder so far, limits, retired §9 with the withdrawn figures struck |
| `docs/CHOMP-technical-docs.md` | rewritten in ASD-STE100 / Diátaxis; tutorial command verified on the ABRA main checkout (release `eaa5becc54eb`, `ABRA_REGULATION=regmc`), Part 5 for the retired tool |
| `docs/CHOMP-deck-plain-english.pptx`, `build/build_deck.js` | 9 slides; every number checked; last slide links the rendered white paper (it linked `https://github.com/`); output path made relative (it pointed at a dead sandbox path) |
| `docs/EXECUTIVE-SUMMARY.md`, `llms.txt`, `CLAUDE.md` | rewritten for the ABRA CHOMP; CLAUDE.md marks the engine/build rules as retired-tool only |
| `docs/VALIDATION-REPORT.md` | banner: retired tool, Reg M-B |
| `tests/test-deck-figures.js` | new: every numeric token on a slide maps to text in the white paper; the three withdrawn figures stay off; the last slide links the white paper. Shown RED with `1323` put back on slide 6 |
| `tests/test-engine-contract.js` | section 1 retired (opt-in `CHOMP_CROSS_REPO=1`): it compared the Reg M-B engine with ABRA's HEAD engine, failed in CI (no ABRA checkout) since 2026-07-31, and failed locally because ABRA left Reg M-B |
| `build/export_deck_pdf.ps1` | new: PowerPoint COM export to PDF (no LibreOffice on this machine) |
| `app/plugin/chomp-bring4.user.js`, `build/build_v2_userscript.py` | `@version` 3.0.0 only, to match the changelog (the check reads the userscript as CHOMP's stamp). No code change; installed copies will auto-update to identical code |
| `CHANGELOG.md` | 3.0.0 with `### Record`: Basis CHANGED; Supersedes the three withdrawn figures |

Tests: 9 of 9 files pass locally; GitHub Actions run 38366897597 green. `check_projects.py`: CHOMP all artefacts yes,
`changelog=3.0.0 file=3.0.0 ok`.

## 2. Portfolio (the live site)

Rendered only CHOMP's docs with the portfolio's own `render()` (the full `build_docs.py` re-renders every project and
calls `soffice`, which is absent). Deck PDF exported to `docs/CHOMP/` and `docs/Pokemon/`. CHOMP card: status "Live in
ABRA — v3.0.0", new description and keywords; `build_agent_files.js` regenerated `llms.txt` and JSON-LD.
`tests/test-projects.js` 77/77; `--check` up to date. Pages deploy succeeded.

A concurrent session committed portfolio 1.9.6 (Jeopardy card) while this ran; this entry took 1.9.7. No file overlap.

## 3. Rules checked

- **No Pokémon, item, ability or move is named** in any new or rewritten CHOMP text, so no legality check was needed.
  The retired section describes the old sandstorm story without names. (The tutorial command prints species from
  ABRA's pool at run time; nothing is typed.)
- Reg M-B figures (57% vs 46%, n = 50) appear only in the retired section, labelled Reg M-B.
- No withheld or PRE-GATE figure is used: every gate figure was played on release `eaa5becc54eb`.
- Ladder records (chomp1 9–10, chomptop 7–8, chomptopfix 12–8, earned forfeits counted) are in the white paper only,
  marked as whole-pipeline, under the 100-series bar, and not a CHOMP measurement. Not on any slide.

## 4. Not done / owed

- **This report is not committed to ABRA** (ABRA was read-only for this task). Commit it with the next ABRA docs commit.
- `build/export_deck_pdf.ps1`'s header says its default output is git-ignored; it is not (`docs/*.pdf` is not in
  `.gitignore`). Harmless, since the portfolio is the PDF's home; fix on the next CHOMP change.
- The full portfolio `build_docs.py` still depends on LibreOffice; it was not run.
- Old CHOMP docs not rewritten and left as Reg M-B history: `CHOMP-referee-report.md`, `RISK-REGISTER.md`, the matchup
  guides. Their portfolio HTML still renders them.
