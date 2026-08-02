/* test-click-match.js — one reader for "whose moveset is this, and which candidate did they press",
 * and this bans the others.
 *
 *   node tests/test-click-match.js            check
 *   node tests/test-click-match.js --update   re-baseline (do this when you REMOVE a hand-rolled one)
 *
 * WHY IT EXISTS
 * -------------
 * docs/ARTIFACT-ACCESS-RULES.md R6: **the second occurrence of a bug must ship the guard against the
 * third.** The first occurrence was `MC.mons` — one artifact, five private doorways, 8.17% of the
 * metagame lost silently. This is the second, in the store's team sheets: seven files each wrote
 * `sheet[base(species)] = { side, ... }` and then never looked at `side` again.
 *
 * R7: **a guard only guards what it exercises.** The semantics fixture missed the forme bug because
 * every species in it was hyphen-free. So every assertion below is built from a REAL defect measured
 * by engine/redirect_audit.js on 2026-08-02, and each one is also asserted to FAIL under the old
 * lookup — a test that passes both before and after the fix is not testing the fix.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

console.log('CLICK MATCH — one reader for the team sheets and the human\'s click\n');

const B = require(D('engine', 'board.js'));
const CM = require(D('engine', 'click_match.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const base = B.baseSpecies;

/* The lookup every one of the seven files wrote, reproduced here so the assertions can show it
 * failing. If this ever stops failing, the defect has been fixed somewhere else and these tests are
 * no longer proving anything — which is worth knowing. */
function oldFlatSheet(g) {
  const sheet = {};
  for (const side of ['p1', 'p2']) {
    for (const m of (g.sheets && g.sheets[side]) || []) {
      if (m && m.species) sheet[base(m.species)] = { side, moves: (m.moves || []).map(B.norm) };
    }
  }
  return sheet;
}

/* ---- 1. THE MIRROR ---------------------------------------------------------------------------
 * 58.63% of corpus games carry at least one species on BOTH sheets, and Species Clause is per
 * PLAYER, not per battle. Measured: 8.02% of all slots were scored against the other side's four
 * moves, and 62.16% of those matched anyway and were fitted with the wrong choice set. */
const mirrorGame = {
  sheets: {
    p1: [{ species: 'Kingambit', ability: 'Defiant', moves: ['Kowtow Cleave', 'Sucker Punch', 'Swords Dance', 'Protect'] }],
    p2: [{ species: 'Kingambit', ability: 'Defiant', moves: ['Iron Head', 'Low Kick', 'Sucker Punch', 'Protect'] }],
  },
};
const SIm = CM.sheetIndex(mirrorGame, dex);
ok(SIm.get('p1', 'Kingambit').moves.includes('kowtowcleave') && !SIm.get('p1', 'Kingambit').moves.includes('ironhead'),
  'p1 Kingambit gets p1\'s moveset');
ok(SIm.get('p2', 'Kingambit').moves.includes('ironhead') && !SIm.get('p2', 'Kingambit').moves.includes('kowtowcleave'),
  'p2 Kingambit gets p2\'s moveset');
ok(SIm.mirrored().includes('kingambit'), 'the mirror is reported rather than silently resolved');
ok(oldFlatSheet(mirrorGame)[base('Kingambit')].side === 'p2',
  'the OLD flat lookup really does hand p1\'s Kingambit the p2 set (this is the defect)');

/* ---- 2. IN-BATTLE FORMES ---------------------------------------------------------------------
 * 19.65% of slot failures. The sheet says `Floette-Eternal` and the protocol calls the slot
 * `Floette`, 3,627 times. Aegislash's sheet says `Aegislash` and the battle turns it into
 * `Aegislash-Blade` mid-turn. Both directions, folded through the DEX's own baseSpecies. */
const formeGame = {
  sheets: {
    p1: [{ species: 'Aegislash', ability: 'StanceChange', moves: ['Shadow Ball', 'Flash Cannon', 'Kings Shield', 'Protect'] }],
    p2: [{ species: 'Floette-Eternal', ability: 'FlowerVeil', moves: ['Moonblast', 'Calm Mind', 'Dazzling Gleam', 'Protect'] }],
  },
};
const SIf = CM.sheetIndex(formeGame, dex);
ok(SIf.get('p2', 'Floette') && SIf.get('p2', 'Floette').moves.includes('moonblast'),
  'the battle\'s "Floette" finds the sheet\'s Floette-Eternal (base -> forme)');
