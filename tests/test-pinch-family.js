/* tests/test-pinch-family.js — ROADMAP #112, THE PINCH FAMILY. THE CONDITION IS THE MECHANIC.
 *
 *   SHOWDOWN_PATH=... node tests/test-pinch-family.js
 *
 * ================= WHAT WAS WRONG ================================================================
 *
 * Blaze (5,903 uses), Torrent (1,924), Overgrow (651) and Swarm (46) — 8,524 uses between them — had
 * never fired once. Not because the consumer was missing: it was there, and it REFUSED them, on
 * purpose. `data/tags.json` carried their condition as PROSE —
 *
 *     blaze  {"mult":1.5,"onType":"Fire","inWeather":null,"onlyWhen":"only below 1/3 HP"}
 *
 * — and `medicham2-browser.js` gated on `!_db.onlyWhen`, which is the correct thing to do with a
 * condition you cannot evaluate (ROADMAP #92: a guessed threshold is the boolean-in-a-fraction's-
 * clothing defect, and failing closed beats inventing one). The refusal was right. The defect was
 * that nobody ever made `onlyWhen` READABLE, so the refusal was permanent — and the consumer ended up
 * armed for the five abilities with ZERO corpus uses (dragonsmaw, firemane, rockypayload, steelworker,
 * transistor) and closed against the four everybody runs.
 *
 * The fix is one thing: `onlyWhen` is now a STRUCTURE, derived by SHAPE out of Showdown's own
 * handler (`attacker.hp <= attacker.maxhp / 3`), and the consumer evaluates it. Nothing is
 * hardcoded — an ability added next regulation with `hp <= maxhp / 4` is picked up without an
 * engine edit, which is `docs/TAGS.md`'s standing rule.
 *
 * ================= WHY EVERY SCENARIO IS SHAPED THE WAY IT IS ====================================
 *
 * 1. BOTH ENGINES, EVERY ROW. `tests/probe_pair.js` builds the same body on both sides and REFUSES
 *    to return a number when they differ. No number in this file is an expectation typed by hand;
 *    Showdown is the expectation, exactly as `tests/staged_board.js` has it.
 *
 * 2. A PINCH ABILITY ON A FULL-HP BODY READS 0 = 0 IN BOTH ARMS AND PROVES NOTHING. Every row is
 *    staged at a CHOSEN current HP, set on both sides and asserted equal by `probe_pair`.
 *
 * 3. THE CONTROL IS NAMED, NEVER DEFAULTED. Illuminate, `probe_pair.QUIET_ABILITY`. The first Choice
 *    Scarf probe in this repository compared a Scarf against a body the builder had already given a
 *    Scarf; the roster's `ability/generic` rule produced four false findings the same way.
 *
 * 4. THE BOUNDARY IS THE TEST. Showdown's gate is `hp <= maxhp / 3` with REAL division, so a body at
 *    exactly one third gets the boost and one at a third plus one HP does not. An off-by-one here
 *    reads as correct at every HP except the one that decides games. Both parities are staged: a
 *    maxhp divisible by three (where "exactly one third" is an integer that must PASS) and one that
 *    is not (where the largest passing HP is the floor).
 *
 * 5. THE FIVE ZERO-USE MEMBERS ARE THE POSITIVE CONTROL. They are what the consumer served before
 *    this change. A change that turns four rows green while silently breaking them has broken the
 *    model, and that failure would be invisible — they have no corpus usage to notice it in.
 *
 * 6. THE TWO DERIVATIONS ARE COMPARED. `tests/roster.js`'s `ability/pinch-offense` rule reads the
 *    same threshold out of the same handler with its own regex. Two readers of one fact will
 *    disagree eventually (CLAUDE.md: facts are global), so this file asserts they agree — on
 *    MEMBERSHIP and on the DENOMINATOR — rather than assuming it.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);
require(D('engine', 'showdown_path.js'));
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const PP = require(D('tests', 'probe_pair.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = Dex.forFormat(CS.FORMAT);
const MC = globalThis.MC;
const TAGSJSON = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));

let fail = 0, rows = 0;
const notComparable = [];
const ok = (name, cond, detail) => {
  rows++; if (!cond) fail++;
  console.log((cond ? '  ok    ' : '  FAIL  ') + name + (detail ? '\n          ' + detail : ''));
};

/* ---- THE DELIVERY MOVE IS DERIVED, NOT LISTED ------------------------------------------------
 * The ability names a TYPE; the move comes out of the format's own move list. A hand list of four
 * moves is the hand-maintained-list failure this repository opens on, in miniature. */
