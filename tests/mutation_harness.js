/* COVERAGE LAYER 2 — MUTATION: does the handler MATTER, or does it only FIRE?
 *
 *   node tests/mutation_harness.js              gate + sweep, writes data/mutation-coverage.json
 *   node tests/mutation_harness.js --gate-only  just the planted-stub demonstration
 *   node tests/mutation_harness.js --tags=a,b   sweep a chosen tag list
 *   node tests/mutation_harness.js --no-write   do not touch the artifact
 *
 * WHY THIS EXISTS, in the words of the thing it catches.
 * ------------------------------------------------------
 * A STUB DOES NOT SHOW UP AS DEAD. `data/tag-consumption.json` has four buckets and a stub lands in
 * the two that are not ratcheted: a registered handler that never fires reads UNREACHED (deliberately
 * never ratcheted, because it measures the sweep and not the engine), and a handler that FIRES and
 * ignores its payload reads LIVE. WIRE 71 is the standing case — `extendsDuration` had four consuming
 * routes and three wrote a literal 5 for months with every test green. Shield Dust FIRED, the partial
 * trap FIRED, Purifying Salt's damage half FIRED, and all three were wrong.
 *
 * So: change the FACT and see whether the BEHAVIOUR moves. If it does not, the handler is not reading
 * what it claims to read.
 *
 * THE THREE TRAPS, and what is done about each. Getting any of them wrong produces a FALSE DEAD,
 * which is the dangerous direction.
 *
 * (a) PER-PARAM OPERATORS, NOT ONLY PER-TAG. Removing `spreadAll` moves the SPREAD set, so the tag
 *     scores LIVE while `hitsAlly` stays ignored. Every operator family below is emitted twice: once
 *     removing the tag from the carrier, once perturbing each scalar param.
 *
 * (b) THE DERIVED SETS ARE BUILT AT MODULE LOAD. `medicham2-browser.js` builds SPREAD, HITS_ALLY, the
 *     terrain residual table and the priority-block map from the artifact when the module is first
 *     evaluated (lines ~167-237). `TAGS.__setDB()` after that point silently no-ops for every one of
 *     them, and a no-op reads as "removing this changed nothing" — a false DEAD. tags.js carries a
 *     `__onSetDB` rebuild hook and NOTHING IN THE ENGINE REGISTERS ONE (grep it), so this harness does
 *     not rely on the hook: it COMPILES A FRESH ENGINE INSTANCE per mutant, after the DB is injected,
 *     so every module-load derivation is rebuilt from the mutated artifact by construction. The
 *     planted set-building stub below is the proof that this actually happens.
 *
 * (c) A SEED BATTERY, NOT ONE SEED. One seed can miss a probabilistic effect (false DEAD). And a
 *     removed tag shifts PRNG CONSUMPTION, so a downstream roll changes for an unrelated reason
 *     (false LIVE). Both directions are named in the artifact: three CONSTANT-value rngs cannot shift
 *     a stream at all, so a difference under one of those is solid; two streaming LCGs can, so a
 *     difference seen ONLY under a streaming rng is recorded as `stream-shift-suspect` rather than
 *     quietly counted as evidence.
 *
 * THE EQUIVALENT-MUTANT DEFENCE, kept unchanged from the original design because the review calls it
 * the best idea in it: before scoring a mutant, ask whether the REFERENCE engine's two arms differ at
 * all. The control arm removes the CARRIER from the scenario (the ability becomes 'none', the item
 * becomes '', the move click becomes a pass). If the reference engine cannot tell those apart, the
 * case cannot express the mechanic and a mutation that changes nothing proves nothing — the case is
 * INERT and is never counted as evidence in either direction.
 *
 * THE STANDING GATE. No check is committed until it has been shown failing on a known-bad input. Two
 * stubs are PLANTED in the engine source in memory — one that reads a param and writes a literal (the
 * WIRE 71 shape), one that ignores a tag-derived SET — and the harness must report both as
 * READ-AND-IGNORED while reporting the shipped engine LIVE on the same operators. The sweep REFUSES
 * TO RUN if the gate does not catch them, because a harness that has never caught a planted stub is
 * not evidence.
 *
 * WHAT THIS INSTRUMENT STRUCTURALLY CANNOT SEE, printed on every run:
 *   - a fact derived WRONG upstream. It is propagated faithfully, consumed faithfully, and mutation
 *     says LIVE. Only the differential (tests/test-engine-diff.js, tests/test-game-diff.js) and the
 *     interaction matrix see that. Layer 4 owns it.
 *   - a mechanic no scenario here stages. That is UNSTAGEABLE, and it is NOT a clean result — it is
 *     the absence of one. It is counted separately and never folded into the pass.
 *   - nesting. A param whose value is an object or an array of objects is not perturbed; it is
 *     counted as `nested-not-mutated` so the gap is a number rather than a silence.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const D = (...p) => path.join(__dirname, '..', ...p);

require(D('engine', 'job_cost.js')).track('mutation-harness');

require(D('data', 'engine-data.js'));
const TAGS = require(D('engine', 'tags.js'));

const MEDI_PATH = D('engine', 'medicham2-browser.js');
const SHIPPED_SRC = fs.readFileSync(MEDI_PATH, 'utf8');
const SHIPPED_DB = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
const OUT = D('data', 'mutation-coverage.json');

const clone = o => JSON.parse(JSON.stringify(o));
const TABLE = { move: 'moves', item: 'items', ability: 'abilities' };

/* ---- loading a FRESH engine over an injected artifact ------------------------------------------
 * NOT a require-cache clear of engine/tags.js: that would drop the ASKED/COUNT counters this file
 * reads to tell "never consulted" apart from "consulted and ignored". Only medicham2 is recompiled.
 * A fresh Module means every module-load derivation (SPREAD, HITS_ALLY, the terrain table, the
 * priority-block map) is rebuilt from whatever DB is installed at that instant. */
