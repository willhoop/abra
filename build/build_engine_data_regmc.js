/* build_engine_data_regmc.js — generate data/engine-data-regmc.js, the Reg M-C damage table.
 *
 *   node build/build_engine_data_regmc.js --regulation regmc            writes the artifact
 *   node build/build_engine_data_regmc.js --regulation regmc --check    writes NOTHING; exits non-zero
 *                                                                      if the artifact on disk is not
 *                                                                      what this script would write
 *   --pool <dir>   the FROZEN M-C team pool (default data/team-pool-frozen-regmc)
 *   --out  <file>  the artifact (default data/engine-data-regmc.js)
 *
 * ══ WHY THIS IS A SECOND BUILDER AND NOT A FLAG ON THE FIRST ════════════════════════════════════
 *
 * build/build_engine_data.js is a three-stage pipeline over CHOMP/engine/champ-model.js plus two
 * later generators that edit data/engine-data.js IN PLACE, and it carries 2,072 field values off its
 * own previous output because of it (data/engine-data-purity.json). None of that exists for Reg M-C:
 * there is no champ-model for this regulation, there is no previous artifact to carry, and there is
 * nothing to preserve. So this builder is a PURE FUNCTION of three upstreams and says so:
 *
 *     the Reg M-C Champions dex      types, base stats, weight, move type/category/bp/recoil/self,
 *                                    the type chart, every species' legal ability list
 *     the FROZEN M-C team pool       the observed JOINT set per species (item, ability, nature, the
 *                                    four moves together)
 *     engine/legal_scope.js          which species / moves exist in this regulation, INCLUDING the
 *                                    `Future`-flagged entries the TeamValidator accepts
 *
 * Nothing is read back off data/engine-data-regmc.js. `--check` therefore proves the WHOLE artifact,
 * not the half of it the M-B check can reach.
 *
 * ══ REG M-B DOES NOT MOVE, BY CONSTRUCTION ══════════════════════════════════════════════════════
 *
 * This file writes ONE path and it is not data/engine-data.js. It reads the M-B artifact for exactly
 * one purpose — the KEY-SPELLING control below — and never writes it. The 2026-07-30 failure was a
 * builder whose 67 writes all missed because the two files spelled a key differently and nothing
 * compared them; the control here is that the key rule this builder uses (merge_mega_into_engine.js's
 * `artifactKey` convention) is re-derived against the 322 rows of the LIVE M-B artifact on every run
 * and the disagreements are PRINTED with whether they flatten alike. On 2026-09-21 five disagree, all
 * five are CHOMP's own spellings (`kommoo` for `kommo-o`) and all five flatten to the same key; they
 * are reported rather than silently accepted, because a key rule nobody checks is the whole of that bug.
 *
 * ══ THE THREE WAYS A ROW GETS ITS SET, AND WHY THERE IS A THIRD ═════════════════════════════════
 *
 *   OBSERVED           the species' own most-common joint set from the pool's open team sheets. A
 *                      MEGA forme is observed too: a sheet declares species + item, and a mega stone
 *                      IDENTIFIES the forme (`item.megaStone[baseName]`), so `Venusaur @ Venusaurite`
 *                      IS Venusaur-Mega with its four declared moves. 82 of 82 legal M-C megas are
 *                      reached this way.
 *   INHERITED          no sheet of its own, but the forme it CHANGES FROM has one. Mega evolution and
 *                      a forme change swap stats, typing and ability — never the moveset. The ABILITY
 *                      comes from this forme's own dex row, not the base's, because that is the
 *                      ability standing on the field.
 *   DERIVED            neither. The set is built from the FORMAT — the dex's slot-0 ability and the
 *                      species' own move pool — and then put to the TeamValidator, which is what
 *                      decides legality here (Will, 2026-09-20). Every DERIVED row is PRINTED with
 *                      its set on every run.
 *
 * AN EMPTY `mv` IS NEVER WRITTEN. `buildMon` returns a body that threatens NOTHING, which is
 * invisible to every scorer in this project — the 2026-07-30 failure, whose expensive half was the
 * empty moveset and not the null ability. The census at the end counts the shape directly.
 *
 * ══ WHAT THIS BUILDER DELIBERATELY DOES NOT DO ═════════════════════════════════════════════════
 *
 *  - It does not touch data/tags.json or data/abra-tags.js. Those are Reg M-B's, the 41 new M-C
 *    mechanics are not modelled, and a mega forme whose STONE has no tag row cannot be reached by
 *    `megaTargetFor` yet. A row existing and a mechanic being wired are different claims.
 *  - It writes no Reg M-C figure anywhere. The counts it prints describe the artifact it just built.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), readline = require('readline');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const { normalise } = require(D('engine', 'read_text.js'));

const CHECK = process.argv.includes('--check');
const flag = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
/* ── WHERE THE POOL IS, AND WHY THERE IS A CHAIN ────────────────────────────────────────────────
 * The pool is UNTRACKED (250 MB) and exists only in the checkout that ran engine/cut_regmc_pool.js. So
 * `ROOT/data/…` is absent in two places this builder is legitimately run: a git WORKTREE of that
 * checkout, and the scratch copy engine/artifact_audit.js --staged makes of the next commit — which is
 * the pre-commit hook, and which BLOCKED the first commit of this file with a false "is NOT what its
 * builder would write" because the builder could not find its input. Found in that order, first hit
 * wins, and the path used is printed and digested into the receipt:
 *
 *   --pool <dir>  >  ABRA_REGMC_POOL  >  ROOT  >  each root in ABRA_AUDIT_SOURCE_ROOTS (set by the
 *   --staged wrapper: the checkout the copy was taken from)  >  the MAIN checkout of a git worktree
 *
 * A pool found anywhere else cannot launder a wrong artifact: --check compares the bytes this build
 * would write, so a different pool is a different table and reads as drift. */
