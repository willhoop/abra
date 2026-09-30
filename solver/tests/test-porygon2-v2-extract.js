/* solver/tests/test-porygon2-v2-extract.js — PORYGON2 v2's position extractor never leaks: a position at turn n holds
 * nothing revealed after turn n (solver/porygon2/v2/reveal.js).
 *
 *   node solver/tests/test-porygon2-v2-extract.js [--no-red] [--games N]       exit 0 GREEN, 1 RED, 2 CANNOT ANSWER
 *
 * Real replays: the first write-once raw-log shards of the Reg M-C bo1 (closed sheets) and bo3 (open sheets) streams in
 * the main checkout's data/raw/ (a dated shard never changes, so the sample is fixed).
 *
 *   PREFIX    for every position n of every game: the extractor run on the log CUT at the `|turn|n` line (nothing after
 *             it exists) returns a last position byte-identical to position n of the full run. Anything the full run knew
 *             from later in the log would make them differ.
 *   EVIDENCE  bo1 (rooms without public sheets): every revealed field in position n is named in the log BEFORE the `|turn|n` line — each known move,
 *             each known item (orig and now) and each ability learned from the log. An independent check that does not
 *             run the extractor twice.
 *   SHEETS    a bo1 room whose log shows both |showteam| sheets before the battle is marked sheets_public and carries
 *             them from turn 1 (they were public); no other bo1 room is.
 *   MONOTONE  a revealed move, an original item and a base ability, once known, stay known and unchanged at every later
 *             turn; `brought` never goes back to UNK.
 *   UNKNOWN   bo1 is not vacuously honest: members not yet on the field show brought/hp/status UNK, and UNK move slots
 *             exist at turn 1; bo3 carries the four sheet moves from turn 1.
 *   LABELS    no position input carries a label: no key named z / winner / labels / final / next_ko / turns_left anywhere
 *             inside x, and no player name.
 *   RED       unless --no-red: PORY2V2_BREAK=leak (a look-ahead pass seeds end-of-game reveals) and PORY2V2_BREAK=late (the
 *             snapshot is taken at the end of the turn) must each turn this test RED.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const MAIN = 'C:/Users/willj/Projects/Pokemon/ABRA';
if (!process.env.SHOWDOWN_PATH) {
  const sib = path.join(MAIN, '..', 'pokemon-showdown-mc');
  if (fs.existsSync(path.join(sib, 'dist', 'sim'))) process.env.SHOWDOWN_PATH = sib;
}
const argv = process.argv.slice(2);
const NO_RED = argv.includes('--no-red');
const NG = argv.includes('--games') ? +argv[argv.indexOf('--games') + 1] : 400;
const R = require('../porygon2/v2/reveal.js');
const UNK = R.UNK;

const DIRS = { bo1: path.join(MAIN, 'data', 'raw', 'games.gen9championsvgc2026regmc'), bo3: path.join(MAIN, 'data', 'raw', 'games.gen9championsvgc2026regmcbo3') };
for (const d of Object.values(DIRS)) if (!fs.existsSync(d)) { console.log('CANNOT ANSWER: no raw-log shards at ' + d); process.exit(2); }

let fails = 0, checks = 0;
const failed = {};
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed[clause] = (failed[clause] || 0) + 1; if (failed[clause] <= 5) console.log('  FAIL [' + clause + '] ' + msg); } };

function sample(dir, n) {
  const out = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.jsonl.gz')).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString('utf8');
    for (const line of txt.split('\n')) { if (!line.trim()) continue; const r = JSON.parse(line); if (r.log) out.push(r); if (out.length >= n) return out; }
  }
  return out;
}
const LABEL_KEYS = new Set(['z', 'winner', 'labels', 'final', 'next_ko', 'turns_left', 'end']);
function keysDeep(o, acc) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { acc.add(k); keysDeep(o[k], acc); } return acc; }

const stats = { games: 0, skipped: 0, positions: 0, prefix_runs: 0, evidence_fields: 0, unk_slots_t1: 0, known_moves_total: 0 };
for (const fmt of ['bo1', 'bo3']) {
  const rows = sample(DIRS[fmt], fmt === 'bo1' ? NG : Math.ceil(NG / 2));
  for (const r of rows) {
    let g;
    try { g = R.extract(r.log, { mode: fmt }); } catch (e) { stats.skipped++; continue; }
    if (!g.positions.length) { stats.skipped++; continue; }
    stats.games++;
    const L = String(r.log).split('\n');
    const turnLine = {};
    L.forEach((l, i) => { const m = /^\|turn\|(\d+)/.exec(l); if (m && turnLine[+m[1]] == null) turnLine[+m[1]] = i; });
    const hasSheets = L.filter(l => /^\|showteam\|p[12]\|/.test(l)).length >= 2;
    ok('SHEETS', hasSheets === g.game.sheets_public, fmt + ' ' + r.id + ' sheets_public ' + g.game.sheets_public + ' but the log ' + (hasSheets ? 'shows' : 'does not show') + ' both sheets');
    if (fmt === 'bo1' && hasSheets) stats.bo1_public_sheet_games = (stats.bo1_public_sheet_games || 0) + 1;
    const names = [g.game.players.p1 && g.game.players.p1.name, g.game.players.p2 && g.game.players.p2.name].filter(n => n && n.length >= 4);
    let prev = null;
    for (const p of g.positions) {
      stats.positions++;
      const cut = turnLine[p.n];
      ok('PREFIX', cut != null, fmt + ' ' + r.id + ' no |turn|' + p.n + ' line');
      if (cut == null) continue;
      const prefix = L.slice(0, cut + 1).join('\n');
      let gp = null;
      try { gp = R.extract(prefix, { mode: fmt }); } catch (e) { ok('PREFIX', false, fmt + ' ' + r.id + ' prefix threw ' + e.message); continue; }
      stats.prefix_runs++;
      const last = gp.positions[gp.positions.length - 1];
      ok('PREFIX', last && last.n === p.n && JSON.stringify(last.x) === JSON.stringify(p.x), fmt + ' ' + r.id + ' turn ' + p.n + ': the position differs from the one built on the log cut at |turn|' + p.n);
      // LABELS
      const ks = keysDeep(p.x, new Set());
      ok('LABELS', ![...ks].some(k => LABEL_KEYS.has(k)), fmt + ' ' + r.id + ' a label key inside x: ' + [...ks].filter(k => LABEL_KEYS.has(k)));
      const sx = JSON.stringify(p.x);
      ok('LABELS', !names.some(n => sx.includes('"' + n + '"')), fmt + ' ' + r.id + ' a player name inside x');
      // EVIDENCE (bo1). A bo1 room whose log shows both sheets before the battle made them public at turn 1; its evidence
      // is the |showteam| line itself, so it is checked for that instead (SHEETS below).
      if (fmt === 'bo1' && !g.game.sheets_public) {
        for (const s of ['p1', 'p2']) for (const m of p.x.sides[s].mons) {
          for (const mv of m.moves) if (mv !== UNK) { stats.evidence_fields++; ok('EVIDENCE', prefix.includes('|' + mv), fmt + ' ' + r.id + ' turn ' + p.n + ' ' + m.species + ' move ' + mv + ' not named before |turn|' + p.n); }
          for (const it of [m.item.orig, m.item.now]) if (it && it !== UNK) { stats.evidence_fields++; ok('EVIDENCE', prefix.includes(it), fmt + ' ' + r.id + ' turn ' + p.n + ' ' + m.species + ' item ' + it + ' not named before |turn|' + p.n); }
          if (m.ability_src === 'log' && m.ability.base !== UNK) { stats.evidence_fields++; ok('EVIDENCE', prefix.includes(m.ability.base), fmt + ' ' + r.id + ' turn ' + p.n + ' ' + m.species + ' ability ' + m.ability.base + ' not named before |turn|' + p.n); }
        }
      }
      // UNKNOWN
      if (p.n === 1) {
        for (const s of ['p1', 'p2']) for (const m of p.x.sides[s].mons) {
          if (m.brought !== true) ok('UNKNOWN', m.brought === UNK && m.hp === UNK && m.status === UNK, fmt + ' ' + r.id + ' an unseen member is not UNK at turn 1');
          if (fmt === 'bo1') stats.unk_slots_t1 += m.moves.filter(x => x === UNK).length;
          else ok('UNKNOWN', m.moves.filter(x => x !== UNK).length >= 1 && m.item.orig !== UNK && m.ability.base !== UNK, fmt + ' ' + r.id + ' a bo3 sheet field is UNK at turn 1');
        }
      }
      // MONOTONE
      if (prev) for (const s of ['p1', 'p2']) prev.x.sides[s].mons.forEach((a, k) => {
        const b = p.x.sides[s].mons[k];
        const ka = a.moves.filter(x => x !== UNK);
        ok('MONOTONE', ka.every(x => b.moves.includes(x)), fmt + ' ' + r.id + ' a known move vanished at turn ' + p.n);
        ok('MONOTONE', a.item.orig === UNK || a.item.orig === b.item.orig, fmt + ' ' + r.id + ' an original item changed at turn ' + p.n);
        ok('MONOTONE', a.ability.base === UNK || a.ability.base === b.ability.base, fmt + ' ' + r.id + ' a base ability changed at turn ' + p.n);
        ok('MONOTONE', a.brought !== true || b.brought === true, fmt + ' ' + r.id + ' a brought member went back to UNK at turn ' + p.n);
      });
      prev = p;
    }
    const lastP = g.positions[g.positions.length - 1];
    for (const s of ['p1', 'p2']) for (const m of lastP.x.sides[s].mons) stats.known_moves_total += m.moves.filter(x => x !== UNK).length;
  }
}
ok('NONVACUOUS', stats.games >= 50 && stats.positions >= 300, 'too few games/positions: ' + JSON.stringify(stats));
ok('NONVACUOUS', stats.evidence_fields > 0 && stats.unk_slots_t1 > 0 && stats.known_moves_total > 0, 'nothing revealed or nothing hidden: ' + JSON.stringify(stats));

// firstPerson is a pure chair swap
{
  const r = sample(DIRS.bo1, 1)[0];
  const g = R.extract(r.log, { mode: 'bo1' });
  const x = g.positions[0].x, a = R.firstPerson(x, 'p1'), b = R.firstPerson(x, 'p2');
  ok('FIRSTPERSON', a.me === x.sides.p1 && a.opp === x.sides.p2 && b.me === x.sides.p2 && b.opp === x.sides.p1 && a.field === x.field, 'firstPerson is not a chair swap');
}

console.log(JSON.stringify(stats));
let red = true;
if (!NO_RED && !process.env.PORY2V2_BREAK) {
  for (const brk of ['leak', 'late']) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red', '--games', '80'], { env: Object.assign({}, process.env, { PORY2V2_BREAK: brk }), encoding: 'utf8' });
    const wentRed = res.status === 1;
    console.log('  deliberate break PORY2V2_BREAK=' + brk + ': ' + (wentRed ? 'RED (as it must be)' : 'NOT RED, exit ' + res.status) + ' — ' + ((res.stdout || '').match(/FAIL \[[A-Z]+\]/g) || []).slice(0, 3).join(', '));
    ok('RED', wentRed, 'the test stayed green under PORY2V2_BREAK=' + brk);
  }
}
console.log((fails ? 'RED' : 'GREEN') + ' ' + (checks - fails) + '/' + checks + (fails ? '  failing: ' + JSON.stringify(failed) : ''));
process.exit(fails ? 1 : 0);