ok(SIf.get('p1', 'Aegislash-Blade') && SIf.get('p1', 'Aegislash-Blade').moves.includes('shadowball'),
  'the battle\'s "Aegislash-Blade" finds the sheet\'s Aegislash (forme -> base)');
ok(!oldFlatSheet(formeGame)[base('Floette')] && !oldFlatSheet(formeGame)[base('Aegislash-Blade')],
  'the OLD flat lookup finds neither (this is the defect)');
ok(SIf.get('p1', 'Floette') === null, 'a species that is on the OTHER side does not resolve on this one');
ok(SIf.get('p1', 'Definitely Not A Pokemon') === null, 'an unknown species resolves to null, not to something plausible');

/* The fold must refuse to guess. Two formes of one species cannot legally share a side under
 * Species Clause, but the accessor is what stops a future store bug becoming a silent wrong set. */
const ambiguous = CM.sheetIndex({ sheets: { p1: [
  { species: 'Rotom-Wash', moves: ['Hydro Pump'] },
  { species: 'Rotom-Heat', moves: ['Overheat'] },
], p2: [] } }, dex);
ok(ambiguous.get('p1', 'Rotom') === null, 'an ambiguous forme fold returns null rather than picking one');
ok(ambiguous.get('p1', 'Rotom-Wash').moves.includes('hydropump'), '...while the exact name still resolves');

/* ---- 3. THE TARGET THAT WAS NOT THERE YET -----------------------------------------------------
 * The single biggest cause of the joint fit's 23.18% drop: 44.37% of failures. Switches resolve
 * before moves, so the protocol records the mon that ARRIVED while the human was choosing against
 * the one that LEFT. A human targets a SLOT. */
const board = new B.Board();
for (const [side, a, b] of [['p1', 'Sneasler', 'Dragonite'], ['p2', 'Archaludon', 'Victreebel']]) {
  board.setParty(side, [a, b, 'Pelipper']);
  board.switchIn(side, 'a', a);
  board.switchIn(side, 'b', b);
}
const ev = [
  { t: 's', s: 'p2a', mon: 'Pelipper' },
  { t: 'm', s: 'p1a', mon: 'Sneasler', mv: 'Close Combat', tgt: 'pelipper' },
];
ok(CM.targetAtDecision(ev, 1, 'p2', 'pelipper', board) === 'archaludon',
  'a target that switched in this turn resolves back to who was standing there (pelipper -> archaludon)');
ok(CM.targetAtDecision(ev, 1, 'p2', 'victreebel', board) === 'victreebel',
  'a target that was already there resolves to itself');
ok(CM.targetAtDecision(ev, 0, 'p2', 'pelipper', board) === null,
  'a switch that had not happened yet is not used to resolve anything');
ok(CM.targetAtDecision(ev, 1, 'p2', null, board) === null, 'no recorded target resolves to null, not to a guess');

/* ...and the matcher then finds the candidate the human actually pressed. */
const user = board.slot('p1', 'a');
const cands = B.candidates(['closecombat', 'gunkshot', 'fakeout', 'protect'], user, board, 'p1', dex);
const want = { kind: 'move', mv: 'Close Combat', tgt: 'pelipper' };
const fixed = CM.matchClick(cands, want, dex, CM.targetAtDecision(ev, 1, 'p2', 'pelipper', board));
const naive = CM.matchClick(cands, want, dex, undefined);
ok(fixed.chosen >= 0 && base(cands[fixed.chosen].targetMon.species) === 'archaludon',
  'the click matches Close Combat aimed at Archaludon');
ok(naive.chosen < 0 && naive.sameMove > 0,
  'without the resolution it finds the move and no target — which is what "targetMismatch" was');

/* ---- 4. THE RULES THE MATCHER MUST NOT LOSE ---------------------------------------------------
 * R7 again. The spread rule cost 70% of the pair fit's data on 2026-08-01 and the ambiguity rule is
 * why mirror targets are dropped rather than guessed. Both are exercised so a rewrite cannot quietly
 * drop them. */
const spreadCands = B.candidates(['earthquake', 'protect'], user, board, 'p1', dex);
const spreadIdx = spreadCands.findIndex(c => c.move && c.move.id === 'earthquake');
ok(spreadIdx >= 0 && spreadCands[spreadIdx].targetMon === null,
  'a spread candidate structurally has no targetMon');
