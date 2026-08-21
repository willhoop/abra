/* probe_trace_choice.js — WHICH ABILITY DOES TRACE COPY? STAGED, NOT INFERRED.
 *
 *   SHOWDOWN_PATH=... node tests/probe_trace_choice.js
 *   SHOWDOWN_PATH=... node tests/probe_trace_choice.js --arm top-tie-first
 *   SHOWDOWN_PATH=... node tests/probe_trace_choice.js --arm bottom-tie-first
 *
 * ================= WHY =============================================================================
 *
 * The whole-corpus end-state run of 2026-08-19 found NINE games that narrate IDENTICALLY in both
 * engines and still end on a different board because the two Traces copied a DIFFERENT ability off a
 * living Gardevoir or Alakazam-Mega. `data/verification/endstate-by-cause.json` names them; the
 * protocol comparison could never see it, because the semantic normaliser's `ability-announcement`
 * rule collapses exactly that line.
 *
 * A pair of ability names out of a real game is a LEAD and not a mechanism. This file stages the
 * question on a board where the answer is forced, and NOBODY TYPES THE ANSWER — Showdown plays the
 * same script and its own `|-ability|` line is the expectation, exactly as tests/staged_board.js
 * argues.
 *
 * ================= THE AUTHORITY'S RULE, READ RATHER THAN RECALLED ================================
 *
 * `data/abilities.ts:5110` (`trace`). `data/mods/champions/abilities.ts` is 100 lines and contains no
 * `trace` entry at all, so Champions inherits mainline here — checked, not assumed.
 *
 *   onStart(pokemon)                                       seek = true
 *     if any adjacentFoe has ability 'noability'           seek = false      (Hackmons only)
 *     if pokemon.hasItem('Ability Shield')                 seek = false, and `-block` is announced
 *     if (seek) singleEvent('Update', ...)                 try immediately
 *   onUpdate(pokemon)
 *     if (!seek) return
 *     possibleTargets = pokemon.adjacentFoes()
 *        .filter(t => !t.getAbility().flags['notrace'] && t.ability !== 'noability')
 *     if (!possibleTargets.length) return                  <-- NO copy, and seek STAYS true
 *     const target = this.sample(possibleTargets)          <-- A UNIFORM DIE over the eligible foes
 *     pokemon.setAbility(ability, target)
 *
 * Three separate claims fall out of that, and this file has one arm for each:
 *
 *   (1) MORE THAN ONE CANDIDATE -> `this.sample`, i.e. `prng.random(possibleTargets.length)`
 *       (sim/prng.ts). It is a DIE, not slot order. Under a pinned corner arm the authority's die is
 *       a CONSTANT — `random(2)` is 1 on the top corner and 0 on the bottom — so running this file
 *       under both corners turns the die into a KNOB, and an engine that ignores it gives the same
 *       answer twice. `docs/LESSONS.md`: identical results across a varied knob mean the knob is
 *       UNWIRED.
 *   (2) AN UNTRACEABLE ABILITY is refused by the TARGET ability's own `notrace` flag, never by a
 *       list. Arm 3 puts the untraceable body in SLOT 0 so an engine walking slot order has to skip
 *       it. 34 legal-format abilities carry the flag; 10 of them have a legal carrier in Reg M-B
 *       (derived below and printed, so this sentence cannot go stale).
 *   (3) WHEN THERE IS NOTHING TO COPY the ability does NOT give up — `seek` is never cleared, so the
 *       next `Update` tries again. Arm 4 leads into two untraceable foes and then switches a
 *       traceable one in on turn 2.
 *
 * ================= WHAT THIS FILE IS NOT =========================================================
 *
 * It is not a census probe and it writes nothing. It is a staged answer to one question, kept beside
 * `probe_turn_order.js` for the same reason that one exists: a class table over real games can say
 * WHICH games disagree and never WHY.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}

/* THE UNTRACEABLE SET IS DERIVED ON EVERY RUN, never listed. It is printed before a fixture uses it,
 * because a derived membership that is not printed is a membership nobody has checked (CLAUDE.md). */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CARRIED = (() => {
  const m = new Map();
  for (const s of DEX.species.all()) {
    if (!s || !s.exists || s.isNonstandard || s.tier === 'Illegal') continue;
    for (const a of Object.values(s.abilities || {})) {
      const k = norm(a); if (!m.has(k)) m.set(k, []); m.get(k).push(s.name);
    }
  }
  return m;
})();
const NOTRACE = DEX.abilities.all()
  .filter(a => a.exists && !a.isNonstandard && a.flags && a.flags['notrace']);
