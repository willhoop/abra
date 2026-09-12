/* probe_mega_ends_absorb_gift.js — A MEGA OVERWRITES THE ABILITY, AND THE ABILITY'S GIFT MUST GO
 * WITH IT. 2026-09-12.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_ends_absorb_gift.js
 *   SHOWDOWN_PATH=... node tests/probe_mega_ends_absorb_gift.js --only mega-drops-gift
 *   SHOWDOWN_PATH=... node tests/probe_mega_ends_absorb_gift.js --release <id>
 *
 * ================= WHY THIS FILE EXISTS ========================================================
 *
 * `data/verification/game-differential-10k-middle.json` (7,178 games, release 48ac1c228e02) parted
 * 84 boards, and `state.families` — the POPULATION — carries `active[].vol.flashfire  2 games`. The
 * protocol side names the moment exactly, twice, in two different games:
 *
 *     |detailschange|p2a: Houndoom|Houndoom-Mega, L50
 *     |-mega|p2a: Houndoom|Houndoom|Houndoominite
 *     sd:  |-end|p2a: Houndoom|ability: Flash Fire|[silent]      <- missing from medicham2
 *     me:  |move|p2a: Houndoom|protect|p2a: Houndoom
 *
 * ================= THE MECHANISM, READ AT THE LINE =============================================
 *
 *     flashfire.onEnd(pokemon) { pokemon.removeVolatile("flashfire"); }        data/abilities.ts
 *     flashfire.condition.onEnd(target) { this.add('-end', target, 'ability: Flash Fire', '[silent]'); }
 *     Pokemon#setAbility: this.battle.singleEvent('End', oldAbility, this.abilityState, this, source);
 *                                                                              sim/pokemon.ts:1928
 *
 * `setAbility` runs the OUTGOING ability's End on every rewrite, and a mega evolution is a rewrite:
 * Champions overwrites the ability, every game, on ~26% of this format's usage. medicham2 already
 * knows the rule — `abRewrite` calls `endAbsorbGiftVolatile` and has since 2026-08-29 — but
 * `megaEvolveNow` does not go through `abRewrite`. It writes `m.ability=ab; m.baseAbility=ab;`
 * directly, so the one ability rewrite that happens in EVERY game was the one that skipped the End.
 *
 * ================= WHAT THE TAG MATCHES, PRINTED BEFORE IT WAS WIRED ============================
 *
 * The engine reads this off `typeImmunity.gain.volatileBoost.endsWithAbility` rather than off a
 * name. Walked over `data/tags.json` before the fix was written, that param matches EXACTLY ONE
 * ability in this format:
 *
 *     flashfire   vol=flashfire   uses=1777   {"stats":["atk","spa"],"moveType":"Fire",
 *                                              "mult":1.5,"announce":"ability: Flash Fire",
 *                                              "endsWithAbility":true}
 *
 * so the blast radius is one ability and one volatile, and the file prints the same walk at run time
 * rather than trusting this paragraph. Eighteen OTHER legal abilities carry an `onEnd` (Unburden,
 * Protosynthesis, Quark Drive, Slow Start, Zen Mode, Supreme Overlord and the rest); NONE of them is
 * touched here and that is stated rather than implied — they are a separate mechanism with their own
 * probe, and Supreme Overlord's is the `-end|pXa|fallenundefined` narration bucket in the same
 * artifact.
 *
 * ================= NO EXPECTATION IS TYPED =====================================================
 *
 * Every arm plays the identical script on both engines under the same pinned dice arm and the BOARD
 * is compared by the driver's own state comparator. Showdown's board is the answer.
 * `MEDI_MEGA_KEEPS_ABSORB_GIFT=1` restores the pre-fix engine and stamps
 * `MEDFAILS.megaKeepsAbsorbGiftRestored`, asserted ABSENT clean and PRESENT under the knob.
 *
 * ================= THE THREE ARMS ==============================================================
 *
 *   mega-drops-gift   THE DEFECT. Chandelure absorbs a Will-O-Wisp with Flash Fire on turn 1 and
 *                     megas on turn 2 into Infiltrator. RED before the fix.
 *   no-mega           THE KNOB CLEARED BY ONE FIELD — the identical board, the identical clicks,
 *                     `mega: true` removed. The gift SURVIVES on both sides. A fix that dropped the
 *                     gift on any turn a mega was merely POSSIBLE breaks here.
 *   mega-no-gift      THE OVER-MATCH GUARD. The identical mega with no gift ever banked (the foe
 *                     presses Protect on turn 1). Nothing may part.
 *
 * ================= THE FIXTURE, DERIVED ========================================================
 *
 * Chandelure rather than Houndoom, although the artifact shows both: Chandelure-Mega's ability is
 * INFILTRATOR, which does nothing on this board, while Houndoom-Mega's is SOLAR POWER, which chips
 * its holder in sun and would put a second moving part in the turn under test. Will-O-Wisp rather
 * than a Fire attack because Flash Fire absorbs it whole — no damage roll, no burn, nothing to part
 * a board except the leaf being measured. The arm is `bottom-tie-first`, where a sub-100 move always
 * hits, so Will-O-Wisp's 85 accuracy is a certainty rather than a coin.
 *
 * Every species, item, ability and move is checked against the format AND the learnset before a game
 * is played, and the file refuses to run on a single illegal cell.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_mega_ends_absorb_gift.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_MEGA_KEEPS_ABSORB_GIFT';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE BOARD --------------------------------------------------------------------------------- */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));
