/* rerun_list.js — WHICH PUBLISHED NUMBERS WERE MEASURED ON AN ENGINE WE NOW KNOW WAS WRONG.
 *
 *   node engine/rerun_list.js              print the list
 *   node engine/rerun_list.js --write      also write data/rerun-list.json
 *   node engine/rerun_list.js --selftest   drive every verdict branch on synthetic input
 *
 * WHY THIS EXISTS
 * ---------------
 * ROADMAP #57. Will, 2026-08-06: "THE 10 POINT LOSS WAS BASED ON A BOGUS ENGINE YOU KEEP QUOTING
 * THINGS THAT ARE UNRELIABLE." He was right, and the fix for that is not a note — a note is the thing
 * that failed. Six separate times a rollout-derived figure was quoted after the engine under it had
 * been corrected, by the same person who had written the retraction that morning.
 *
 * So the list is DERIVED. It reads each artifact's own stamp, asks the release registry what the
 * frozen engine's digest was, and compares that to the engine now. Nothing here is typed.
 *
 * THE CENTRAL FACT IT REPORTS, and the reason the task was understated: WIRES 123-131 landed on
 * 2026-08-06 and every engine release cut before that date froze a medicham2 that is now known wrong
 * in ways that change damage, accuracy and turn order. WIRE 123 alone gave the WRONG SIDE THE WEATHER
 * from turn 1 onward. An artifact stamped to such a release is not "slightly stale" — it is a
 * measurement of a different game.
 *
 * FOUR VERDICTS, and the distinctions are the whole point:
 *
 *   VOID        the generator invalidated its own run and said so. Already honest; nothing to decide.
 *   UNSTAMPED   no engine_release at all. THE WORST CASE, because it cannot even be dated. A stamped
 *               artifact that is stale can be re-run and compared; an unstamped one cannot be
 *               compared to anything, so its number is not evidence and never was.
 *   STALE       stamped, and the frozen engine differs from the live engine. Re-run and compare.
 *   CURRENT     stamped, and the frozen engine still matches. Quotable.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not re-run anything and it does not delete anything. It
 * says which numbers may be quoted. Acting on it is a decision with a compute cost, and this file has
 * no business making it.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
const WRITE = process.argv.includes('--write');
/* Nothing here fails quietly. tests/test-no-silent-failure.js is a ratchet and it is right:
 * a skip that says nothing turns a missing input into a clean result. */
const SKIPS = [], UNREADABLE = [];
const sha12 = require('./engine_release.js').sha12;

/* THE ENGINE FILES WHOSE MOVEMENT INVALIDATES A ROLLOUT. Read from the release registry's own SOURCES
 * rather than retyped — CLAUDE.md: a hand-maintained list of four went stale without anybody noticing.
 * Only the ones that change what a GAME does are compared; a release also freezes weights and data
 * files, and those moving means something different (a different opponent, not a different rulebook). */
const GAME_SOURCES = ['engine/medicham2-browser.js', 'engine/board.js', 'engine/champions_sim.js'];

/* An artifact is in scope if it reports a number produced by PLAYING, as opposed to by counting the
 * store. Matched on the artifact's own declared shape where it has one, and on the filename otherwise,
 * because 15 of them declare nothing at all — which is itself the finding. */
const PLAYS_GAMES = /rollout|exploit|wobbuffet|machamp|h2h|selfplay|self-?play|leaf|miltank|winrate-backtest|separation-gate|step-probe|ladder|game-diff|engine-diff/i;

function releaseDigests(id) {
  try {
    const meta = JSON.parse(fs.readFileSync(D('data', 'releases', id, 'release.json'), 'utf8'));
    return meta.files || meta.digests || meta.sources || null;
  } catch (e) { SKIPS.push('release ' + id + ': ' + String((e && e.message) || e).slice(0, 90)); return null; }
}