const NOTRACE_LIVE = NOTRACE.filter(a => CARRIED.has(a.id));
console.log('UNTRACEABLE ABILITIES (Showdown\'s own `notrace` flag), derived this run:');
console.log('  ' + NOTRACE.length + ' in the format table, ' + NOTRACE_LIVE.length
  + ' with a legal Reg M-B carrier:');
console.log('  ' + NOTRACE_LIVE.map(a => a.id + ' (' + CARRIED.get(a.id)[0] + ')').join(', '));

/* AND THE SAME MEMBERSHIP OUT OF OUR OWN ARTIFACT, side by side, because `traceCopy` reads
 * `data/tags.json` and an artifact that is missing a row treats that ability as COPYABLE. */
const TAGS = require(D('data', 'tags.json'));
const artMissing = NOTRACE_LIVE.filter(a => {
  const p = TAGS.abilities[a.id] && TAGS.abilities[a.id].params
            && TAGS.abilities[a.id].params.refusesCopy;
  return !p || p.notrace !== true;
});
console.log('  data/tags.json carries refusesCopy.notrace for '
  + (NOTRACE_LIVE.length - artMissing.length) + '/' + NOTRACE_LIVE.length
  + (artMissing.length ? '   MISSING: ' + artMissing.map(a => a.id).join(', ') : ''));

const G = require(D('engine', 'game_differential.js'));
const mon = (species, ability, moves) => ({ species, item: '', ability: ability || '', moves });
const BENCH = (...names) => names.map(n => mon(n, '', ['Protect']));

/* ---- THE FIXTURES -------------------------------------------------------------------------------
 * Gardevoir is the carrier because it is the one this defect was OBSERVED on and because it is a
 * non-mega, so nothing about a forme change is mixed into the answer. Its two foes carry abilities
 * that are (a) legal for that species, (b) traceable, and (c) different from each other and from
 * anything else on the board, so the copied name identifies WHICH BODY was chosen and not merely
 * that something was copied. */
const GARDE = [mon('gardevoir', 'Trace', ['Protect']), mon('milotic', 'Marvel Scale', ['Protect'])]
  .concat(BENCH('clefable', 'snorlax'));
const PROTECT2 = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };

const ARMS = [
  { id: 'two-eligible-A',
    what: 'TWO eligible foes — Rough Skin in slot 0, Pressure in slot 1',
    A: GARDE,
    B: [mon('garchomp', 'Rough Skin', ['Protect']), mon('corviknight', 'Pressure', ['Protect'])]
      .concat(BENCH('toxapex', 'whimsicott')),
    script: [PROTECT2] },

  { id: 'two-eligible-B',
    what: 'THE SAME TWO FOES, SWAPPED — Pressure in slot 0, Rough Skin in slot 1. Paired with the '
        + 'arm above this separates "the authority picks a SLOT" from "the authority picks an '
        + 'ABILITY": a slot rule moves with the swap, an ability rule does not.',
    A: GARDE,
    B: [mon('corviknight', 'Pressure', ['Protect']), mon('garchomp', 'Rough Skin', ['Protect'])]
      .concat(BENCH('toxapex', 'whimsicott')),
    script: [PROTECT2] },

  { id: 'refusal-in-slot-0',
    what: 'ONE eligible foe, and the UNTRACEABLE one is in slot 0 — Aegislash (Stance Change, '
        + 'notrace) leads beside Garchomp (Rough Skin). There is no die here: both engines must copy '
        + 'Rough Skin. An engine that walks slot order without the refusal copies Stance Change.',
    A: GARDE,
    B: [mon('aegislash', 'Stance Change', ['Protect']), mon('garchomp', 'Rough Skin', ['Protect'])]
      .concat(BENCH('toxapex', 'whimsicott')),
    script: [PROTECT2] },

  { id: 're-attempt',
    what: 'NOTHING eligible on entry — Aegislash (Stance Change) and Castform (Forecast) are both '
        + 'untraceable — and then Garchomp switches in on turn 2. `seek` is never cleared, so the '
        + 'authority should copy Rough Skin on turn 2. An engine that only tries at switch-in never '
        + 'copies anything at all.',
    A: GARDE,
    B: [mon('aegislash', 'Stance Change', ['Protect']), mon('castform', 'Forecast', ['Protect']),
        mon('garchomp', 'Rough Skin', ['Protect']), mon('toxapex', 'Regenerator', ['Protect'])],
    script: [PROTECT2,
             { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { sw: 'garchomp' }] },
             PROTECT2] },
];

