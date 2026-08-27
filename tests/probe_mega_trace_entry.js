/* probe_mega_trace_entry.js — A MEGA THAT ARRIVES HOLDING TRACE MUST COPY *AND THEN RUN* WHAT IT
 * COPIED, IN THE SAME BREATH AS THE EVOLUTION.
 *
 *   SHOWDOWN_PATH=... node tests/probe_mega_trace_entry.js
 *   SHOWDOWN_PATH=... node tests/probe_mega_trace_entry.js --red     (the knob child, run by the parent)
 *
 * ================= THE DEFECT, CITED RATHER THAN PARAPHRASED ====================================
 *
 * `Pokemon#setAbility` (`sim/pokemon.ts:1946`) ends:
 *
 *     if (ability.id && this.battle.gen > 3 &&
 *         (!isTransform || oldAbility.id !== ability.id || this.battle.gen <= 4)) {
 *       this.battle.singleEvent('Start', ability, this.abilityState, this, source);
 *     }
 *
 * so EVERY ability write runs the NEW ability's `Start` handler. Trace (`data/abilities.ts:5110`;
 * `data/mods/champions/abilities.ts` is 100 lines and carries no `trace` row — grepped
 * case-insensitively over the WHOLE file, so Champions inherits mainline) is:
 *
 *     onStart(pokemon)  { ... this.singleEvent('Update', this.effect, this.effectState, pokemon); }
 *     onUpdate(pokemon) { ... const target = this.sample(possibleTargets);
 *                             pokemon.setAbility(target.getAbility(), target); }
 *
 * A mega evolution is a `formeChange` with `isPermanent`, which calls `setAbility(..., true)` — the
 * flag suppresses the `SetAbility` event and the `-ability` announcement, NOT the `Start` handler.
 * So a mega forme whose ability is Trace runs Trace's `onStart` -> `Update` -> `setAbility(copied)`
 * -> the COPIED ability's `Start`, all inside the evolution. Copy Intimidate off a foe and both foes
 * lose an Attack stage before anything else on that turn happens.
 *
 * THIS ENGINE DID THE COPY AND NOT THE RUN, AND THE TWO WERE IN DIFFERENT PLACES. `megaEvolveNow`
 * wrote the mega's ability and called `applyEntryEffects` + `applyEntryDrops` with the body holding
 * `trace` — which drops nothing — and the copy landed LATER, at a `traceSweep` boundary, where no
 * entry effect runs at all. The two ORDINARY Trace doors already do it in the right order
 * (`traceCopy(...)` then `applyEntryEffects(...)`, twice); the mega door simply had no `traceCopy`.
 *
 * FOUND IN A REAL GAME, not constructed: `pair-protect-bust`, seed
 * `gen9championsvgc2026regmbbo3-2657559916 vs ...-2657524920`, turn 10. The authority mega-evolves
 * a Meowstic into a Trace forme opposite an Incineroar and a Rampardos, copies Intimidate, and drops
 * BOTH — the Incineroar's White Herb then spends itself clearing its own drop, so the authority's
 * board reads `incineroar.item ""` with no drop and `rampardos.boosts.atk -1`. This engine applied
 * no drop to either and the herb never triggered. One board-material game of 961.
 *
 * ================= WHAT IT ASKS, AND WHY NOTHING IS TYPED =======================================
 *
 * Six arms over two engines, one board each, judged with NO typed expectation: the quantity is a
 * count of `|-unboost|<body>|atk|` lines and `|-enditem|...|whiteherb` lines read out of BOTH
 * streams, and the arm passes when the two engines agree. Showdown is the answer.
 *
 *   A  mega-Trace, both foes carry Intimidate, neither holds an item            RED
 *   B  the same, with a White Herb on one foe — the shape of the real game      RED
 *   C  a mega whose OWN ability is Intimidate (no Trace anywhere)               control
 *   D  mega-Trace where both foes carry a traceable ability with NO `onStart`   control
 *   E  an ORDINARY switch-in Trace copying Intimidate (the door that worked)    control
 *   F  mega-Trace, both foes carry Intimidate, and BOTH hold a White Herb       RED
 *
 * C, D and E are the OVER-FIRE controls: they must agree clean AND must not move under the knob. E
 * matters most — it is the door that was already right, and a fix that changed it would be doing the
 * copy twice.
 *
 * ================= THE KNOB, AND WHY IT IS A KNOB AND NOT A DELETION ============================
 *
 * `MEDI_MEGA_TRACE_LATE=1` reverts exactly one thing: the `traceCopy` call inside `megaEvolveNow`.
 * The sweep still lands the copy afterwards, so the knob reproduces the ENGINE AS IT WAS rather than
 * removing Trace. Under it, A, B and F must PART from the authority and C, D, E must NOT. The knob's
 * load is asserted through `MEDFAILS.megaTraceLate` — present on the child, ABSENT on the parent —
 * because a knob that reaches no module reads as a row of held controls, which has happened here.
 *
 * ================= THE FIXTURE IS DERIVED, AND A CELL THAT QUALIFIES TWICE IS REFUSED ===========
 *
 * Every species, item and ability below comes out of `Dex.forFormat('gen9championsvgc2026regmb')`
 * filtered `exists && !isNonstandard && tier !== 'Illegal'`, and every one is printed. Two counts are
 * DERIVED per arm and the file refuses the arm rather than reporting it:
 *
 *   SOURCES   how many distinct things on the board could lower a p2 Attack this turn. Every click
 *             is Protect, so the only candidates are entry-shaped drops from p1 bodies. An arm that
 *             expects the drop is REFUSED at anything but 1 — two sources and a green result would
 *             not say which one fired.
 *   REASONS   per foe, how many distinct things could stop the drop STICKING: an ability with
 *             `onTryBoost` / `onChangeBoost` / `onAfterEachBoost`, a stage already at the floor, a
 *             substitute, or an item tagged `restoresStats`. Refused above 1. Arm B and arm F put
 *             the herb there ON PURPOSE, so their foes read exactly 1 and the herb is the reason.
 *
 * ================= WHAT IT STRUCTURALLY CANNOT SEE ==============================================
 *
 * WHICH foe Trace picks — both foes carry the same ability in every arm that copies one, deliberately,
 * so the target die cannot decide the answer. `tests/probe_trace_target.js` owns that question and
 * this file would only re-measure it badly.
 *
 * The OTHER copiers. `receiverSweep` has the identical gap and says so in its own header
 * (`MEDFAILS.inheritedAbilityStartNotFired`); Skill Swap, Entrainment and Role Play write abilities
 * through `abRewrite` too. Nothing here is changed for them and nothing here measures them — this is
 * ONE door, not the class.
 *
 * The copied ability's PASSIVE half, which was never missing: every immunity, multiplier and residual
 * of a traced ability was live before this fix and is live after. The gap was the `Start` handler
 * alone.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
const NL = String.fromCharCode(10);
const RED_CHILD = process.argv.includes('--red');
const KNOB_ON = process.env.MEDI_MEGA_TRACE_LATE === '1';

const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const DEX = Dex.forFormat('gen9championsvgc2026regmb');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legalS = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const legalI = x => x && x.exists && !x.isNonstandard;
const SPECIES = DEX.species.all().filter(legalS).sort((a, b) => a.name.localeCompare(b.name));
const ITEMS = DEX.items.all().filter(legalI).sort((a, b) => a.name.localeCompare(b.name));
const abOf = s => Object.values(s.abilities || {});
const AB = id => DEX.abilities.get(id);

/* ---- WHAT MAKES AN ABILITY AN ENTRY-SHAPED ATTACK DROP, READ OFF ITS OWN HANDLER --------------
 * Never a name list: `onStart` that calls `boost` with a negative `atk` is the shape. The handler is
 * read as SOURCE because the dist build keeps it as a function — a paraphrase of Intimidate is a
 * value typed from memory. */