const CHAND = ['chandelure', 'Chandelurite', 'Flash Fire', ['Calm Mind', 'Protect']];
/* Early Bird, not Flash Fire: a Flash Fire foe would absorb nothing here but would put a second
 * carrier of the exact volatile under test on the board, which is how a leaf reads green for the
 * wrong body. */
const HOUND = ['houndoom', '', 'Early Bird', ['Will-O-Wisp', 'Protect']];
const CLEF = ['clefable', '', 'Magic Guard', ['Calm Mind', 'Protect']];
const MEOW = ['meowstic', '', 'Keen Eye', ['Calm Mind', 'Protect']];

const P1 = stage([CHAND, CLEF]).concat(BENCH('garchomp', 'toxapex'));
const P2 = stage([HOUND, MEOW]).concat(BENCH('snorlax', 'furfrou'));

const CM = { m: 'calmmind' }, PR = { m: 'protect' };
const PR_MEGA = { m: 'protect', mega: true };
const WOW0 = { m: 'willowisp', t: 0 };

const CASES = [
  { id: 'mega-drops-gift', kind: 'red', arm: 'bottom-tie-first', megas: 1, gift_after: 0,
    script: [{ p1: [CM, CM], p2: [WOW0, CM] },
      { p1: [PR_MEGA, CM], p2: [PR, CM] }],
    what: 'THE DEFECT. Chandelure absorbs a Will-O-Wisp with Flash Fire on turn 1, then mega evolves '
        + 'into Infiltrator on turn 2. The authority runs the OUTGOING ability\'s End inside '
        + '`setAbility`, which removes the gift; `megaEvolveNow` wrote `m.ability` directly and never '
        + 'reached `abRewrite`, so the board parts on `p1.active[0].vol.flashfire  medicham 1  '
        + 'showdown 0`.' },

  { id: 'no-mega', kind: 'control', arm: 'bottom-tie-first', megas: 0, gift_after: 1,
    script: [{ p1: [CM, CM], p2: [WOW0, CM] },
      { p1: [PR, CM], p2: [PR, CM] }],
    what: 'THE KNOB CLEARED BY ONE FIELD — the identical board and the identical clicks with '
        + '`mega: true` removed. Nothing rewrites the ability, so the gift SURVIVES on both sides and '
        + 'the leaf reads 1. A fix that dropped the gift on a turn where a mega was merely POSSIBLE, '
        + 'or on any forme change, parts here.' },

  { id: 'mega-no-gift', kind: 'control', arm: 'bottom-tie-first', megas: 1, gift_after: 0,
    script: [{ p1: [CM, CM], p2: [PR, CM] },
      { p1: [PR_MEGA, CM], p2: [PR, CM] }],
    what: 'THE OVER-MATCH GUARD. The identical mega with nothing ever banked — the foe presses '
        + 'Protect instead of the Will-O-Wisp. An ordinary mega must be byte-identical to what it was '
        + 'before this fix existed.' },
];