function classify(name, art, live, relLookup) {
  if (art && art.void) return { verdict: 'VOID', why: art.void_reason || 'the generator declared its own run void' };

  const rel = art && (art.engine_release || art.release || (art.stamp && art.stamp.engine_release));
  if (!rel) {
    return { verdict: 'UNSTAMPED',
             why: 'no engine_release — this number cannot be dated, so it cannot be compared to anything' };
  }

  /* A DECLARED NON-DEPENDENCE IS NOT A STALE STAMP, AND THIS READ IT AS ONE. `dusk-size-gate.json`
   * puts a full sentence in its `engine_release` field explaining that it loads no engine module at
   * all — pure store analysis, nothing for a release to freeze. That is the RAW-STORE-OK pattern
   * CLAUDE.md endorses: a gap that is a JUDGEMENT gets declared with its reason. Treating the
   * sentence as an id made the lookup fail and printed the whole paragraph as a release name.
   * A release id is 12 hex characters; anything else in that field is prose, and prose is a claim. */
  if (!/^[0-9a-f]{12}$/.test(String(rel))) {
    return { verdict: 'DECLARED N/A', why: String(rel).replace(/\s+/g, ' ').slice(0, 200) };
  }

  const frozen = relLookup(rel);
  if (!frozen) return { verdict: 'STALE', release: rel, why: `release ${rel} is not on disk, so what it froze cannot be checked` };

  const moved = GAME_SOURCES.filter(s => frozen[s] && live[s] && frozen[s] !== live[s]);
  if (!moved.length) return { verdict: 'CURRENT', release: rel, why: 'every game-affecting source still matches the frozen copy' };
  return { verdict: 'STALE', release: rel, moved,
           why: `measured on ${moved.map(m => `${m.split('/').pop()} ${frozen[m]}`).join(', ')}; live is `
              + moved.map(m => `${live[m]}`).join(', ') };
}

/* ---- SELFTEST ---------------------------------------------------------------------------------
 * The standing rule: shown failing on known-bad input before it is committed. Every branch, and in
 * particular the one that separates UNSTAMPED from STALE — an unstamped artifact used to be lumped in
 * with stale ones, which flatters it. Stale can be re-run and compared. Unstamped never could. */