function loadEngine(src) {
  const m = new Module(MEDI_PATH, null);
  m.filename = MEDI_PATH;
  m.paths = Module._nodeModulePaths(path.dirname(MEDI_PATH));
  m._compile(src, MEDI_PATH);
  return m.exports;
}

/* ---- the rng battery ---------------------------------------------------------------------------
 * Three CONSTANT rngs (no stream, so removing a tag cannot realign anything) and two LCGs (a stream,
 * so they can see a probabilistic effect the constants miss AND can realign for unrelated reasons).
 * Which one saw the difference is recorded per operator. */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RNGS = [
  { name: 'k05', stream: false, make: () => () => 0.05 },
  { name: 'k50', stream: false, make: () => () => 0.5 },
  { name: 'k95', stream: false, make: () => () => 0.95 },
  { name: 'lcg-20260805', stream: true, make: () => mulberry32(20260805) },
  { name: 'lcg-777', stream: true, make: () => mulberry32(777) },
];

/* ---- the state projection ----------------------------------------------------------------------
 * Everything the engine can hold that a mutation could move. Deliberately WIDE rather than targeted:
 * a targeted projection is a hand-written expectation, and every one of this project's ~26 wrong
 * probes was a human writing down what should happen. */
function projVal(v) {
  if (v === null || v === undefined) return 'null';
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return String(v);
  if (t === 'function') return 'fn';
  if (v instanceof Set) return '{' + [...v].map(String).sort().join(',') + '}';
  if (v instanceof Map) return 'M' + v.size;
  if (Array.isArray(v)) return '[' + v.map(x => (x && typeof x === 'object') ? String(x.id || x.name || 'o') : String(x)).join(',') + ']';
  if (typeof v.curHP === 'number' && v.name) return 'mon:' + v.name;      // a body reference, not its state
  return '{' + Object.keys(v).sort().map(k => k + '=' + ((v[k] && typeof v[k] === 'object') ? projVal(v[k]) : String(v[k]))).join(',') + '}';
}
const MON_SKIP = new Set(['_sf', 'moves', 'st', '__mask']);   // _sf is the shared side object, projected once
const MASK_ANY = Symbol('mask-any');
/* THE MASK, AND IT IS NOT COSMETIC — WITHOUT IT THE EQUIVALENT-MUTANT DEFENCE DOES NOT WORK.
 *
 * The inertness question is "would the reference engine behave the same if the carrier were not
 * there". The control arm answers it by taking the carrier away — but `ability` and `item` are STATE,
 * so the projection contains the literal string `ability=magnetpull` in one arm and `ability=none` in
 * the other, and EVERY case comes back non-inert for a reason that has nothing to do with the
 * mechanic. The first cut of this file did exactly that and scored 32 of 32 cases expressive,
 * including Magnet Pull staged against a field with no Steel type on it.
 *
 * So the slot the carrier was planted in reports `#CTL#` for that one field FOR AS LONG AS IT STILL
 * HOLDS WHAT IT WAS GIVEN. A Knock Off or a Trick that moves it makes the value differ from the
 * planted one and the real value is printed again — the mask hides the staging, never a change. */
function projMon(m) {
  if (!m) return 'x';
  const ks = Object.keys(m).filter(k => !MON_SKIP.has(k)).sort();
  const mask = m.__mask;
  return ks.map(k => {
    if (mask && Object.prototype.hasOwnProperty.call(mask, k)
      && (mask[k] === MASK_ANY || String(m[k]) === String(mask[k]))) return k + '=#CTL#';
    return k + '=' + projVal(m[k]);
  }).join(';');
}
function projSide(sf) {
  if (!sf) return 'x';
  return Object.keys(sf).filter(k => k !== 'team').sort().map(k => k + '=' + projVal(sf[k])).join(';');
}
function projState(S) {
  return [
    'T' + S.turn,
    'F:' + projVal(S.field),
    'sA:' + projSide(S.sfA), 'sB:' + projSide(S.sfB),
    'aA:' + S.actA.map(m => m ? m.name : 'x').join(','), 'aB:' + S.actB.map(m => m ? m.name : 'x').join(','),
    'bA:' + S.benchA.map(m => m ? m.name : 'x').join(','), 'bB:' + S.benchB.map(m => m ? m.name : 'x').join(','),
  ].join(' | ');
}