function hitOfType(type, category) {
  const cands = [];
  for (const m of dex.moves.all()) {
    if (m.isNonstandard) continue;
    if (m.type !== type || m.category !== category) continue;
    if (m.accuracy !== 100 && m.accuracy !== true) continue;
    if (m.target !== 'normal' && m.target !== 'any') continue;
    if (m.onModifyType || m.multihit || m.ohko || m.damage) continue;
    if (!MC.moves[m.id]) continue;              /* must exist on OUR side too */
    cands.push(m);
  }
  cands.sort((a, b) => (b.basePower - a.basePower) || a.id.localeCompare(b.id));
  return cands[0] || null;
}

const flatHP = (b) => Math.floor((2 * b + 31) * 50 / 100) + 50 + 10;
const maxhpOf = (species) => flatHP(dex.species.get(species).baseStats.hp);

/* THE TWO STAGES, both with an MC.mons row and neither carrying a type that gives any of the eight
 * abilities below a STAB it would not otherwise have. Farigiraf's 195 is divisible by three, so
 * "exactly one third" is the integer 65; Goodra's 165 is too, so a THIRD body is used for the
 * non-divisible parity and it is chosen by search rather than by memory. */
const BODY_DIV3 = 'Farigiraf';
const DEFENDER  = 'Snorlax';
const BODY_ND3  = (() => {
  for (const id of Object.keys(MC.mons)) {
    const sp = dex.species.get(id);
    if (!sp.exists || sp.isNonstandard) continue;
    if (maxhpOf(sp.name) % 3 === 0) continue;
    if (dex.getImmunity('Fire', sp.types) === false) continue;
    return sp.name;
  }
  return null;
})();

/* ---- THE FAMILY, READ OUT OF THE ARTIFACT ---------------------------------------------------- */
const PINCH = [], ALWAYS = [];
for (const [id, rec] of Object.entries(TAGSJSON.abilities)) {
  const p = (rec.params || {}).damageBoost;
  if (!p || !p.mult || !p.onType) continue;
  if (!rec.tags || rec.tags.length !== 1) continue;
  if (p.inWeather) continue;
  if (p.onlyWhen) PINCH.push([id, p, rec]); else ALWAYS.push([id, p, rec]);
}

console.log('THE PINCH FAMILY — the condition is the mechanic\n');
console.log('  membership, printed before it is believed (docs/LESSONS §4):');
console.log('    gated  : ' + (PINCH.map(x => x[0]).join(', ') || '(none)'));
console.log('    ungated: ' + (ALWAYS.map(x => x[0]).join(', ') || '(none)'));
console.log('    stages : ' + BODY_DIV3 + ' maxhp ' + maxhpOf(BODY_DIV3) + ' (divisible by 3), '
          + BODY_ND3 + ' maxhp ' + maxhpOf(BODY_ND3) + ' (not), into ' + DEFENDER + '\n');

/* ================= 1. THE DERIVED SHAPE IS MACHINE-READABLE ==================================== */
console.log('1. THE SHAPE — onlyWhen must be a STRUCTURE, not a sentence');
for (const [id, p] of PINCH) {
  const w = p.onlyWhen;
  ok(id + ' carries a structured condition',
     w && typeof w === 'object' && w.cond === 'hpFraction' && w.of === 'self'
       && Number.isInteger(w.num) && Number.isInteger(w.den) && w.den > 0
       && (w.cmp === '<=' || w.cmp === '>='),
     'onlyWhen = ' + JSON.stringify(w));
}