const POOL_REL = ['data', 'team-pool-frozen-regmc'];
/* THE CHECKOUTS THIS PROCESS MAY TAKE AN UNTRACKED INPUT FROM, in order. Shared by the pool and by the
 * Showdown checkout below, so the two cannot be found by different rules. */
function sourceRoots() {
  const roots = [ROOT, ...String(process.env.ABRA_AUDIT_SOURCE_ROOTS || '').split(path.delimiter).filter(Boolean)];
  const g = require('child_process').spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'],
                                               { cwd: ROOT, encoding: 'utf8' });
  if (g.status === 0 && String(g.stdout).trim()) roots.push(path.dirname(String(g.stdout).trim()));
  return roots;
}
function findPool() {
  const explicit = flag('--pool', null) || process.env.ABRA_REGMC_POOL;
  if (explicit) return explicit;
  for (const r of sourceRoots()) {
    const p = path.join(r, ...POOL_REL);
    if (fs.existsSync(path.join(p, 'games.bo3.jsonl'))) return p;
  }
  return path.join(ROOT, ...POOL_REL);          // absent — scanPool() refuses on it, loudly
}
const POOL = findPool();
const OUT = flag('--out', D('data', 'engine-data-regmc.js'));

/* ── THIS BUILDER NAMES ITS OWN REGULATION, AND A CONTRARY CHOICE REFUSES ──────────────────────
 * It builds exactly one regulation's table, so with nothing chosen it chooses M-C itself — through
 * the environment, BEFORE engine/regulation.js resolves, which is also what makes the choice announce
 * itself on stderr. That is what lets engine/artifact_audit.js check G spawn `--check` bare and get a
 * real answer. An EXPLICIT choice of any other regulation is still refused below: building an "M-C"
 * table out of another regulation's bytes would produce a well-formed artifact describing the wrong
 * game, which is the silent-default failure this repository is organised against. */
if (!process.env.ABRA_REGULATION && !process.argv.some(a => a === '--regulation' || a.startsWith('--regulation=')))
  process.env.ABRA_REGULATION = 'regmc';
const WANT = 'gen9championsvgc2026regmc';
/* AN INHERITED SHOWDOWN_PATH THAT CANNOT SERVE THIS FORMAT IS DROPPED, AND SAYS SO. engine/showdown_path.js
 * WRITES `SHOWDOWN_PATH` into the environment as a side effect of being required, so any parent that
 * loaded it — tests/run-all.js, which spawns engine/artifact_audit.js, which spawns this — hands every
 * child the DEFAULT regulation's checkout, and "an explicit SHOWDOWN_PATH still wins" then pins the M-B
 * checkout under an M-C run. Measured 2026-09-21 with SHOWDOWN_PATH on the M-B checkout and
 * ABRA_REGULATION=regmc: champions_sim REFUSES the format (loud, not silent) while the regulation banner
 * on stderr still reads "checkout pokemon-showdown-mc". So under run-all this builder would exit non-zero
 * and engine/artifact_audit.js check G would read a GAP that is the environment, not the artifact. The
 * path is asked whether it carries the format before it is trusted; a path that does carry it is kept,
 * so a deliberately-placed M-C checkout still wins. */