/* ---- the scenarios -----------------------------------------------------------------------------
 * Six bare bodies — item and ability BLANKED on every one of them, so the carrier under test is the
 * only ability or item on the field. That is the rule this project learned from the Choice Scarf
 * probe that compared a Scarf against a Scarf. */
/* TWO PAIRINGS, AND THE SECOND ONE EXISTS FOR A REASON THE FIRST RUN EXPOSED.
 *
 * With one pairing, `speedMult` scored READ-AND-IGNORED at the tag level on a Choice Scarf that
 * engine/medicham2-browser.js:1689 demonstrably reads. Incineroar is 80 and Garchomp is 161, so
 * x1.5 = 120 does not overtake anything and the turn order — the only observable a speed change has —
 * never moves. That is a FALSE DEAD produced entirely by the staging.
 *
 * Pairing 2 puts a body at 101 opposite one at 130, so 101 < 130 < 151: a x1.5 flips the bracket and
 * a x1.0 does not. That is a GENERIC property of a battery (it should contain two bodies inside one
 * multiplier of each other), not a fix aimed at Choice Scarf, which is why it is stated as a speed
 * gap rather than as a Scarf case.
 *
 * `stab` names a body's own-type move so `stabBoost` has something to multiply — with only Drain
 * Punch on the field Adaptability came back UNSTAGEABLE. `special` is a SPECIAL, NON-CONTACT attack,
 * without which `punishesAttacker.trigger` cannot be discriminated: an unknown trigger falls through
 * to `:true` (fires on everything), so a contact-only battery reads a contact carrier identically
 * either way. */
const PAIRINGS = [
  { name: 'p1', A: ['incineroar', 'milotic', 'corviknight'], B: ['garchomp', 'weavile', 'archaludon'],
    stabA: 'nightslash', stabB: 'dragonclaw', specialA1: 'scald' },
  { name: 'p2-speed', A: ['milotic', 'corviknight', 'weavile'], B: ['archaludon', 'torkoal', 'dragapult'],
    stabA: 'scald', stabB: 'ironhead', specialA1: 'flashcannon' },
];

function bare(M, sp) {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row for ' + sp);
  b.item = ''; b.ability = 'none';
  return b;
}

/* THE ABILITY / ITEM SCRIPT. Four turns, and every slot on the field has a job, so a carrier can be
 * planted in any of the four and still find something to act on:
 *   T1  A0 Will-O-Wisp -> B0 (a direct status move), A1 Reflect (a SCREEN, which is what Light Clay
 *       extends), B0 Sunny Day (a weather set, whose duration Heat Rock extends)
 *   T2  A0/B0 Drain Punch (contact, and no secondary of its own — the move WIRE 115 had to switch to
 *       after Flare Blitz's own burn was misread as a Poison Touch proc), B1 Rain Dance (a weather
 *       CHANGE, and the one Damp Rock extends)
 *   T3  A0 and B0 switch (trapping, hazards, entry effects, Regenerator, Unburden)
 *   T4  idle (residuals, expiry)
 * None of that is aimed at a particular tag; it is a spread of the ACTION CLASSES this engine has, so
 * the generator does not have to know what it is staging. */
function scriptAbilItem(M, S, mons, turn) {
  const [a0, a1, a2, b0, b1, b2] = mons;
  const P = { kind: 'pass' };
  const act = (m, mv, tg) => (m && !m.fainted) ? M.playerAction(m, mv, tg, S.field) : P;
  const sw = (m, to) => (m && !m.fainted && to && !to.fainted && S.actA.indexOf(to) < 0 && S.actB.indexOf(to) < 0) ? { kind: 'switch', to } : P;
  const A0 = S.actA[0], A1 = S.actA[1], B0 = S.actB[0], B1 = S.actB[1];
  if (turn === 1) return [new Map([[A0, act(A0, 'willowisp', B0)], [A1, act(A1, 'reflect', null)]]),
                          new Map([[B0, act(B0, 'sunnyday', null)], [B1, P]])];
  if (turn === 2) return [new Map([[A0, act(A0, 'drainpunch', B0)], [A1, P]]),
                          new Map([[B0, act(B0, 'drainpunch', A0)], [B1, act(B1, 'raindance', null)]])];
  if (turn === 3) return [new Map([[A0, sw(A0, a2)], [A1, P]]), new Map([[B0, sw(B0, b2)], [B1, P]])];
  return [new Map([[A0, P], [A1, P]]), new Map([[B0, P], [B1, P]])];
}