/* ---- LEGALITY, DERIVED AND REFUSED ------------------------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const mid = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[mid]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
const seenRow = new Set();
for (const row of P1.concat(P2)) {
  const key = row.species + '|' + row.item + '|' + row.ability + '|' + row.moves.join(',');
  if (seenRow.has(key)) continue;
  seenRow.add(key);
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.item && !legal(dex.items.get(row.item))) {
    console.log('ILLEGAL FIXTURE  ' + row.item + ' is not in this format'); illegal++;
  }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE MECHANISM, READ OUT OF THE FORMAT RATHER THAN QUOTED ---------------------------------- */
const FF_END = String(dex.abilities.get('flashfire').onEnd || '');
const FF_REMOVES = /removeVolatile\(['"]flashfire['"]\)/.test(FF_END);
const STONE = dex.items.get('chandelurite');
const MEGA_TARGET = STONE.megaStone && STONE.megaStone[dex.species.get('chandelure').name];
const MEGA_AB = MEGA_TARGET ? Object.values(dex.species.get(MEGA_TARGET).abilities) : [];
const WOW_TYPE = dex.moves.get('willowisp').type;
/* THE TAG WALK, PRINTED AT RUN TIME. The engine keys the removal on this param and NOT on a name, so
 * what it matches is what the fix touches. An over-match is a finding here, not a surprise later. */
const TAGS_JSON = JSON.parse(require('fs').readFileSync(D('data', 'tags.json'), 'utf8'));
const GIFT_ABILITIES = Object.entries(TAGS_JSON.abilities || {}).filter(([, r]) => {
  const g = r.params && r.params.typeImmunity && r.params.typeImmunity.gain;
  return !!(g && g.volatile && g.volatileBoost && g.volatileBoost.endsWithAbility);
}).map(([k, r]) => k + '(' + ((r.params.typeImmunity.gain.volatile)) + ', uses ' + (r.uses || 0) + ')');
console.log(NL + '  READ AT RUN TIME, NOT RECALLED:');
console.log('    flashfire.onEnd removes the volatile         : ' + FF_REMOVES);
console.log('    chandelurite -> ' + MEGA_TARGET + ', ability ' + MEGA_AB.join('/'));
console.log('    the mega ability is NOT Flash Fire           : '
  + !MEGA_AB.map(a => dex.abilities.get(a).id).includes('flashfire'));
console.log('    willowisp type                               : ' + WOW_TYPE);
console.log('    abilities matching `endsWithAbility`         : ' + (GIFT_ABILITIES.join(', ') || 'NONE'));
if (!FF_REMOVES || !MEGA_TARGET || WOW_TYPE !== 'Fire'
    || MEGA_AB.map(a => dex.abilities.get(a).id).includes('flashfire') || !GIFT_ABILITIES.length) {
  console.log(NL + 'NOT RUN — the format no longer supports this fixture. That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const arm = G.ARM_BY_ID.get(c.arm);
  if (!arm) { console.log('NOT RUN — the driver has no arm named ' + c.arm); process.exit(2); }
  const a = G.buildPair(P1), b = G.buildPair(P2);
  if (!a || !b) return { notStaged: true, which: (!a ? 'A' : 'B') };
  let sdGift = null, mediGift = null, sdAb = '', mediAb = '';
  const r = G.playGame(a, b, 'directed', 'probe_mega_ends_absorb_gift :: ' + c.id, { script: c.script, arm,
    onBoundary: (snap, turnIdx, S, battle) => {
      const me = (S.actA || [])[0];
      mediGift = me && me._vol && me._vol.flashfire ? 1 : 0;
      mediAb = me ? String(me.ability) : '';
      const p = battle.sides[0].active[0];
      sdGift = p && p.volatiles && p.volatiles.flashfire ? 1 : 0;
      sdAb = p ? String(p.ability) : '';
    } });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters(), sdGift, mediGift, sdAb, mediAb,
    restored: (globalThis.MEDFAILS || {}).megaKeepsAbsorbGiftRestored || 0 };
}
const shortDiv = d => (!d ? 'none' : (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)));

let bad = 0, ran = 0;
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   arm ' + c.arm);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused side ' + clean.which); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  if (brk.notStaged) { console.log('  NOT-STAGED under the knob — side ' + brk.which); bad++; continue; }
  if (brk.r.err) { console.log('  THREW under the knob — ' + brk.r.err); bad++; continue; }
  harness(false);
  ran++;

  console.log('    megas evolved / gifts ended   ' + (clean.delta.megaEvolved || 0) + ' / '
    + (clean.delta.absorbGiftVolatileEnded || 0) + '   (expected megas ' + c.megas + ')');
  console.log('    ability at the last board     medicham ' + clean.mediAb + '   showdown ' + clean.sdAb);
  console.log('    vol.flashfire at the last board  medicham ' + clean.mediGift
    + '   showdown ' + clean.sdGift + '   (this arm is for ' + c.gift_after + ')');
  console.log('    mega asks Showdown refused    ' + clean.sc.megaRefused);
  console.log('    board divergence clean        ' + shortDiv(clean.r.stateDiv));
  console.log('    board divergence knob         ' + shortDiv(brk.r.stateDiv));
  console.log('    MEDFAILS stamp   clean ' + clean.restored + '   knob ' + brk.restored);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue;
  }
  if (clean.sc.megaRefused || brk.sc.megaRefused) {
    console.log('    >> FIXTURE FAILED — Showdown refused a scripted mega ask.'); bad++; continue;
  }
  if (clean.r.turns < c.script.length || brk.r.turns < c.script.length) {
    console.log('    >> FIXTURE FAILED — the game ended before the script did ('
      + clean.r.turns + ' / ' + brk.r.turns + ' of ' + c.script.length + ' turns).'); bad++; continue;
  }
  if ((clean.delta.megaEvolved || 0) !== c.megas) {
    console.log('    >> FIXTURE FAILED — ' + (clean.delta.megaEvolved || 0) + ' mega(s) in medicham2, '
      + c.megas + ' asked for. The arm is not staging its own question.'); bad++; continue;
  }
  if (clean.sdGift !== c.gift_after) {
    console.log('    >> FIXTURE FAILED — the authority reads flashfire ' + clean.sdGift
      + ' and this arm was written for ' + c.gift_after + '. That is a claim about this file, not '
      + 'about medicham2.'); bad++; continue;
  }
  if (clean.r.stateDiv) {
    console.log('    >> RED — the boards part with the fix in: ' + shortDiv(clean.r.stateDiv)); bad++; continue;
  }
  if (c.kind === 'red') {
    if (!brk.r.stateDiv) {
      console.log('    >> THE KNOB DID NOT PART THE BOARDS. Either it is unwired or this arm was never '
        + 'measuring the mechanic — identical output across a varied knob is the finding.'); bad++; continue;
    }
    if (!/vol\.flashfire/.test(JSON.stringify(brk.r.stateDiv))) {
      console.log('    >> THE KNOB PARTED THE BOARDS ON THE WRONG LEAF.'); bad++; continue;
    }
    if (clean.restored !== 0 || brk.restored !== 1) {
      console.log('    >> THE KNOB DOES NOT STAMP — clean ' + clean.restored + ', knob ' + brk.restored
        + '. A knob that leaves no mark cannot be shown to have been applied.'); bad++; continue;
    }
  } else if (brk.r.stateDiv) {
    console.log('    >> THE KNOB PARTED A CONTROL. The restored road is wider than the defect: '
      + shortDiv(brk.r.stateDiv)); bad++; continue;
  }
  console.log('    OK');
}

console.log(NL + '================================================================');
if (!ran) { console.log('NOT RUN — no arm matched --only ' + ONLY + '. This is not a pass.'); process.exit(2); }
console.log(bad ? 'FAIL — ' + bad + ' of ' + ran + ' arm(s)' : 'PASS — ' + ran + ' arm(s)');
console.log('release ' + REL_ID);
process.exit(bad ? 1 : 0);