if (process.env.SHOWDOWN_PATH) {
  let carries = false, why = 'it has no such format';
  try { carries = !!require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim')).Dex.formats.get(WANT).exists; }
  catch (e) { why = 'its simulator would not load: ' + String((e && e.message) || e).split('\n')[0]; }
  if (!carries) {
    console.error(`build_engine_data_regmc: SHOWDOWN_PATH=${process.env.SHOWDOWN_PATH} cannot serve ${WANT} (${why}); `
      + 'ignoring it so the regulation\'s own checkout is used.');
    delete process.env.SHOWDOWN_PATH;
  }
}
/* regulation.js SELECTS and resolves no checkout, so it is safe to ask before champions_sim loads. */
const REG = require(D('engine', 'regulation.js'));
/* AND THE REGULATION'S OWN CHECKOUT IS LOOKED FOR BESIDE EVERY SOURCE ROOT, not only beside ROOT.
 * regulation.js anchors its candidates at ROOT and at a worktree's main checkout, and neither exists in
 * the scratch copy engine/artifact_audit.js --staged builds under the OS temp directory — measured: the
 * second attempt at this commit reached `/tmp/ps` and threw. The same roots the pool is found under. */
if (!process.env.SHOWDOWN_PATH && REG.entry && REG.entry.checkout) {
  const c = REG.entry.checkout;
  const hit = (path.isAbsolute(c) ? [c] : sourceRoots().map(r => path.join(r, '..', c)))
    .find(p => fs.existsSync(path.join(p, 'dist', 'sim')));
  if (hit) process.env.SHOWDOWN_PATH = hit;
}
const CS = require(D('engine', 'champions_sim.js'));
if (CS.FORMAT !== WANT) {
  console.error(`build_engine_data_regmc REFUSES: the resolved format is ${CS.FORMAT}, not ${WANT}.`);
  console.error('  Pass --regulation regmc (or set ABRA_REGULATION=regmc). This builder writes an');
  console.error('  M-C artifact; building it from another regulation\'s dex would describe the wrong game.');
  process.exit(2);
}
/* AND THE CHECKOUT THAT LOADED MUST ACTUALLY CARRY IT — the format id is the regulation's answer, the
 * dex is the checkout's, and the two can come apart (see the SHOWDOWN_PATH note above). */
if (!CS.sim().Dex.formats.get(WANT).exists) {
  console.error(`build_engine_data_regmc REFUSES: the loaded Showdown checkout has no ${WANT}.`);
  process.exit(2);
}
const DEX = CS.sim().Dex.forFormat(CS.FORMAT);
const MEDI = require(D('engine', 'medicham2-browser.js'));
const LS = require(D('engine', 'legal_scope.js'));

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const say = (...a) => console.log(...a);

/* ── THE SCOPE ──────────────────────────────────────────────────────────────────────────────────
 * The strict filter is a CANDIDATE list and the TeamValidator decides; engine/legal_scope.js is the
 * one place that implements that, including the `Future` re-admission. It is asked, not re-derived. */
const SCOPE = LS.derive();
const strict = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const futureSpecies = new Set(SCOPE.futureReadmitted.filter(r => r.startsWith('species:')).map(r => r.slice(8)));
const SPECIES = DEX.species.all().filter(s => strict(s) || futureSpecies.has(s.id));

/* ── THE KEY RULE, WITH ITS CONTROL ─────────────────────────────────────────────────────────────
 * The ARTIFACT's own stated convention, not a new one: engine/merge_mega_into_engine.js `artifactKey`
 * — "display name, lowercased, runs of non-alphanumerics collapsed to one hyphen". Plain lowercasing
 * was tried first and wrote `vivillon-icy snow` and `mr. rime`, which every consumer would have found
 * through `monFlat` and which no human would ever have typed. Checked against the LIVE Reg M-B
 * artifact on every run so the 2026-07-30 two-spellings failure cannot recur silently. */
const keyOf = s => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function keyControl() {
  let mb = null;
  try { mb = JSON.parse(fs.readFileSync(D('data', 'engine-data.js'), 'utf8').match(/const MC = (\{[\s\S]*?\});/)[1]); }
  catch (e) { return { ran: false, why: String((e && e.message) || e).split('\n')[0] }; }
  let agree = 0; const differ = [];
  for (const k of Object.keys(mb.mons || {})) {
    const s = DEX.species.get(k);
    if (!s || !s.exists) { differ.push(`${k} -> the M-C dex does not know it`); continue; }
    if (keyOf(s) === k) agree++;
    else differ.push(`${k} -> this rule would write ${keyOf(s)}` + (norm(k) === norm(keyOf(s)) ? '  (same flattened key — monFlat resolves both)' : '  (DIFFERENT flattened key)'));
  }
  return { ran: true, rows: Object.keys(mb.mons || {}).length, agree, differ };
}

/* ── THE POOL ───────────────────────────────────────────────────────────────────────────────────
 * The frozen M-C pool, and ONLY the frozen pool. The live M-C stores grow hourly, so a table built
 * from them is not reproducible; and engine/quality.js prefers the PLAIN store file where the M-C
 * collector writes the compressed one (docs/REGMC.md), so reading the live store here would silently
 * get a fraction of it. The pool cut already applied the scope rule and the Eject Button conjunction.
 *
 * THE RECEIPT DIGESTS THE PATHS THIS RUN ACTUALLY OPENED, never the canonical path for that kind of
 * file — a receipt that names the wrong store passes provenance for the wrong reason (ROADMAP #547). */
const POOL_FILES = ['games.bo3.jsonl', 'games.ots.jsonl'];

/* stone -> forme. `item.megaStone` is `{ "Venusaur": "Venusaur-Mega" }` in this format, read off the
 * dex rather than off any artifact of ours. */
const STONE_INTO = new Map();
for (const it of DEX.items.all()) {
  if (!it.exists || !it.megaStone) continue;
  for (const [base, into] of Object.entries(it.megaStone)) {
    const sp = DEX.species.get(norm(into));
    if (sp && sp.exists) STONE_INTO.set(norm(it.id) + '|' + norm(base), sp.id);
  }
}

async function scanPool() {
  const per = new Map();            // species id -> Map(setKey -> {n, item, ability, nature, moves})
  const files = [], badLines = [];
  let games = 0, sheets = 0, unresolved = new Map(), megaAttributed = 0;
  for (const f of POOL_FILES) {
    const p = path.join(POOL, f);
    if (!fs.existsSync(p)) {
      console.error(`build_engine_data_regmc REFUSES: ${p} is absent. The frozen pool is the ONLY`);
      console.error('  source of an observed set in this regulation; building without it would write');
      console.error('  a DERIVED set for all 382 rows and report success.');
      process.exit(2);
    }
    const h = crypto.createHash('sha256');
    let bytes = 0, lines = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(p), crlfDelay: Infinity });
    for await (const line of rl) {
      h.update(line); h.update('\n'); bytes += Buffer.byteLength(line) + 1; lines++;
      if (!line.trim()) continue;
      let g;
      try { g = JSON.parse(line); }
      catch (e) { badLines.push(`${f}:${lines} ${String(e.message).slice(0, 60)}`); continue; }   // counted, printed, refused below
      if (!g.openSheet || !g.sheets) continue;
      games++;
      for (const side of ['p1', 'p2']) for (const e of (g.sheets[side] || [])) {
        if (!e || !e.species) continue;
        sheets++;
        const base = DEX.species.get(norm(e.species));
        if (!base || !base.exists) { unresolved.set(norm(e.species), (unresolved.get(norm(e.species)) || 0) + 1); continue; }
        const into = STONE_INTO.get(norm(e.item) + '|' + base.id);
        if (into) megaAttributed++;
        for (const id of into ? [base.id, into] : [base.id]) {
          const moves = (e.moves || []).map(norm).filter(Boolean);
          const setKey = [norm(e.item), norm(e.ability), norm(e.nature), moves.slice().sort().join(',')].join('|');
          if (!per.has(id)) per.set(id, new Map());
          const m = per.get(id), hit = m.get(setKey);
          if (hit) { hit.n++; continue; }
          m.set(setKey, { n: 1, item: norm(e.item) || null, ability: norm(e.ability) || null,
                          nature: norm(e.nature) || null, moves });
        }
      }
    }
    files.push({ file: f, path: p, lines, bytes, sha256: h.digest('hex') });
  }
  /* A POOL LINE THAT DOES NOT PARSE IS A DAMAGED FROZEN POOL, not ragged input: the cutter wrote every
   * line with JSON.stringify. Skipping it would build a table off a different sample than the pool's
   * digest names, so it refuses. */
  if (badLines.length) {
    console.error(`build_engine_data_regmc REFUSES: ${badLines.length} pool line(s) do not parse — ${badLines.slice(0, 3).join(' | ')}`);
    process.exit(2);
  }
  return { per, files, games, sheets, unresolved, megaAttributed };
}