const dropsAtkOnEntry = abId => {
  const a = AB(abId);
  if (!a || !a.exists || typeof a.onStart !== 'function') return false;
  const src = Function.prototype.toString.call(a.onStart);
  return /boost\s*\(\s*\{\s*atk\s*:\s*-\s*1/.test(src);
};
/* an ability that would interfere with a stat drop landing, again by handler and not by name */
const guardsBoosts = abId => {
  const a = AB(abId);
  if (!a || !a.exists) return false;
  return typeof a.onTryBoost === 'function' || typeof a.onChangeBoost === 'function'
      || typeof a.onAfterEachBoost === 'function';
};
const traceable = abId => {
  const a = AB(abId);
  return !!(a && a.exists && !(a.flags && a.flags['notrace']) && abId !== 'noability');
};
/* an ability with no entry handler at all — a traceable body that copies to NOTHING VISIBLE */
const inertOnEntry = abId => {
  const a = AB(abId);
  return !!(a && a.exists && typeof a.onStart !== 'function' && typeof a.onSwitchIn !== 'function'
            && typeof a.onAnySwitchIn !== 'function' && typeof a.onUpdate !== 'function');
};
/* THE HERB IS THE ARTIFACT'S, not a name. `restoresStats` is the tag; it is printed and asserted to
 * match exactly one item, per docs/LESSONS.md §4. */
const TAGS = require(D('engine', 'tags.js'));
const HERBS = ITEMS.filter(i => {
  const p = TAGS.param && TAGS.param('item', norm(i.name), 'restoresStats');
  return !!(p && p.restores);
});

/* ---- THE THREE CARRIERS ------------------------------------------------------------------------ */
let STONE = null, BASE = null, MEGA = null;              // a mega forme whose ability is Trace
let ISTONE = null, IBASE = null, IMEGA = null;           // a mega forme whose OWN ability drops atk
for (const it of ITEMS) {
  if (!it.megaStone || typeof it.megaStone !== 'object') continue;
  for (const baseName of Object.keys(it.megaStone)) {
    const m = DEX.species.get(it.megaStone[baseName]);
    const b = DEX.species.get(baseName);
    if (!m || !m.exists || m.isNonstandard || !b || !b.exists || b.isNonstandard) continue;
    const abs = abOf(m).map(norm);
    if (!STONE && abs.some(a => a === 'trace')) { STONE = it; BASE = b; MEGA = m; }
    if (!ISTONE && abs.some(dropsAtkOnEntry)) { ISTONE = it; IBASE = b; IMEGA = m; }
  }
}
const TRACER = SPECIES.find(s => !/-Mega/.test(s.name) && abOf(s).map(norm).includes('trace'));
const DROPPERS = SPECIES.filter(s => !/-Mega/.test(s.name)
  && abOf(s).map(norm).some(dropsAtkOnEntry)
  && !abOf(s).map(norm).some(guardsBoosts));
const INERTS = SPECIES.filter(s => !/-Mega/.test(s.name)
  && abOf(s).map(norm).some(a => traceable(a) && inertOnEntry(a))
  && !abOf(s).map(norm).some(guardsBoosts));
const FILLERS = SPECIES.filter(s => !/-Mega/.test(s.name)
  && abOf(s).map(norm).every(a => inertOnEntry(a) && !guardsBoosts(a)));

const miss = [];
if (!STONE) miss.push('no legal mega forme carrying Trace');
if (!ISTONE) miss.push('no legal mega forme whose own ability drops Attack on entry');
if (!TRACER) miss.push('no legal non-mega Trace carrier');
if (DROPPERS.length < 2) miss.push('fewer than two legal entry-drop carriers');
if (!INERTS.length) miss.push('no legal traceable-but-inert carrier');
if (FILLERS.length < 4) miss.push('fewer than four legal inert fillers');
if (HERBS.length !== 1) miss.push('the `restoresStats` tag matches ' + HERBS.length + ' items, not 1');
if (miss.length) { console.log('NOT-STAGED — ' + miss.join('; ')); process.exit(1); }

const HERB = HERBS[0];
const DROP_A = DROPPERS[0], DROP_B = DROPPERS[1];
const dropAbOf = s => abOf(s).find(a => dropsAtkOnEntry(norm(a)));
const INERT_A = INERTS[0], INERT_B = INERTS[1] || INERTS[0];
const inertAbOf = s => abOf(s).find(a => traceable(norm(a)) && inertOnEntry(norm(a)));

console.log('DERIVED FROM THE FORMAT — nothing below is typed:');
console.log('  Trace mega        ' + BASE.name + ' + ' + STONE.name + ' -> ' + MEGA.name
  + '   ' + JSON.stringify(MEGA.abilities));
console.log('  entry-drop mega   ' + IBASE.name + ' + ' + ISTONE.name + ' -> ' + IMEGA.name
  + '   ' + JSON.stringify(IMEGA.abilities));
console.log('  non-mega Trace    ' + TRACER.name);
console.log('  entry droppers    ' + DROP_A.name + ' / ' + dropAbOf(DROP_A) + '   and   '
  + DROP_B.name + ' / ' + dropAbOf(DROP_B)
  + '   (shape: onStart calls boost({atk:-1}) — read off the handler, not named)');
console.log('  traceable+inert   ' + INERT_A.name + ' / ' + inertAbOf(INERT_A) + '   and   '
  + INERT_B.name + ' / ' + inertAbOf(INERT_B));
console.log('  restoresStats     ' + HERB.name + '   (the tag matches exactly ' + HERBS.length + ' item)');

/* ---- THE DRIVER --------------------------------------------------------------------------------- */
function argFlag(n) { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; }
if (!argFlag('--games')) process.argv.push('--games', '4');
if (!argFlag('--arm')) process.argv.push('--arm', 'middle');
if (!argFlag('--team-store')) process.argv.push('--team-store', 'data/team-pool-frozen');
const G = require(D('engine', 'game_differential.js'));
const M = G.REL.require('engine/medicham2-browser.js');
const ARM = G.ARM_BY_ID.get('middle');
if (!ARM) { console.log('NOT-STAGED — the middle arm is gone from game_differential.js'); process.exit(1); }

const mon = (sp, ab, it) => ({ species: sp, item: it || '', ability: ab || '', moves: ['Protect'] });
function pad(actives, bench) {
  const used = new Set(actives.concat(bench || []).map(m => norm(m.species)));
  const out = actives.concat(bench || []);
  for (const s of FILLERS) {
    if (out.length >= 4) break;
    if (used.has(norm(s.name))) continue;
    used.add(norm(s.name)); out.push(mon(s.name, ''));
  }
  return out;
}
const side = (actives, bench) => G.buildPair(pad(actives, bench));

/* ---- READING THE ANSWER OUT OF EITHER STREAM, FOLDED TO ONE SHAPE ------------------------------ */
const lines = x => (x || []).map(l => Array.isArray(l) ? '|' + l.join('|') : String(l));
function readout(str, sideTag) {
  let unboost = 0, herb = 0, copied = 0;
  for (const l of lines(str)) {
    const p = l.split('|');
    if (p[1] === '-unboost' && norm(p[3]) === 'atk' && String(p[2] || '').startsWith(sideTag)) unboost++;
    if (p[1] === '-enditem' && norm(p[3]) === norm(HERB.name)) herb++;
    if (p[1] === '-ability' && /ability:\s*trace/i.test(l)) copied++;
  }
  return { unboost, herb, copied };
}

/* ---- THE ARMS ---------------------------------------------------------------------------------- */
const megaClick = { p1: [{ m: 'protect', mega: true }, { m: 'protect' }],
                    p2: [{ m: 'protect' }, { m: 'protect' }] };
const plainClick = { p1: [{ m: 'protect' }, { m: 'protect' }],
                     p2: [{ m: 'protect' }, { m: 'protect' }] };

const ARMS = [
  { id: 'A mega-Trace copies the drop, no items', red: true,
    p1: [mon(BASE.name, '', STONE.name), mon(FILLERS[0].name, '')],
    p2: [mon(DROP_A.name, dropAbOf(DROP_A)), mon(DROP_B.name, dropAbOf(DROP_B))],
    script: [megaClick], expectDrop: true, herbs: 0 },
  { id: 'B the real game — one foe holds the herb', red: true,
    p1: [mon(BASE.name, '', STONE.name), mon(FILLERS[0].name, '')],
    p2: [mon(DROP_A.name, dropAbOf(DROP_A)), mon(DROP_B.name, dropAbOf(DROP_B), HERB.name)],
    script: [megaClick], expectDrop: true, herbs: 1 },
  { id: 'C control — the mega\'s OWN ability drops, no Trace', red: false,
    p1: [mon(IBASE.name, '', ISTONE.name), mon(FILLERS[0].name, '')],
    p2: [mon(DROP_A.name, dropAbOf(DROP_A)), mon(DROP_B.name, dropAbOf(DROP_B))],
    script: [megaClick], expectDrop: true, herbs: 0 },
  { id: 'D control — mega-Trace onto an ability with no onStart', red: false,
    p1: [mon(BASE.name, '', STONE.name), mon(FILLERS[0].name, '')],
    p2: [mon(INERT_A.name, inertAbOf(INERT_A)), mon(INERT_B.name, inertAbOf(INERT_B))],
    script: [megaClick], expectDrop: false, herbs: 0 },
  { id: 'E control — the ORDINARY switch-in Trace door', red: false,
    p1: [mon(FILLERS[0].name, ''), mon(FILLERS[1].name, '')],
    p1bench: [mon(TRACER.name, 'Trace')],
    p2: [mon(DROP_A.name, dropAbOf(DROP_A)), mon(DROP_B.name, dropAbOf(DROP_B))],
    script: [{ p1: [{ sw: TRACER.name }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] },
             plainClick],
    expectDrop: true, herbs: 0 },
  { id: 'F mega-Trace, BOTH foes hold the herb', red: true,
    p1: [mon(BASE.name, '', STONE.name), mon(FILLERS[0].name, '')],
    p2: [mon(DROP_A.name, dropAbOf(DROP_A), HERB.name), mon(DROP_B.name, dropAbOf(DROP_B), HERB.name)],
    script: [megaClick], expectDrop: true, herbs: 2 },
];

/* ---- THE FIXTURE AUDIT — DERIVED, PRINTED, AND ABLE TO REFUSE ---------------------------------- */
console.log('');
console.log('THE FIXTURE AUDIT — SOURCES is how many things on this board could lower a p2 Attack on');
console.log('the staged turn; REASONS is how many things could stop the drop STICKING on a given foe.');
console.log('An arm that expects a drop is REFUSED at anything but SOURCES 1, and ANY foe reading more');
console.log('than one REASON is refused outright — a cell that qualifies twice proves nothing.');
let refused = 0;
for (const a of ARMS) {
  /* SOURCES: every p1 body that ARRIVES on the staged turn (the mega, or the switch-in) and whose
   * ability-at-that-moment drops Attack. A traced Trace counts as its COPY, which is the point. */
  let sources = 0; const why = [];
  const megaing = a.script[0].p1.some(c => c && c.mega);
  if (megaing) {
    const megaAb = abOf(DEX.species.get(a.p1[0].item === STONE.name ? MEGA.name : IMEGA.name)).map(norm);
    if (megaAb.some(dropsAtkOnEntry)) { sources++; why.push('the mega forme\'s own ability'); }
    if (megaAb.includes('trace') && a.p2.some(f => dropsAtkOnEntry(norm(f.ability)))) {
      sources++; why.push('the ability Trace copies');
    }
  }
  const swIn = a.script[0].p1.find(c => c && c.sw);
  if (swIn) {
    const s = DEX.species.get(swIn.sw), abs = abOf(s).map(norm);
    if (abs.some(dropsAtkOnEntry)) { sources++; why.push('the entrant\'s own ability'); }
    if (abs.includes('trace') && a.p2.some(f => dropsAtkOnEntry(norm(f.ability)))) {
      sources++; why.push('the ability the entrant Traces');
    }
  }
  /* every click in every arm is Protect or a switch — asserted, not assumed */
  const anyMove = a.script.some(t => [].concat(t.p1, t.p2).some(c => c && c.m && norm(c.m) !== 'protect'));
  if (anyMove) { sources++; why.push('a clicked move'); }
  const reasons = a.p2.map(f => {
    const r = [];
    if (guardsBoosts(norm(f.ability))) r.push('ability guards boosts');
    if (f.item && TAGS.param('item', norm(f.item), 'restoresStats')) r.push('holds ' + f.item);
    /* no arm stages a substitute or a pre-existing stage, and that is a fact about the SCRIPT: every
     * click is Protect, so neither can exist. Stated so the count is complete rather than partial. */
    return { sp: f.species, n: r.length, r };
  });
  const bad = [];
  if (a.expectDrop && sources !== 1) bad.push('SOURCES ' + sources + ' (must be 1)');
  if (!a.expectDrop && sources !== 0) bad.push('SOURCES ' + sources + ' (must be 0)');
  for (const x of reasons) if (x.n > 1) bad.push(x.sp + ' qualifies for ' + x.n + ' reasons');
  a._audit = { sources, why, reasons, bad };
  console.log('  ' + (bad.length ? 'REFUSED ' : 'ok      ') + a.id);
  console.log('          SOURCES ' + sources + (why.length ? '  [' + why.join('; ') + ']' : '  [none]')
    + '    REASONS ' + reasons.map(x => x.sp + '=' + x.n + (x.r.length ? '(' + x.r.join(',') + ')' : '')).join('  '));
  if (bad.length) { console.log('          ' + bad.join('; ')); refused++; }
}
if (refused) {
  console.log('');
  console.log('  ' + refused + ' ARM(S) REFUSED BY THE AUDIT. Nothing below is readable. This is not a pass.');
  process.exit(1);
}

/* ---- PLAY ------------------------------------------------------------------------------------- */
console.log('');
console.log('THE ARMS — every number below is READ OUT OF A STREAM. Showdown is the expectation and');
console.log('this file types no answer. `sd` is the authority, `me` is medicham2.');
const rows = [];
let hardFail = 0;
for (const a of ARMS) {
  const pa = side(a.p1, a.p1bench), pb = side(a.p2, a.p2bench);
  if (!pa || !pb) { console.log('  NOT-STAGED ' + a.id + ' — buildPair refused a side.'); hardFail++; continue; }
  const before = { ...M.MEDSEEN };
  G.resetScriptCounters();
  let r;
  try { r = G.playGame(pa, pb, 'directed', 'probe_mega_trace_entry/' + a.id, { script: a.script, arm: ARM }); }
  catch (e) { console.log('  THREW ' + a.id + ' — ' + String((e && e.message) || e).split(NL)[0]); hardFail++; continue; }
  if (r.err || r.turns < a.script.length) {
    console.log('  SHORT ' + a.id + ' — err ' + r.err + ', turns ' + r.turns + ' of ' + a.script.length);
    hardFail++; continue;
  }
  const sc = G.scriptCounters();
  if (sc.megaRefused || sc.moveNotOnRequest) {
    console.log('  SCRIPT DID NOT RUN ' + a.id + ' — megaRefused ' + sc.megaRefused
      + ', moveNotOnRequest ' + sc.moveNotOnRequest + ' ' + sc.firstMissing);
    hardFail++; continue;
  }
  const sd = readout(G.sdStream(G.lastSdLog()), 'p2');
  const me = readout(r.mediTrace, 'p2');
  const dTrace = (M.MEDSEEN.megaTraceCopied || 0) - (before.megaTraceCopied || 0);
  const agree = sd.unboost === me.unboost && sd.herb === me.herb && sd.copied === me.copied;
  rows.push({ id: a.id, red: a.red, sd, me, agree, megaTraceCopied: dTrace });
  console.log('  ' + (agree ? 'AGREE ' : 'PART  ') + a.id);
  console.log('          p2 atk unboosts  sd ' + sd.unboost + ' / me ' + me.unboost
    + '     herb spends  sd ' + sd.herb + ' / me ' + me.herb
    + '     trace copies  sd ' + sd.copied + ' / me ' + me.copied
    + '     MEDSEEN.megaTraceCopied +' + dTrace);
}

/* ---- THE VERDICT ------------------------------------------------------------------------------- */
const knobLoaded = Object.prototype.hasOwnProperty.call(M.MEDFAILS, 'megaTraceLate');
console.log('');
console.log('THE KNOB\'S OWN RECEIPT — `MEDFAILS.megaTraceLate` must be PRESENT on the knob child and');
console.log('ABSENT on the clean parent. A knob that reached no module reads as a row of held controls.');
console.log('  MEDI_MEGA_TRACE_LATE=' + (KNOB_ON ? '1' : '(unset)') + '   MEDFAILS.megaTraceLate '
  + (knobLoaded ? 'PRESENT (' + M.MEDFAILS.megaTraceLate + ')' : 'absent'));

let bad = hardFail;
if (KNOB_ON) {
  if (!knobLoaded) { console.log('  THE KNOB DID NOT REACH THE ENGINE.'); bad++; }
  /* THE CHILD ASSERTS THE DEFECT IS PRESENT. Under the knob the reds MUST part and the controls MUST
   * NOT — that is what makes this a control set rather than three more chances to pass. */
  for (const r of rows) {
    if (r.red && r.agree) { console.log('  UNDER THE KNOB, RED ARM STILL AGREES: ' + r.id); bad++; }
    if (!r.red && !r.agree) { console.log('  UNDER THE KNOB, A CONTROL MOVED: ' + r.id); bad++; }
  }
} else {
  if (knobLoaded) { console.log('  THE KNOB IS LOADED ON A CLEAN RUN.'); bad++; }
  for (const r of rows) if (!r.agree) { console.log('  PARTS FROM THE AUTHORITY: ' + r.id); bad++; }
  /* the fix's own receipt: the mega door must have done the copy on every arm that megas into Trace */
  const megaTraceArms = rows.filter(r => /mega-Trace/.test(r.id));
  const fired = megaTraceArms.filter(r => r.megaTraceCopied > 0).length;
  console.log('  the mega door\'s copy fired on ' + fired + ' of ' + megaTraceArms.length
    + ' mega-Trace arms (a zero means the wire is dead, whatever the streams say)');
  if (fired !== megaTraceArms.length) { console.log('  THE MEGA DOOR DID NOT COPY.'); bad++; }
}

if (!RED_CHILD && !KNOB_ON) {
  /* THE RED DEMONSTRATION, IN A CHILD, because the knob is read where the engine loads. The PARENT
   * judges the child's EXIT CODE — under the knob the child asserts the defect is PRESENT, so a
   * working knob exits 0 and a knob that changed nothing exits non-zero. */
  const { spawnSync } = require('child_process');
  console.log('');
  console.log('THE RED DEMONSTRATION — the same six arms under MEDI_MEGA_TRACE_LATE=1, in a child:');
  const ch = spawnSync(process.execPath, [__filename, '--red'],
    { env: { ...process.env, MEDI_MEGA_TRACE_LATE: '1' }, encoding: 'utf8' });
  const out = String(ch.stdout || '') + String(ch.stderr || '');
  for (const l of out.split(NL)) if (/^  (AGREE|PART |UNDER|THE KNOB|MEDI_)/.test(l)) console.log('  | ' + l.trim());
  if (ch.status !== 0) { console.log('  THE RED DEMONSTRATION FAILED (child exit ' + ch.status + ').'); bad++; }
  else console.log('  the child went red exactly where it had to and held every control.');
}

console.log('');
console.log(bad ? 'FAIL — ' + bad + ' problem(s).' : 'PASS — every arm agrees with the authority and the knob breaks the right ones.');
process.exit(bad ? 1 : 0);