/* THE MOVE SCRIPT. The move under test is clicked on T1; the two switches on T2 and T3 exist so a
 * hazard laid on either side and a trap applied to either side can resolve. */
function scriptMove(M, S, mons, turn, moveId) {
  const [a0, a1, a2, b0, b1, b2] = mons;
  const P = { kind: 'pass' };
  const act = (m, mv, tg) => (m && !m.fainted && mv) ? M.playerAction(m, mv, tg, S.field) : P;
  const sw = (m, to) => (m && !m.fainted && to && !to.fainted && S.actA.indexOf(to) < 0 && S.actB.indexOf(to) < 0) ? { kind: 'switch', to } : P;
  const A0 = S.actA[0], A1 = S.actA[1], B0 = S.actB[0], B1 = S.actB[1];
  if (turn === 1) return [new Map([[A0, act(A0, moveId, B0)], [A1, P]]), new Map([[B0, P], [B1, P]])];
  if (turn === 2) return [new Map([[A0, P], [A1, P]]), new Map([[B0, sw(B0, b2)], [B1, P]])];
  if (turn === 3) return [new Map([[A0, sw(A0, a2)], [A1, P]]), new Map([[B0, P], [B1, P]])];
  return [new Map([[A0, P], [A1, P]]), new Map([[B0, P], [B1, P]])];
}

const TURNS = 4;

const SLOT = { A0: 0, A1: 1, B0: 3, B1: 4 };
/* opts: { kind, id, placement:'A0'|'A1'|'B0'|'B1'|null, neutralize:bool, mask:bool } */
function stage(M, opts, rngSpec) {
  const mons = [...TEAM_A.map(s => bare(M, s)), ...TEAM_B.map(s => bare(M, s))];
  const target = opts.placement ? mons[SLOT[opts.placement]] : null;
  if (target) {
    const field = opts.kind === 'ability' ? 'ability' : 'item';
    if (!opts.neutralize) target[field] = opts.id;
    if (opts.mask) target.__mask = { [field]: target[field] };
  }
  /* The move arms differ in the same trivial way: the control arm never clicks, so `_lastMove` alone
   * would make every move case look expressive. Masked for the inertness question only. */
  if (opts.kind === 'move' && opts.mask) mons[0].__mask = { _lastMove: MASK_ANY };
  const S = M.battleInit(mons.slice(0, 3), mons.slice(3), {});
  const rng = rngSpec.make();
  const trace = [];
  for (let t = 1; t <= TURNS; t++) {
    if (M.battleOver(S)) break;
    const [aActs, bActs] = (opts.kind === 'move')
      ? scriptMove(M, S, mons, t, opts.neutralize ? null : opts.id)
      : scriptAbilItem(M, S, mons, t);
    M.battleTurn(S, rng, aActs, bActs);
    trace.push(projState(S) + ' || ' + mons.map(projMon).join(' # '));
  }
  return trace.join('\n');
}

function digestsFor(M, opts) {
  const out = {};
  for (const r of RNGS) {
    /* NOT DISCARDED — the message becomes the digest. A staging failure has to be DISTINGUISHABLE
     * from a digest that merely differs, because a mutation that makes the engine throw is not the
     * same finding as one that changes its output; `threwAnywhere` below reads this back. */
    try { out[r.name] = stage(M, opts, r); }
    catch (e) { out[r.name] = 'THREW:' + String(e && e.message || e); }
  }
  return out;
}
const threwAnywhere = d => Object.values(d).some(v => String(v).startsWith('THREW'));

/* ---- the operators -----------------------------------------------------------------------------
 * Two families, both read straight off the artifact so a tag added tomorrow gets the same treatment
 * without an edit here. */