/* ── THE STAT LINE ──────────────────────────────────────────────────────────────────────────────
 * `spreadL50` is medicham2's own — the SAME function buildMon's mega conversion uses, and the one
 * place in this project that knows Champions applies the nature AFTER adding SP. A second copy of
 * that arithmetic in a builder is the facts-are-global breach CLAUDE.md names. */
const SP_MAIN = 50, SP_SECOND = 25;          // the magnitudes build/rebuild_sets_from_sheets.js uses
function offenceOf(moves) {
  let phys = 0, spec = 0;
  for (const m of moves || []) {
    const d = DEX.moves.get(norm(m));
    if (!d || !d.exists) continue;
    if (d.category === 'Physical') phys++; else if (d.category === 'Special') spec++;
  }
  if (!phys && !spec) return null;
  return phys >= spec ? 'at' : 'sa';
}
function spFor(set) {
  const out = { hp: 0, at: 0, df: 0, sa: 0, sd: 0, sp: 0 };
  const off = offenceOf(set.moves);
  const up = MEDI.natureShift(set.nature).plus;          // the one nature chart in this project
  if (off) out[off] = SP_MAIN;
  if (up && up !== off) out[up] = SP_SECOND;
  else if (up && up === off) out.sp = SP_SECOND;
  return out;
}
const bsOf = s => ({ hp: s.baseStats.hp, atk: s.baseStats.atk, def: s.baseStats.def,
                     spa: s.baseStats.spa, spd: s.baseStats.spd, spe: s.baseStats.spe });

/* ── THE DERIVED FALLBACK, AND IT IS LOUD ───────────────────────────────────────────────────────
 * A species with no sheet and no base row to inherit from. The alternative is `mv: []`, which makes
 * the body threaten nothing and is invisible; so a set is built FROM THE FORMAT and put to the
 * TeamValidator. Each one is printed with its set. */
/* THE RANKING, and why it is not "highest base power". The first draft ranked on base power alone and
 * handed Garbodor and Gourgeist EXPLOSION and four species GIGA IMPACT — a body that self-KOs or
 * skips its next turn as its "best" move. So the moves whose cost the dex states as a field are
 * excluded (`selfdestruct`, a `recharge` or `charge` flag, `ohko`), and the rest are ranked on
 * base power x STAB x accuracy, all three read off the dex. It is still an ASSUMPTION and the row says
 * so; the ranking only has to avoid pricing a body on a move no player would lead with. */