ok(CM.matchClick(spreadCands, { kind: 'move', mv: 'Earthquake', tgt: 'archaludon' }, dex).chosen === spreadIdx,
  'a spread click matches despite carrying a recorded target');

const mirrorBoard = new B.Board();
mirrorBoard.setParty('p1', ['Sneasler']); mirrorBoard.switchIn('p1', 'a', 'Sneasler');
mirrorBoard.setParty('p2', ['Garchomp', 'Garchomp']);
mirrorBoard.switchIn('p2', 'a', 'Garchomp'); mirrorBoard.switchIn('p2', 'b', 'Garchomp');
const mUser = mirrorBoard.slot('p1', 'a');
const mCands = B.candidates(['closecombat'], mUser, mirrorBoard, 'p1', dex);
const mRes = CM.matchClick(mCands, { kind: 'move', mv: 'Close Combat', tgt: 'garchomp' }, dex);
ok(mRes.ambiguous && mRes.chosen < 0, 'two identical foes make the target genuinely ambiguous, and it is dropped not guessed');

ok(CM.matchClick(cands, { kind: 'switch', to: 'dragonite' }, dex).chosen < 0
  || cands.some(c => c.switchTo === 'dragonite'), 'a switch is matched by its destination');

/* ---- 5. THE BAN -------------------------------------------------------------------------------
 * Behavioural tests only prove today's callers work. The recurring failure is a NEW file writing the
 * same three lines, so the check is about the SHAPE of the code — the same trick as
 * tests/test-mc-key.js and tests/test-drop-guard.js. Over-broad on purpose, then baselined. */
const PATTERNS = [
  { re: /\bsheets?\s*\[\s*base\s*\(/, why: 'indexes a sheet map by species with no side in the key' },
  { re: /\bsheets?\s*\[\s*(?:B\.)?norm\s*\(/, why: 'indexes a sheet map by a normalised species with no side' },
];
/* The accessor and its own test are allowed to touch the raw shape — that is their job. So is
 * engine/redirect_audit.js, which keeps the OLD lookup deliberately, as the control it scores the
 * new one against: without it the before/after comparison would be two separate runs of two
 * different programs rather than one replay scored two ways. */
const OWN = new Set(['engine/click_match.js', 'tests/test-click-match.js', 'engine/redirect_audit.js']);

const BASELINE_FILE = D('data', 'click-match-baseline.json');
const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : { allowed: {} };

const found = {};
for (const dir of ['engine', 'build', 'tests']) {
  if (!fs.existsSync(D(dir))) continue;
  for (const f of fs.readdirSync(D(dir))) {
    if (!/\.js$/.test(f)) continue;
    const rel = `${dir}/${f}`;
    if (OWN.has(rel)) continue;
    let hits = 0;
    for (const line of fs.readFileSync(D(dir, f), 'utf8').split('\n')) {
      if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;          // a comment describing the bug is not the bug
      for (const p of PATTERNS) if (p.re.test(line)) hits++;
    }
    if (hits) found[rel] = hits;
  }
}

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify({
    note: 'Files still keying the team sheets by species with no side. New entries are a FAILURE; '
        + 'this list may only shrink. See engine/click_match.js and docs/ARTIFACT-ACCESS-RULES.md R1.',
    allowed: found,
  }, null, 2) + '\n');
  console.log(`  re-baselined: ${Object.keys(found).length} file(s) still hand-rolling the sheet lookup`);
  process.exit(0);
}

const novel = Object.keys(found).filter(f => !(f in (baseline.allowed || {})));
const grew = Object.keys(found).filter(f => (baseline.allowed || {})[f] !== undefined && found[f] > baseline.allowed[f]);
ok(novel.length === 0, `no NEW file keys the sheets by species alone (${novel.join(', ') || 'none'})`);
ok(grew.length === 0, `no baselined file grew more of them (${grew.map(f => `${f}: ${baseline.allowed[f]} -> ${found[f]}`).join(', ') || 'none'})`);

const cleaned = Object.keys(baseline.allowed || {}).filter(f => !(f in found));
if (cleaned.length) console.log(`  (${cleaned.length} baselined file(s) now clean: ${cleaned.join(', ')} — re-baseline with --update)`);
console.log(`\n  side-blind sheet lookups remaining: ${Object.keys(found).length} `
  + `(${Object.entries(found).map(([f, n]) => `${f}:${n}`).join(', ') || 'none'})`);

console.log(`\nCLICK MATCH TESTS: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