function opRemoveTag(kind, id, tag) {
  return {
    key: `${kind}:${id}:${tag}:REMOVE-TAG`, family: 'remove-tag', kind, id, tag, param: null,
    apply(db) {
      const rec = db[TABLE[kind]][id];
      rec.tags = rec.tags.filter(t => t !== tag);
      if (rec.params) delete rec.params[tag];
    },
  };
}
const SENTINEL_STR = 'ZZ-MUTANT-ZZ';
function paramOps(kind, id, tag, params) {
  const ops = [];
  let nested = 0, nulls = 0;
  for (const k of Object.keys(params || {})) {
    const v = params[k];
    let values = null, shape = null;
    if (typeof v === 'boolean') { values = [!v]; shape = 'boolean'; }
    else if (typeof v === 'number') { values = [v * 3 + 7, v === 0 ? 1 : 0]; shape = 'number'; }
    else if (typeof v === 'string') { values = [SENTINEL_STR]; shape = 'string'; }
    /* A NULL PARAM IS NOT A FACT AND MUTATING IT IS NOT A MUTATION. `roughskin.setsWeather: null`
     * says Rough Skin does not set weather; writing a sentinel there asks the consumer to honour a
     * fact the artifact never asserted, and a consumer that sensibly refuses an unknown value is
     * indistinguishable from one that never looked. The first cut of this file scored 20-odd of
     * those as DEFECT-CANDIDATE. They are counted and skipped. */
    else if (v === null) { nulls++; continue; }
    else if (Array.isArray(v) && v.every(x => typeof x !== 'object')) { values = [[], [SENTINEL_STR]]; shape = 'array'; }
    else { nested++; continue; }
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      ops.push({
        key: `${kind}:${id}:${tag}.${k}:=${JSON.stringify(val)}`, family: 'param', kind, id, tag,
        param: k, paramShape: shape, paramWas: v, paramNow: val,
        apply(db) {
          const rec = db[TABLE[kind]][id];
          rec.params = rec.params || {}; rec.params[tag] = rec.params[tag] || {};
          rec.params[tag][k] = val;
        },
      });
    }
  }
  return { ops, nested, nulls };
}

/* ---- carriers ---------------------------------------------------------------------------------- */
function carriersOf(db, tag, perKind) {
  const out = [];
  for (const kind of ['move', 'item', 'ability']) {
    const T = db[TABLE[kind]];
    const rows = Object.keys(T).filter(id => (T[id].tags || []).includes(tag))
      .map(id => ({ kind, id, uses: T[id].uses || 0, params: (T[id].params || {})[tag] || {} }))
      .sort((a, b) => b.uses - a.uses);
    out.push(...rows.slice(0, perKind));
  }
  return out;
}
function placementsFor(kind) { return kind === 'move' ? [null] : ['A0', 'A1', 'B0', 'B1']; }