function derivedSet(s) {
  /* No try/catch: a move pool that cannot be read must stop the build, not become an empty set. */
  const pool = [...DEX.species.getMovePool(s.id)];
  const rows = pool.map(id => DEX.moves.get(id)).filter(m => m && m.exists && !m.isNonstandard);
  /* and the moves whose cost is a HANDLER rather than a field — ones that can fail by their own rule
   * (`onTry`) or lock themselves (`onDisableMove`). The second draft still picked Last Resort, Belch
   * and Poltergeist, all three of which fail on a body that has not met a condition first. */
  const costly = m => !!(m.selfdestruct || m.ohko || (m.flags && (m.flags.recharge || m.flags.charge))
                         || typeof m.onTry === 'function' || typeof m.onDisableMove === 'function');
  const score = m => (m.basePower || 0) * (s.types.includes(m.type) ? 1.5 : 1) * (m.accuracy === true ? 1 : (m.accuracy || 0) / 100);
  const dmg = rows.filter(m => m.category !== 'Status' && (m.basePower || 0) > 0 && !costly(m))
                  .sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1));
  const picked = [], seenType = new Set();
  for (const m of dmg) { if (seenType.has(m.type)) continue; seenType.add(m.type); picked.push(m.id); if (picked.length >= 3) break; }
  for (const m of dmg) { if (picked.length >= 3) break; if (!picked.includes(m.id)) picked.push(m.id); }
  const prot = rows.find(m => m.id === 'protect');
  if (prot) picked.push('protect'); else if (dmg[picked.length]) picked.push(dmg[picked.length].id);
  const ability = norm(s.abilities && s.abilities['0']) || null;
  let moves = picked.slice(0, 4);
  /* The validator decides, and a refusal narrows the set rather than being ignored. */
  for (let i = 0; i < 4 && moves.length; i++) {
    const v = CS.checkLegal({ species: s.name, ability, moves: moves.map(id => DEX.moves.get(id).name) });
    if (v && v.legal) return { item: null, ability, nature: null, moves, verdict: 'accepted' };
    if (v && v.unavailable) return { item: null, ability, nature: null, moves, verdict: 'VALIDATOR UNAVAILABLE' };
    moves = moves.slice(0, moves.length - 1);
  }
  return { item: null, ability, nature: null, moves: picked.slice(0, 4), verdict: 'REFUSED — written anyway, see the run output' };
}

/* the legal ability set of a forme, from the dex. A sheet cannot declare an impossible one, but an
 * INHERITED or DERIVED row can, so it is checked where it is assembled. */
const abilitiesOf = s => new Set(Object.values(s.abilities || {}).map(norm));

function buildRows(scan) {
  const mons = {};
  const prov = { observed: [], inherited: [], derived: [] };
  const abilityFixed = { mega: [], other: [] };
  /* pass 1 — every species that has an observed set of its own */
  const setOf = new Map();
  for (const s of SPECIES) {
    const m = scan.per.get(s.id);
    if (!m || !m.size) continue;
    const sets = [...m.values()].sort((a, b) => b.n - a.n);
    const n = sets.reduce((a, x) => a + x.n, 0);
    setOf.set(s.id, { top: sets[0], n, distinct: sets.length, share: +(sets[0].n / n).toFixed(4) });
  }
  /* pass 2 — assemble */
  for (const s of SPECIES) {
    const k = keyOf(s);
    const bs = bsOf(s);
    const own = setOf.get(s.id);
    let set = null, source = null, from = null;
    if (own) { set = own.top; source = 'observed'; }
    else {
      /* the body it CHANGES FROM — `changesFrom` first, `baseSpecies` second. Reg M-B paid for the
       * other order: Floette-Mega's baseSpecies is an ILLEGAL species here and its changesFrom is not. */
      const fromName = s.changesFrom || s.baseSpecies;
      const fs_ = fromName ? DEX.species.get(norm(fromName)) : null;
      const inh = fs_ && fs_.exists && setOf.get(fs_.id);
      if (inh) { set = inh.top; source = 'inherited'; from = fs_.id; }
    }
    if (!set) { set = derivedSet(s); source = 'derived'; }

    /* the ABILITY is this forme's, never the donor's. For a MEGA this is the expected case, not a
     * repair: the sheet declares the ability the body is BROUGHT with, which is the base forme's, and
     * the mega's own replaces it on evolution ("Mega evolution overwrites the ability"). It is counted
     * separately so a real repair on a non-mega row cannot hide inside 82 expected ones. */
    let ab = norm(set.ability) || null;
    const legalAb = abilitiesOf(s);
    if (legalAb.size && (!ab || !legalAb.has(ab))) {
      const primary = norm(s.abilities && s.abilities['0']) || null;
      if (primary) { if (ab) (s.isMega ? abilityFixed.mega : abilityFixed.other).push(`${k}: ${ab} -> ${primary}`); ab = primary; }
    }
    const moves = (set.moves || []).map(norm).filter(Boolean);
    const sp = spFor({ moves, nature: set.nature });
    const st = MEDI.spreadL50(bs, sp, set.nature || null);
    const row = {
      t: s.types.slice(),
      bs, st, mv: moves,
      item: set.item || null,
      ab,
      wt: s.weighthg ? s.weighthg / 10 : null,
      nature: set.nature || null,
      sp,
    };
    if (s.isMega) row.mega = true;
    if (s.changesFrom || (s.baseSpecies && s.baseSpecies !== s.name)) {
      const b = DEX.species.get(norm(s.changesFrom || s.baseSpecies));
      if (b && b.exists) row.base = b.id;
    }
    row.set_source = source === 'observed'
      ? { observed: ['mv', 'item', 'ab', 'nature'], assumed: ['sp'], n: own.n, share: own.share, distinct_sets: own.distinct }
      : source === 'inherited'
        ? { observed: [], assumed: ['mv', 'item', 'ab', 'nature', 'sp'], inherited_from: from,
            note: 'no open-sheet sighting of this forme; the moveset comes from the body it changes from, the ability from its own dex row' }
        : { observed: [], assumed: ['mv', 'item', 'ab', 'nature', 'sp'],
            note: 'no open-sheet sighting and nothing to inherit; built from the format\'s own move pool and put to the TeamValidator — ' + (set.verdict || 'unchecked') };
    mons[k] = row;
    prov[source].push(k);
  }
  return { mons, prov, abilityFixed };
}