/* ================= 2. THE TWO DERIVATIONS AGREE ================================================
 * tests/roster.js reads `/hp\s*<=\s*\w+\.maxhp\s*\/\s*(\d+)/` off the handler to stage its scenario.
 * Same regex here, same source, and the answers are compared. This is not duplication for its own
 * sake — it is the check that the number the roster stages AGAINST is the number the engine gates ON. */
console.log('\n2. THE TWO READERS OF ONE FACT AGREE (tag_dex vs tests/roster.js\'s regex)');
{
  const rosterSeen = [];
  for (const a of dex.abilities.all()) {
    if (a.isNonstandard) continue;
    const src = ['onModifyAtk', 'onModifySpA'].map(k => String(a[k] || '')).join(' ').replace(/\s+/g, ' ');
    const g = /hp\s*<=\s*\w+\.maxhp\s*\/\s*(\d+)/.exec(src);
    if (!g) continue;
    rosterSeen.push([a.id, +g[1]]);
  }
  ok('the roster\'s regex finds every gated member the artifact does',
     PINCH.every(([id]) => rosterSeen.some(r => r[0] === id)),
     'regex found: ' + rosterSeen.map(r => r[0] + '(1/' + r[1] + ')').join(', '));
  for (const [id, p] of PINCH) {
    const r = rosterSeen.find(x => x[0] === id);
    ok(id + ' — same denominator in both readers',
       !!r && p.onlyWhen && p.onlyWhen.den === r[1] && p.onlyWhen.num === 1,
       'tag_dex says ' + JSON.stringify(p.onlyWhen) + ', the roster\'s regex says 1/' + (r && r[1]));
  }
}

/* ================= 3. BELOW THE GATE IT FIRES, ABOVE IT IT DOES NOT ============================ */
/* THE ISOLATION IS DECLARED, ONCE, HERE (added 2026-08-09 with probe_pair's legality guard).
 *
 * Every row in this file stages a typed ability and its matching typed move on ONE generic body —
 * Farigiraf carrying Steelworker and clicking Flash Cannon, which it cannot learn and cannot have.
 * That is the DESIGN, not an accident: holding the body fixed is what makes Blaze's row comparable to
 * Torrent's, and letting the body vary per ability is exactly the Fluffy/Sand Rush failure (ROADMAP
 * #100) that produced four false findings across 2,049 uses.
 *
 * So the pairing complaint is waived, deliberately and in writing. The BAN check is NOT waived and
 * cannot be from here — an entity that does not exist in this format still throws, because there is no
 * isolation for which a fictional mechanic is the right subject. */
function row(label, o) {
  let r;
  try { r = PP.damage(Object.assign({ iKnowThisPairingIsIllegal: true }, o)); }
  catch (e) { return { err: e.message }; }
  return r;
}

/* THE THRESHOLD AND THE TYPE COME OUT OF SHOWDOWN'S OWN HANDLER, NOT OUT OF THE ARTIFACT UNDER
 * TEST. The first draft of this file read `p.onlyWhen.den` — the very field the fix creates — so on
 * the unfixed tree it computed `floor(maxhp / undefined)` and staged a body at NaN HP. `probe_pair`
 * refused it, which is the whole reason that refusal exists, but the row would have proved nothing
 * either way. Showdown is the expectation; the artifact is the thing being judged. */