/* ---- one tag, one engine source ---------------------------------------------------------------- */
function sweepTag(src, tag, opt) {
  const perKind = (opt && opt.perKind) || 2;
  const carriers = carriersOf(SHIPPED_DB, tag, perKind);
  const row = { tag, carriers: carriers.map(c => `${c.kind}:${c.id}`), cases: [], operators: [], nestedParamsSkipped: 0, nullParamsSkipped: 0 };
  if (!carriers.length) { row.verdict = 'NO-CARRIER'; return row; }

  /* THE REFERENCE PASS. A fresh engine over the SHIPPED artifact, compiled while the shipped artifact
   * is installed, so its lazily-memoised tables (terrainPerTurnHP, priorityBlockAbilities) can never
   * be built under a mutated DB and poison the baseline. */
  TAGS.__setDB(null);
  const refM = loadEngine(src);
  TAGS.resetHits();
  const cases = [];
  for (const c of carriers) {
    for (const pl of placementsFor(c.kind)) {
      const opts = { kind: c.kind, id: c.id, placement: pl, neutralize: false };
      /* UNMASKED, for the mutation comparison — both of its arms stage the carrier identically, so
       * nothing needs hiding and nothing is hidden. */
      const base = digestsFor(refM, opts);
      /* MASKED, for the equivalent-mutant question only. */
      const expr = digestsFor(refM, { ...opts, mask: true });
      const ctl = digestsFor(refM, { ...opts, neutralize: true, mask: true });
      const differing = RNGS.filter(r => expr[r.name] !== ctl[r.name]).map(r => r.name);
      const threw = RNGS.filter(r => String(base[r.name]).startsWith('THREW')).map(r => r.name);
      cases.push({ carrier: `${c.kind}:${c.id}`, placement: pl, base, inert: differing.length === 0, expressedUnder: differing, threw });
      row.cases.push({ carrier: `${c.kind}:${c.id}`, placement: pl, inert: differing.length === 0, expressedUnder: differing, threw });
    }
  }
  row.asked = (TAGS.asked()[tag] || 0);
  row.found = (TAGS.hits()[tag] || 0);
  const liveCases = cases.filter(c => !c.inert);
  if (!liveCases.length) { row.verdict = 'UNSTAGEABLE'; return row; }

  /* THE OPERATORS. One mutant engine per operator, compiled AFTER the mutated DB is installed. */
  const ops = [];
  for (const c of carriers) {
    /* AN OPERATOR IS ONLY EMITTED FOR A CARRIER THAT HAS A NON-INERT CASE. A mutation of a carrier no
     * scenario here can stage tells you nothing at all, and reporting it as READ-AND-IGNORED beside
     * real findings is how a report gets ignored. */
    if (!liveCases.some(x => x.carrier === `${c.kind}:${c.id}`)) {
      row.cases.filter(x => x.carrier === `${c.kind}:${c.id}`).forEach(x => { x.unstageable = true; });
      continue;
    }
    ops.push({ op: opRemoveTag(c.kind, c.id, tag), carrier: `${c.kind}:${c.id}` });
    const { ops: pops, nested, nulls } = paramOps(c.kind, c.id, tag, c.params);
    row.nestedParamsSkipped += nested;
    row.nullParamsSkipped += nulls;
    for (const p of pops) ops.push({ op: p, carrier: `${c.kind}:${c.id}` });
  }

  for (const { op, carrier } of ops) {
    const db = clone(SHIPPED_DB);
    op.apply(db);
    TAGS.__setDB(db);
    const mutM = loadEngine(src);
    const changedUnder = [], sameUnder = [];
    let threwUnderMutation = false;
    for (const c of liveCases) {
      if (c.carrier !== carrier) continue;
      const mut = digestsFor(mutM, { kind: op.kind, id: op.id, placement: c.placement, neutralize: false });
      if (threwAnywhere(mut) && !threwAnywhere(c.base)) threwUnderMutation = true;
      for (const r of RNGS) {
        const tagName = `${c.carrier}${c.placement ? '@' + c.placement : ''}/${r.name}`;
        if (mut[r.name] !== c.base[r.name]) changedUnder.push({ where: tagName, stream: r.stream });
        else sameUnder.push(tagName);
      }
    }
    TAGS.__setDB(null);
    const verdict = changedUnder.length === 0 ? 'READ-AND-IGNORED' : 'LIVE';
    const streamOnly = changedUnder.length > 0 && changedUnder.every(x => x.stream);
    row.operators.push({
      key: op.key, family: op.family, carrier, param: op.param, paramShape: op.paramShape,
      paramWas: op.paramWas === undefined ? undefined : op.paramWas, paramNow: op.paramNow,
      verdict, changed: changedUnder.length, same: sameUnder.length,
      ...(threwUnderMutation ? { threw: true } : {}),
      ...(streamOnly ? { note: 'stream-shift-suspect — every difference came from a STREAMING rng, so a realigned PRNG cannot be ruled out' } : {}),
    });
  }
  TAGS.__setDB(null);

  /* PRESENCE-ONLY vs DEFECT-CANDIDATE. A boolean param whose tag-level removal is LIVE is carrying no
   * information the MEMBERSHIP does not already carry — `spreadAll.hitsAlly` is exactly that shape.
   * That is redundant, not broken, and calling it a defect would train the reader to ignore this file.
   * A NUMBER or a STRING that is ignored is the WIRE 71 shape and is a defect candidate. */
  const tagLevelLive = row.operators.some(o => o.family === 'remove-tag' && o.verdict === 'LIVE');
  for (const o of row.operators) {
    if (o.family !== 'param' || o.verdict !== 'READ-AND-IGNORED') continue;
    o.class = (o.paramShape === 'boolean' && tagLevelLive) ? 'PRESENCE-ONLY' : 'DEFECT-CANDIDATE';
  }
  row.verdict = tagLevelLive ? 'LIVE'
    : row.operators.some(o => o.family === 'remove-tag' && o.verdict === 'READ-AND-IGNORED') ? 'READ-AND-IGNORED'
      : 'UNSTAGEABLE';
  return row;
}

/* ---- THE PLANTED STUBS ------------------------------------------------------------------------- */
/* Each is a textual patch of the engine source applied IN MEMORY. Nothing is written to disk. Each
 * one asserts it matched — a patch that silently failed to apply would make a broken engine look
 * fixed, which is this project's signature failure arriving through the check meant to catch it. */
function plant(src, from, to, label) {
  if (from instanceof RegExp) {
    if (!from.test(src)) throw new Error('PLANT FAILED — the source no longer contains the site for "' + label + '". Fix the patch, do not skip it.');
    return src.replace(from, to);
  }
  if (src.indexOf(from) < 0) throw new Error('PLANT FAILED — the source no longer contains the site for "' + label + '". Fix the patch, do not skip it.');
  return src.split(from).join(to);
}
const STUBS = [
  {
    name: 'param-level stub (the WIRE 71 shape)',
    tag: 'speedMult',
    /* Reads the tag, then writes a literal. `asked()` counts it, the census sees Choice Scarf working,
     * and the artifact's own number is never consulted. */
    op: /^item:choicescarf:speedMult\.mult:/,
    make: src => plant(src,
      "{const _sm=TAGS.param('item',m.item,'speedMult');if(_sm&&_sm.mult)s*=+_sm.mult;}",
      "{const _sm=TAGS.param('item',m.item,'speedMult');if(_sm&&_sm.mult)s*=1.5;}",
      'speedMult literal'),
    mustBe: 'READ-AND-IGNORED',
  },
  {
    name: 'set-building stub (proves the mutated DB reaches a MODULE-LOAD derivation)',
    tag: 'spreadFoes',
    op: /^move:rockslide:spreadFoes:REMOVE-TAG$/,
    make: src => plant(src,
      /const SPREAD = \(TAGS\.off[\s\S]{0,200}?HITS_ALLY\]\);/,
      "const SPREAD = SPREAD_LEGACY;",
      'SPREAD derived set'),
    mustBe: 'READ-AND-IGNORED',
  },
];