/* ── MOVES ──────────────────────────────────────────────────────────────────────────────────────
 * EVERY legal move of the regulation, not only the ones something can learn. A move missing from this
 * table is UNLOOKUPABLE — `dmgRange` reads `MC.moves[id].bp` — and Reg M-B lost Low Kick and Grass
 * Knot that way for weeks. A move nothing can learn costs three fields. */
function buildMoves() {
  const moves = {};
  const futureMoves = new Set(SCOPE.futureReadmitted.filter(r => r.startsWith('move:')).map(r => r.slice(5)));
  const rows = DEX.moves.all().filter(m => m.exists && (!m.isNonstandard || futureMoves.has(m.id)));
  const ids = rows.map(m => m.id).sort();
  for (const id of ids) {
    const d = DEX.moves.get(id);
    const mv = { t: d.type, c: d.category === 'Physical' ? 'P' : 'S', bp: d.basePower || 0 };
    if (d.recoil) mv.rc = d.recoil;
    const sb = (d.self && d.self.boosts) || (d.selfBoost && d.selfBoost.boosts) || null;
    if (sb) mv.self = sb;
    moves[id] = mv;
  }
  /* the sim's own injected moves (Struggle) — read out of legal_scope, never typed */
  for (const inj of (SCOPE.injected || [])) {
    const d = DEX.moves.get(inj.id);
    if (!d || !d.exists || moves[d.id]) continue;
    moves[d.id] = { t: d.type, c: d.category === 'Physical' ? 'P' : 'S', bp: d.basePower || 0 };
  }
  return moves;
}

/* ── THE TYPE CHART ─────────────────────────────────────────────────────────────────────────────
 * [attacking][defending] -> multiplier, derived from the format rather than restated. */
let CHART_DROPPED = [];
function buildChart() {
  /* THE TYPES THE REGULATION USES — a legal species' or a legal move's — not every name the dex holds.
   * `types.names()` also returns a type no legal species or move carries, and a row for it would be a
   * chart entry nothing can reach. Derived, and the dropped names are printed. Control: over Reg M-B's
   * 18 types this derivation reproduces data/engine-data.js's MC.C with 0 of 324 cells differing. */
  const used = new Set();
  for (const s of SPECIES) for (const t of s.types) used.add(t);
  for (const m of DEX.moves.all()) if (m.exists && !m.isNonstandard) used.add(m.type);
  const types = DEX.types.names().filter(t => used.has(t));
  CHART_DROPPED = DEX.types.names().filter(t => !used.has(t));
  const C = {};
  for (const a of types) {
    C[a] = {};
    for (const b of types) {
      if (!DEX.getImmunity(a, b)) { C[a][b] = 0; continue; }
      const e = DEX.getEffectiveness(a, b);
      C[a][b] = e === 0 ? 1 : (e > 0 ? Math.pow(2, e) : Math.pow(0.5, -e));
    }
  }
  return C;
}

/* ── PRIORS — DELIBERATELY EMPTY, AND SAID OUT LOUD ─────────────────────────────────────────────
 * MC.priors is the rollout's OPPONENT MODEL, not a species row: `const pr = MC.priors[me.name]` in
 * medicham2's chooser. Reg M-B's 230 rows are HAND-AUTHORED (data/mc-priors.json `_provenance`) and
 * that file names their owner as the opponent model, not this builder. A first draft here derived M-C
 * priors from the pool's observed clicks, and the intent label it had to attach over-matched on the
 * first print — Endure came out as `protect`, so the sampler would have played every Endure as a
 * Protect — and M-B's other four labels (`status`, `speed`, `pivot`, `redirect`) are judgements, one
 * of them a recorded defect. Building an opponent model is not ENGINE's call and was not the brief.
 *
 * So M-C ships `priors: {}` and every run prints it. The sampler's existing `if (pr)` falls through
 * to its non-prior chooser for every species. THE SOURCE EXISTS: every pool game carries `turns[].ev`
 * with `t: 'm'`, the active species and the move clicked, so the owner of the opponent model can
 * derive them from observed human clicks without a model in the path. */
function buildPriors() { return { priors: {} }; }

/* ── RENDER ─────────────────────────────────────────────────────────────────────────────────────
 * The SAME wrapper Reg M-B's artifact uses (data/engine-data.template.txt): one public surface, so a
 * consumer that requires either file gets `globalThis.MC` and `mcEff` and nothing else to learn. */