if (process.argv.includes('--selftest')) {
  const LIVE = { 'engine/medicham2-browser.js': 'live00000000', 'engine/board.js': 'liveboard000', 'engine/champions_sim.js': 'livesim00000' };
  const SAME = { ...LIVE };
  const DIFF = { ...LIVE, 'engine/medicham2-browser.js': 'old000000000' };
  /* REALISTIC IDS. The first draft used 'same'/'diff'/'gone', and when the DECLARED N/A rule landed
   * the selftest went red on four cases — correctly. A release id is 12 hex, those were not, so the
   * new rule read every fixture as prose. The fixtures were wrong, not the rule; a check whose inputs
   * do not look like production inputs will pass or fail for reasons production never sees. */
  const SAME_ID = 'aaaaaaaaaaaa', DIFF_ID = 'bbbbbbbbbbbb', GONE_ID = 'cccccccccccc';
  const look = id => (id === SAME_ID ? SAME : id === DIFF_ID ? DIFF : null);
  const cases = [
    ['declared void                -> VOID',      { void: true, void_reason: 'x' }, 'VOID'],
    ['no stamp at all              -> UNSTAMPED', { games: 5000 },                  'UNSTAMPED'],
    ['stamped, engine moved        -> STALE',     { engine_release: DIFF_ID },      'STALE'],
    ['stamped, engine unchanged    -> CURRENT',   { engine_release: SAME_ID },      'CURRENT'],
    ['stamped to a missing release -> STALE',     { engine_release: GONE_ID },      'STALE'],
    ['stamp nested under .stamp    -> CURRENT',   { stamp: { engine_release: SAME_ID } }, 'CURRENT'],
    /* THE REAL SHAPE THAT BROKE IT: dusk-size-gate.json declares, in prose, that it loads no engine. */
    ['a PROSE reason, not an id    -> DECLARED N/A',
      { engine_release: 'none — this is pure store analysis and loads no engine module.' }, 'DECLARED N/A'],
  ];
  let bad = 0;
  for (const [label, art, want] of cases) {
    const got = (classify('t.json', art, LIVE, look) || {}).verdict;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `   got ${got}`}`);
  }
  /* THE DISTINCTION THAT MATTERS, asserted rather than implied. */
  const u = classify('t.json', { games: 1 }, LIVE, look).verdict;
  const s = classify('t.json', { engine_release: 'diff' }, LIVE, look).verdict;
  const sep = u !== s;
  if (!sep) bad++;
  console.log(`  ${sep ? 'ok  ' : 'FAIL'} an UNSTAMPED artifact is not reported as merely STALE`);
  console.log(`\nRERUN-LIST SELFTEST: ${cases.length + 1 - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

/* ---- RUN --------------------------------------------------------------------------------------- */
const live = {};
for (const s of GAME_SOURCES) {
  try { live[s] = sha12(D(s)); }
  catch (e) { live[s] = null; SKIPS.push(`could not hash ${s}: ${(e.message || e).toString().slice(0, 80)}`); }
}

const cache = {};
const relLookup = id => (id in cache ? cache[id] : (cache[id] = releaseDigests(id)));

const rows = [];
for (const f of fs.readdirSync(D('data'))) {
  if (!f.endsWith('.json')) continue;
  let art;
  /* COUNTED, NOT SWALLOWED. An artifact that will not parse is exactly the kind of thing this list
   * exists to surface; skipping it in silence would report "0 unstamped" over a file nobody can read. */
  try { art = JSON.parse(fs.readFileSync(D('data', f), 'utf8')); }
  catch (e) { UNREADABLE.push(f); continue; }
  if (!art || Array.isArray(art)) continue;
  const stamped = !!(art.engine_release || art.release || (art.stamp && art.stamp.engine_release));
  if (!PLAYS_GAMES.test(f) && !stamped) continue;
  /* A NUMBER ONLY. `games` is a COUNT in most artifacts and an ARRAY OF GAMES in game-diff.json,
   * and printing the array gave a column of `[object Object]` — a display bug, but the same shape as
   * the real ones here: a field read without asking what type it holds. */
  const g = [art.games, art.n_games, art.summary && art.summary.games].find(x => typeof x === 'number');
  rows.push({ artifact: f, games: g == null ? null : g, ...classify(f, art, live, relLookup) });
}

const ORDER = { UNSTAMPED: 0, VOID: 1, STALE: 2, 'DECLARED N/A': 3, CURRENT: 4 };
rows.sort((a, b) => (ORDER[a.verdict] - ORDER[b.verdict]) || a.artifact.localeCompare(b.artifact));

const count = v => rows.filter(r => r.verdict === v).length;
console.log('');
console.log('THE RE-RUN LIST — generated by engine/rerun_list.js, nothing here is typed');
console.log('');
console.log(`  ${rows.length} artifacts report a number produced by playing games.`);
console.log(`  UNSTAMPED ${count('UNSTAMPED')}   VOID ${count('VOID')}   STALE ${count('STALE')}   DECLARED N/A ${count('DECLARED N/A')}   CURRENT ${count('CURRENT')}`);
console.log('');
let last = null;
for (const r of rows) {
  if (r.verdict !== last) { console.log(`  -- ${r.verdict} ${'-'.repeat(Math.max(0, 60 - r.verdict.length))}`); last = r.verdict; }
  console.log(`  ${r.artifact.padEnd(38)} ${r.games ? String(r.games).padStart(6) + ' games' : '            '}  ${r.release || ''}`);
  console.log(`  ${' '.repeat(38)} ${r.why}`);
}
console.log('');
console.log('  UNSTAMPED is the worst column, not the mildest. A STALE number can be re-run and');
console.log('  compared against what it used to say. An UNSTAMPED one cannot be compared to anything,');
console.log('  because nothing records which engine produced it.');
console.log('');

if (WRITE) {
  fs.writeFileSync(D('data', 'rerun-list.json'), JSON.stringify({
    generated: new Date().toISOString(),
    by: 'engine/rerun_list.js',
    note: 'ROADMAP #57. Derived, never typed. UNSTAMPED means the number cannot be dated and is not evidence.',
    live_digests: live,
    game_sources: GAME_SOURCES,
    counts: { unstamped: count('UNSTAMPED'), void: count('VOID'), stale: count('STALE'), current: count('CURRENT') },
    rows,
  }, null, 2) + '\n');
  console.log('  -> data/rerun-list.json');
}