function runGate() {
  console.log('\n  THE GATE — the harness must catch a PLANTED STUB before any green from it is believed.\n');
  let failures = 0;
  const rows = [];
  for (const st of STUBS) {
    const shipped = sweepTag(SHIPPED_SRC, st.tag, { perKind: 1 });
    const stubSrc = st.make(SHIPPED_SRC);
    const stubbed = sweepTag(stubSrc, st.tag, { perKind: 1 });
    const findOp = r => r.operators.find(o => st.op.test(o.key));
    const a = findOp(shipped), b = findOp(stubbed);
    const okShipped = a && a.verdict === 'LIVE';
    const okStub = b && b.verdict === st.mustBe;
    const ok = okShipped && okStub;
    if (!ok) failures++;
    rows.push({ stub: st.name, operator: (a && a.key) || (b && b.key) || '(operator not emitted)', shipped: a ? a.verdict : 'MISSING', stubbed: b ? b.verdict : 'MISSING', expectedStub: st.mustBe, caught: ok });
    console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} ${st.name}`);
    console.log(`           operator  ${(a && a.key) || (b && b.key) || '(none emitted)'}`);
    console.log(`           shipped engine -> ${a ? a.verdict : 'MISSING'}   (must be LIVE)`);
    console.log(`           stubbed engine -> ${b ? b.verdict : 'MISSING'}   (must be ${st.mustBe})`);
  }
  return { failures, rows };
}

/* ---- the default sweep list --------------------------------------------------------------------
 * NOT all 177. A working harness over a chosen dozen beats a half-working one over everything, and
 * the cost of the full run is measured and reported rather than guessed. The dozen span the shapes
 * the traps are about: two module-load SETS, two damage-layer params, three state-layer tags, a
 * duration param (the WIRE 71 tag itself), a presence-only param, and a residual. */
const DEFAULT_TAGS = ['spreadFoes', 'spreadAll', 'speedMult', 'stabBoost', 'setsWeather',
  'extendsDuration', 'passiveHeal', 'hazard', 'partialTrap', 'preventsSwitch',
  'statusImmune', 'punishesAttacker'];

function main() {
  const argv = process.argv.slice(2);
  const arg = k => { const a = argv.find(x => x.startsWith(k + '=')); return a ? a.slice(k.length + 1) : null; };
  const gateOnly = argv.includes('--gate-only');
  const noWrite = argv.includes('--no-write');
  const tagArg = arg('--tags');
  const perKind = +(arg('--per-kind') || 2);

  const t0 = Date.now();
  const gate = runGate();
  if (gate.failures) {
    console.log('\n  THE GATE FAILED. The sweep is NOT run and no artifact is written.');
    console.log('  A harness that cannot catch a stub it planted itself cannot be trusted about one it did not.\n');
    process.exit(1);
  }
  const gateMs = Date.now() - t0;
  console.log(`\n  gate passed in ${(gateMs / 1000).toFixed(1)}s — both planted stubs caught.\n`);
  if (gateOnly) return;

  const tags = tagArg ? tagArg.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_TAGS;
  console.log(`  THE SWEEP — ${tags.length} tags, ${RNGS.length} rngs per case, ${TURNS}-turn scripts.\n`);
  const t1 = Date.now();
  const rows = [];
  for (const tag of tags) {
    const r = sweepTag(SHIPPED_SRC, tag, { perKind });
    rows.push(r);
    const ops = r.operators || [];
    const ri = ops.filter(o => o.verdict === 'READ-AND-IGNORED');
    const dc = ri.filter(o => o.class === 'DEFECT-CANDIDATE');
    console.log(`  ${String(r.verdict).padEnd(17)} ${tag.padEnd(20)} ${String(ops.length).padStart(2)} operators, ` +
      `${ops.filter(o => o.verdict === 'LIVE').length} live, ${ri.length} read-and-ignored` +
      (dc.length ? `  <-- ${dc.length} DEFECT-CANDIDATE` : '') +
      (r.verdict === 'UNSTAGEABLE' ? `   (asked=${r.asked})` : ''));
    for (const o of ri) console.log(`        ${(o.class || 'TAG-LEVEL').padEnd(17)} ${o.key}`);
  }
  const sweepMs = Date.now() - t1;

  /* ---- the artifact + the ratchet -------------------------------------------------------------- */
  const allOps = rows.flatMap(r => (r.operators || []).map(o => ({ ...o, tag: r.tag })));
  const summary = {
    tagsSwept: rows.length,
    operators: allOps.length,
    live: allOps.filter(o => o.verdict === 'LIVE').length,
    readAndIgnored: allOps.filter(o => o.verdict === 'READ-AND-IGNORED').length,
    defectCandidates: allOps.filter(o => o.class === 'DEFECT-CANDIDATE').length,
    presenceOnly: allOps.filter(o => o.class === 'PRESENCE-ONLY').length,
    unstageableTags: rows.filter(r => r.verdict === 'UNSTAGEABLE').map(r => r.tag),
    streamShiftSuspect: allOps.filter(o => o.note).length,
    nestedParamsSkipped: rows.reduce((s, r) => s + (r.nestedParamsSkipped || 0), 0),
    nullParamsSkipped: rows.reduce((s, r) => s + (r.nullParamsSkipped || 0), 0),
    unstageableCases: rows.reduce((s, r) => s + (r.cases || []).filter(c => c.inert).length, 0),
    threwUnderMutation: allOps.filter(o => o.threw).length,
    inertCases: rows.reduce((s, r) => s + (r.cases || []).filter(c => c.inert).length, 0),
    liveCases: rows.reduce((s, r) => s + (r.cases || []).filter(c => !c.inert).length, 0),
  };

  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const regressions = [];
  if (prev && prev.operators) {
    const was = new Map(prev.operators.map(o => [o.key, o.verdict]));
    for (const o of allOps) {
      const w = was.get(o.key);
      if (w === 'LIVE' && o.verdict !== 'LIVE') regressions.push({ key: o.key, was: w, now: o.verdict });
    }
  }

  const artifact = {
    generated: new Date().toISOString(),
    by: 'tests/mutation_harness.js',
    design: 'Layer 2 of docs/ENGINE-COVERAGE-PLAN.md. Change the FACT, watch the BEHAVIOUR. A handler that fires and ignores its payload reads LIVE everywhere else in this repo; here it reads READ-AND-IGNORED.',
    gate: { rows: gate.rows, ms: gateMs, note: 'The sweep refuses to run unless both planted stubs are caught. A harness that has never caught a planted stub is not evidence.' },
    battery: { rngs: RNGS.map(r => ({ name: r.name, stream: r.stream })), turns: TURNS, teamA: TEAM_A, teamB: TEAM_B },
    cannotSee: [
      'a fact derived WRONG upstream — propagated faithfully, consumed faithfully, scores LIVE. Layer 4 (test-engine-diff, test-game-diff, the interaction matrix) owns it.',
      'a mechanic no scenario here stages — reported as UNSTAGEABLE, which is the ABSENCE of a result and is never folded into the pass.',
      'a param whose value is an object or an array of objects — counted as nestedParamsSkipped, never silently.',
    ],
    cost: { gate_ms: gateMs, sweep_ms: sweepMs, ms_per_tag: Math.round(sweepMs / Math.max(1, rows.length)), peak_rss_mb: Math.round(process.memoryUsage().rss / 1048576) },
    summary,
    ratchet: {
      rule: 'An operator that was LIVE may never come back anything else. That is the only direction that means a handler stopped reading its fact.',
      regressions,
    },
    tags: rows,
    operators: allOps.map(o => ({ key: o.key, tag: o.tag, family: o.family, verdict: o.verdict, class: o.class, changed: o.changed, same: o.same, note: o.note })),
  };

  console.log('\n  ' + summary.operators + ' operators over ' + summary.tagsSwept + ' tags: '
    + summary.live + ' LIVE, ' + summary.readAndIgnored + ' READ-AND-IGNORED ('
    + summary.defectCandidates + ' defect candidates, ' + summary.presenceOnly + ' presence-only)');
  console.log('  ' + summary.liveCases + ' staged cases expressed the mechanic, ' + summary.inertCases
    + ' were INERT and scored nothing;  ' + summary.nestedParamsSkipped + ' nested params not perturbed;  '
    + summary.streamShiftSuspect + ' stream-shift-suspect');
  console.log('  cost: gate ' + (gateMs / 1000).toFixed(1) + 's, sweep ' + (sweepMs / 1000).toFixed(1)
    + 's (' + artifact.cost.ms_per_tag + ' ms/tag), peak rss ' + artifact.cost.peak_rss_mb + ' MB');

  if (regressions.length) {
    console.log('\n  RATCHET BROKEN — an operator that used to move the engine no longer does:');
    for (const r of regressions) console.log('    ' + r.key + '   ' + r.was + ' -> ' + r.now);
  }
  if (!noWrite) { fs.writeFileSync(OUT, JSON.stringify(artifact, null, 2)); console.log('\n  wrote ' + path.relative(D('.'), OUT)); }
  console.log('');
  if (regressions.length) process.exit(1);
}

if (require.main === module) main();
module.exports = { sweepTag, loadEngine, runGate, DEFAULT_TAGS };