function render(MC, date) {
  let src;
  try { src = fs.readFileSync(D('data', 'engine-data.template.txt'), 'utf8'); }
  catch (e) { console.error('build_engine_data_regmc: cannot read data/engine-data.template.txt — ' + e.message); process.exit(2); }
  const m = src.match(/const MC = \{[\s\S]*?\};/);
  if (!m) { console.error('build_engine_data_regmc: no MC object in the template'); process.exit(2); }
  const stamp = `/* engine-data-regmc.js — the Champions REG M-C mon/move/type-chart data.
 * GENERATED by ABRA/build/build_engine_data_regmc.js from the Reg M-C Champions dex, the frozen
 * Reg M-C team pool and engine/legal_scope.js. Reg M-B's table is data/engine-data.js and is a
 * SEPARATE artifact; this file never writes it.
 * Last generated: ${date}. Do not hand-edit the MC object. */\n`;
  /* LF, ALWAYS. The template is CRLF on this machine only because `core.autocrlf` checks it out that
   * way; a NEW artifact inheriting that would change bytes with the checkout. The M-B builder keeps the
   * disk's endings to stay byte-stable against a file that predates it; this one has no such history. */
  const HEADER = /^\/\*[\s\S]*?\*\/\n/;
  const lf = src.replace(/\r\n/g, '\n');
  if (!HEADER.test(lf)) { console.error('build_engine_data_regmc: the template does not open with a block comment'); process.exit(2); }
  const out = lf.replace(/const MC = \{[\s\S]*?\};/, () => 'const MC = ' + JSON.stringify(MC) + ';');
  return out.replace(HEADER, () => stamp);
}

/* ── THE CENSUS — the 2026-07-30 shape, counted directly ────────────────────────────────────────*/
const CENSUS_BANDS = [
  ['bs missing (buildMon returns null — UNBUILDABLE)', m => !m.bs],
  ['ab null', m => m.ab == null],
  ['mv empty (the body threatens NOTHING)', m => !m.mv || !m.mv.length],
  ['item null', m => m.item == null],
  ['wt null (Low Kick / Grass Knot / Heavy Slam / Heat Crash uncomputable)', m => m.wt == null],
  ['st missing', m => !m.st],
];