function authorityGate(id) {
  const a = dex.abilities.get(id);
  const src = ['onModifyAtk', 'onModifySpA'].map(k => String(a[k] || '')).join(' ').replace(/\s+/g, ' ');
  const g = /hp\s*<=\s*\w+\.maxhp\s*\/\s*(\d+)/.exec(src);
  const t = /move\.type\s*===?\s*["'](\w+)["']/.exec(src);
  return { den: g ? +g[1] : null, type: t ? t[1] : null };
}

function pinchRows(id, p, body, category) {
  const G = authorityGate(id);
  const type = G.type;
  const mv = type && hitOfType(type, category);
  if (!G.den || !type) { ok(id + ' — the authority states a gate and a type', false, JSON.stringify(G)); return; }
  if (!mv) { ok(id + ' ' + category + ' — a delivery move exists', false, 'no 100-acc single-target ' + type + ' ' + category + ' move'); return; }
  const maxhp = maxhpOf(body);
  const den = G.den;
  const under = Math.floor(maxhp / den);          /* the largest HP that PASSES: hp <= maxhp/den */
  const over = under + 1;
  const base = { att: body, def: DEFENDER, move: mv.name, roll: 0 };

  const ctlU = row('', Object.assign({}, base, { attHP: under }));
  const testU = row('', Object.assign({}, base, { attHP: under, attAb: id }));
  const ctlO = row('', Object.assign({}, base, { attHP: over }));
  const testO = row('', Object.assign({}, base, { attHP: over, attAb: id }));
  for (const [n, r] of [['ctl<=', ctlU], ['test<=', testU], ['ctl>', ctlO], ['test>', testO]]) {
    if (r.err) { ok(id + ' ' + n + ' staged', false, r.err); return; }
  }
  const tag = id + ' / ' + mv.name + ' (' + category + ') off ' + body + ' maxhp ' + maxhp;

  /* NOT COMPARABLE: if the CONTROL arm already disagrees, the two engines differ about the MOVE and
   * the row says nothing about the ability. Printed, never silently dropped — this is how the real
   * finding below surfaced. `First Impression` reads bp 90 in `data/engine-data.js` and 100 in the
   * dex, which is a defect in a file this division does not own; it is reported, not swept in. */
  if (!ctlU.agree || !ctlO.agree) {
    console.log('  N/C   ' + tag + ' — THE CONTROL ARM ALREADY DISAGREES (showdown ' + ctlO.showdown
      + ' vs medicham ' + ctlO.medicham + ' with NO ability). The two engines differ about the MOVE, '
      + 'so this row is not evidence about ' + id + '. FILED, not scored.');
    notComparable.push(mv.name + ' (' + ctlO.showdown + ' vs ' + ctlO.medicham + ')');
    return;
  }

  /* THE KNOB HAS TO MOVE IN THE AUTHORITY, or the row is not evidence about either engine. */
  ok(tag + ' — the AUTHORITY itself distinguishes the two arms under the gate',
     ctlU.showdown !== testU.showdown && ctlU.showdown > 0,
     'showdown at hp ' + under + '/' + maxhp + ': control ' + ctlU.showdown + ' -> ' + id + ' ' + testU.showdown);
  ok(tag + ' — UNDER the gate (hp ' + under + ' <= ' + maxhp + '/' + den + '): both engines agree',
     testU.agree, 'showdown ' + testU.showdown + ' vs medicham ' + testU.medicham
       + '   (control both-engines ' + ctlU.showdown + '/' + ctlU.medicham + ')');
  ok(tag + ' — OVER the gate (hp ' + over + '): both engines agree AND nothing is boosted',
     testO.agree && testO.showdown === ctlO.showdown && testO.medicham === ctlO.medicham,
     'showdown ' + testO.showdown + ' vs medicham ' + testO.medicham
       + '   (control ' + ctlO.showdown + '/' + ctlO.medicham + ')');
  /* ARM 2 — THE DEFECT IS ALWAYS AT THE LINE. Our own engine must move between under and over. */
  ok(tag + ' — OUR engine changes its answer ACROSS the line and not before it',
     testU.medicham > testO.medicham && testO.medicham === ctlO.medicham,
     'medicham hp ' + under + ' -> ' + testU.medicham + ', hp ' + over + ' -> ' + testO.medicham
       + ', unabilitied ' + ctlO.medicham);
}

/* THE SET UNDER TEST IS THE AUTHORITY'S, and it is compared to the artifact's rather than taken
 * from it. `defeatist` matches the hp-gate regex and is deliberately NOT here: it names no type
 * (`onType: null`) and its multiplier is 0.5, so it is a NERF rather than a boost and the consumer's
 * `onType === mvT` clause keeps refusing it. That is a real remaining gap at 0 corpus uses, filed
 * rather than swept in. */
const AUTH_PINCH = dex.abilities.all()
  .filter(a => !a.isNonstandard)
  .map(a => [a.id, authorityGate(a.id)])
  .filter(([, g]) => g.den && g.type)
  .map(([id]) => id).sort();

console.log('\n3. THE FOUR GATED MEMBERS — special and physical, both parities of maxhp');
ok('the artifact\'s gated set is exactly the authority\'s type-naming hp-gated set',
   AUTH_PINCH.join(',') === PINCH.map(x => x[0]).sort().join(','),
   'authority: ' + AUTH_PINCH.join(', ') + '   |   artifact: ' + PINCH.map(x => x[0]).sort().join(', '));
for (const id of AUTH_PINCH) {
  const p = (TAGSJSON.abilities[id].params || {}).damageBoost;
  pinchRows(id, p, BODY_DIV3, 'Special');
  pinchRows(id, p, BODY_DIV3, 'Physical');
  pinchRows(id, p, BODY_ND3, 'Special');
}

/* ================= 4. THE POSITIVE CONTROL — the five that already worked ====================== */
console.log('\n4. THE POSITIVE CONTROL — the ungated members the consumer already served');
ok('all five 0-use members are still in the ungated set',
   ['dragonsmaw', 'firemane', 'rockypayload', 'steelworker', 'transistor']
     .every(x => ALWAYS.some(a => a[0] === x)),
   'ungated set is: ' + ALWAYS.map(a => a[0]).join(', '));
for (const [id, p] of ALWAYS) {
  const mv = hitOfType(p.onType, 'Special');
  if (!mv) { ok(id + ' — a delivery move exists', false, 'none of type ' + p.onType); continue; }
  const base = { att: BODY_DIV3, def: DEFENDER, move: mv.name, roll: 0 };
  const ctl = row('', base);
  const test = row('', Object.assign({}, base, { attAb: id }));
  if (ctl.err || test.err) { ok(id + ' staged', false, ctl.err || test.err); continue; }
  ok(id + ' / ' + mv.name + ' — fires at FULL HP and both engines agree',
     test.agree && test.medicham > ctl.medicham && ctl.agree,
     'control ' + ctl.showdown + '/' + ctl.medicham + '  ->  ' + id + ' ' + test.showdown + '/' + test.medicham);
}

/* ================= 5. THE GATE IS NOT A LICENCE — an unevaluable condition still refuses ======= */
console.log('\n5. FAIL CLOSED IS STILL THE RULE');
{
  /* Every `damageBoost` that carries a condition this engine cannot evaluate must still be refused.
   * The list is printed rather than asserted empty: it is the honest remaining gap, and it shrinking
   * is what the next wire looks like. */
  const unreadable = [];
  for (const [id, rec] of Object.entries(TAGSJSON.abilities)) {
    const p = (rec.params || {}).damageBoost;
    if (!p || !p.onlyWhen) continue;
    if (typeof p.onlyWhen === 'object' && p.onlyWhen.cond === 'hpFraction') continue;
    unreadable.push(id + ' (' + JSON.stringify(p.onlyWhen) + ', ' + rec.uses + ' uses)');
  }
  console.log('  still unreadable, and therefore still refused: ' + (unreadable.join('; ') || '(none)'));
  ok('no damageBoost carries a PROSE hp gate any more',
     !Object.values(TAGSJSON.abilities).some(r => {
       const p = (r.params || {}).damageBoost;
       return p && typeof p.onlyWhen === 'string' && /hp/i.test(p.onlyWhen);
     }), 'a sentence is not a condition');
}

if (notComparable.length) {
  console.log('\nNOT COMPARABLE, and named rather than hidden — the control arm disagrees on the MOVE:');
  for (const n of [...new Set(notComparable)]) console.log('  ' + n);
}
console.log('\n' + (fail ? fail + ' of ' + rows + ' FAILED' : 'all ' + rows + ' green'));
process.exit(fail ? 1 : 0);