/* ---- READING THE ANSWER OUT OF BOTH STREAMS ---------------------------------------------------
 * Showdown: |-ability|p1a: Gardevoir|Rough Skin|[from] ability: Trace|[of] p2a: Garchomp
 * medicham: |-ability|p1a: Gardevoir|roughskin|[from] ability: trace           (four fields — the
 *           `[of]` is declared-absent at medicham2-browser.js's traceCopy)
 * Both are folded to an id so a display-name table cannot decide the verdict. */
const traceOf = lines => lines.map(String)
  .filter(l => /^\|?-ability\|/.test(l.replace(/^\|/, '|')) || /^\|-ability\|/.test(l))
  .filter(l => /ability:\s*trace/i.test(l))
  .map(l => norm(l.split('|').filter(Boolean)[2]));
const sdTraceOf = lines => lines.map(String)
  .filter(l => l.startsWith('|-ability|') && /\[from\] ability: Trace/i.test(l))
  .map(l => norm(l.split('|')[3]));

/* ---- THE DIE IS THE KNOB, AND IT IS TURNED HERE ------------------------------------------------
 *
 * `--arm` on the command line moves `ARM_IDS`, which does NOT move `PRIMARY_ARM` — `playGame` reads
 * `opts.arm || PRIMARY_ARM` and `PRIMARY_ARM` is `ARMS[0]` unconditionally. So the pin is passed per
 * game, deliberately, and every fixture is played under all three. That is the point of the file: on
 * a corner arm Showdown's `random(2)` inside `PRNG#sample` is a CONSTANT — `m - 1` on the top corner
 * and `0` on the bottom (game_differential.js's `pinRandom`) — so the authority is forced onto the
 * second eligible foe under one pin and the first under the other. An engine that answers the same
 * on both has not read the die. */
const PINS = ['bottom-tie-first', 'top-tie-first', 'middle'];
const NL = String.fromCharCode(10);
let bad = 0, ran = 0;
const seen = new Map();
for (const a of ARMS) {
  console.log(NL + '--- ' + a.id);
  console.log('    ' + a.what);
  for (const pinId of PINS) {
    const arm = G.ARM_BY_ID.get(pinId);
    const pa = G.buildPair(a.A), pb = G.buildPair(a.B);
    if (!pa || !pb) { console.log('    NOT-STAGED  ' + pinId); bad++; continue; }
    const r = G.playGame(pa, pb, 'directed', 'probe_trace_choice :: ' + a.id + ' :: ' + pinId,
                         { script: a.script, arm });
    if (r.err) { console.log('    THREW       ' + pinId + '   ' + r.err); bad++; continue; }
    if (r.turns < a.script.length) {
      console.log('    SHORT       ' + pinId + '   ' + r.turns + '/' + a.script.length); bad++; continue;
    }
    ran++;
    const sd = sdTraceOf(G.sdStream(G.lastSdLog()));
    const me = traceOf(r.mediTrace);
    const agree = sd.length === me.length && sd.every((x, i) => x === me[i]);
    if (!agree) bad++;
    const key = a.id + '|' + pinId;
    seen.set(key, { sd: sd.join(','), me: me.join(',') });
    console.log('    ' + (agree ? 'AGREE  ' : 'DIFFERS') + '  ' + pinId.padEnd(17)
      + 'showdown [' + sd.join(', ') + ']   medicham [' + me.join(', ') + ']');
  }
}

/* ---- THE KNOB CHECK, ON BOTH SIDES ------------------------------------------------------------
 * A fixture with two eligible foes is only a test of the die if the AUTHORITY's answer moved when
 * the die moved. If it did not, the corner pin never reached `PRNG#sample` and this file proves
 * nothing about either engine — which is a fixture verdict, not a finding. */
for (const id of ['two-eligible-A', 'two-eligible-B']) {
  const t = seen.get(id + '|top-tie-first'), b = seen.get(id + '|bottom-tie-first');
  if (!t || !b) continue;
  const sdMoved = t.sd !== b.sd, meMoved = t.me !== b.me;
  console.log(NL + 'KNOB  ' + id + '   showdown ' + (sdMoved ? 'MOVED' : 'did NOT move')
    + ' between the corners (' + b.sd + ' -> ' + t.sd + ');   medicham '
    + (meMoved ? 'MOVED' : 'did NOT move') + ' (' + b.me + ' -> ' + t.me + ')');
  if (!sdMoved) {
    console.log('      THE AUTHORITY DID NOT MOVE, so this arm never reached the die and says nothing'
      + ' about medicham. NOT a pass.');
    bad++;
  } else if (!meMoved) {
    console.log('      medicham gave the SAME answer under both corners: the die is UNWIRED here, it'
      + ' takes a fixed index into the eligible list.');
  }
}

console.log(NL + ran + ' staged games, ' + bad + ' not matching (or not staged)');
process.exit(bad ? 1 : 0);