(async () => {
  const t0 = Date.now();
  say(`build_engine_data_regmc — ${CS.FORMAT}`);
  say(`  regulation ${REG.ID} by ${REG.SOURCE}, pinned ${REG.PINNED_COMMIT ? REG.PINNED_COMMIT.slice(0, 12) : 'UNPINNED'}`);
  say(`  pool       ${POOL}`);
  say(`  out        ${OUT}${CHECK ? '   [--check: NOTHING IS WRITTEN]' : ''}`);

  const kc = keyControl();
  say(`\n  KEY-SPELLING CONTROL against the live Reg M-B artifact: `
    + (kc.ran ? `${kc.agree} of ${kc.rows} rows reproduce under the artifact's key rule, ${kc.differ.length} differ`
              : `DID NOT RUN — ${kc.why}`));
  for (const d of (kc.differ || [])) say(`      ${d}`);
  if (kc.ran && kc.differ.length) say('      (reported, not silently accepted — the 2026-07-30 failure was two spellings and no comparison)');

  const scan = await scanPool();
  say(`\n  POOL READ: ${scan.games.toLocaleString()} open-sheet games, ${scan.sheets.toLocaleString()} sheet entries, `
    + `${scan.megaAttributed.toLocaleString()} of them carrying a mega stone that identifies a forme`);
  for (const f of scan.files) say(`      ${f.file}  ${f.lines.toLocaleString()} lines  sha256 ${f.sha256.slice(0, 12)}`);
  if (scan.unresolved.size) say(`      sheet species the M-C dex cannot resolve: ${scan.unresolved.size} — `
    + [...scan.unresolved.entries()].slice(0, 10).map(([k, n]) => `${k} x${n}`).join(', '));
  else say('      sheet species the M-C dex cannot resolve: 0');

  const { mons, prov, abilityFixed } = buildRows(scan);
  const moves = buildMoves();
  const C = buildChart();
  const { priors } = buildPriors();
  const MC = { mons, moves, C, priors };

  /* TWO KEYS, ONE BODY — the check that would have caught 2026-07-30. Not "do two files spell a key
   * the same", which they legitimately may not: does THIS artifact hold two keys that normalise alike? */
  const flat = new Map();
  for (const k of Object.keys(mons)) { const f = norm(k); if (!flat.has(f)) flat.set(f, []); flat.get(f).push(k); }
  const dupes = [...flat.entries()].filter(([, ks]) => ks.length > 1);
  say(`\n  TWO KEYS, ONE BODY: ${dupes.length} collision(s)` + (dupes.length ? ' -> ' + dupes.map(([f, ks]) => f + ': ' + ks.join(' + ')).join(' | ') : ''));
  if (dupes.length) { console.error('  REFUSING: two representations of one body diverge and the emptier one wins.'); process.exit(1); }

  say(`\n  ROWS: ${Object.keys(mons).length} species`);
  say(`      OBSERVED  ${prov.observed.length}  (their own open-sheet joint set)`);
  say(`      INHERITED ${prov.inherited.length}  -> ${prov.inherited.join(', ') || 'none'}`);
  say(`      DERIVED   ${prov.derived.length}  -> ${prov.derived.join(', ') || 'none'}`);
  for (const k of prov.derived) say(`          ${k}: ab=${mons[k].ab} mv=${JSON.stringify(mons[k].mv)}  [${(mons[k].set_source.note || '').split('— ')[1] || ''}]`);
  say(`      mega rows given their OWN ability in place of the declared pre-evolution one (expected): ${abilityFixed.mega.length}`);
  say(`      NON-mega rows whose sheet/donor ability is impossible for the forme, replaced with the dex primary: ${abilityFixed.other.length}`
    + (abilityFixed.other.length ? ' -> ' + abilityFixed.other.join(', ') : ''));
  say(`      megas: ${Object.values(mons).filter(m => m.mega).length}`);

  say(`\n  MOVES: ${Object.keys(moves).length} rows  |  TYPE CHART: ${Object.keys(C).length} types (not carried: ${CHART_DROPPED.join(', ') || 'none'})  |  PRIORS: ${Object.keys(priors).length} species`);
  say('      PRIORS ARE EMPTY ON PURPOSE: the opponent model is not ENGINE\'s and is not built for M-C. medicham2\'s');
  say('      priors sampler will fall through to its non-prior chooser for EVERY M-C species. See buildPriors().');

  say('\n  row census — the 2026-07-30 shape:');
  let open = 0;
  for (const [label, pred] of CENSUS_BANDS) {
    const hit = Object.keys(mons).filter(k => pred(mons[k]));
    open += (label.startsWith('item') ? 0 : hit.length);
    say(`      ${label}: ${hit.length}` + (hit.length && hit.length <= 20 ? ' -> ' + hit.join(', ') : ''));
  }
  say(`      (a null \`item\` is a legal team-build state — no held item — and is not counted as open)`);
  say(`      OPEN rows in total: ${open}` + (open ? '  <- these are the ones to look at' : ''));
  /* JUDGED ON THE ROWS IT WRITES, AND IT REFUSES ON THEM. A byte comparison alone would pass an
   * artifact and a candidate that are both empty in the same place — which is exactly how 67 mega rows
   * sat at `mv: []` with every check green. So an open row fails the build AND the check. */
  if (open) {
    console.error(`\n  REFUSING${CHECK ? ' (--check)' : ' TO WRITE'}: ${open} row(s) carry the 2026-07-30 shape. A body with no base`);
    console.error('  stats cannot be built, and one with no moves or no ability threatens nothing and is invisible.');
    process.exit(1);
  }

  const bytes = render(MC, new Date().toISOString().slice(0, 10));
  const receipt = {
    _file: 'data/engine-data-regmc-receipt.json',
    _what: 'GENERATED. What build/build_engine_data_regmc.js actually opened to write data/engine-data-regmc.js.',
    _rule: 'The digests name the paths THIS RUN opened, never the canonical path for that kind of file.',
    generated: new Date().toISOString(),
    format: CS.FORMAT,
    regulation: REG.ID, regulation_source: REG.SOURCE, showdown_pinned_commit: REG.PINNED_COMMIT || null,
    showdown_actual_commit: (() => { try { return CS.actualCommit(); } catch (e) { return 'UNREADABLE: ' + String(e.message).split('\n')[0]; } })(),
    pool: POOL, pool_files: scan.files,
    pool_games: scan.games, pool_sheet_entries: scan.sheets, mega_sheets_attributed: scan.megaAttributed,
    scope: { species: SPECIES.length, future_readmitted: SCOPE.futureReadmitted },
    rows: Object.keys(mons).length, moves: Object.keys(moves).length,
    types: Object.keys(C).length, priors: Object.keys(priors).length,
    set_provenance: { observed: prov.observed.length, inherited: prov.inherited, derived: prov.derived },
    artifact_sha256: sha(Buffer.from(normalise(bytes))),
  };

  if (CHECK) {
    let disk = null;
    try { disk = fs.readFileSync(OUT, 'utf8'); } catch (e) {
      console.error(`\nbuild_engine_data_regmc --check: NO VERDICT. ${OUT} is absent.`); process.exit(2);
    }
    const undate = s => normalise(s).replace(/Last generated: \d{4}-\d{2}-\d{2}/, '<DATE>');
    const shown = path.relative(ROOT, OUT).replace(/\\/g, '/');
    if (undate(disk) === undate(bytes)) { say(`\n${shown} is exactly what its sources would produce today.`); process.exit(0); }
    console.error(`\n${shown} DOES NOT MATCH its sources.`);
    let had = null;
    try { had = JSON.parse(undate(disk).match(/const MC = (\{[\s\S]*?\});/)[1]); } catch (e) { console.error('  the MC object on disk does not parse — ' + e.message); }
    if (had) for (const top of ['mons', 'moves', 'C', 'priors']) {
      const a = had[top] || {}, b = MC[top] || {};
      const rows = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(r => JSON.stringify(a[r]) !== JSON.stringify(b[r]));
      if (rows.length) console.error(`  ${top}: ${rows.length} row(s) differ — ${rows.slice(0, 12).join(', ')}`);
    }
    process.exit(1);
  }

  fs.writeFileSync(OUT, bytes);
  fs.writeFileSync(D('data', 'engine-data-regmc-receipt.json'), JSON.stringify(receipt, null, 1) + '\n');
  say(`\n  -> ${OUT}  (${Buffer.byteLength(bytes).toLocaleString()} bytes, sha256 ${receipt.artifact_sha256.slice(0, 12)})`);
  say(`  -> data/engine-data-regmc-receipt.json`);
  say(`  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})();
