/* stage_planner.js — A FIXTURE FOR EVERY MECHANIC, CONSTRUCTED RATHER THAN FOUND.
 *
 *   node engine/stage_planner.js                       plan everything, print the coverage
 *   node engine/stage_planner.js --only ability:hospitality,item:damprock --show
 *   node engine/stage_planner.js --json <path>         write the whole plan to <path> (scratch only)
 *   STAGE_PLANNER_BREAK=<mode> node engine/stage_planner.js   a deliberately broken planner (see BREAKS)
 *
 * Will, 2026-09-11: "devise more sophisticated staging so all mechanics are thoroughly tested."
 *
 * WHY. `engine/all_mechanics_fire.js` stages every mechanic against HAND-PICKED DEFAULTS, and each
 * default hides a family (docs/_reports/2026-09-11-plan-never-fired.md, -plan-boards.md): the receiver
 * is always Feraligatr, the ally always clicks Protect, the dice are pinned, nobody clicks the setter,
 * every body is genderless, megas are dropped from the species list, stones are excused. This module
 * inverts the order: it reads what each mechanic REQUIRES off the authority's own handlers and the tag
 * params, and then BUILDS a legal board that supplies exactly that — and a control that removes
 * exactly one thing.
 *
 * PLAYS NO GAMES. It reads the format, the tags and the handler sources, and asks Showdown's
 * `TeamValidator` about every team it emits. Validating is not playing.
 *
 * THE INVARIANTS, BUILT IN RATHER THAN ADVISED (each is asserted by tests/test-stage-planner.js and was
 * shown red on a deliberately broken planner first — see BREAKS at the bottom):
 *   1. COULD-NOT-STAGE IS A CLAIM ABOUT THE FIXTURE. Nothing is searched for and dropped: a mechanic
 *      gets a fixture or a machine-readable refusal, and a PLANNER gap is labelled as the planner's,
 *      never as the format's.
 *   2. A FIXTURE IS MASKED FOR ZERO REASONS AND A CONTROL IS INERT FOR EXACTLY ONE. `masksFor` counts
 *      the independent reasons a click cannot connect (type chart, an absorbing ability, powder into
 *      Grass, Prankster into Dark, a status the body cannot take, a shield, a roll the arm fails). The
 *      fixture must count 0; the control must fail exactly one condition, counted over the SAME list.
 *   3. A CONTROL DIFFERS FROM ITS FIXTURE IN EXACTLY ONE LEAF. The trigger move and the control move
 *      are both in the moveset, so a click swap changes one script leaf and nothing else.
 *   4. A TAG NAMED FOR TWO HALVES GETS A FIXTURE PER HALF. The halves are read off the tag's PARAMS.
 *   5. SIDE SELECTION IS A CLASS OF BUG. Every fixture is also emitted mirrored (far side), and at slot
 *      b wherever the handler reads adjacency, allies or position.
 *   6. MATCH ON SHAPE. No mechanic name appears in a decision below; ids appear only in comments.
 *   7. SCOPE IS IMPORTED. Which mechanics exist in the regulation is engine/legal_scope.js's answer; this
 *      file decides only how to stage them (tests/test-stage-planner.js clause oneScope).
 *
 * NO POKEMON VALUE IS TYPED HERE. Speeds come from the Champions mod's own `statModify`, called with the
 * declared spread; crit tiers from `critMult` read out of `sim/battle-actions.ts`; accuracy multipliers
 * from each handler's own `chainModify`; the legal population from the format filter CLAUDE.md
 * mandates. The Champions mod is read first because `Dex.forFormat` IS the mod dex; every entity also
 * records whether the mod overrides mainline (`modOverride`). */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
require('./showdown_path.js');
const CS = require('./champions_sim.js');
const PRE = require('./fixture_preflight.js');
const LS = require('./legal_scope.js');

const ROOT = path.join(__dirname, '..');
const SDP = process.env.SHOWDOWN_PATH;
const { Dex, Teams, TeamValidator } = CS.sim();
const FORMAT = CS.FORMAT;
const D = Dex.forFormat(FORMAT);
const ML = Dex;                                   /* mainline gen 9, only to say what the mod overrides */
const FILTER = "x.exists && !x.isNonstandard && x.tier !== 'Illegal'";
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const uniq = a => [...new Set(a)];

/* ================= INPUTS, PHOTOGRAPHED ============================================================ */
/* THE TAGS ARE READ AT HEAD, NOT OFF THE DISK. Another agent may be rewriting data/tags.json while this
 * runs, and a torn read is a plausible, well-formed, fictitious answer (CLAUDE.md). A disk read is
 * available with --tags-live and is recorded as such. */
function loadTags(opt) {
  if (opt && opt.tagsPath) {
    const t = fs.readFileSync(opt.tagsPath, 'utf8');
    return { json: JSON.parse(t), source: 'file:' + opt.tagsPath, digest: sha(t) };
  }
  if (!(opt && opt.tagsLive)) {
    try {
      const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
      const t = cp.execFileSync('git', ['show', 'HEAD:data/tags.json'], { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
      return { json: JSON.parse(t), source: 'git:' + head.slice(0, 12) + ':data/tags.json', digest: sha(t) };
    } catch (e) {
      console.error('  stage_planner: git show HEAD:data/tags.json FAILED (' + String(e.message).split('\n')[0]
        + ') — FALLING BACK TO THE WORKING TREE, and the plan records that it did.');
    }
  }
  const p = path.join(ROOT, 'data', 'tags.json');
  const t = fs.readFileSync(p, 'utf8');
  return { json: JSON.parse(t), source: 'working-tree:data/tags.json', digest: sha(t) };
}

/* The authority's own sources, read once, for citations (critMult, the hit check, the ARM ids). */
const SRC = {};
function srcOf(rel) {
  if (SRC[rel]) return SRC[rel];
  const p = rel.startsWith('engine/') ? path.join(ROOT, rel) : path.join(SDP, rel);
  SRC[rel] = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  return SRC[rel];
}
function cite(rel, re) {
  const L = srcOf(rel);
  for (let i = 0; i < L.length; i++) if (re.test(L[i])) return { at: rel + ':' + (i + 1), text: L[i].trim() };
  return null;
}
/* THE CRIT TABLE, READ — `critMult = [0, 24, 8, 2, 1]` today; a hit crits at a corner only where the
 * pinned draw clears it. Refuses loudly if the line cannot be found: a guessed table is a typed fact. */
/* THE FILE HOLDS ONE TABLE PER GENERATION BRACKET (`gen <= 5`, `gen === 6`, else) and the first one
 * found is the gen-5 table — the first draft read it and planned crit tiers against the wrong game.
 * Gen 9 is the FINAL `else`, so the last assignment in the block is taken, and all are printed. */
function critTable() {
  const L = srcOf('sim/battle-actions.ts');
  const hits = [];
  for (let i = 0; i < L.length; i++) if (/critMult\s*=\s*\[/.test(L[i])) hits.push({ at: 'sim/battle-actions.ts:' + (i + 1), text: L[i].trim() });
  if (!hits.length) throw new Error('stage_planner: critMult not found in sim/battle-actions.ts — refusing to guess it');
  const c = hits[hits.length - 1];
  return { table: c.text.match(/\[([^\]]*)\]/)[1].split(',').map(x => +x.trim()), cite: c.at, allBranches: hits.map(h => h.at + ' ' + h.text) };
}
/* THE ARM IDS, READ OUT OF THE DRIVER rather than typed, so a renamed arm fails here by name. */
function armIds() {
  const L = srcOf('engine/game_differential.js');
  const ids = [];
  for (const l of L) { const m = /makeArm\(\{\s*id:\s*'([a-z-]+)'/.exec(l); if (m) ids.push(m[1]); }
  if (!ids.length) throw new Error('stage_planner: no makeArm({ id }) found in engine/game_differential.js');
  return ids;
}
/* What each corner does to a draw, stated against the driver's own `what:` text (engine/game_differential.js
 * makeArm): the bottom corner's `random(d)` is 0 — every `randomChance(n,d)` with n>0 SUCCEEDS, every
 * sub-100 move hits, every crit lands, every secondary fires; the top corner's is d-1 — a chance
 * succeeds only when n >= d, a move hits only at modified accuracy >= 100, a crit only at critMult 1. */
const BOTTOM = 'bottom-tie-first', TOP = 'top-tie-first', MIDDLE = 'middle';

/* ================= THE POPULATION ================================================================== */
let U = null;                                    /* the universe, built once per process */
function universe(opt) {
  if (U && !(opt && opt.fresh)) return U;
  const tags = loadTags(opt || {});
  const T = tags.json;
  const ROSTER = D.species.all().filter(legal);                       /* incl. megas and battle formes */
  /* A SHEET CAN NAME ONLY A BODY THAT IS NOT BATTLE-ONLY. A mega or a battle forme reaches the field
   * by changing forme in play; the planner carries the base on the sheet and the forme as `field`. */
  const SHEET = ROSTER.filter(s => !s.battleOnly && !s.isMega && s.num > 0);
  const POOL = new Map();
  const POOL_FAILS = [];
  for (const s of SHEET) {
    try { POOL.set(s.id, D.species.getMovePool(s.id)); } catch (e) { POOL_FAILS.push(s.id + ': ' + e.message); }
  }
  const learners = new Map();                                         /* move id -> sheet species ids */
  for (const [sid, p] of POOL) for (const m of p) { if (!learners.has(m)) learners.set(m, []); learners.get(m).push(sid); }
  const MOVES = D.moves.all().filter(m => m.exists && !m.isNonstandard);
  const ABILITIES = D.abilities.all().filter(a => a.exists && !a.isNonstandard);
  const ITEMS = D.items.all().filter(i => i.exists && !i.isNonstandard);
  /* ability -> every way a sheet can put it on the field */
  const bearers = new Map();
  for (const s of ROSTER) for (const [slot, a] of Object.entries(s.abilities || {})) {
    const k = id(a);
    if (!bearers.has(k)) bearers.set(k, []);
    if (!s.battleOnly && !s.isMega) bearers.get(k).push({ sheet: s.name, field: s.name, via: 'slot', slot });
    else if (s.isMega) {
      const base = D.species.get(s.battleOnly || s.baseSpecies), stone = D.items.get(s.requiredItem || '');
      if (legal(base) && legal(stone)) bearers.get(k).push({ sheet: base.name, field: s.name, via: 'mega', stone: stone.name });
    } else {
      const base = D.species.get(s.battleOnly);
      if (legal(base)) bearers.get(k).push({ sheet: base.name, field: s.name, via: 'battle-forme' });
    }
  }
  U = { tags, T, ROSTER, SHEET, POOL, POOL_FAILS, learners, MOVES, ABILITIES, ITEMS, bearers,
        scope: LS.derive(),
        crit: critTable(), arms: armIds(),
        hitCheck: cite('sim/battle-actions.ts', /randomChance\(\s*accuracy\s*,\s*100\s*\)/),
        genderPin: cite('engine/game_differential.js', /gender:\s*'N',\s*level:\s*50/) || cite('engine/game_differential.js', /\?\s*p\.gender\s*:\s*'N'/),
        genderSeam: cite('engine/game_differential.js', /opts\.declaredGender\s*&&/),
        knobs: knobMap() };
  return U;
}

/* CONFERRAL IS engine/legal_scope.js's (2026-09-11). This file scanned `setAbility("<literal>")` itself, a
 * second derivation of a scope fact; legal_scope reads every ability-writing method out of the compiled sim
 * (skillSwap, formeChange and transformInto as well) and asks the validator about the source's learner.
 * A CONFERRED verdict carries its sources, and `stageConferred` stages the first move source it can. */

/* THE KNOB MAP — which `MEDI_*` switch in medicham2 sits beside a lookup of which tag. Derived by
 * proximity (the knob line and a TAGS lookup within 25 lines), so every entry is a CANDIDATE plant and
 * is labelled so: it must be shown to part a board before it is trusted. The file is READ, never
 * required, so a mid-edit engine cannot crash the planner. */
function knobMap() {
  let L;
  try { L = srcOf('engine/medicham2-browser.js'); } catch (e) { return { byTag: new Map(), count: 0, error: e.message }; }
  const byTag = new Map();
  const lookup = /TAGS\.(?:param|has)\(\s*'(?:move|item|ability)'\s*,[^;]{0,120}?,\s*'([A-Za-z]+)'\s*\)|TAGS\.withTag\(\s*'(?:move|item|ability)'\s*,\s*'([A-Za-z]+)'/g;
  const knobs = new Set();
  for (let i = 0; i < L.length; i++) {
    for (const k of L[i].matchAll(/process\.env\.(MEDI_[A-Z0-9_]+)/g)) {
      knobs.add(k[1]);
      for (let j = Math.max(0, i - 25); j < Math.min(L.length, i + 25); j++)
        for (const m of L[j].matchAll(lookup)) {
          const t = m[1] || m[2];
          if (!byTag.has(t)) byTag.set(t, new Set());
          byTag.get(t).add(k[1]);
        }
    }
  }
  return { byTag, count: knobs.size };
}

/* ================= HANDLERS, READ ================================================================== */
/* Every function reachable on an entry: its own `on*` and callbacks, its `condition`, its secondaries
 * and its `self`. The source is the COMPILED dist/sim, where TypeScript writes double quotes. */
function handlersOf(e) {
  const out = [];
  const walk = (o, pre, depth) => {
    if (!o || typeof o !== 'object' || depth > 2) return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'function') out.push({ name: pre + k, src: String(v) });
      else if (v && typeof v === 'object' && /^(condition|secondary|secondaries|self|\d+)$/.test(k)) walk(v, pre + k + '.', depth + 1);
    }
  };
  walk(e, '', 0);
  return out;
}
const FIELDS = ['basePower', 'accuracy', 'priority', 'category', 'type', 'target', 'secondary', 'secondaries',
  'flags', 'critRatio', 'multihit', 'drain', 'recoil', 'status', 'volatileStatus', 'boosts', 'weather',
  'terrain', 'sideCondition', 'pseudoWeather', 'selfSwitch', 'forceSwitch', 'ohko', 'isBerry', 'fling'];
/* WHAT THE CHAMPIONS MOD CHANGED, per entity — handlers whose source differs from mainline, fields whose
 * value differs, or 'champions-only' when mainline has no such entry. */
function modOverride(kind, eid) {
  const a = D[kind].get(eid), b = ML[kind].get(eid);
  if (!b || !b.exists) return ['champions-only'];
  const diff = [];
  const ha = new Map(handlersOf(a).map(h => [h.name, h.src])), hb = new Map(handlersOf(b).map(h => [h.name, h.src]));
  for (const k of uniq([...ha.keys(), ...hb.keys()])) if (ha.get(k) !== hb.get(k)) diff.push('handler:' + k);
  for (const f of FIELDS) if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) diff.push('field:' + f);
  if (kind === 'moves' && a.pp !== b.pp) diff.push('field:pp');
  return diff;
}
function splitHandler(name) {
  const m = /^(?:condition\.)?on(Ally|Foe|Source|Any)?([A-Z][A-Za-z]*)$/.exec(name);
  return m ? { prefix: m[1] || '', base: m[2].toLowerCase() } : null;
}

/* ================= WHAT THE MECHANIC WRITES, AND SO WHERE THE ROW MUST LOOK ======================== */
/* A leaf per state-mutating call in the handler. A handler that only calls `this.add(...)` writes
 * nothing a board comparator can see — it is observable on the PROTOCOL only, and the plan says so
 * rather than pretending a board will show it. Speed and priority handlers change ORDER, which is a
 * protocol observable unless something ordered differently changes a leaf. */
const LEAF_RULES = [
  [/this\.boost\(|\.boostBy\(|clearBoosts\(|setBoost\(/, 'boosts'],
  [/setStatus\(|trySetStatus\(|cureStatus\(/, 'status'],
  [/this\.heal\(|this\.damage\(|\.sethp\(|directDamage\(/, 'hp'],
  [/setWeather\(|clearWeather\(/, 'field.weather'],
  [/setTerrain\(|clearTerrain\(/, 'field.terrain'],
  [/addPseudoWeather\(|removePseudoWeather\(/, 'field.pseudoWeather'],
  [/addSideCondition\(|removeSideCondition\(/, 'side.conditions'],
  [/addVolatile\(|removeVolatile\(/, 'volatiles'],
  [/setItem\(|takeItem\(|useItem\(|eatItem\(/, 'item'],
  [/setAbility\(/, 'ability'],
  [/formeChange\(|setSpecies\(|transformInto\(/, 'species'],
  [/deductPP\(|\.pp\s*-=|\.pp\s*=/, 'pp'],
  [/setType\(|addType\(/, 'types'],
  [/forceSwitch|dragIn\(|switchFlag/, 'active'],
];
const DAMAGE_EVENTS = /^(basepower|modifyatk|modifyspa|modifydamage|sourcemodifydamage|modifydef|modifyspd|modifystab|effectiveness|weathermodifydamage|sourcebasepower|anybasepower|damage|modifycritratio|criticalhit)$/;
const ORDER_EVENTS = /^(modifyspe|modifypriority|fractionalpriority)$/;
const ACC_EVENTS = /^(modifyaccuracy|sourcemodifyaccuracy|accuracy|anyaccuracy|anyinvulnerability)$/;
function observeOf(kind, e) {
  const H = handlersOf(e);
  const leaves = new Set();
  const channels = new Set();
  for (const h of H) {
    for (const [re, leaf] of LEAF_RULES) if (re.test(h.src)) leaves.add(leaf);
    const sh = splitHandler(h.name);
    if (sh && DAMAGE_EVENTS.test(sh.base) && /chainModify|return\s+[\w.]*\s*[*+-]|return\s+\d/.test(h.src)) leaves.add('hp');
    if (sh && ORDER_EVENTS.test(sh.base)) channels.add('protocol-order');
    if (sh && ACC_EVENTS.test(sh.base)) leaves.add('hp');
    if (/this\.add\(/.test(h.src)) channels.add('protocol-line');
  }
  if (kind === 'moves') {
    if (e.category !== 'Status') leaves.add('hp');
    if (e.status || (e.secondaries || []).some(s => s && s.status)) leaves.add('status');
    if (e.boosts || (e.secondaries || []).some(s => s && (s.boosts || (s.self && s.self.boosts))) || (e.self && e.self.boosts)) leaves.add('boosts');
    if (e.volatileStatus || (e.secondaries || []).some(s => s && s.volatileStatus)) leaves.add('volatiles');
    if (e.weather) leaves.add('field.weather');
    if (e.terrain) leaves.add('field.terrain');
    if (e.pseudoWeather) leaves.add('field.pseudoWeather');
    if (e.sideCondition || e.slotCondition) leaves.add('side.conditions');
    if (e.selfSwitch || e.forceSwitch) leaves.add('active');
    if (e.heal || e.drain) leaves.add('hp');
    if (e.priority) channels.add('protocol-order');
  }
  if (kind === 'items' && e.megaStone) leaves.add('species');
  const board = leaves.size > 0;
  return { leaves: [...leaves], channels: [...channels], boardObservable: board,
           channel: board ? 'board' : (channels.has('protocol-order') ? 'protocol-order' : 'protocol-line') };
}

/* ================= DICE ============================================================================ */
/* A CHAINED MULTIPLIER, read off the handler: `chainModify([4505, 4096])` -> 1.0999, `chainModify(0.5)`
 * -> 0.5. Null when the handler writes none (the planner then refuses the roll fixture by name). */
function chainMult(src) {
  const a = /chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/.exec(src);
  if (a) return +a[1] / +a[2];
  const b = /chainModify\(\s*([\d.]+)\s*\)/.exec(src);
  return b ? +b[1] : null;
}
/* Does the mechanic draw its own die, and on which branch is the effect? `randomChance(n, d)` succeeds
 * at the bottom corner whenever n > 0, so a mechanic whose effect is on the success branch is staged
 * there; one that works by moving a THRESHOLD (accuracy, crit tier, secondary chance) is invisible at
 * the bottom — everything already succeeds — and is staged at the top, where the threshold decides. */
function rollOf(e) {
  const src = handlersOf(e).map(h => h.src).join('\n');
  const own = [...src.matchAll(/randomChance\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)].map(m => ({ n: +m[1], d: +m[2] }));
  return { ownChance: own, gated: own.length > 0 || /this\.random\(/.test(src) };
}

/* ================= TRIGGERS, DERIVED ================================================================ */
/* Every trigger carries `source` — the function or tag it was read from — so a reader can follow it
 * back. PRE (engine/fixture_preflight.js) is the ONE implementation of move needs and board needs;
 * this module adds only the shapes PRE does not read, each by a pattern in the handler. */
function allSrc(e) { return handlersOf(e).map(h => h.name + ' ' + h.src).join('\n'); }
/* PRE reads `move.category`; the compiled source sometimes writes `move?.category`. The entity is
 * handed to PRE with each handler's source normalised — the function objects are the originals with a
 * `toString` that answers the normalised text, so PRE's own derivation runs unchanged. */
const NORMALISED = [];
const OVERMATCH = [];
const NE_CACHE = new Map();
function NE_OF(e) { if (!NE_CACHE.has(e.id + '|' + e.effectType)) NE_CACHE.set(e.id + '|' + e.effectType, normEntity(e)); return NE_CACHE.get(e.id + '|' + e.effectType); }
function normEntity(e) {
  const o = { exists: e.exists, id: e.id, name: e.name };
  for (const [k, v] of Object.entries(e)) {
    if (typeof v !== 'function') continue;
    const src = String(v).replace(/\?\./g, '.');
    const f = function () {}; f.toString = () => src; o[k] = f;
  }
  return o;
}
const ENTRY_ACTS = [
  [/\.heal\(/, 'ally-damaged'], [/clearBoosts\(/, 'ally-boosted'],
  [/removeSideCondition\(|sideConditions/, 'screens-up'], [/cureStatus\(/, 'ally-statused'],
];
function triggersOf(kind, e, Uv) {
  const out = [];
  const add = (t) => out.push(t);
  const H = handlersOf(e);
  const S = allSrc(e);
  const functional = H.filter(h => /^(condition\.)?on[A-Z]|Callback$/.test(h.name));
  /* A GENDER GATE ONE STEP AWAY: the volatile the handler adds may be the thing that reads gender. */
  for (const m of [...S.matchAll(/addVolatile\(\s*["']([a-z]+)["']/g)]) {
    const c = D.conditions.get(m[1]);
    if (c && c.exists && handlersOf(c).some(h => /\.gender\b/.test(h.src))) { add({ kind: 'capability', capability: 'gender', source: 'the volatile ' + m[1] + ' it adds reads .gender' }); break; }
  }
  if (kind === 'moves' && e.volatileStatus && handlersOf(D.conditions.get(e.volatileStatus)).some(h => /\.gender\b/.test(h.src)))
    add({ kind: 'capability', capability: 'gender', source: 'the volatile ' + e.volatileStatus + ' reads .gender' });
  if (kind === 'abilities' || kind === 'items') {
    const NE = normEntity(e);
    const mn = PRE.moveNeeds(NE);
    /* TWO OVER-MATCHES PRE CANNOT SEE, dropped and recorded:
     *   - a property the handler ASSIGNS (`move.multihit = 2`) is the mechanic writing it, not needing it;
     *   - a handler gated on `move.id === "<x>"` where <x> is not in the regulation is dead here. */
    mn.needs = mn.needs.filter(n => {
      const src = String(e[n.handler] || '');
      const prop = { multihit: 'multihit', drain: 'drain', recoil: 'recoil', secondary: 'secondaries', priority: 'priority' }[n.kind];
      if (prop && new RegExp('move\\.' + prop + '\\s*=[^=]').test(src)) { OVERMATCH.push(e.id + ': ' + n.kind + ' (the handler assigns move.' + prop + ')'); return false; }
      const gate = /move\.id\s*===\s*["']([a-z0-9]+)["']/.exec(src);
      if (gate && !legal(D.moves.get(gate[1]))) { OVERMATCH.push(e.id + ': ' + n.kind + ' (' + n.handler + ' is gated on ' + gate[1] + ', not in the regulation)'); return false; }
      return true;
    });
    const raw = PRE.moveNeeds(e).needs.length;
    if (mn.needs.length > raw) NORMALISED.push(e.id + ': +' + (mn.needs.length - raw) + ' need(s) once `?.` is read as `.`');
    /* CONTACT READ THROUGH THE AUTHORITY'S HELPER, which PRE's flag regex does not see */
    for (const h of H) { const sh = splitHandler(h.name); if (sh && !sh.prefix && sh.base === 'damaginghit' && /checkMoveMakesContact\(/.test(h.src)
      && !mn.needs.some(n => n.kind === 'flag' && n.values.includes('contact'))) mn.needs.push({ kind: 'flag', values: ['contact'], by: 'receiver', handler: h.name, damagingOnly: true }); }
    for (const n of mn.needs) add({ kind: 'click', by: n.by, need: { kind: n.kind, values: n.values || [], damagingOnly: !!n.damagingOnly },
                                    handler: n.handler, source: 'fixture_preflight.moveNeeds' });
    for (const u of mn.undetermined) {
      const m = /gated on effect "([^"]+)"/.exec(u.cue);
      if (m) add({ kind: 'adversary-effect', effect: m[1].split('/')[0], handler: u.handler, source: 'fixture_preflight.moveNeeds(undetermined)' });
    }
    /* A takeItem handler that RETURNS FALSE is a refusal (a stone that cannot be removed), not a
     * consumption; PRE's item-consumed reads the event name only. */
    const bn = PRE.boardNeeds(NE).filter(n => !(n.state === 'item-consumed' || n.kind === 'item-consumed')
      || !/takeitem/i.test(n.handler || '') || !/return\s+(false|!)/.test(String(e[n.handler] || '')));
    for (const n of bn) add(Object.assign({ kind: 'board', state: n.kind, values: n.values || [], source: 'fixture_preflight.boardNeeds' }, n, { kind: 'board' }));
    /* ENTRY — an `onStart`/`onSwitchIn` with no prefix fires as the holder arrives. When it ACTS on the
     * partner or the field, the thing it acts on must already be there, so the holder has to ENTER
     * after a setup turn rather than lead (the Hospitality shape: `adjacentAllies()` + `heal`). */
    for (const h of H) {
      const sh = splitHandler(h.name);
      if (!sh || sh.prefix || !/^(start|switchin)$/.test(sh.base)) continue;
      const onPartner = /adjacentAllies\(|\.allies\(|alliesAndSelf\(/.test(h.src);
      const acts = ENTRY_ACTS.filter(([re]) => re.test(h.src)).map(([, need]) => need)
        .filter(need => need !== 'screens-up' || /removeSideCondition|sideConditions/.test(h.src));
      const need = acts.find(n => n === 'screens-up') || (onPartner ? acts.find(n => n !== 'screens-up') : null);
      add({ kind: 'entry', handler: h.name, needsBeforeEntry: need || null, source: 'handler:' + h.name });
    }
    /* WEATHER AND TERRAIN the handler tests for. */
    const wx = uniq([...S.matchAll(/isWeather\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]))
      .concat([...S.matchAll(/effectiveWeather\(\)\s*===?\s*["']([a-z]+)["']/g)].map(m => m[1])));
    if (wx.length) add({ kind: 'weather', values: wx, source: 'handler:isWeather/effectiveWeather' });
    const tx = uniq([...S.matchAll(/isTerrain\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1])));
    if (tx.length) add({ kind: 'terrain', values: tx, source: 'handler:isTerrain' });
    if (/\.gender\b/.test(S)) add({ kind: 'capability', capability: 'gender', source: 'handler reads .gender' });
    /* A PARTNER OF A NAMED TYPE, or carrying a named ability. */
    const ty = uniq([...S.matchAll(/hasType\(\s*["']([A-Z][a-z]+)["']\s*\)/g)].map(m => m[1]));
    if (ty.length) add({ kind: 'body-type', values: ty, source: 'handler:hasType' });
    for (const h of H) {
      const m = /(?:ally|allyActive|allies\(\)[\s\S]{0,60}?)\.hasAbility\(\s*\[?([^)\]]*)\]?\s*\)/.exec(h.src);
      if (m) add({ kind: 'ally-ability', values: [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]), handler: h.name, source: 'handler:ally.hasAbility' });
    }
    /* SHAPES PRE DOES NOT READ, each by handler event. */
    for (const h of H) {
      const sh = splitHandler(h.name); if (!sh) continue;
      if (sh.base === 'dragout' && !sh.prefix) add({ kind: 'foe-forces-switch', handler: h.name, source: 'handler:onDragOut' });
      if (sh.base === 'modifyboost' && sh.prefix === 'Any') add({ kind: 'foe-boost-then-hit', handler: h.name, source: 'handler:onAnyModifyBoost' });
      if (/delete\s+move\.flags\[\s*["']contact["']\s*\]/.test(h.src)) add({ kind: 'target-punishes-contact', handler: h.name, source: 'handler deletes flags.contact' });
      if (sh.base === 'damage' && !sh.prefix && /effectType\s*!==\s*["']Move["']/.test(h.src)) add({ kind: 'indirect-damage', handler: h.name, source: 'handler:onDamage(effectType !== Move)' });
      if (sh.prefix === 'Ally' && /^(afteruseitem|eatitem|useitem|takeitem)$/.test(sh.base)) add({ kind: 'ally-item-consumed', handler: h.name, source: 'handler:' + h.name });
      if (sh.prefix === 'Ally' && /^(setstatus|tryaddvolatile|tryboost)$/.test(sh.base)) add({ kind: 'ally-guard', base: sh.base, handler: h.name, source: 'handler:' + h.name });
      if (ORDER_EVENTS.test(sh.base) && !sh.prefix && sh.base !== 'modifyspe') add({ kind: 'carrier-slower', handler: h.name, source: 'handler:' + h.name + ' — priority is visible only to a body that would otherwise move later' });
      if (sh.base === 'modifyspe' && !sh.prefix && !PRE.boardNeeds(NE_OF(e)).some(n => n.kind === 'speed-order')) { const mm = chainMult(h.src); if (mm && mm !== 1) add({ kind: 'speed-mult', multiplier: mm, handler: h.name, source: 'handler:onModifySpe chainModify ' + mm }); }
      if (/tryhit/.test(sh.base) && /isAlly\(\s*source\s*\)/.test(h.src) && /category\s*[!=]==\s*["']Status["']/.test(h.src)) add({ kind: 'ally-hits-holder', handler: h.name, source: 'handler:onTryHit isAlly(source)' });
      if (sh.base === 'anymodifydamage' || (sh.prefix === 'Any' && sh.base === 'modifydamage')) add({ kind: 'ally-hit', handler: h.name, source: 'handler:' + h.name });
      if (sh.base === 'residual' && /adjacentAllies\(|\.allies\(/.test(h.src) && /cureStatus\(/.test(h.src)) add({ kind: 'ally-statused', handler: h.name, source: 'handler:onResidual cures ally' });
      if (sh.base === 'allyfaint' || (sh.prefix === 'Ally' && sh.base === 'faint')) add({ kind: 'ally-faints', handler: h.name, source: 'handler:' + h.name });
    }
    /* THE MECHANIC'S EFFECT IS READ BY SOMEBODY ELSE. `abilityState.<x> = true` with the reading done
     * in other entities' handlers (the pinch-berry shape). When every reader is illegal, no legal board
     * can show it. */
    for (const m of uniq([...S.matchAll(/abilityState\.([a-z]+)\s*=/g)].map(x => x[1])).map(k => [null, k])) {
      /* A READER READS: an assignment (`abilityState.x = ...`) is a write and reads nothing. */
      const reads = x => new RegExp('abilityState\\.' + m[1] + '\\b(?!\\s*=[^=])').test(allSrc(x));
      const readers = Uv.ITEMS.concat(Uv.ABILITIES).filter(x => x.id !== e.id && reads(x));
      const all = D.items.all().concat(D.abilities.all()).filter(x => x.id !== e.id && x.exists && reads(x));
      add({ kind: 'read-by-others', state: 'abilityState.' + m[1], legalReaders: readers.map(x => x.id),
            illegalReaders: all.filter(x => !legal(x)).map(x => x.id), source: 'abilityState write' });
    }
    /* NO FUNCTIONAL HANDLER — the effect lives in somebody else's code (the rocks, Light Clay). */
    if (!functional.length || kind === 'items') {
      const rb = PRE.readByOthers(e.id, kind === 'items' ? 'item' : 'ability');
      if (rb.length) add({ kind: 'read-elsewhere', sites: rb.slice(0, 6).map(r => ({ at: r.file + ':' + r.line, fn: r.fn, durations: r.durations })),
                           durationExtension: rb.some(r => r.durations && r.durations.length), source: 'fixture_preflight.readByOthers' });
    }
    /* WHOSE STATUS. PRE.statusesRead says a status is read, not on whom — and Merciless reads the
     * TARGET's (`["psn","tox"].includes(target.status)` inside an attacker-role event), which the first
     * draft turned into "poison the holder", on a Poison-type holder. The variable is resolved against
     * the event's role (PRE.EVENT_ROLE): in an attacker event the holder is source/pokemon and the foe is
     * target; in a defender event the reverse. */
    /* RESOLVED BY POSITION, NOT BY NAME. Handler authors name parameters freely — Merciless writes
     * `onModifyCritRatio(critRatio, source, target)` — but the simulator calls every handler as
     * (relay?, eventTarget, eventSource, effect), and an unprefixed handler runs with the HOLDER as the
     * event target. So after the relay value, parameter 1 is the holder and parameter 2 the other body. */
    const sts = new Set(), foeSts = new Set();
    const bodyish = /^(pokemon|target|source|attacker|defender|user|foe|ally|mon)$/;
    for (const h of H) {
      const sh = splitHandler(h.name); if (!sh || sh.prefix) continue;
      const params = ((/^[^(]*\(([^)]*)\)/.exec(h.src) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);
      const off = params.length && bodyish.test(params[0]) ? 0 : 1;
      const foeV = params[off + 1] || null;
      const put = (v, s) => (v && v === foeV ? foeSts : sts).add(s);
      const foeVar = new RegExp('^' + (foeV || '$^') + '$');
      for (const m of h.src.matchAll(/(\w+)\.status\s*===\s*["'](brn|par|psn|tox|slp|frz)["']/g)) put(m[1], m[2]);
      for (const m of h.src.matchAll(/\[([^\]]*)\]\.includes\(\s*(\w+)\.status\s*\)/g)) for (const s of m[1].matchAll(/["'](brn|par|psn|tox|slp|frz)["']/g)) put(m[2], s[1]);
      if (/^(setstatus|trysetstatus|immunity)$/.test(sh.base)) for (const m of h.src.matchAll(/["'](brn|par|psn|tox|slp|frz)["']/g)) sts.add(m[1]);
      for (const m of h.src.matchAll(/(\w+)\.status\b(?!\s*===)(?!\s*\))/g)) if (!/^(move|effect|this)$/.test(m[1]) && !sts.size && !foeSts.size && /^(pokemon|source|target)$/.test(m[1]) && !foeVar.test(m[1])) sts.add('any');
    }
    if (sts.size && !out.some(t => t.kind === 'ally-guard')) add({ kind: 'holder-statused', values: [...sts], source: 'status reads on the holder, resolved by event role' });
    if (foeSts.size) add({ kind: 'foe-statused', values: [...foeSts], source: 'status reads on the foe, resolved by event role' });
    /* A TYPE IMMUNITY THE HANDLER SWITCHES OFF (`move.ignoreImmunity["Normal"] = true`). */
    const byp = uniq([...S.matchAll(/ignoreImmunity\[\s*["']([A-Za-z]+)["']\s*\]\s*=\s*true/g)].map(m => m[1]));
    if (byp.length) add({ kind: 'bypass-immunity', values: byp, source: 'handler writes move.ignoreImmunity' });
    /* A BASE-POWER CEILING the holder's own move must sit under. */
    for (const h of H) { const sh = splitHandler(h.name); const m = /basePower\s*<=\s*(\d+)/.exec(h.src); if (sh && sh.base === 'basepower' && !sh.prefix && m) add({ kind: 'click-bp', max: +m[1], handler: h.name, source: 'handler:onBasePower basePower <= ' + m[1] }); }
    if (kind === 'items' && e.megaStone) add({ kind: 'mega', into: e.megaStone, source: 'item.megaStone' });
    if (kind === 'items' && e.isBerry) add({ kind: 'berry', source: 'item.isBerry' });
  }
  if (kind === 'moves') {
    const tg = (Uv.T.moves[e.id] || { tags: [], params: {} });
    const has = t => tg.tags.includes(t);
    add({ kind: 'click-self', target: e.target, source: 'move.target' });
    if (has('healsSelf') || has('drain') || e.heal) add({ kind: 'user-damaged', source: 'tag:healsSelf/drain' });
    if (has('healsAlly')) add({ kind: 'ally-damaged', source: 'tag:healsAlly' });
    if (has('removesItem') || has('takesTargetItem') || has('readsTargetItem') || has('forcesBerryEat'))
      add({ kind: 'target-holds-item', berry: !!((tg.params.removesItem || {}).requiresItemClass || []).includes('isBerry') || has('forcesBerryEat'), source: 'tag:removesItem/takesTargetItem/readsTargetItem' });
    if (has('needsTargetToAttack') || has('failsIfTargetNotAttacking')) add({ kind: 'target-attacks', source: 'tag:needsTargetToAttack' });
    if (has('failsIfTargetMoveNotPriority')) add({ kind: 'target-attacks', priority: true, source: 'tag:failsIfTargetMoveNotPriority' });
    if (has('punishesBoostedTarget')) add({ kind: 'target-boosted', source: 'tag:punishesBoostedTarget' });
    if (has('thawsTarget')) add({ kind: 'target-statused', status: 'frz', source: 'tag:thawsTarget' });
    if (has('hazard')) add({ kind: 'foe-switches-after', source: 'tag:hazard' });
    const w = (tg.params.weatherScaled || tg.params.failsWithoutWeather || tg.params.chargeSkippedByWeather || {});
    const wv = w.weather || w.weathers || w.in || null;
    if (has('failsWithoutWeather') || has('chargeSkippedByWeather') || has('weatherScaled'))
      add({ kind: 'weather', values: [].concat(wv || []).map(id).filter(Boolean), anyOf: !wv, source: 'tag:weatherScaled/failsWithoutWeather/chargeSkippedByWeather' });
    if (has('failsWithoutTerrain') || has('terrainScaled')) {
      const t = (tg.params.failsWithoutTerrain || tg.params.terrainScaled || {});
      add({ kind: 'terrain', values: [].concat(t.terrain || []).map(id).filter(Boolean), anyOf: !t.terrain, source: 'tag:failsWithoutTerrain/terrainScaled' });
    }
    if (has('chargeTurn') && !has('chargeSkippedByWeather')) add({ kind: 'two-turn', source: 'tag:chargeTurn' });
    if (has('delayedHit')) add({ kind: 'delayed', turns: 2, source: 'tag:delayedHit' });
    if (has('locksTarget') || has('sealsMoves')) add({ kind: 'target-moved-before', source: 'tag:locksTarget/sealsMoves' });
  }
  return out;
}

/* ================= BODIES AND MASKS ================================================================ */
function spOf(name) { return D.species.get(name); }
function typesOf(b) { return spOf(b.field || b.species).types; }
/* The declared spread. 0 SP under a neutral nature that is not `Serious` (the validator objects to a
 * 0-SP Serious body by name). Speeds are the authority's arithmetic on THIS spread; the driver's own
 * `spreadFor` ladder is a different spread and the integration must pass this one through — see the
 * report's seam list. */
const SPREAD = Object.freeze({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const NATURE = 'Hardy';
function speedOf(b) {
  const sp = spOf(b.field || b.species);
  const ctx = { trunc: D.trunc.bind(D), ruleTable: Dex.formats.getRuleTable(Dex.formats.get(FORMAT)), dex: D };
  return D.data.Scripts.statModify.call(ctx, sp.baseStats, { evs: b.evs || SPREAD, level: 50, nature: b.nature || NATURE }, 'spe');
}
function tagsOf(kind, eid) { const r = U.T[kind][id(eid)]; return r ? r : { tags: [], params: {} }; }
/* HOW LOUD A NON-SUBJECT ABILITY IS. A pad or receiver should carry the quietest legal ability its
 * species has: tags a consumer reads, plus any entry/residual handler that writes state. */
function abilityNoise(abName) {
  const a = D.abilities.get(abName);
  const t = tagsOf('abilities', a.id).tags.filter(x => x !== 'breakable');
  const loud = handlersOf(a).filter(h => { const s = splitHandler(h.name); return s && !s.prefix && /^(start|switchin|residual|update)$/.test(s.base) && LEAF_RULES.some(([re]) => re.test(h.src)); }).length;
  return t.length + loud;
}
function quietAbility(species, avoid) {
  const sp = spOf(species);
  const opts = uniq(Object.values(sp.abilities || {})).filter(a => !(avoid || []).includes(id(a)) && abilityAccepted(sp.name, a));
  opts.sort((x, y) => abilityNoise(x) - abilityNoise(y) || (x < y ? -1 : 1));
  return opts[0] || null;
}
/* THE INDEPENDENT REASONS A CLICK CANNOT CONNECT, counted over the target's typing, ability and click
 * and over the arm. `except` names the reasons that ARE the mechanic under test (a Scrappy fixture's
 * Normal-into-Ghost is the trigger, not a mask). A fixture must count zero. */
function masksFor(move, user, target, ctx) {
  const mv = typeof move === 'string' ? D.moves.get(move) : move;
  const r = [];
  if (!mv || !mv.exists) return ['no such move'];
  const ex = new Set((ctx && ctx.except) || []);
  /* THE CARRIER'S OWN ABILITY IS THE MECHANIC, not a mask — but only while the target still carries
   * it. A control that swapped in an absorbing ability must have that counted, so the exception is
   * keyed on the ability, not on the role. */
  if (ex.has('ability') && ctx && ctx.selfAbility && id(target.ability) !== ctx.selfAbility) ex.delete('ability');
  const tt = typesOf(target);
  const self = mv.target === 'self' || mv.target === 'allySide' || mv.target === 'allyTeam' || mv.target === 'all' || mv.target === 'foeSide';
  if (!self) {
    if (mv.ignoreImmunity !== true && !D.getImmunity(mv.type, tt) && !ex.has('type')) r.push('type-immunity: ' + mv.type + ' into ' + tt.join('/'));
    if (mv.flags && mv.flags.powder && tt.includes('Grass') && !ex.has('powder')) r.push('powder into Grass');
    if (ctx && ctx.prankster && mv.category === 'Status' && ctx.foe && tt.includes('Dark') && !ex.has('prankster')) r.push('Prankster status into Dark');
    const at = tagsOf('abilities', target.ability);
    const p = at.params || {};
    if (!ex.has('ability')) {
      if (p.typeImmunity && id(p.typeImmunity.type) === id(mv.type) && mv.category !== 'Status') r.push('ability ' + target.ability + ' is immune to ' + mv.type);
      if (p.immuneToMoveClass && mv.flags && mv.flags[p.immuneToMoveClass.blocksFlag]) r.push('ability ' + target.ability + ' blocks ' + p.immuneToMoveClass.blocksFlag);
      if (p.refusesStatusMoves && mv.category === 'Status') r.push('ability ' + target.ability + ' refuses status moves');
      if (p.blocksMove && p.blocksMove.what === 'priority' && ((mv.priority || 0) > 0 || (ctx && ctx.prankster && mv.category === 'Status'))) r.push('ability ' + target.ability + ' blocks priority');
      if (p.redirectsType && id(p.redirectsType.type) === id(mv.type)) r.push('ability ' + target.ability + ' absorbs ' + mv.type);
    }
    const st = PRE.statusOf(mv);
    if (st && !ex.has('status')) {
      const why = statusImmunity(spOf(target.field || target.species), st, ex.has('ability') ? '' : id(target.ability));
      if (why && (mv.category === 'Status' || (mv.secondary && mv.secondary.status && ctx && ctx.statusIsTrigger))) r.push('status: ' + why);
      if (ctx && ctx.targetStatused) r.push('target already statused');
    }
    if (ctx && ctx.targetGuards && !ex.has('guard')) r.push('target clicks ' + ctx.targetGuards);
  }
  if (typeof mv.accuracy === 'number' && mv.accuracy < 100 && ctx && ctx.arm === TOP && !ex.has('accuracy') && !sureHit(mv, user)) r.push('accuracy ' + mv.accuracy + ' misses at the top corner');
  return r;
}
/* STATUS IMMUNITY, asked of the authority's type chart (`getImmunity(status, types)` — the chart
 * carries par/brn/psn/tox/frz rows) and of the ability's own refusal handlers. */
function statusImmunity(sp, status, abilityId) {
  if (!D.getImmunity(status, sp.types)) return sp.types.join('/') + ' is immune to ' + status + ' by the type chart';
  if (abilityId) {
    const a = D.abilities.get(abilityId);
    const src = handlersOf(a).filter(h => /on(Set|TrySet)Status|onImmunity|onUpdate/.test(h.name)).map(h => h.src).join(' ');
    if (new RegExp('["\']' + status + '["\']').test(src) || (/onSetStatus/.test(handlersOf(a).map(h => h.name).join(' ')) && /return\s+false/.test(src) && !/["'](brn|par|psn|tox|slp|frz)["']/.test(src)))
      return 'its ability ' + a.name + ' refuses ' + status;
  }
  return null;
}
/* A PAD ONLY CLICKS PROTECT AND IS NEVER AIMED AT, so its ability is loud only if it fires on its own:
 * on entry, at residual or update, or through an Any/Foe/Ally handler that reaches other bodies. */
function padNoise(abName) {
  const a = D.abilities.get(abName);
  return handlersOf(a).filter(h => { const s = splitHandler(h.name); return s && (/^(Any|Foe|Ally)$/.test(s.prefix) || /^(start|switchin|residual|update|end|switchout|faint)$/.test(s.base)); }).length
    + (weatherish().includes(a.id) ? 5 : 0);
}
/* HOW MUCH AN ALTERNATIVE ABILITY WRITES ON ITS OWN on this board: entry, residual and field-wide
 * handlers that change a leaf (an announcement is not a write); a switch-out handler only if the
 * carrier switches out here. */
function stateNoise(a, rc) {
  return handlersOf(a).filter(h => {
    const s = splitHandler(h.name); if (!s) return false;
    const writes = LEAF_RULES.some(([re]) => re.test(h.src)) || /chainModify|return\s+\d/.test(h.src);
    if (!s.prefix && /^(start|switchin|residual|update|end)$/.test(s.base)) return writes;
    if (!s.prefix && s.base === 'switchout') return writes && rc.turns.some(t => t.C && t.C.sw);
    if (/^(Any|Foe|Ally)$/.test(s.prefix)) return writes;
    return false;
  }).length;
}
/* THE VALIDATOR'S EXISTENCE VERDICT on a species/ability pair, asked once. A slot can name a forme the
 * format does not have (a `S` slot that resolves to a battle-only forme); a pad or receiver must never
 * be handed one. Pairing complaints are not existence complaints and do not refuse. */
const ACCEPT = new Map();
function abilityAccepted(species, ability) {
  const k = id(species) + '|' + id(ability);
  if (!ACCEPT.has(k)) { const r = CS.checkLegal({ species, ability }); ACCEPT.set(k, !(r.banned && r.banned.length) && !r.unavailable); }
  return ACCEPT.get(k);
}
function learns(species, move) { const p = U.POOL.get(spOf(species).id) || U.POOL.get(id(spOf(species).baseSpecies)); return !!p && p.has(id(move)); }
const GUARD_MOVES = () => uniq(Object.entries(U.T.moves).filter(([, e]) => e.tags.includes('shieldsUser') || e.tags.includes('stalling')).map(([k]) => k));

/* ================= THE RECIPE ======================================================================
 *
 * A fixture is written in ROLES, not slots, so the same recipe renders to every side and slot:
 *   C  the carrier (holds the mechanic)          CA its partner          LP a lead that hands C the
 *   R  the receiver / adversary                  RA R's partner          slot when C must ENTER
 *   CB, RB1, RB2  bench bodies                   pads fill each sheet to the six the validator demands
 * A turn is `{ C: click, CA: click, R: click, RA: click, LP: click }`; a click is
 * `{ m, at }` (at = the ROLE aimed at), `{ sw: role }`, or `{ m, mega: true }`. `render` maps roles to
 * `p1`/`p2` and slots `a`/`b`, and aims to the driver's `t` / `ally` fields. */
class PlanError extends Error { constructor(code, reason, extra) { super(code + ': ' + reason); this.code = code; this.reason = reason; this.extra = extra || {}; } }
const refuse = (code, reason, extra) => { throw new PlanError(code, reason, extra); };

function newRecipe(mech) {
  return { mech, bodies: {}, lineup: { p1: ['C', 'CA', 'CB', null], p2: ['R', 'RA', 'RB1', 'RB2'] },
           turns: [], arm: BOTTOM, hpPool: 'x6', readAfter: null, observe: null, notes: [],
           assumptions: [], conditions: [], triggerClicks: [], used: new Set(), items: { p1: new Set(), p2: new Set() },
           guards: GUARD_MOVES(), live: new Set() };
}
function useSpecies(rc, name) {
  const k = id(spOf(name).baseSpecies || name);
  if (rc.used.has(k)) return false;
  rc.used.add(k); return true;
}
/* A body. Moves are added by the stagers and trimmed to the four a sheet allows at render time. */
function setBody(rc, role, b) {
  const sp = spOf(b.species);
  if (!legal(sp) || sp.battleOnly || sp.isMega) refuse('PLANNER-CANNOT-CONSTRUCT', 'role ' + role + ' was handed a non-sheet species ' + b.species);
  rc.bodies[role] = Object.assign({ item: '', moves: [], nature: NATURE, evs: Object.assign({}, SPREAD), gender: '' }, b,
                                  { species: sp.name, field: b.field || sp.name });
  return rc.bodies[role];
}
function addMove(rc, role, m) {
  const b = rc.bodies[role]; const mv = D.moves.get(m);
  if (!b.moves.includes(mv.name)) b.moves.push(mv.name);
  if (b.moves.length > 4) refuse('PLANNER-CANNOT-CONSTRUCT', 'role ' + role + ' needs more than four moves: ' + b.moves.join(', '));
  return mv.name;
}
function sideOfRole(rc, role) { return rc.lineup.p1.includes(role) || role === 'LP' ? 'p1' : 'p2'; }
function setItem(rc, role, item) {
  const s = sideOfRole(rc, role);
  const it = D.items.get(item);
  if (rc.items[s].has(it.id)) refuse('PLANNER-CANNOT-CONSTRUCT', 'item clause: ' + it.name + ' is already on ' + s);
  rc.items[s].add(it.id);
  rc.bodies[role].item = it.name;
}

/* THE ORDER BODIES ARE TRIED IN. The harness's receiver first (so a row that works today keeps its
 * body), then the sheet species by id. Deterministic, and a search over the format, not a shortlist. */
function speciesOrder(prefer) {
  const all = U.SHEET.map(s => s.id).sort();
  const head = (prefer || []).map(id).filter(x => all.includes(x));
  return uniq(head.concat(all));
}
const RECEIVER_FIRST = ['feraligatr'];
/* A move a body can learn, ranked so the least noisy one wins: sure accuracy, no secondary, no charge
 * or recharge, no self-switch, no recoil, a middling power. Returns ids. */
/* Tags that say a move does nothing beyond hitting (or being a status click). Any OTHER tag is a side
 * effect — a screen broken, an item taken, a type changed — and costs the move its place. */
/* `contact` is not benign: it is the trigger of every contact reactor (Rough Skin, Pickpocket, Static…),
 * so an ordinary hit prefers not to make it — costed lightly below, required outright where a need asks. */
const BENIGN = new Set(['pp', 'targetClass', 'formatSecondaryCount', 'moveClass', 'noProtectFlag', 'callRefusalFlags',
  'statusCategory', 'sound', 'volatileRestart', 'neverMisses', 'spreadFoes', 'spreadAll', 'noExtraHit', 'punishesMinimize']);
function rankMoves(ids) {
  const cost = m => {
    const d = D.moves.get(m); let c = 0;
    const tg = (U.T.moves[d.id] || { tags: [] }).tags;
    c += 6 * tg.filter(t => !BENIGN.has(t) && t !== 'contact').length + (tg.includes('contact') ? 2 : 0);
    if (d.basePowerCallback || d.damageCallback || d.damage) c += 6;
    if (d.accuracy !== true && d.accuracy < 100) c += 4;
    if (d.secondary || (d.secondaries || []).length) c += 3;
    if (d.flags && (d.flags.charge || d.flags.recharge)) c += 8;
    if (d.selfSwitch || d.forceSwitch || d.selfdestruct) c += 8;
    if (d.recoil || d.drain || d.multihit || d.self) c += 2;
    if ((d.priority || 0) !== 0) c += 2;
    if (d.target !== 'normal' && d.target !== 'self') c += 1;
    if (d.basePower > 120) c += 1;
    return c;
  };
  return ids.slice().sort((a, b) => cost(a) - cost(b) || (a < b ? -1 : 1));
}
/* FIND A BODY FOR A ROLE. `pred(moveObj)` says which moves qualify; `ok(body, move)` returns a list of
 * masks and the candidate is taken only at zero. Returns { species, ability, move } or null. */
function findBody(rc, { pred, ok, prefer, avoidAbilities, typeReq, speedReq, ability }) {
  for (const sid of speciesOrder(prefer)) {
    const sp = D.species.get(sid);
    if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
    if (typeReq && !typeReq.some(t => sp.types.includes(t))) continue;
    const ab = ability ? (Object.values(sp.abilities).map(id).includes(id(ability)) ? D.abilities.get(ability).name : null)
                       : quietAbility(sp.name, avoidAbilities);
    if (!ab) continue;
    const body = { species: sp.name, field: sp.name, ability: ab };
    if (speedReq && !speedReq(speedOf(body))) continue;
    const pool = U.POOL.get(sp.id); if (!pool) continue;
    const cands = pred ? rankMoves([...pool].filter(m => { const d = D.moves.get(m); return legal(d) && pred(d); })) : [null];
    for (const m of cands) {
      const masks = ok ? ok(body, m) : [];
      if (!masks.length) return { species: sp.name, ability: ab, move: m };
    }
  }
  return null;
}
function padFor(rc, role, moves) {
  for (const sid of speciesOrder()) {
    const sp = D.species.get(sid);
    if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
    if (!(moves || ['protect']).every(m => learns(sp.name, m))) continue;
    const ab = uniq(Object.values(sp.abilities || {})).filter(a => abilityAccepted(sp.name, a)).sort((x, y) => padNoise(x) - padNoise(y) || abilityNoise(x) - abilityNoise(y) || (x < y ? -1 : 1))[0];
    if (!ab || padNoise(ab) > 0) continue;
    useSpecies(rc, sp.name);
    setBody(rc, role, { species: sp.name, ability: ab });
    for (const m of (moves || ['protect'])) addMove(rc, role, m);
    return rc.bodies[role];
  }
  refuse('PLANNER-CANNOT-CONSTRUCT', 'no quiet pad left for ' + role);
}
/* The click a body makes when it must act and must not move the measured leaf. A guard on a body that
 * nothing aims at; the format's declared inert move (champions_sim.INERT_MOVE, which fails with no
 * consumed item) where a guard would block something the fixture needs to land. */
function inertFor(rc, role, opt) {
  const b = rc.bodies[role];
  const inert = id(CS.INERT_MOVE);
  if (!(opt && opt.noGuard) && learns(b.species, 'protect')) return { m: addMove(rc, role, 'protect') };
  if (learns(b.species, inert) && !(opt && opt.consumes)) return { m: addMove(rc, role, inert) };
  /* A SELF MOVE WHOSE OWN `onTry` FAILS FOR A HEALTHY BODY — read off the handler (it returns a test of
   * the user's status), so it cannot copy, call or change anything on a board where nobody sleeps. */
  const have = b.moves.map(id);
  const pool = [...(U.POOL.get(spOf(b.species).id) || [])].map(m => D.moves.get(m)).filter(d => legal(d) && d.category === 'Status'
    && d.target === 'self' && typeof d.onTry === 'function' && /return\s+[^;]*\.status\s*===/.test(String(d.onTry)))
    .sort((x, y) => (have.includes(y.id) - have.includes(x.id)) || (x.id < y.id ? -1 : 1));
  if (pool.length) { rc.notes.push(role + ' idles with ' + pool[0].name + ' (its onTry fails for a healthy body)'); return { m: addMove(rc, role, pool[0].id) }; }
  refuse('PLANNER-CANNOT-CONSTRUCT', role + ' (' + b.species + ') has no inert click');
}
/* A damaging move this body can aim at that target with zero masks. */
function hitFor(rc, role, atRole, opt) {
  const b = rc.bodies[role], t = rc.bodies[atRole];
  const pool = [...(U.POOL.get(spOf(b.species).id) || [])];
  const want = pool.filter(m => { const d = D.moves.get(m); return legal(d) && d.category !== 'Status' && d.target === 'normal'
    && (!opt || !opt.category || d.category === opt.category) && (!opt || !opt.pred || opt.pred(d)); });
  for (const m of rankMoves(want)) if (!masksFor(m, b, t, { arm: rc.arm, except: opt && opt.except }).length) return addMove(rc, role, m);
  return null;
}

/* ================= RENDERING, VALIDATING, COMPARING ================================================= */
function setOf(b) {
  return { name: b.species, species: b.species, item: b.item || '', ability: b.ability, moves: b.moves.slice(),
           nature: b.nature || NATURE, evs: Object.assign({}, b.evs || SPREAD),
           ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50, gender: b.gender || '' };
}
/* `layout.mirror` puts the carrier's side on p2; `layout.swapSlot` puts the carrier's lead slot at b.
 * Aims are recomputed from who occupies which slot AT THAT TURN, so a switch-in is aimed correctly. */
function render(rc, layout) {
  const L = layout || {};
  const lu = { p1: rc.lineup.p1.slice(), p2: rc.lineup.p2.slice() };
  if (L.swapSlot) { const t = lu.p1[0]; lu.p1[0] = lu.p1[1]; lu.p1[1] = t; }
  const nm = s => (L.mirror ? (s === 'p1' ? 'p2' : 'p1') : s);
  const teams = {}, roles = {};
  for (const s of ['p1', 'p2']) {
    const order = lu[s].concat(rc.pads[s]);
    teams[nm(s)] = order.map(r => setOf(rc.bodies[r]));
    order.forEach((r, i) => { roles[r] = { side: nm(s), index: i, field: rc.bodies[r].field, species: rc.bodies[r].species, ability: rc.bodies[r].ability }; });
  }
  const occ = { p1: [lu.p1[0], lu.p1[1]], p2: [lu.p2[0], lu.p2[1]] };
  const script = [], roleAt = [];
  for (const turn of rc.turns) {
    const step = {}, at = {};
    const swaps = [];
    for (const s of ['p1', 'p2']) {
      step[nm(s)] = [null, null];
      for (let i = 0; i < 2; i++) {
        const role = occ[s][i]; const c = turn[role];
        at[role] = { side: nm(s), slot: i };
        if (!c) refuse('PLANNER-CANNOT-CONSTRUCT', 'turn ' + (script.length + 1) + ' leaves ' + role + ' without a click');
        if (c.sw) { step[nm(s)][i] = { sw: id(rc.bodies[c.sw].species) }; swaps.push([s, i, c.sw]); continue; }
        const e = { m: id(c.m) };
        if (c.mega) e.mega = true;
        if (c.at) {
          const os = s === 'p1' ? 'p2' : 'p1';
          if (occ[os].includes(c.at)) e.t = occ[os].indexOf(c.at);
          else if (occ[s].includes(c.at) && c.at !== role) e.ally = true;
          else refuse('PLANNER-CANNOT-CONSTRUCT', role + ' aims at ' + c.at + ', who is not on the field at turn ' + (script.length + 1));
        }
        step[nm(s)][i] = e;
      }
    }
    for (const [s, i, r] of swaps) occ[s][i] = r;
    script.push(step); roleAt.push(at);
  }
  return { teams, script, roles, roleAt, arm: rc.arm, hpPool: rc.hpPool, readAfter: rc.readAfter,
           layout: (L.mirror ? 'far' : 'near') + '-' + (L.swapSlot ? 'b' : 'a') };
}
let VALIDATOR = null;
const VCACHE = new Map();
const VSTATS = { calls: 0, cached: 0 };
function validateTeam(team) {
  const k = JSON.stringify(team);
  if (VCACHE.has(k)) { VSTATS.cached++; return VCACHE.get(k); }
  if (!VALIDATOR) VALIDATOR = new TeamValidator(FORMAT);
  VSTATS.calls++;
  let probs;
  try { probs = VALIDATOR.validateTeam(Teams.unpack(Teams.pack(team))) || []; }
  catch (e) { probs = ['VALIDATOR THREW: ' + e.message]; }         /* never read as legal */
  VCACHE.set(k, probs);
  return probs;
}
function flatten(o, pre, out) {
  if (o === null || typeof o !== 'object') { out[pre] = o; return out; }
  for (const k of Object.keys(o)) flatten(o[k], pre ? pre + '.' + k : k, out);
  if (!Object.keys(o).length) out[pre] = Array.isArray(o) ? '[]' : '{}';
  return out;
}
/* THE LEAVES TWO RENDERED BOARDS DIFFER IN — teams, script, arm and pool; never the bookkeeping. */
function diffLeaves(a, b) {
  const pick = r => ({ teams: r.teams, script: r.script, arm: r.arm, hpPool: r.hpPool });
  const fa = flatten(pick(a), '', {}), fb = flatten(pick(b), '', {});
  /* A CLICK IS ONE DECISION — its move and its aim are one variable, so every leaf under one
   * script slot collapses to that slot. Everything else is counted leaf by leaf. */
  const unit = k => { const m = /^(script\.\d+\.p[12]\.\d)\b/.exec(k); return m ? m[1] : k; };
  return uniq(uniq(Object.keys(fa).concat(Object.keys(fb))).filter(k => fa[k] !== fb[k]).map(unit));
}
/* A CONDITION OF THE TRIGGER, evaluated on a RENDERED board so the test can re-derive it without
 * trusting the planner's own bookkeeping. */
function holds(cond, r) {
  if (cond.kind === 'field') {
    const p = r.roles[cond.role]; if (!p) return false;
    return id(r.teams[p.side][p.index][cond.field]) === id(cond.value);
  }
  const at = (r.roleAt[cond.turn - 1] || {})[cond.role];
  if (!at) return false;
  const e = r.script[cond.turn - 1][at.side][at.slot] || {};
  if (cond.kind === 'click' && cond.sw) return !!r.roles[cond.sw] && e.sw === id(r.roles[cond.sw].species);
  if (cond.kind === 'click') return id(e.m) === id(cond.move);
  if (cond.kind === 'mega') return !!e.mega;
  return false;
}
/* THE MASKS OF A RENDERED BOARD, re-derived from its bodies: every trigger click, aimed at its target. */
function renderedMasks(tc, r, rc) {
  const out = [];
  for (const c of tc) {
    if (!c.at) continue;                                   /* a field or self click has no target to be masked */
    const u = r.roles[c.role], t = r.roles[c.at];
    if (!u || !t) { out.push('trigger role missing'); continue; }
    const at = (r.roleAt[c.turn - 1] || {})[c.role];
    const e = at ? r.script[c.turn - 1][at.side][at.slot] || {} : {};
    if (id(e.m) !== id(c.move)) continue;                  /* the click was swapped away: that is the variable, not a mask */
    const ub = { species: u.species, field: u.field, ability: r.teams[u.side][u.index].ability };
    const tb = { species: t.species, field: t.field, ability: r.teams[t.side][t.index].ability };
    const tgtClick = (r.roleAt[c.turn - 1] || {})[c.at];
    const tgtE = tgtClick ? r.script[c.turn - 1][tgtClick.side][tgtClick.slot] || {} : {};
    const guards = (rc && rc.guards) || GUARD_MOVES();
    const guard = c.at && c.at !== c.role && guards.includes(id(tgtE.m)) ? tgtE.m : null;
    const selfAbility = rc && rc.mech && rc.mech.kind === 'abilities' ? rc.mech.id : null;
    for (const m of masksFor(c.move, ub, tb, Object.assign({}, c.ctx || {}, { arm: r.arm, targetGuards: guard, selfAbility }))) out.push(c.role + '->' + (c.at || 'self') + ': ' + m);
  }
  return out;
}

/* ================= THE AUTHORITY'S ARITHMETIC ======================================================= */
/* `Battle#modify`, read and cited rather than restated: modifier = tr(num*4096/den), result =
 * tr((tr(value*modifier) + 2047) / 4096). The accuracy fixtures are chosen against THIS, so a move that
 * sits one point either side of 100 is judged by the rounding the authority actually does. */
function authModify(value, num, den) {
  if (!cite('sim/battle.ts', /^\s*modify\(value: number, numerator/)) refuse('PLANNER-CANNOT-CONSTRUCT', 'Battle#modify not found in sim/battle.ts');
  const tr = D.trunc.bind(D);
  const modifier = tr(num * 4096 / den);
  return tr((tr(value * modifier) + 2048 - 1) / 4096);
}
function multOf(src) {
  const a = /chainModify\(\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]\s*\)/.exec(src);
  if (a) return { num: +a[1], den: +a[2], m: +a[1] / +a[2] };
  const b = /chainModify\(\s*([\d.]+)\s*\)/.exec(src);
  return b ? { num: +b[1], den: 1, m: +b[1] } : null;
}
/* A move that puts `status` on its target: a status move, or — at the bottom corner, where every
 * secondary fires (the driver's own arm text) — a hit whose secondary carries it. Freeze has no
 * status move at all, so without the second door no fixture could ever freeze anything. */
function statusMoveFor(status, arm) {
  return d => (d.target === 'normal' || d.target === 'any' || d.target === 'adjacentFoe')
    && ((d.category === 'Status' && d.status === status)
        || ((arm || BOTTOM) === BOTTOM && d.category !== 'Status' && [].concat(d.secondaries || [], d.secondary ? [d.secondary] : []).some(s => s && s.status === status)));
}
const STATUS_IDS = ['brn', 'par', 'psn', 'tox', 'slp', 'frz'];
const sureHit = (d, user) => d.accuracy === true || d.accuracy >= 100
  || ((U.T.moves[d.id] || { tags: [] }).tags.includes('neverMissesFromUserType')
      && typesOf(user).includes((U.T.moves[d.id].params.neverMissesFromUserType || {}).userType));

/* ================= STAGING AN ABILITY OR AN ITEM ==================================================== */
/* One recipe from the triggers. Every branch below is keyed on a TRIGGER KIND that `triggersOf`
 * derived from the handler — never on the mechanic's name. */
/* TWO HANDLERS WHOSE MOVE NEEDS CANNOT BE ONE CLICK are two triggers, and each gets its own fixture:
 * disjoint `type` needs (one handler wants Water, the other Fire), or one handler a redirect and the
 * other a direct hit. Returns the handler list when they conflict, [null] when one click serves all. */
function clickGroups(trig) {
  const cl = trig.filter(t => t.kind === 'click');
  const hs = uniq(cl.map(t => t.handler));
  if (hs.length < 2) return [null];
  const types = h => cl.filter(t => t.handler === h && t.need.kind === 'type').flatMap(t => t.need.values);
  const redirect = h => /RedirectTarget/.test(h || '');
  for (const a of hs) for (const b of hs) if (a < b) {
    const ta = types(a), tb = types(b);
    if ((ta.length && tb.length && !ta.some(x => tb.includes(x))) || redirect(a) !== redirect(b)) return hs;
  }
  return [null];
}
function stageEntity(kind, e, trig, bearer, branch) {
  const isAb = kind === 'abilities';
  {
    const g = clickGroups(trig);
    const pickH = branch && branch.startsWith('handler:') ? branch.slice(8) : g[0];
    if (pickH) trig = trig.filter(t => t.kind !== 'click' || t.handler === pickH);
    /* an immunity bypass and an adversary effect are two triggers; the bypass is the main fixture */
    if (trig.some(t => t.kind === 'bypass-immunity') && trig.some(t => t.kind === 'adversary-effect'))
      trig = trig.filter(t => branch === 'adversary' ? t.kind !== 'bypass-immunity' : t.kind !== 'adversary-effect');
  }
  const rc = newRecipe({ kind, id: e.id, name: e.name });
  const T = k => trig.filter(t => t.kind === k);
  const board = s => trig.find(t => t.kind === 'board' && t.state === s);
  const exceptSelf = isAb ? ['ability'] : [];
  /* ---- THE CARRIER ---- */
  useSpecies(rc, bearer.sheet);
  setBody(rc, 'C', { species: bearer.sheet, field: bearer.field,
                     ability: isAb ? (bearer.via === 'slot' ? e.name : quietAbility(bearer.sheet)) : quietAbility(bearer.sheet, weatherish()) });
  if (isAb && bearer.via === 'mega') { setItem(rc, 'C', bearer.stone); rc.conditions.push({ kind: 'field', role: 'C', field: 'item', value: bearer.stone }); rc.megaRole = 'C'; }
  if (isAb && bearer.via === 'slot') rc.conditions.push({ kind: 'field', role: 'C', field: 'ability', value: e.name });
  if (isAb && bearer.via === 'battle-forme') rc.notes.push('the ability rides a battle forme (' + bearer.field + '); the sheet names ' + bearer.sheet);
  if (!isAb) { setItem(rc, 'C', e.name); rc.conditions.push({ kind: 'field', role: 'C', field: 'item', value: e.name }); }
  const setup = [], trigger = {};
  let entry = null;
  /* ---- A STONE: the base forme holds it and asks to evolve on turn 1 ---- */
  if (T('mega').length) {
    rc.megaRole = 'C';
    rc.observe = { role: 'C', leaf: 'species', channel: 'board' };
  }
  /* ---- A DURATION EXTENSION READ IN SOMEBODY ELSE'S durationCallback: the HOLDER must click the setter ---- */
  const dx = (tagsOf('items', e.id).params || {}).extendsDuration;
  if (!isAb && dx && T('read-elsewhere').some(t => t.durationExtension) && BRK !== 'no-setter') {
    /* a setter that itself needs a weather to succeed is not a setter on a clear board */
    const setters = dx.extends.map(n => D.moves.get(n)).filter(m => legal(m) && !(U.T.moves[m.id] || { tags: [] }).tags.includes('failsWithoutWeather'));
    const s = setters.find(m => learns(bearer.sheet, m.id));
    if (!s) refuse('NO-TRIGGER-SUPPLIER', 'the holder ' + bearer.sheet + ' learns none of the setters ' + setters.map(m => m.name).join('/'));
    rc.setterClick = { m: addMove(rc, 'C', s.id) };
    rc.conditions.push({ kind: 'click', role: 'C', turn: 1, move: s.id });
    rc.extraTurns = dx.insteadOf;                 /* play until the short clock has run out */
    rc.readAfter = dx.insteadOf;
    rc.observe = { role: s.sideCondition ? 'C' : 'field', leaf: s.sideCondition ? 'side.conditions' : 'field.weather', channel: 'board' };
    rc.notes.push('the short clock is ' + dx.insteadOf + ' and the item makes it ' + dx.toTurns
      + ' (tag extendsDuration, derived); the arms part at the boundary after turn ' + dx.insteadOf);
  }
  /* ---- ENTRY: an onStart/onSwitchIn that ACTS on something must find it there — the carrier enters late ---- */
  const en = T('entry').find(t => t.needsBeforeEntry);
  if (en) { entry = en.needsBeforeEntry; rc.lineup.p1 = ['LP', 'CA', 'C', null]; rc.live.add('CA'); }
  /* ---- WHO THE PARTNER IS ---- */
  const allyTrig = trig.filter(t => /^ally-/.test(t.kind) || (t.kind === 'click' && t.by === 'ally'));
  const bodyType = T('body-type')[0];
  const needCA = [];
  if (allyTrig.length || entry || bodyType) rc.live.add('CA');
  if (T('ally-ability').length) needCA.push({ values: T('ally-ability')[0].values });
  /* ---- THE RECEIVER'S REQUIREMENTS ---- */
  let reqR = [];                                 /* { key, pred(d, sp), at, turn } */
  for (const t of T('click').filter(t => t.by === 'receiver' || t.by === 'either')) {
    const redirect = /RedirectTarget/.test(t.handler || '');
    reqR.push({ key: 'need:' + t.need.kind, handler: t.handler, at: redirect ? 'CA' : 'C', turn: 'trigger',
                pred: (d, sp) => PRE.satisfiesNeed(d.id, t.need, { userTypes: sp.types, targetTypes: typesOf(rc.bodies.C) })
                  && (d.category !== 'Status' || d.target !== 'self'),
                except: redirect ? [] : exceptSelf, why: 'the handler ' + t.handler + ' needs ' + t.need.kind + '=' + t.need.values.join('/') });
    if (redirect) rc.live.add('CA');
  }
  const stTrig = T('holder-statused')[0];
  if (stTrig) {
    const want = stTrig.values.includes('any') || !stTrig.values.length ? STATUS_IDS : stTrig.values;
    reqR.push({ key: 'status', at: 'C', turn: 'setup', except: exceptSelf, statusIsTrigger: true,
                pred: (d) => want.some(s => statusMoveFor(s, rc.arm)(d)), why: 'the handler reads the holder\'s status (' + want.join('/') + ')' });
  }
  const ind = T('indirect-damage')[0];
  if (ind) reqR.push({ key: 'indirect', at: 'C', turn: 'setup', except: [], pred: d => ['brn', 'psn', 'tox'].some(s => statusMoveFor(s)(d)),
                       why: 'onDamage refuses non-move damage — a residual status chip supplies it' });
  const vp = board('volatile-present');
  if (vp) reqR.push({ key: 'volatile', at: 'C', turn: 'setup', except: [], pred: d => d.category === 'Status' && vp.values.includes(d.volatileStatus),
                      why: 'the handler cures one of ' + vp.values.join('/') });
  if (board('own-stat-dropped')) reqR.push({ key: 'drop', at: 'C', turn: 'setup', except: [],
    pred: d => PRE.satisfiesNeed(d.id, { kind: 'statDrop', values: [] }), why: 'the handler restores a dropped stat' });
  if (board('trapped')) reqR.push({ key: 'trap', at: 'C', turn: 'setup', except: [],
    pred: d => (U.T.moves[d.id] || { tags: [] }).tags.some(x => x === 'trapsTarget') && d.category === 'Status', why: 'the holder must be trapped' });
  if (T('foe-forces-switch').length) reqR.push({ key: 'phaze', at: 'C', turn: 'trigger', except: [], pred: d => !!d.forceSwitch, why: 'onDragOut needs a forced switch' });
  if (T('foe-boost-then-hit').length) {
    reqR.push({ key: 'boost', at: null, turn: 'setup', except: [], pred: d => d.category === 'Status' && d.target === 'self' && d.boosts && (d.boosts.atk > 0), why: 'the foe boosts first' });
    reqR.push({ key: 'hit-phys', at: 'C', turn: 'trigger', except: exceptSelf, pred: d => d.category === 'Physical' && d.target === 'normal', why: 'then hits the holder' });
  }
  const adv = T('adversary-effect')[0];
  const advAbility = adv && D.abilities.get(adv.effect).exists ? D.abilities.get(adv.effect).name : null;
  if (adv && !advAbility) reqR.push({ key: 'adv-move', at: 'C', turn: 'trigger', except: [], pred: d => id(d.name) === id(adv.effect), why: 'the adversary must carry ' + adv.effect });
  /* item consumed by the holder: a berry the RECEIVER can make it eat */
  let berry = null;
  if (board('item-consumed') || T('ally-item-consumed').length) {
    const holderRole = T('ally-item-consumed').length ? 'CA' : 'C';
    const events = handlersOf(e).map(h => (splitHandler(h.name) || {}).base);
    const cureBerries = U.ITEMS.filter(i => i.isBerry && (tagsOf('items', i.id).params.curesStatus || {}).statuses && tagsOf('items', i.id).params.curesStatus.statuses !== 'any');
    if (events.includes('sourcemodifydamage')) {
      berry = { kind: 'resist' };
    } else if (events.includes('tryheal')) {
      berry = { kind: 'heal', item: U.ITEMS.find(i => (tagsOf('items', i.id).params.healsAtThreshold || {}).restores) };
    } else {
      berry = { kind: 'cure', options: cureBerries.map(i => ({ item: i, status: tagsOf('items', i.id).params.curesStatus.statuses[0] })) };
    }
    berry.holder = holderRole;
    if (berry.kind === 'cure') reqR.push({ key: 'berry-status', at: holderRole, turn: 'setup', except: [],
      pred: d => berry.options.some(o => statusMoveFor(o.status)(d)), why: 'a status the berry on ' + holderRole + ' cures' });
    if (holderRole === 'CA') rc.live.add('CA');
  }
  const allyGuard = T('ally-guard')[0];
  const pa = (tagsOf('abilities', e.id).params || {}).protectsAllyFromStatus;
  if (allyGuard) {
    const at = branch === 'covers-self' ? 'C' : 'CA';
    const vols = pa && pa.volatiles && pa.volatiles.length ? pa.volatiles : null;
    const sts = pa && Array.isArray(pa.statuses) && pa.statuses.length ? pa.statuses : null;
    let pred;
    if (allyGuard.base === 'tryaddvolatile') pred = d => d.category === 'Status' && !!d.volatileStatus && (!vols || vols.includes(d.volatileStatus)) && d.target === 'normal';
    else if (allyGuard.base === 'setstatus') pred = d => (sts || STATUS_IDS).some(s => statusMoveFor(s)(d));
    else pred = d => PRE.satisfiesNeed(d.id, { kind: 'statDrop', values: [] }) && d.category === 'Status';
    reqR.push({ key: 'ally-guard', at, turn: 'trigger', except: at === 'C' ? exceptSelf : [], pred, why: 'the veil must be asked on ' + at + ' (' + allyGuard.handler + ')' });
    rc.live.add('CA');
  }
  /* A VEIL'S OWN HANDLER IS ONE TRIGGER, not two: the move need PRE reads off `onAllyTryBoost` and the
   * veil request for the same handler are the same click, aimed where the veil is asked. */
  if (allyGuard) reqR = reqR.filter(q => !(q.key.startsWith('need:') && q.handler === allyGuard.handler));
  if (T('ally-hit').length) reqR.push({ key: 'ally-hit', at: 'CA', turn: 'trigger', except: [], pred: d => d.category !== 'Status' && d.target === 'normal', why: 'the partner must take a hit' });
  if (T('ally-statused').length) reqR.push({ key: 'ally-status', at: 'CA', turn: 'setup', except: [], pred: d => STATUS_IDS.some(s => statusMoveFor(s)(d)), why: 'the partner must carry a status' });
  if (entry === 'ally-damaged') reqR.push({ key: 'entry-hurt', at: 'CA', turn: 'setup', except: [], pred: d => d.category !== 'Status' && d.target === 'normal', why: 'the partner must be damaged before the holder enters' });
  if (entry === 'ally-statused') reqR.push({ key: 'entry-status', at: 'CA', turn: 'setup', except: [], pred: d => STATUS_IDS.some(s => statusMoveFor(s)(d)), why: 'the partner must be statused before the holder enters' });
  if (entry === 'screens-up') reqR.push({ key: 'entry-screen', at: null, turn: 'setup', except: [], pred: d => !!d.sideCondition && !!d.condition && Object.keys(d.condition).some(k => /ModifyDamage/.test(k)), why: 'a screen must be up before the holder enters' });
  if (T('target-punishes-contact').length) rc.punisher = true;
  /* ---- ROLL-GATED: accuracy and crit, staged at the corner where the threshold decides ---- */
  const acc = board('accuracy-roll'), crit = board('crit-roll');
  let accPlan = null, critPlan = null;
  if (acc) {
    rc.arm = TOP;
    const h = handlersOf(e).find(x => ACC_EVENTS.test((splitHandler(x.name) || {}).base || ''));
    const sh = splitHandler(h.name);
    const holderAttacks = sh.prefix === 'Source' || sh.prefix === 'Any' || sh.base === 'sourcemodifyaccuracy';
    const always = /return\s+true/.test(h.src);
    const mm = multOf(h.src);
    if (!always && !mm) refuse('PLANNER-CANNOT-CONSTRUCT', 'accuracy handler ' + h.name + ' writes no readable multiplier');
    const hits = (A) => always || authModify(A, mm.num, mm.den) >= 100;
    accPlan = { holderAttacks, always, mult: mm && mm.m, gate: /willMove/.test(h.src) ? 'target-moved' : null,
                vol: (/volatiles\[\s*["']([a-z]+)["']\s*\]/.exec(h.src) || [])[1] || null };
    const good = (d) => d.category !== 'Status' && d.target === 'normal' && typeof d.accuracy === 'number'
      && (accPlan.always || accPlan.mult > 1 ? (d.accuracy < 100 && hits(d.accuracy)) : (d.accuracy === 100 && !hits(d.accuracy)));
    accPlan.good = good;
    rc.notes.push('top corner: the draw is 99, so a move lands only at modified accuracy >= 100 (' + (U.hitCheck ? U.hitCheck.at : 'hit check') + ', Battle#modify)');
    /* the multiplier's own plan replaces PRE's generic "a sub-100 move" cue, which is the wrong half for
     * a multiplier below 1: that one needs a move AT 100 that the multiplier pulls under it */
    reqR = reqR.filter(q => q.key !== 'need:subaccuracy');
    if (!holderAttacks) reqR.push({ key: 'acc', at: 'C', turn: 'trigger', except: exceptSelf, arm: TOP, pred: good, why: 'the holder is the target of a move the multiplier moves across 100' });
    if (accPlan.vol) reqR.push({ key: 'acc-vol', at: 'C', turn: 'setup', except: [], arm: TOP,
      pred: d => d.category === 'Status' && d.volatileStatus === accPlan.vol && (d.accuracy === true || d.accuracy >= 100), why: 'the multiplier is gated on ' + accPlan.vol + ' on the holder' });
  }
  if (crit) {
    rc.arm = TOP;
    const h = handlersOf(e).find(x => /modifycritratio/.test((splitHandler(x.name) || {}).base || ''));
    const add = /critRatio\s*\+\s*(\d+)/.exec(h.src), abs = /return\s+(\d+)/.exec(h.src);
    const i1 = U.crit.table.indexOf(1);
    const stTest = /\[([^\]]*)\]\.includes\(\s*target\.status\s*\)/.exec(h.src);
    critPlan = { add: add ? +add[1] : null, abs: abs ? +abs[1] : null, i1, targetStatus: stTest ? [...stTest[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]) : null };
    if (!critPlan.add && !critPlan.abs) refuse('PLANNER-CANNOT-CONSTRUCT', 'crit handler writes neither critRatio + k nor a literal ratio');
    rc.notes.push('top corner: a crit lands only where critMult is 1, i.e. ratio >= ' + i1 + ' (critMult read at ' + U.crit.cite + ')');
  }
  /* ---- WEATHER / TERRAIN the handler tests: the PARTNER sets it on turn 1 ---- */
  const wx = T('weather')[0], tx = T('terrain')[0];
  /* ---- SPEED: priority is visible only to a body that would otherwise move later ---- */
  const slower = T('carrier-slower').length > 0 || (accPlan && accPlan.gate === 'target-moved');
  const speedOrder = board('speed-order');

  /* ======== PICK THE RECEIVER ======== */
  /* EVERY TRIGGER-TURN REQUIREMENT AIMED AT ONE BODY IS ONE CLICK. A resist berry's `type` and
   * `supereffective` needs are two sentences about the same move. */
  {
    const merged = [];
    for (const q of reqR) {
      const same = merged.find(m => m.turn === 'trigger' && q.turn === 'trigger' && m.at === q.at && m.key.startsWith('need:') && q.key.startsWith('need:'));
      if (same) { const p1 = same.pred, p2 = q.pred; same.pred = (d, sp) => p1(d, sp) && p2(d, sp); same.why += ' AND ' + q.why; }
      else merged.push(Object.assign({}, q));
    }
    reqR = merged;
  }
  let rPick = null;
  const rOk = (body, sp) => {
    const moves = [];
    for (const q of reqR) {
      const pool = [...(U.POOL.get(sp.id) || [])].map(m => D.moves.get(m)).filter(d => legal(d) && q.pred(d, sp));
      const target = q.at ? (q.at === 'CA' ? null : rc.bodies[q.at]) : null;
      const m = rankMoves(pool.map(d => d.id)).find(mid => {
        const d = D.moves.get(mid);
        if (q.arm === TOP && !(d.accuracy === true || sureHit(d, body) || (accPlan && q.key === 'acc'))) return false;
        return !target || !masksFor(mid, body, target, { arm: rc.arm, except: q.except, statusIsTrigger: q.statusIsTrigger }).length;
      });
      if (!m) return null;
      moves.push({ q, m });
    }
    return moves;
  };
  /* the break inverts the window rather than dropping it: dropping it still picks the first, faster
   * receiver, and a break that cannot make the check go red demonstrates nothing */
  /* a Speed multiplier is visible only where it changes who moves first: the receiver sits between the
   * carrier's Speed and that Speed multiplied (either direction), computed by the authority's statModify */
  const smult = T('speed-mult')[0];
  const cS = () => speedOf(rc.bodies.C);
  const multWindow = smult ? (smult.multiplier > 1 ? (s) => s > cS() && s < cS() * smult.multiplier : (s) => s < cS() && s > cS() * smult.multiplier) : null;
  const rSpeed = slower ? (BRK === 'prankster-fast' ? (s) => s < speedOf(rc.bodies.C) : (s) => s > speedOf(rc.bodies.C)) : multWindow ? multWindow : speedOrder ? (s) => s > speedOf(rc.bodies.C) && s < speedOf(rc.bodies.C) * (speedOrder.multiplier || 2) : null;
  const wantAbility = advAbility || null;
  /* a contact punisher, read off the handler: it damages the attacker from `onDamagingHit` when the
   * authority's `checkMoveMakesContact` says so, and draws no die of its own */
  const punishers = rc.punisher ? U.ABILITIES.filter(a => handlersOf(a).some(h => h.name === 'onDamagingHit' && /checkMoveMakesContact\(/.test(h.src) && /this\.damage\(/.test(h.src))
    && !rollOf(a).gated).map(a => a.name) : null;
  const bypassT = T('bypass-immunity')[0];
  for (const sid of (BRK === 'feraligatr-only' ? RECEIVER_FIRST : speciesOrder(RECEIVER_FIRST))) {
    const sp = D.species.get(sid);
    if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
    /* the receiver must be immune BY THE TYPE CHART to a type the handler switches immunity off for */
    if (bypassT && !bypassT.values.some(t => !D.getImmunity(t, sp.types))) continue;
    const abOpts = wantAbility ? [wantAbility] : punishers ? punishers : [quietAbility(sp.name, [e.id])];
    for (const ab of abOpts) {
      if (!ab || !Object.values(sp.abilities).map(id).includes(id(ab))) continue;
      const body = { species: sp.name, field: sp.name, ability: ab };
      if (rSpeed && !rSpeed(speedOf(body))) continue;
      if (rc.punisher && !rc.bodies.C) continue;
      const moves = rOk(body, sp);
      if (!moves) continue;
      /* the receiver must also be able to hit the carrier when nothing else is asked of it */
      rPick = { body, moves };
      break;
    }
    if (rPick) break;
  }
  if (!rPick) refuse(reqR.length || wantAbility || punishers ? 'NO-TRIGGER-SUPPLIER' : 'PLANNER-CANNOT-CONSTRUCT',
    'no legal receiver supplies: ' + (reqR.map(q => q.why).join('; ') || (wantAbility ? 'the ability ' + wantAbility : 'a contact punisher') || 'a hittable body')
    + (rSpeed ? ' (with the speed window the order needs)' : ''));
  useSpecies(rc, rPick.body.species);
  setBody(rc, 'R', rPick.body);
  const rMoves = {};
  for (const { q, m } of rPick.moves) rMoves[q.key] = addMove(rc, 'R', m);

  /* ======== THE PARTNER ======== */
  const caReq = [];
  if (T('click').some(t => t.by === 'ally')) for (const t of T('click').filter(t => t.by === 'ally'))
    caReq.push({ key: 'need', at: 'R', pred: (d, sp) => PRE.satisfiesNeed(d.id, t.need, { userTypes: sp.types, targetTypes: typesOf(rc.bodies.R) }) });
  if (entry === 'ally-boosted') caReq.push({ key: 'boost', at: null, pred: d => d.category === 'Status' && d.target === 'self' && !!d.boosts });
  if (T('ally-hits-holder').length) caReq.push({ key: 'hit-holder', at: 'C', except: exceptSelf, pred: d => d.category !== 'Status' && (d.target === 'allAdjacent' || d.target === 'normal') });
  if (T('ally-faints').length) caReq.push({ key: 'faint', at: 'R', pred: d => ((U.T.moves[d.id] || { params: {} }).params.userFaints || {}).faints === 'always' });
  if (wx) caReq.push({ key: 'weather', at: null, pred: d => !!d.weather && (wx.anyOf || wx.values.some(v => id(D.conditions.get(d.weather).id).includes(v) || v.includes(id(D.conditions.get(d.weather).id).slice(0, 4)))) });
  if (tx) caReq.push({ key: 'terrain', at: null, pred: d => !!d.terrain && (tx.anyOf || tx.values.includes(id(d.terrain))) });
  if (rc.live.has('CA') || caReq.length || needCA.length) {
    rc.live.add('CA');
    let got = null;
    const typeReq = bodyType && (branch !== 'covers-self') ? bodyType.values : null;
    const wantAbs = needCA.length ? needCA[0].values : null;
    for (const sid of speciesOrder()) {
      const sp = D.species.get(sid);
      if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
      if (typeReq && !typeReq.some(t => sp.types.includes(t))) continue;
      const hit = wantAbs ? Object.values(sp.abilities).find(a => wantAbs.includes(id(a))) : null;
      const ab = wantAbs ? (hit || null) : quietAbility(sp.name, weatherish().concat([e.id]));
      if (!ab) continue;
      const body = { species: sp.name, field: sp.name, ability: ab };
      const pool = [...(U.POOL.get(sp.id) || [])];
      const picked = [];
      let fail = false;
      for (const q of caReq) {
        const tgt = q.at ? rc.bodies[q.at] : null;
        const m = rankMoves(pool.filter(x => { const d = D.moves.get(x); return legal(d) && q.pred(d, sp); }))
          .find(x => !tgt || !masksFor(x, body, tgt, { arm: rc.arm, except: q.except }).length);
        if (!m) { fail = true; break; }
        picked.push({ q, m });
      }
      if (fail) continue;
      /* the partner must be able to take what is aimed at it: status and volatile arrivals unmasked */
      const aimed = rPick.moves.filter(x => x.q.at === 'CA');
      if (aimed.some(x => masksFor(x.m, rPick.body, body, { arm: rc.arm, statusIsTrigger: true }).length)) continue;
      got = { body, picked };
      break;
    }
    if (!got) refuse(typeReq ? 'NEEDS-SECOND-BODY-TYPE' : 'NO-TRIGGER-SUPPLIER',
      'no legal partner' + (typeReq ? ' of type ' + typeReq.join('/') : '') + ' can do: ' + (caReq.map(q => q.key).join(', ') || 'stand live beside the holder'));
    useSpecies(rc, got.body.species);
    setBody(rc, 'CA', got.body);
    rc.caMoves = {};
    for (const { q, m } of got.picked) rc.caMoves[q.key] = addMove(rc, 'CA', m);
  }
  rc.rMoves = rMoves;
  return composeEntity(rc, { kind, e, trig, bearer, branch, isAb, entry, berry, accPlan, critPlan, wx, tx, slower, speedOrder, exceptSelf, setup, trigger, advAbility });
}
function weatherish() {
  return Object.entries(U.T.abilities).filter(([, a]) => a.tags.some(t => /weatherSetter|terrainSetter|onSwitchInDrop|privateWeather/.test(t))).map(([k]) => k);
}

/* ================= TURNING A RECIPE INTO TURNS ====================================================== */
/* Setup actions are packed into the earliest turn where their role is free and their dependency has
 * already happened; the trigger turn follows; every idle slot is filled with a guard when nothing is
 * aimed at it and with an inert click when something is (a guard would block the setup). */
function composeEntity(rc, x) {
  const { e, trig, isAb, entry, berry, accPlan, critPlan, wx, tx, exceptSelf } = x;
  const T = k => trig.filter(t => t.kind === k);
  const board = s => trig.find(t => t.kind === 'board' && t.state === s);
  const acts = [];                                  /* { role, click, phase: 0 setup / 1 trigger, after } */
  const tc = (role, at, move, phase, ctx) => rc.triggerClicks.push({ role, at, move: id(move), phase, ctx: ctx || {} });
  const consumed = new Set(['click', 'entry', 'read-elsewhere', 'berry', 'read-by-others', 'capability', 'mega', 'adversary-effect', 'body-type', 'ally-ability']);
  /* ---- the holder clicks the setter its item extends ---- */
  if (rc.setterClick) acts.push({ role: 'C', click: rc.setterClick, phase: 1 });
  /* ---- the carrier's own clicks ---- */
  let cHit = null;
  const actor = T('click').filter(t => t.by === 'actor');
  const bp = T('click-bp')[0];
  if (actor.length || bp || accPlan && accPlan.holderAttacks || critPlan || T('target-punishes-contact').length || T('bypass-immunity').length) {
    const pool = [...(U.POOL.get(spOf(rc.bodies.C.species).id) || [])];
    const R = rc.bodies.R;
    let pred = d => d.category !== 'Status' && d.target === 'normal';
    const p0 = pred;
    if (actor.length) pred = d => actor.every(t => PRE.satisfiesNeed(d.id, t.need, { userTypes: typesOf(rc.bodies.C), targetTypes: typesOf(R) }))
      && (actor.every(t => t.need.kind === 'statRaise') || d.category !== 'Status' || d.target !== 'self' || actor.some(t => t.need.kind === 'category'));
    if (bp) { const q = pred; pred = d => q(d) && d.category !== 'Status' && d.basePower > 0 && d.basePower <= bp.max; }
    if (accPlan && accPlan.holderAttacks) { const q = pred; pred = d => q(d) && accPlan.good(d); }
    if (critPlan) { const q = pred; pred = d => q(d) && d.category !== 'Status' && (d.critRatio || 1) === 1 && (d.accuracy === true || d.accuracy >= 100); }
    if (T('target-punishes-contact').length) { const q = pred; pred = d => q(d) && d.flags && d.flags.contact; }
    void p0;
    const byp = T('bypass-immunity')[0];
    if (byp) { const q = pred; pred = d => q(d) && d.category !== 'Status' && byp.values.includes(d.type); }
    /* the type immunity IS the trigger of a bypass fixture, so it is excepted on that click only */
    const exceptAcc = (accPlan && accPlan.holderAttacks ? ['accuracy'] : []).concat(byp ? ['type'] : []);
    /* A PRIORITY STATUS CLICK SHOWS ON THE BOARD when it lands before a hit it changes: a screen that
     * halves the hit, a substitute that takes it. Preferred, derived from the condition's own damage
     * handler and the substitute tag. */
    const shows = k => { const d = D.moves.get(k); return !!(d.sideCondition && d.condition && Object.keys(d.condition).some(h => /ModifyDamage/.test(h))) || (U.T.moves[k] || { tags: [] }).tags.includes('substitute'); };
    const ranked = rankMoves(pool.filter(k => { const d = D.moves.get(k); return legal(d) && pred(d); }));
    const ordered = T('carrier-slower').length ? ranked.filter(shows).concat(ranked.filter(k => !shows(k))) : ranked;
    const m = ordered
      .find(k => { const d = D.moves.get(k); return d.target === 'self' || d.target === 'allySide' || !masksFor(k, rc.bodies.C, R, { arm: rc.arm, except: exceptAcc, prankster: T('carrier-slower').length > 0, foe: true }).length; });
    if (!m) refuse('NO-TRIGGER-SUPPLIER', 'the carrier ' + rc.bodies.C.species + ' learns no move that supplies '
      + (actor.map(t => t.need.kind + '=' + t.need.values.join('/')).join(', ') || (bp ? 'base power <= ' + bp.max : accPlan ? 'an accuracy the multiplier moves across 100' : critPlan ? 'a crit-ratio-1 sure hit' : 'a contact hit')));
    cHit = addMove(rc, 'C', m);
    const d = D.moves.get(m);
    const at = d.target === 'self' || d.target === 'allySide' ? null : 'R';
    acts.push({ role: 'C', click: { m: cHit, at }, phase: 1 });
    tc('C', at, m, 1, { except: exceptAcc, prankster: T('carrier-slower').length > 0, foe: true });
    rc.conditions.push({ kind: 'click', role: 'C', move: m, phase: 1 });
    if (d.category === 'Status' && T('carrier-slower').length) {
      /* priority on a status move shows on the board when a hit lands on the other side of it — a
       * screen only for the category its own condition names */
      const cat = d.condition ? (/getCategory\(move\)\s*===\s*["'](Physical|Special)["']/.exec(handlersOf(d).map(x => x.src).join(' ')) || [])[1] : null;
      const h = hitFor(rc, 'R', 'C', { except: exceptSelf, category: cat || undefined });
      if (h) {
        acts.push({ role: 'R', click: { m: h, at: 'C' }, phase: 1 });
        rc.triggerClicks.push({ role: 'R', at: 'C', move: id(h), phase: 1, ctx: { except: exceptSelf } });
        rc.observe = { role: 'C', leaf: 'hp', channel: 'board', leaves: ['hp'] };
        rc.notes.push(d.name + ' lands before ' + D.moves.get(h).name + ' only if priority moves it ahead (carrier ' + speedOf(rc.bodies.C) + ' < receiver ' + speedOf(rc.bodies.R) + ', authority statModify)');
      }
    }
  }
  /* ---- setup the carrier does to itself ---- */
  if (critPlan) {
    const i1 = critPlan.i1;
    /* THE BASE RATIO IS THE MOVE'S OWN `critRatio` (the relay starts at `move.critRatio || 0`,
     * sim/battle-actions.ts, the line after the table), read off the move the carrier clicks. */
    const base = cHit ? (D.moves.get(cHit).critRatio || 0) : 0;
    if (critPlan.add) {
      const fe = U.MOVES.filter(d => (U.T.moves[d.id] || { tags: [] }).tags.includes('critStageVolatile'))
        .map(d => ({ d, k: +((/critRatio\s*\+\s*(\d+)/.exec(String(d.condition && d.condition.onModifyCritRatio)) || [])[1] || 0) }))
        .find(o => o.k && learns(rc.bodies.C.species, o.d.id) && base + o.k < i1 && base + o.k + critPlan.add >= i1 && o.d.target === 'self');
      if (!fe) refuse('NO-TRIGGER-SUPPLIER', 'the crit tier ' + i1 + ' is reached from ratio ' + base + ' + ' + critPlan.add + ' only with a self crit-stage move the carrier does not learn');
      acts.push({ role: 'C', click: { m: addMove(rc, 'C', fe.d.id) }, phase: 0 });
      rc.notes.push('ratio without the mechanic ' + base + '+' + fe.k + '=' + (base + fe.k) + ' (< ' + i1 + ', no crit at the top corner); with it ' + (base + fe.k + critPlan.add) + ' (crit)');
    }
    if (critPlan.abs) rc.notes.push('ratio without the mechanic ' + base + ' (< ' + i1 + '); the handler returns ' + critPlan.abs + ', clamped to ' + (U.crit.table.length - 1));
    if (critPlan.targetStatus) {
      const who = ['C', 'CA'].find(r => rc.bodies[r]);
      const pool = [...(U.POOL.get(spOf(rc.bodies[who].species).id) || [])].map(k => D.moves.get(k))
        .filter(d => legal(d) && critPlan.targetStatus.some(s => statusMoveFor(s, rc.arm)(d)) && sureHit(d, rc.bodies[who])
                && !masksFor(d.id, rc.bodies[who], rc.bodies.R, { arm: rc.arm, statusIsTrigger: true }).length);
      if (!pool.length) refuse('NO-TRIGGER-SUPPLIER', 'the target must carry ' + critPlan.targetStatus.join('/') + ' and ' + rc.bodies[who].species + ' has no sure-hit way to give it at the top corner');
      acts.push({ role: who, click: { m: addMove(rc, who, pool[0].id), at: 'R' }, phase: 0 });
      tc(who, 'R', pool[0].id, 0, { statusIsTrigger: true });
    }
  }
  /* the FOE's status, which the handler reads — the carrier gives it at setup, sure-hit at the arm */
  const foeSt = T('foe-statused')[0];
  if (foeSt && !(critPlan && critPlan.targetStatus)) {
    const pool = [...(U.POOL.get(spOf(rc.bodies.C.species).id) || [])].map(k => D.moves.get(k))
      .filter(d => legal(d) && foeSt.values.some(s => statusMoveFor(s, rc.arm)(d)) && (rc.arm !== TOP || sureHit(d, rc.bodies.C))
              && !masksFor(d.id, rc.bodies.C, rc.bodies.R, { arm: rc.arm, statusIsTrigger: true }).length);
    if (!pool.length) refuse('NO-TRIGGER-SUPPLIER', 'the foe must carry ' + foeSt.values.join('/') + ' and the carrier ' + rc.bodies.C.species + ' cannot give it unmasked');
    const m = rankMoves(pool.map(d => d.id))[0];
    acts.push({ role: 'C', click: { m: addMove(rc, 'C', m), at: 'R' }, phase: 0 });
    tc('C', 'R', m, 0, { statusIsTrigger: true });
  }
  /* hp threshold on the holder: a self-cost move when one reaches it, otherwise the real pool */
  const hp = board('hp-threshold') || (berry && berry.kind === 'heal' ? { fraction: 2 } : null);
  if (hp) {
    const f = hp.fraction || +hp.values[0];
    const cost = U.MOVES.filter(d => { const p = ((U.T.moves[d.id] || { params: {} }).params.costsUserHP || {}); return p.costsFraction && !d.selfSwitch && 1 - p.costsFraction <= 1 / f; })
      .find(d => learns(rc.bodies.C.species, d.id));
    if (cost) { acts.push({ role: 'C', click: { m: addMove(rc, 'C', cost.id) }, phase: 0 }); rc.notes.push('HP is lowered to <= 1/' + f + ' by ' + cost.name + ' (tag costsUserHP)'); }
    else {
      rc.hpPool = 'x1';
      const h = hitFor(rc, 'R', 'C', { except: exceptSelf });
      if (!h) refuse('NO-TRIGGER-SUPPLIER', 'nothing lowers the holder to 1/' + f);
      for (let i = 0; i < 2; i++) acts.push({ role: 'R', click: { m: h, at: 'C' }, phase: 0, seq: i });
      rc.assumptions.push('two real-pool hits from ' + rc.bodies.R.species + ' are ASSUMED to take the holder to <= 1/' + f + ' — the planner runs no damage calculator; confirm off the authority log');
    }
    consumed.add('board');
  }
  if (board('ko-hit')) {
    rc.hpPool = 'x1';
    const h = hitFor(rc, 'R', 'C', { except: exceptSelf, pred: d => d.basePower >= 80 });
    if (!h) refuse('NO-TRIGGER-SUPPLIER', 'no receiver hit to threaten the holder from full HP');
    acts.push({ role: 'R', click: { m: h, at: 'C' }, phase: 1 });
    rc.assumptions.push('the hit is ASSUMED lethal from full on the real pool — no damage calculator is run; confirm off the authority log');
  }
  if (board('pp-exhausted')) {
    const pool = [...(U.POOL.get(spOf(rc.bodies.C.species).id) || [])].map(k => D.moves.get(k)).filter(d => legal(d) && d.category === 'Status' && d.target === 'self' && !d.boosts && !d.heal)
      .map(d => ({ d, pp: ((U.T.moves[d.id] || { params: {} }).params.pp || {}).max || 99 })).sort((a, b) => a.pp - b.pp);
    if (!pool.length || pool[0].pp > 12) refuse('NO-TRIGGER-SUPPLIER', 'no short-PP idle move on the holder to run dry');
    for (let i = 0; i < pool[0].pp; i++) acts.push({ role: 'C', click: { m: addMove(rc, 'C', pool[0].d.id) }, phase: 0, seq: i });
    rc.notes.push(pool[0].d.name + ' is clicked ' + pool[0].pp + ' times (its format PP, tag pp.max) to reach 0');
  }
  if (board('heal-effect')) {
    const drain = [...(U.POOL.get(spOf(rc.bodies.C.species).id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && d.drain && d.target === 'normal' && !masksFor(d.id, rc.bodies.C, rc.bodies.R, { arm: rc.arm }).length);
    if (!drain) refuse('NO-TRIGGER-SUPPLIER', 'the holder learns no drain move to heal from');
    const h = hitFor(rc, 'R', 'C', { except: exceptSelf });
    if (!h) refuse('NO-TRIGGER-SUPPLIER', 'nothing damages the holder first');
    acts.push({ role: 'R', click: { m: h, at: 'C' }, phase: 0 });
    acts.push({ role: 'C', click: { m: addMove(rc, 'C', drain.id), at: 'R' }, phase: 1 });
  }
  /* ---- the receiver's requirements, as clicks ---- */
  for (const [key, m] of Object.entries(rc.rMoves || {})) {
    const req = { status: ['C', 0], indirect: ['C', 0], volatile: ['C', 0], drop: ['C', 0], trap: ['C', 0], phaze: ['C', 1],
                  boost: [null, 0], 'hit-phys': ['C', 1], 'adv-move': ['C', 1], 'berry-status': [berry && berry.holder, 0],
                  'ally-guard': [null, 1], 'ally-hit': ['CA', 1], 'ally-status': ['CA', 0], 'entry-hurt': ['CA', 0],
                  'entry-status': ['CA', 0], 'entry-screen': [null, 0], acc: ['C', 1], 'acc-vol': ['C', 0] };
    let [at, phase] = req[key] || ['C', 1];
    if (key.startsWith('need:')) { const d = D.moves.get(m); at = d.target === 'self' ? null : (trig.some(t => /RedirectTarget/.test(t.handler || '')) ? 'CA' : 'C'); phase = 1; }
    if (key === 'ally-guard') at = x.branch === 'covers-self' ? 'C' : 'CA';
    const d = D.moves.get(m);
    if (d.target === 'self' || d.target === 'allySide' || d.target === 'foeSide' || d.target === 'all') at = null;
    acts.push({ role: 'R', click: { m, at }, phase });
    tc('R', at, m, phase, { except: at === 'C' ? exceptSelf : [], statusIsTrigger: /status/.test(key) });
    if (phase === 1) rc.conditions.push({ kind: 'click', role: 'R', move: m, phase: 1 });
  }
  if (board('trapped')) acts.push({ role: 'C', click: { sw: 'CB' }, phase: 1 });
  /* ---- the partner ---- */
  for (const [key, m] of Object.entries(rc.caMoves || {})) {
    const d = D.moves.get(m);
    const at = key === 'hit-holder' ? (d.target === 'normal' ? 'C' : null) : (d.target === 'self' || d.weather || d.terrain || d.target === 'all' || d.target === 'allySide' ? null : 'R');
    const phase = key === 'weather' || key === 'terrain' || key === 'boost' ? 0 : 1;
    acts.push({ role: 'CA', click: { m, at }, phase });
    tc('CA', at, m, phase, { except: at === 'C' ? exceptSelf : [] });
    if (phase === 1) rc.conditions.push({ kind: 'click', role: 'CA', move: m, phase: 1 });
  }
  /* ---- items on the partner or the carrier that the trigger consumes ---- */
  if (berry) {
    if (berry.kind === 'cure') {
      const m = rc.rMoves['berry-status'];
      const st = PRE.statusOf(D.moves.get(m));
      const b = berry.options.find(o => o.status === st);
      if (!b) refuse('PLANNER-CANNOT-CONSTRUCT', 'no cure berry matches the status ' + st);
      setItem(rc, berry.holder, b.item.name);
      rc.notes.push(berry.holder + ' holds ' + b.item.name + ' and eats it when ' + D.moves.get(m).name + ' lands');
    } else if (berry.kind === 'heal') {
      if (!berry.item) refuse('PLANNER-CANNOT-CONSTRUCT', 'no legal healing berry');
      setItem(rc, berry.holder, berry.item.name);
    } else refuse('PLANNER-CANNOT-CONSTRUCT', 'a resist-berry consumption fixture is not built by this planner yet');
    if (T('ally-item-consumed').length && !rc.bodies.C.item) {
      /* the QUIETEST item to pass: fewest functional handlers (a weight or take-item hook is not one),
       * then fewest tags — never an accuracy or speed item riding along into the comparison */
      const give = U.ITEMS.filter(i => !i.megaStone && !i.isBerry && !i.itemUser && !rc.items.p1.has(i.id))
        .map(i => ({ i, h: handlersOf(i).filter(h => !/^on(ModifyWeight|TakeItem)$/.test(h.name)).length, t: tagsOf('items', i.id).tags.filter(t => t !== 'flingable').length }))
        .sort((a, b) => a.h - b.h || a.t - b.t || (a.i.id < b.i.id ? -1 : 1)).map(o => o.i)[0];
      if (!give) refuse('PLANNER-CANNOT-CONSTRUCT', 'no quiet item for the carrier to pass');
      setItem(rc, 'C', give.name);
    }
    consumed.add('board');
  }
  /* ---- entry: the setup turn, then the carrier arrives ---- */
  if (entry) {
    if (entry === 'ally-boosted' && !(rc.caMoves || {}).boost) refuse('NO-TRIGGER-SUPPLIER', 'the partner learns no self boost');
    acts.push({ role: 'LP', click: { sw: 'C' }, phase: 1 });
    rc.conditions.push({ kind: 'click', role: 'LP', sw: 'C', phase: 1 });
    rc.observe = entry === 'screens-up' ? { role: 'R', leaf: 'side.conditions', channel: 'board', leaves: ['side.conditions'] }
      : { role: 'CA', leaf: entry === 'ally-damaged' ? 'hp' : entry === 'ally-boosted' ? 'boosts' : 'status', channel: 'board', leaves: ['hp', 'boosts', 'status'] };
    rc.notes.push('the carrier ENTERS on the trigger turn, after the setup — the handler acts on what is already there');
  }
  /* ---- the generic exchange when no trigger named a click: both sides hit ---- */
  /* an adversary ability (Intimidate on the receiver) fires as the leads enter: nothing need be clicked
   * for it, and a generic exchange would only add hits that wake the control's alternative ability */
  const anyTrigger = acts.some(a => a.phase === 1) || !!x.advAbility;
  /* where the row must look, when the mechanic's own handler writes no leaf: a bypassed immunity shows
   * as damage on the receiver; an adversary's effect shows on the leaf THAT ability writes */
  if (T('bypass-immunity').length) rc.observe = { role: 'R', leaf: 'hp', channel: 'board', leaves: ['hp'] };
  /* a handler that only REFUSES or REDIRECTS writes nothing itself; the leaf is the one the refused
   * thing would have written — the chip Magic Guard stops, the drag Suction Cups stops, the boosted
   * hit Unaware ignores, the partner's hit Telepathy refuses */
  if (!rc.observe && (T('indirect-damage').length || T('foe-boost-then-hit').length || T('ally-hits-holder').length)) rc.observe = { role: 'C', leaf: 'hp', channel: 'board', leaves: ['hp'] };
  if (!rc.observe && T('foe-forces-switch').length) rc.observe = { role: 'C', leaf: 'active', channel: 'board', leaves: ['active'] };
  if (x.advAbility) { const lv = observeOf('abilities', D.abilities.get(x.advAbility)).leaves; if (lv.length) rc.observe = { role: 'C', leaf: lv[0], channel: 'board', leaves: lv }; }
  if (!anyTrigger) {
    const h1 = hitFor(rc, 'C', 'R', {});
    const h2 = hitFor(rc, 'R', 'C', { except: exceptSelf });
    if (!h1 && !h2) refuse('PLANNER-CANNOT-CONSTRUCT', 'neither side can hit the other');
    if (h1) { acts.push({ role: 'C', click: { m: h1, at: 'R' }, phase: 1 }); tc('C', 'R', h1, 1, {}); }
    if (h2) { acts.push({ role: 'R', click: { m: h2, at: 'C' }, phase: 1 }); tc('R', 'C', h2, 1, { except: exceptSelf }); }
  }
  for (const t of trig) if (!consumed.has(t.kind) && !['weather', 'terrain', 'holder-statused', 'indirect-damage', 'foe-forces-switch', 'foe-boost-then-hit',
    'ally-guard', 'ally-hit', 'ally-statused', 'ally-hits-holder', 'ally-faints', 'ally-item-consumed', 'target-punishes-contact', 'carrier-slower', 'click-bp',
    'foe-statused', 'bypass-immunity', 'speed-mult'].includes(t.kind)) {
    if (t.kind === 'board' && ['volatile-present', 'own-stat-dropped', 'trapped', 'item-consumed', 'accuracy-roll', 'crit-roll', 'speed-order', 'ally-only', 'heal-effect', 'pp-exhausted', 'ko-hit', 'hp-threshold'].includes(t.state)) continue;
    if (t.kind === 'board' && t.state === 'species-gated') continue;
    rc.unconsumed = (rc.unconsumed || []).concat(t.kind + (t.state ? ':' + t.state : ''));
  }
  if (rc.unconsumed && rc.unconsumed.length) refuse('PLANNER-CANNOT-CONSTRUCT', 'triggers this planner does not stage yet: ' + uniq(rc.unconsumed).join(', '));
  return layTurns(rc, acts);
}
function layTurns(rc, acts) {
  /* phase-0 actions in order, packed where the role is free; a role's repeated actions (seq) keep order */
  const turns = [];
  const place = (a, from) => {
    for (let i = from; ; i++) {
      if (!turns[i]) turns[i] = {};
      if (!turns[i][a.role]) { turns[i][a.role] = a.click; return i; }
    }
  };
  const lastOf = {};
  for (const a of acts.filter(a => a.phase === 0)) { const i = place(a, lastOf[a.role] != null ? lastOf[a.role] + 1 : 0); lastOf[a.role] = i; }
  const trigAt = turns.length;
  for (const a of acts.filter(a => a.phase === 1)) {
    if (!turns[trigAt]) turns[trigAt] = {};
    if (turns[trigAt][a.role]) refuse('PLANNER-CANNOT-CONSTRUCT', a.role + ' is asked for two trigger clicks on one turn');
    turns[trigAt][a.role] = a.click;
  }
  if (!turns.length) turns.push({});
  if (rc.megaRole) {
    const t0 = turns[0] || (turns[0] = {});
    if (!t0.C || t0.C.sw) { const h = hitFor(rc, 'C', 'R', {}) || inertFor(rc, 'C', { noGuard: true }).m; t0.C = { m: h, at: hitFor(rc, 'C', 'R', {}) ? 'R' : null }; }
    t0.C = Object.assign({}, t0.C, { mega: true });
    rc.conditions.push({ kind: 'mega', role: 'C', turn: 1 });
  }
  const n = Math.max(turns.length, rc.extraTurns ? rc.extraTurns + 1 : 0);
  for (let i = 0; i < n; i++) turns[i] = turns[i] || {};
  /* the conditions and trigger clicks learn their TURN now that turns exist */
  for (const c of rc.conditions) if (c.kind === 'click' && c.turn == null) c.turn = trigAt + 1;
  for (const c of rc.triggerClicks) c.turn = c.phase === 1 ? trigAt + 1 : 1 + turns.findIndex(t => Object.values(t).some(k => k && id(k.m) === c.move));
  if (rc.readAfter == null) rc.readAfter = trigAt + 1;
  rc.turns = turns;
  return rc;
}
/* Fill the rest of the board: pads, the idle clicks, the six-body sheets. */
function finish(rc) {
  if (!rc.bodies.CA) padFor(rc, 'CA');
  if (!rc.bodies.RA) padFor(rc, 'RA');
  for (const r of rc.lineup.p1.concat(rc.lineup.p2)) if (r && !rc.bodies[r]) padFor(rc, r);
  rc.lineup.p1 = rc.lineup.p1.map((r, i) => r || (padFor(rc, 'PB' + i), 'PB' + i));
  if (rc.lineup.p1.includes('LP') && !rc.bodies.LP) padFor(rc, 'LP');
  rc.pads = { p1: [], p2: [] };
  for (const s of ['p1', 'p2']) while (rc.lineup[s].length + rc.pads[s].length < 6) { const r = 'P' + s + rc.pads[s].length; padFor(rc, r); rc.pads[s].push(r); }
  const onField = t => { const o = { p1: [rc.lineup.p1[0], rc.lineup.p1[1]], p2: [rc.lineup.p2[0], rc.lineup.p2[1]] }; for (let i = 0; i < t; i++) for (const s of ['p1', 'p2']) for (let j = 0; j < 2; j++) { const c = rc.turns[i][o[s][j]]; if (c && c.sw) o[s][j] = c.sw; } return o; };
  rc.turns.forEach((turn, i) => {
    const o = onField(i);
    /* aimed = an explicit aim, or the body a trigger click lands on (a spread move names no aim) */
    const aimed = new Set(Object.values(turn).filter(c => c && c.at).map(c => c.at)
      .concat(rc.triggerClicks.filter(c => c.turn === i + 1 && c.at).map(c => c.at)));
    for (const s of ['p1', 'p2']) for (const role of o[s]) {
      if (turn[role]) continue;
      const guardOk = !aimed.has(role) && !rc.live.has(role);
      turn[role] = inertFor(rc, role, { noGuard: !guardOk, consumes: !!rc.bodies[role].item });
    }
  });
  for (const b of Object.values(rc.bodies)) if (!b.moves.length) addMove(rc, Object.keys(rc.bodies).find(k => rc.bodies[k] === b), inertFor(rc, Object.keys(rc.bodies).find(k => rc.bodies[k] === b)).m);
  return rc;
}

/* ================= STAGING A MOVE ================================================================== */
function stageMove(mv, carrier) {
  const rc = newRecipe({ kind: 'moves', id: mv.id, name: mv.name });
  const trig = triggersOf('moves', mv, U);
  const T = k => trig.filter(t => t.kind === k);
  useSpecies(rc, carrier);
  setBody(rc, 'C', { species: carrier, ability: quietAbility(carrier, weatherish()) });
  const main = addMove(rc, 'C', mv.id);
  const tcl = mv.target;
  const at = ['normal', 'any', 'adjacentFoe'].includes(tcl) ? 'R' : ['adjacentAlly', 'adjacentAllyOrSelf'].includes(tcl) ? 'CA' : null;
  if (at === 'CA') rc.live.add('CA');
  const hitsFoe = ['normal', 'any', 'adjacentFoe', 'randomNormal', 'allAdjacentFoes', 'allAdjacent'].includes(tcl);
  /* the receiver: the move lands on it with zero masks, and it can do what the move's tags ask of it */
  const need = {
    attack: T('target-attacks')[0], boosted: T('target-boosted')[0], item: T('target-holds-item')[0],
  };
  const prank = false;
  let pick = null;
  for (const sid of speciesOrder(RECEIVER_FIRST)) {
    const sp = D.species.get(sid);
    if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
    const body = { species: sp.name, field: sp.name, ability: quietAbility(sp.name, [mv.id]) };
    if (!body.ability) continue;
    if (hitsFoe && masksFor(mv.id, rc.bodies.C, body, { arm: rc.arm, prankster: prank, foe: true, statusIsTrigger: true }).length) continue;
    const pool = [...(U.POOL.get(sp.id) || [])].map(k => D.moves.get(k)).filter(legal);
    const moves = {};
    if (need.attack) {
      const m = rankMoves(pool.filter(d => d.category !== 'Status' && d.target === 'normal' && (!need.attack.priority || d.priority > 0)).map(d => d.id))
        .find(k => !masksFor(k, body, rc.bodies.C, { arm: rc.arm }).length);
      if (!m) continue; moves.attack = m;
    }
    if (need.boosted) { const m = pool.find(d => d.category === 'Status' && d.target === 'self' && d.boosts); if (!m) continue; moves.boost = m.id; }
    pick = { body, moves };
    break;
  }
  if (!pick && hitsFoe) refuse('NO-TRIGGER-SUPPLIER', 'no legal receiver takes ' + mv.name + ' unmasked' + (need.attack ? ' and attacks back' : ''));
  if (!pick) pick = { body: null, moves: {} };
  if (pick.body) { useSpecies(rc, pick.body.species); setBody(rc, 'R', pick.body); } else padFor(rc, 'R');
  const acts = [];
  const mTrig = { role: 'C', click: { m: main, at }, phase: 1 };
  acts.push(mTrig);
  rc.conditions.push({ kind: 'click', role: 'C', move: mv.id, phase: 1 });
  /* a spread move is checked against the receiver it lands on; a field or self move against nobody */
  rc.triggerClicks.push({ role: 'C', at: at || (hitsFoe ? 'R' : null), move: mv.id, phase: 1, ctx: { statusIsTrigger: true, foe: at === 'R' || hitsFoe } });
  if (pick.moves.attack) acts.push({ role: 'R', click: { m: addMove(rc, 'R', pick.moves.attack), at: 'C' }, phase: 1 });
  if (pick.moves.boost) acts.push({ role: 'R', click: { m: addMove(rc, 'R', pick.moves.boost) }, phase: 0 });
  if (need.item) {
    const it = need.item.berry ? U.ITEMS.find(i => i.isBerry && (tagsOf('items', i.id).params.curesStatus || {}).statuses === 'any')
      : U.ITEMS.filter(i => !i.megaStone && !i.isBerry && !i.itemUser).sort((a, b) => tagsOf('items', a.id).tags.length - tagsOf('items', b.id).tags.length || (a.id < b.id ? -1 : 1))[0];
    if (!it) refuse('PLANNER-CANNOT-CONSTRUCT', 'no item for the target to hold');
    setItem(rc, 'R', it.name);
  }
  if (T('user-damaged').length) {
    if (!rc.bodies.R || !hitFor(rc, 'R', 'C', {})) refuse('NO-TRIGGER-SUPPLIER', 'nothing damages the user before it heals');
    acts.push({ role: 'R', click: { m: hitFor(rc, 'R', 'C', {}), at: 'C' }, phase: 0 });
    rc.notes.push('the user is hit first: a heal on a full-HP body reads 0 -> 0 forever (LESSONS §5)');
  }
  const caNeeds = [];
  if (T('ally-damaged').length) { rc.live.add('CA'); caNeeds.push('hurt'); }
  const wx = T('weather')[0], tx = T('terrain')[0];
  if (wx || tx || T('target-statused').length) rc.live.add('CA');
  if (rc.live.has('CA')) {
    let got = null;
    for (const sid of speciesOrder()) {
      const sp = D.species.get(sid);
      if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
      const body = { species: sp.name, field: sp.name, ability: quietAbility(sp.name, weatherish()) };
      if (!body.ability) continue;
      if (at === 'CA' && masksFor(mv.id, rc.bodies.C, body, { arm: rc.arm, statusIsTrigger: true }).length) continue;
      const pool = [...(U.POOL.get(sp.id) || [])].map(k => D.moves.get(k)).filter(legal);
      const x = {};
      if (wx) { const s = pool.find(d => d.weather && (wx.anyOf || wx.values.some(v => id(D.conditions.get(d.weather).id).includes(v) || v.includes(id(D.conditions.get(d.weather).id).slice(0, 4))))); if (!s) continue; x.setter = s.id; }
      if (tx) { const s = pool.find(d => d.terrain && (tx.anyOf || tx.values.includes(id(d.terrain)))); if (!s) continue; x.tsetter = s.id; }
      if (T('target-statused').length) { const s = pool.find(d => d.type === 'Ice' && d.category !== 'Status' && (d.secondaries || []).some(q => q && q.status === 'frz') && rc.bodies.R && !masksFor(d.id, body, rc.bodies.R, { arm: rc.arm }).length); if (!s) continue; x.freeze = s.id; }
      got = { body, x }; break;
    }
    if (!got) refuse('NO-TRIGGER-SUPPLIER', 'no legal partner can ' + [wx && 'set the weather', tx && 'set the terrain', T('target-statused').length && 'freeze the target', at === 'CA' && 'take the move'].filter(Boolean).join(', '));
    useSpecies(rc, got.body.species); setBody(rc, 'CA', got.body);
    if (got.x.setter) acts.push({ role: 'CA', click: { m: addMove(rc, 'CA', got.x.setter) }, phase: 0 });
    if (got.x.tsetter) acts.push({ role: 'CA', click: { m: addMove(rc, 'CA', got.x.tsetter) }, phase: 0 });
    if (got.x.freeze) acts.push({ role: 'CA', click: { m: addMove(rc, 'CA', got.x.freeze), at: 'R' }, phase: 0 });
    if (caNeeds.includes('hurt')) { const h = rc.bodies.R && hitFor(rc, 'R', 'CA', {}); if (!h) refuse('NO-TRIGGER-SUPPLIER', 'nothing damages the partner first'); acts.push({ role: 'R', click: { m: h, at: 'CA' }, phase: 0 }); }
  }
  /* the target must have a last move: it hits the carrier once before the locking click */
  if (T('target-moved-before').length && rc.bodies.R) { const h = hitFor(rc, 'R', 'C', {}); if (!h) refuse('NO-TRIGGER-SUPPLIER', 'the target cannot act before the lock'); acts.push({ role: 'R', click: { m: h, at: 'C' }, phase: 0 }); }
  if (T('two-turn').length) acts.push({ role: 'C', click: { m: main, at }, phase: 2 });
  if (T('foe-switches-after').length) acts.push({ role: 'R', click: { sw: 'RB1' }, phase: 2 });
  if (T('delayed').length) rc.extraTurns = 3;
  rc.observe = observeOf('moves', mv);
  /* THE CONTROL MOVE IS IN THE MOVESET FROM THE START, so the control differs by one script leaf. */
  /* the control click: the format's inert move, else a self move whose own onTry fails for a healthy
   * body, else Protect when the move under test is not itself a guard */
  const failsHealthy = [...(U.POOL.get(spOf(carrier).id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && d.category === 'Status' && d.target === 'self'
    && typeof d.onTry === 'function' && /return\s+[^;]*\.status\s*===/.test(String(d.onTry)) && d.id !== mv.id);
  const inert = learns(carrier, CS.INERT_MOVE) ? D.moves.get(CS.INERT_MOVE) : failsHealthy ? failsHealthy
    : (learns(carrier, 'protect') && !rc.guards.includes(mv.id) ? D.moves.get('protect') : null);
  if (inert && inert.id !== mv.id) rc.controlMove = addMove(rc, 'C', inert.id);
  layTurnsPhased(rc, acts);
  return rc;
}
/* layTurns with a third phase: the turn after the trigger (a charge release, a switch onto hazards). */
function layTurnsPhased(rc, acts) {
  const p2 = acts.filter(a => a.phase === 2);
  layTurns(rc, acts.filter(a => a.phase !== 2));
  if (p2.length) {
    const t = {}; for (const a of p2) t[a.role] = a.click;
    rc.turns.push(t);
    rc.readAfter = rc.turns.length;
  }
  if (rc.extraTurns) { while (rc.turns.length < rc.readAfter + rc.extraTurns - 1) rc.turns.push({}); rc.readAfter = rc.turns.length; }
}

/* ================= INJECTED: a move nothing learns and the simulator hands a body ================== */
/* A body with ONE move, a short-PP idle click run to 0 (the format's PP, tag pp.max); the request then
 * offers only the injected move. */
function stageStruggle(e, inj) {
  for (const sid of speciesOrder()) {
    const sp = D.species.get(sid);
    const pool = [...(U.POOL.get(sp.id) || [])].map(k => D.moves.get(k)).filter(d => legal(d) && d.category === 'Status' && d.target === 'self'
      && !d.boosts && !d.heal && !(U.T.moves[d.id] || { tags: [] }).tags.some(t => /heal|boost|substitute|Faint|forme|Type|calls|restores/i.test(t)))
      .map(d => ({ d, pp: ((U.T.moves[d.id] || { params: {} }).params.pp || {}).max || 99 })).sort((a, b) => a.pp - b.pp);
    if (!pool.length || pool[0].pp > 12) continue;
    const ab = quietAbility(sp.name, weatherish()); if (!ab) continue;
    const rc = newRecipe({ kind: 'moves', id: e.id, name: e.name });
    useSpecies(rc, sp.name); setBody(rc, 'C', { species: sp.name, ability: ab });
    addMove(rc, 'C', pool[0].d.id);
    padFor(rc, 'R');
    const acts = [];
    for (let i = 0; i < pool[0].pp; i++) acts.push({ role: 'C', click: { m: pool[0].d.name }, phase: 0 });
    acts.push({ role: 'C', click: { m: e.name, at: 'R' }, phase: 1 });
    rc.conditions.push({ kind: 'click', role: 'C', move: e.id, phase: 1 });
    rc.triggerClicks.push({ role: 'C', at: 'R', move: e.id, phase: 1, ctx: {} });
    rc.observe = { role: 'C', leaf: 'hp', channel: 'board', leaves: ['hp'] };
    rc.notes.push(sp.name + ' carries one move, ' + pool[0].d.name + ', clicked ' + pool[0].pp + ' times (its format PP); with nothing left the request offers only ' + e.name + ' (injected at ' + inj.at + ')');
    rc.assumptions.push('the driver matches {m:"' + e.id + '"} against the request once PP is gone — confirm scriptMoveNotOnRequest stays 0');
    layTurns(rc, acts);
    return rc;
  }
  refuse('NO-TRIGGER-SUPPLIER', 'no legal body has a short-PP idle move to run dry');
}

/* ================= CONFERRAL: an ability put on a body by a legal move ============================== */
function stageConferred(e, src) {
  const moveId = src.via.split(':')[1];
  const rc = newRecipe({ kind: 'abilities', id: e.id, name: e.name });
  const mv = D.moves.get(moveId);
  /* the beamer is the PARTNER and aims at the subject; the subject then does something the ability reads */
  const beamers = U.learners.get(moveId) || [];
  for (const b of beamers) {
    for (const sid of speciesOrder()) {
      const sp = D.species.get(sid);
      if (id(sp.baseSpecies || sp.name) === id(D.species.get(b).baseSpecies || b)) continue;
      const ab = quietAbility(sp.name, [e.id]);
      if (!ab || (D.abilities.get(ab).flags || {}).cantsuppress) continue;
      const self = [...(U.POOL.get(sp.id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && d.category === 'Status' && d.target === 'self' && d.boosts && Object.values(d.boosts).every(v => v > 0));
      if (!self) continue;
      const bab = quietAbility(b, weatherish());
      rc.used = new Set();
      useSpecies(rc, sp.name); useSpecies(rc, b);
      setBody(rc, 'C', { species: sp.name, ability: ab });
      setBody(rc, 'CA', { species: b, ability: bab });
      rc.live.add('CA');
      const beam = addMove(rc, 'CA', moveId);
      rc.controlRole = 'CA';
      const boost = addMove(rc, 'C', self.id);
      padFor(rc, 'R');
      const acts = [{ role: 'CA', click: { m: beam, at: 'C' }, phase: 0 }, { role: 'C', click: { m: boost }, phase: 1 }];
      rc.conditions.push({ kind: 'click', role: 'CA', move: moveId, turn: 1 });
      rc.triggerClicks.push({ role: 'CA', at: 'C', move: moveId, phase: 0, ctx: {} });
      rc.observe = { role: 'C', leaf: 'boosts', channel: 'board', leaves: ['boosts'] };
      rc.notes.push('no legal species carries ' + e.name + '; ' + mv.name + ' (' + beamers.length + ' legal learners) confers it — the partner beams the subject, which then boosts');
      const inert = ['recycle', 'protect'].find(x => learns(b, x));
      if (inert) rc.controlMove = addMove(rc, 'CA', inert);
      layTurns(rc, acts);
      return rc;
    }
  }
  refuse('NO-TRIGGER-SUPPLIER', 'no body can receive ' + e.name + ' from ' + mv.name + ' and then boost');
}

/* ================= A TAG NAMED FOR TWO HALVES — a fixture per half ================================== */
function halvesOf(kind, eid) {
  const out = [];
  const tg = tagsOf(kind, eid);
  for (const t of tg.tags) {
    if (!/[a-z](And|Or)[A-Z]/.test(t)) continue;
    const p = tg.params[t] || {};
    const halves = Object.keys(p).filter(k => p[k] === true);
    if (halves.length >= 2) out.push({ tag: t, halves });
  }
  return out;
}
function stageHalf(kind, e, bearer, tag, half) {
  /* the property the entity's handler WRITES on the move, and the legal moves whose own code READS it */
  const writes = uniq(handlersOf(e).flatMap(h => [...h.src.matchAll(/move\.([a-z]+)\s*=\s*true/g)].map(m => m[1])));
  const readers = U.MOVES.filter(d => writes.some(w => handlersOf(d).some(h => new RegExp('\\.' + w + '\\b').test(h.src))));
  const stem = id(half.replace(/^(ignores|bypasses|blocks|refuses)/i, '')).replace(/s$/, '');
  let cls = readers.filter(d => d.id.startsWith(stem));
  if (!cls.length) cls = readers.filter(d => d.sideCondition && !readers.some(o => o.id.startsWith(stem) && o.id === d.id));
  if (!cls.length) refuse('HALF-UNSTAGEABLE', 'no legal move reads ' + writes.join('/') + ' for the half ' + half);
  const rc = newRecipe({ kind, id: e.id, name: e.name });
  useSpecies(rc, bearer.sheet);
  setBody(rc, 'C', { species: bearer.sheet, field: bearer.field, ability: e.name });
  rc.conditions.push({ kind: 'field', role: 'C', field: 'ability', value: e.name });
  for (const sid of speciesOrder(RECEIVER_FIRST)) {
    const sp = D.species.get(sid);
    if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
    const st = cls.find(d => learns(sp.name, d.id) && !(d.id === 'auroraveil'));
    if (!st) continue;
    const cat = (/getCategory\(move\)\s*===\s*["'](Physical|Special)["']/.exec(handlersOf(st).map(h => h.src).join(' ')) || [])[1] || null;
    const body = { species: sp.name, field: sp.name, ability: quietAbility(sp.name) };
    rc.bodies.R = null;
    setBody(rc, 'R', body);
    const h = hitFor(rc, 'C', 'R', { category: cat || undefined });
    if (!h) { rc.bodies.R.moves = []; continue; }
    useSpecies(rc, sp.name);
    const s = addMove(rc, 'R', st.id);
    layTurns(rc, [{ role: 'R', click: { m: s }, phase: 0 }, { role: 'C', click: { m: h, at: 'R' }, phase: 1 }]);
    rc.triggerClicks.push({ role: 'C', at: 'R', move: id(h), phase: 1, ctx: {} });
    rc.half = { tag, half, state: st.id, readers: cls.map(d => d.id) };
    rc.observe = { role: 'R', leaf: 'hp', channel: 'board', leaves: ['hp'] };
    rc.notes.push('half ' + half + ': ' + sp.name + ' raises ' + st.name + ' (its code reads move.' + writes.join('/') + '), then the carrier hits it' + (cat ? ' with a ' + cat + ' move' : ''));
    return rc;
  }
  refuse('HALF-UNSTAGEABLE', 'no legal receiver learns ' + cls.map(d => d.name).join('/') + ' and can be hit by ' + bearer.sheet);
}

/* ================= THE CONTROL — ONE LEAF, ONE REASON ============================================== */
function cloneRc(rc) {
  const c = Object.assign({}, rc);
  c.bodies = JSON.parse(JSON.stringify(rc.bodies));
  c.turns = JSON.parse(JSON.stringify(rc.turns));
  c.lineup = JSON.parse(JSON.stringify(rc.lineup));
  c.pads = JSON.parse(JSON.stringify(rc.pads));
  return c;
}
/* Render both, count the leaves that differ, the fixture's unmet conditions and masks, and the
 * control's inert reasons — every one of them recomputed from the RENDERED boards. */
function judge(rcF, rcK, layout) {
  const rf = render(rcF, layout);
  const fixtureFailures = rcF.conditions.filter(c => !holds(c, rf)).map(describe);
  const fixtureMasks = renderedMasks(rcF.triggerClicks, rf, rcF);
  if (!rcK) return { rf, fixtureFailures, fixtureMasks };
  const rk = render(rcK, layout);
  const inert = rcF.conditions.filter(c => !holds(c, rk)).map(describe).concat(renderedMasks(rcF.triggerClicks, rk, rcF));
  return { rf, rk, diff: diffLeaves(rf, rk), fixtureFailures, fixtureMasks, inert };
}
function describe(c) { return c.kind + ':' + c.role + (c.field ? '.' + c.field + '=' + c.value : '') + (c.move ? '@' + c.turn + '=' + c.move : '') + (c.sw ? '@' + c.turn + '=sw ' + c.sw : ''); }
function reactsTo(alt, rc, e) {
  const a = D.abilities.get(alt);
  const why = [];
  /* IT REACTS IF IT WOULD DO SOMETHING ON THIS BOARD — not merely because it carries a tag. It fires
   * on its own (entry, residual, a field-wide handler), it shares the mechanic's family, a click on
   * this board supplies one of its move needs, or the board stages one of its board needs. A mask it
   * adds to a trigger click is caught separately by the judge. */
  const shared = tagsOf('abilities', a.id).tags.filter(t => t !== 'breakable' && tagsOf('abilities', e.id).tags.includes(t));
  if (shared.length) why.push('shares ' + shared.join(','));
  if (stateNoise(a, rc) > 0) why.push('writes state on its own (an entry/residual/field handler that changes a leaf)');
  const clicks = rc.turns.flatMap(t => Object.values(t)).filter(c => c && c.m).map(c => id(c.m));
  const C = rc.bodies.C;
  for (const n of PRE.moveNeeds(normEntity(a)).needs) if (clicks.some(m => PRE.satisfiesNeed(m, n, { userTypes: typesOf(C), targetTypes: typesOf(C) }))) { why.push('a click on this board supplies its ' + n.kind + '=' + (n.values || []).join('/')); break; }
  const staged = new Set(rc.conditions.map(c => c.kind));
  for (const n of PRE.boardNeeds(normEntity(a))) if (['hp-threshold', 'item-consumed', 'volatile-present', 'own-stat-dropped', 'trapped', 'ko-hit'].includes(n.kind) && (rc.hpPool === 'x1' || staged.size > 2)) { why.push('the board stages its ' + n.kind); break; }
  return why;
}
function buildControl(rc, kind, e, bearer, trig) {
  if (BRK === 'control-two-vars' || BRK === 'control-two-reasons') void 0;
  const done = (k, variable, why) => {
    if (BRK === 'control-two-vars') k.bodies.C.nature = D.natures.get('adamant').name;
    if (BRK === 'control-two-reasons') { const c = rc.conditions.find(x => x.kind === 'click' && x.move); if (c) { const t = k.turns[c.turn - 1]; if (t && t[c.role]) t[c.role] = { m: 'protect' }; } }
    return { rc: k, variable, why };
  };
  if (kind === 'items') {
    const k = cloneRc(rc); k.bodies.C.item = '';
    return done(k, 'C.item', 'the item is removed' + (rc.megaRole ? '; the mega click is then REFUSED by the authority, which is expected and counted (scriptMegaRefused = 1 in this arm only)' : ''));
  }
  if (rc.controlMove) {
    const c = rc.conditions.find(x => x.kind === 'click' && x.move);
    const k = cloneRc(rc);
    k.turns[c.turn - 1][c.role] = { m: rc.controlMove };
    return done(k, c.role + '.click@' + c.turn, c.role + ' clicks ' + rc.controlMove + ' instead of ' + c.move);
  }
  if (kind === 'abilities' && bearer && bearer.via === 'slot') {
    const alts = uniq(Object.values(spOf(bearer.sheet).abilities)).filter(a => id(a) !== e.id)
      .sort((x, y) => abilityNoise(x) - abilityNoise(y) || (x < y ? -1 : 1));
    const tried = [];
    for (const alt of alts) {
      const r = reactsTo(alt, rc, e);
      if (r.length) { tried.push(alt + ': ' + r.join('; ')); continue; }
      const k = cloneRc(rc); k.bodies.C.ability = alt;
      const j = judge(rc, k, {});
      if (j.diff.length === 1 && j.inert.length === 1) return done(k, 'C.ability', 'the same body carries ' + alt + ' instead');
      tried.push(alt + ': ' + j.inert.length + ' inert reasons, ' + j.diff.length + ' leaves');
    }
    rc.controlTried = tried;
  }
  /* TRIGGER REMOVAL — the click that supplies the need is swapped for one on the same body that does not */
  const needs = trig.filter(t => t.kind === 'click').map(t => t.need);
  for (const c of rc.conditions.filter(x => x.kind === 'click' && x.move)) {
    const b = rc.bodies[c.role]; const d0 = D.moves.get(c.move);
    if (b.moves.length >= 4 || !needs.length) continue;
    const alt = [...(U.POOL.get(spOf(b.species).id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && d.id !== d0.id
      && d.category === d0.category && d.target === d0.target && !needs.some(n => PRE.satisfiesNeed(d.id, n, { userTypes: typesOf(b), targetTypes: typesOf(rc.bodies.C) })));
    if (!alt) continue;
    addMove(rc, c.role, alt.id);
    const k = cloneRc(rc);
    k.turns[c.turn - 1][c.role] = { m: alt.name, at: rc.turns[c.turn - 1][c.role].at };
    const j = judge(rc, k, {});
    if (j.diff.length === 1 && j.inert.length === 1) return done(k, c.role + '.click@' + c.turn, 'the trigger click ' + d0.name + ' becomes ' + alt.name + ', which supplies none of the needs');
    rc.bodies[c.role].moves = rc.bodies[c.role].moves.filter(m => m !== alt.name);
  }
  return { refusal: { code: 'NO-SINGLE-VARIABLE-CONTROL',
    reason: bearer && bearer.via !== 'slot' ? 'the mechanic rides a ' + bearer.via + ' (' + bearer.field + '): no legal body carries it with a second ability, and removing the forme change also moves stats and typing'
      : 'no alternative ability is inert on this board and no trigger click can be swapped for a non-trigger one' + (rc.controlTried ? ' (' + rc.controlTried.join(' | ') + ')' : ''),
    mode: 'board-only: prove the trigger off the authority log, as the boards plan HB-1 specifies' } };
}

/* ================= SIDES AND SLOTS ================================================================== */
const SLOT_RE = /adjacent|\.allies\(|alliesAndSelf|\.foes\(|side\.active|getAtSlot|\.position\b|isAlly|RedirectTarget|isAdjacent|smartTarget/;
function slotSensitive(kind, e) {
  if (kind === 'moves') {
    const tg = tagsOf('moves', e.id).tags;
    return ['adjacentAlly', 'adjacentAllyOrSelf', 'allAdjacent', 'allAdjacentFoes', 'randomNormal', 'allySide', 'foeSide'].includes(e.target)
      || tg.some(t => /redirects|smartTarget|randomTarget|spread/.test(t)) || handlersOf(e).some(h => SLOT_RE.test(h.src));
  }
  return handlersOf(e).some(h => SLOT_RE.test(h.src) || /^(condition\.)?on(Ally|Foe|Any)/.test(h.name));
}
function layoutsFor(kind, e) {
  const L = [{ mirror: false, swapSlot: false }];
  if (BRK !== 'no-mirror') L.push({ mirror: true, swapSlot: false });
  if (slotSensitive(kind, e)) { L.push({ mirror: false, swapSlot: true }); if (BRK !== 'no-mirror') L.push({ mirror: true, swapSlot: true }); }
  return L;
}

/* ================= THE FAILURE PLANTS ============================================================== */
function plantsFor(rc, kind, e, control, obs) {
  const P = [];
  if (control && control.rc) P.push({ kind: 'control', variable: control.variable, expect: 'DID-NOT-FIRE', why: 'the one-leaf control must not fire' });
  const leaf = (rc.observe && rc.observe.leaf) || (obs.leaves || [])[0];
  const role = (rc.observe && rc.observe.role) || (obs.leaves.includes('boosts') && rc.bodies.R ? 'R' : 'C');
  if (obs.boardObservable || (rc.observe && rc.observe.channel === 'board')) P.push({ kind: 'statePlant', role, leaf, afterTurn: rc.readAfter, expect: 'STATE',
    why: 'corrupt the medicham board at ' + role + '.' + leaf + ' after turn ' + rc.readAfter + ' — the existing red() statePlant; the row must read STATE' });
  else P.push({ kind: 'protocol', channel: obs.channel, expect: 'DIFFER', why: 'no board leaf: the plant is a protocol line dropped from the medicham stream' });
  if (rc.arm !== BOTTOM) P.push({ kind: 'arm', arm: BOTTOM, expect: 'DID-NOT-FIRE', why: 'the same rung under the other corner must not fire — the arm is the variable' });
  const knobs = uniq(tagsOf(kind, e.id).tags.flatMap(t => [...(U.knobs.byTag.get(t) || [])]));
  if (knobs.length) P.push({ kind: 'knob', knobs, candidate: true, expect: 'DIFFER', why: 'MEDI_* switches beside a lookup of this entity\'s tags (derived by proximity — confirm each parts a board before trusting it)' });
  return P;
}

/* ================= ONE MECHANIC ===================================================================== */
let BRK = null;
const KEYK = { moves: 'move', abilities: 'ability', items: 'item' };
const FORMAT_CODES = new Set(['NO-LEGAL-CARRIER', 'NO-LEGAL-READER', 'NEEDS-SECOND-BODY-TYPE', 'NO-TRIGGER-SUPPLIER', 'VALIDATOR-REFUSED', 'HALF-UNSTAGEABLE']);
function carriersFor(kind, e, trig) {
  if (kind === 'abilities') {
    let b = (U.bearers.get(e.id) || []).slice();
    if (BRK === 'no-mega') b = b.filter(x => x.via !== 'mega');
    const rank = x => (x.via === 'slot' ? (uniq(Object.values(spOf(x.sheet).abilities)).length > 1 ? 0 : 1) : x.via === 'mega' ? 2 : 3);
    return b.sort((x, y) => rank(x) - rank(y) || (id(x.sheet) < id(y.sheet) ? -1 : 1)).slice(0, 8);
  }
  if (kind === 'items') {
    if (e.megaStone) {
      if (BRK === 'no-mega') return [];
      return Object.entries(e.megaStone).map(([base, mega]) => ({ sheet: D.species.get(base).name, field: D.species.get(mega).name, via: 'holder', legalBase: legal(D.species.get(base)), legalMega: legal(D.species.get(mega)) }))
        .filter(x => x.legalBase && x.legalMega && !D.species.get(x.sheet).battleOnly);
    }
    const gate = trig.find(t => t.kind === 'board' && t.state === 'species-gated');
    const users = gate ? gate.values : (e.itemUser || null);
    let pool = users ? U.SHEET.filter(s => users.some(u => id(u) === id(s.baseSpecies) || id(u) === s.id)).map(s => s.id) : speciesOrder();
    /* a berry that softens a super-effective hit needs a holder that type actually hits super-effectively */
    const se = trig.some(t => t.kind === 'click' && t.need.kind === 'supereffective');
    const tv = trig.filter(t => t.kind === 'click' && t.need.kind === 'type').flatMap(t => t.need.values);
    if (se && tv.length) pool = pool.filter(s => { const ty = D.species.get(s).types; return tv.some(x => D.getEffectiveness(x, ty) > 0 && D.getImmunity(x, ty)); });
    return pool.slice(0, 25).map(s => ({ sheet: D.species.get(s).name, field: D.species.get(s).name, via: 'holder' }));
  }
  const L = (U.learners.get(e.id) || []).slice();
  const inert = id(CS.INERT_MOVE);
  return L.sort((a, b) => (learns(b, inert) - learns(a, inert)) || (a < b ? -1 : 1)).slice(0, 25).map(s => ({ sheet: D.species.get(s).name, field: D.species.get(s).name, via: 'learner' }));
}
/* GENDER, DECLARED WHERE A HANDLER READS IT — 2026-09-11 (ROADMAP #592).
 *
 * THE CLAIM THIS REPLACES WAS MEASURED FALSE. This module's report said the three gender rows "get fixtures
 * with declared genders, held back until the driver seam exists". Once the seam existed and the fixtures were
 * played, every body they emitted carried gender '' — `setBody` defaults it and nothing ever set it — so
 * Attract, Cute Charm and Rivalry would have been staged genderless through a working seam and read as
 * "did not fire" for the planner's reason, not the engine's.
 *
 * WHICH RELATION IS DERIVED, NOT NAMED: a `damageByGender` tag whose `sameMult` exceeds 1 wants the SAME
 * gender (that is where its multiplier moves the hit); any other gender reader (Attract's infatuation gate,
 * Cute Charm through it) wants the OPPOSITE. WHICH GENDERS A SPECIES MAY CARRY is read off the dex — a fixed
 * `gender`, else the non-zero halves of `genderRatio` — and the validator judges the result like every other
 * leaf. No legal pair is a refusal, never a genderless fixture. */
function declareGenders(rc, kind, e, trig) {
  if (!trig.some(t => t.kind === 'capability' && t.capability === 'gender')) return;
  const C = rc.bodies.C, R = rc.bodies.R;
  if (!C || !R) refuse('PLANNER-CANNOT-CONSTRUCT', 'a gender-reading mechanic needs a carrier and a receiver whose genders relate');
  const dbg = (tagsOf(kind, e.id).params || {}).damageByGender;
  const want = dbg && +dbg.sameMult > 1 ? 'same' : 'opposite';
  const can = (name) => {
    const s = D.species.get(name);
    if (s.gender) return s.gender === 'N' ? [] : [s.gender];
    const r = s.genderRatio || {};
    return ['M', 'F'].filter(g => (+r[g] || 0) > 0);
  };
  const cg = can(C.species), rg = can(R.species);
  for (const g of cg) {
    const need = want === 'same' ? g : (g === 'M' ? 'F' : 'M');
    if (rg.includes(need)) {
      C.gender = g; R.gender = need;
      rc.notes.push('genders declared for the ' + want + '-gender case the handler reads: C ' + C.species + ' ' + g + ', R ' + R.species + ' ' + need);
      return;
    }
  }
  refuse('PLANNER-CANNOT-CONSTRUCT', 'no legal gender pair gives the ' + want + '-gender case (C ' + C.species + ' may be '
    + JSON.stringify(cg) + ', R ' + R.species + ' may be ' + JSON.stringify(rg) + ')');
}
function buildOne(kind, e, trig, bearer, branch, stager) {
  const rc = stager ? stager() : kind === 'moves' ? stageMove(e, bearer.sheet) : stageEntity(kind, e, trig, bearer, branch);
  if (bearer && bearer.via === 'mega' || (kind === 'items' && e.megaStone)) rc.megaRole = rc.megaRole || 'C';
  if (kind === 'items' && e.megaStone && !rc.conditions.some(c => c.kind === 'mega')) {
    if (!rc.turns.length) rc.turns.push({});
    const t0 = rc.turns[0];
    if (!t0.C) { const h = rc.bodies.R ? hitFor(rc, 'C', 'R', {}) : null; t0.C = h ? { m: h, at: 'R' } : inertFor(rc, 'C', { noGuard: true }); }
    t0.C = Object.assign({}, t0.C, { mega: true });
    rc.conditions.push({ kind: 'mega', role: 'C', turn: 1 });
    if (rc.readAfter == null) rc.readAfter = 1;
  }
  /* A PERMANENT FORME CHANGE PLAYS THE REAL POOL — 2026-09-11, measured, and the harness already knew.
   * `Pokemon#setSpecies` recomputes max HP from the set when a forme is permanent (a mega evolution, Disguise
   * busting, Zero to Hero), so the authority DROPS the driver's x6 boost at the change and medicham2 keeps it.
   * The first integrated run parted 73 stones and 13 mega-carrier abilities on `party.hp` at about six times
   * (Abomasite 134 vs 959) and Disguise at 114 vs 683 — one instrument artifact, not 87 defects.
   * engine/all_mechanics_fire.js has played every such row x1 since HB-1 for exactly this reason
   * (`MEGA_AB_RUNGS`, the forme-tagged board-only rungs); the planner now does too. The forme test is the
   * harness's own: the carrier's ability carries a `forme*` or `switchInForme` tag. */
  {
    const cAb = rc.bodies.C && rc.bodies.C.ability;
    const formeAb = !!cAb && ((tagsOf('abilities', cAb).tags) || []).some(t => /^forme/.test(t) || t === 'switchInForme');
    if ((rc.megaRole || formeAb) && rc.hpPool !== 'x1') {
      rc.hpPool = 'x1';
      rc.notes.push('real HP pool (x1): ' + (rc.megaRole ? 'the carrier mega-evolves' : 'the carrier\'s ability changes its forme')
        + ', and a permanent forme change makes the authority recompute max HP and drop the x6 boost');
    }
  }
  finish(rc);
  declareGenders(rc, kind, e, trig);
  if (BRK === 'protect-ally') for (const t of rc.turns) if (t.CA && !t.CA.sw && learns(rc.bodies.CA.species, 'protect')) t.CA = { m: addMove(rc, 'CA', 'protect') };
  if (BRK === 'illegal-team') rc.bodies.C.evs.spe = 40;
  const obs = rc.observe && rc.observe.leaves ? rc.observe : Object.assign({}, observeOf(kind, e), rc.observe || {});
  const control = buildControl(rc, kind, e, bearer, trig);
  const layouts = layoutsFor(kind, e);
  const variants = [];
  for (const L of layouts) {
    const j = judge(rc, control.rc || null, L);
    const teams = [j.rf.teams.p1, j.rf.teams.p2].concat(j.rk ? [j.rk.teams.p1, j.rk.teams.p2] : []);
    const problems = BRK === 'illegal-team' ? [] : uniq(teams.flatMap(t => validateTeam(t)));
    if (!BRK) {
      if (problems.length) refuse('VALIDATOR-REFUSED', problems.slice(0, 3).join(' | '), { problems });
      if (j.fixtureMasks.length) refuse('PLANNER-CANNOT-CONSTRUCT', 'the fixture is masked: ' + j.fixtureMasks.join('; '));
      if (j.fixtureFailures.length) refuse('PLANNER-CANNOT-CONSTRUCT', 'the fixture misses its own conditions: ' + j.fixtureFailures.join('; '));
      if (j.rk && (j.diff.length !== 1 || j.inert.length !== 1)) refuse('PLANNER-CANNOT-CONSTRUCT', 'control ' + j.diff.length + ' leaves / ' + j.inert.length + ' reasons');
    }
    variants.push({ layout: j.rf.layout, teams: j.rf.teams, script: j.rf.script, roles: j.rf.roles, roleAt: j.rf.roleAt,
                    control: j.rk ? { teams: j.rk.teams, script: j.rk.script, roles: j.rk.roles, roleAt: j.rk.roleAt } : null,
                    diff: j.diff || null, inert: j.inert || null, masks: j.fixtureMasks, validated: problems.length === 0 });
  }
  return {
    branch: branch || 'main', bearer: bearer ? { sheet: bearer.sheet, field: bearer.field, via: bearer.via, stone: bearer.stone || null } : null,
    arm: rc.arm, hpPool: rc.hpPool, readAfter: rc.readAfter,
    bodies: Object.fromEntries(['C', 'CA', 'R', 'RA', 'LP'].filter(r => rc.bodies[r]).map(r => [r, { species: rc.bodies[r].species, field: rc.bodies[r].field, ability: rc.bodies[r].ability, item: rc.bodies[r].item, moves: rc.bodies[r].moves, speed: speedOf(rc.bodies[r]), gender: rc.bodies[r].gender || '' }])),
    turns: rc.turns, conditions: rc.conditions, triggerClicks: rc.triggerClicks, live: [...rc.live],
    observe: { channel: obs.channel || (rc.observe || {}).channel, leaves: obs.leaves || [], role: (rc.observe || {}).role || null, leaf: (rc.observe || {}).leaf || null },
    control: control.rc ? { variable: control.variable, why: control.why } : null,
    controlRefusal: control.refusal || null,
    variants, plants: plantsFor(rc, kind, e, control, obs),
    notes: rc.notes, assumptions: rc.assumptions, half: rc.half || null,
    spread: { declared: SPREAD, nature: NATURE, seam: 'engine/game_differential.js buildPair must pass the declared evs instead of spreadFor(index)' },
  };
}
function planMechanic(kind, e) {
  const out = { key: KEYK[kind] + ':' + e.id, kind: KEYK[kind], id: e.id, name: e.name, modOverride: modOverride(kind, e.id),
                handlers: handlersOf(e).map(h => h.name), fixtures: [], refusal: null, attempts: [] };
  const trig = triggersOf(kind, e, U);
  out.triggers = trig.map(t => Object.fromEntries(Object.entries(t).filter(([k]) => typeof t[k] !== 'function')));
  out.observe = observeOf(kind, e);
  out.roll = rollOf(e);
  out.slotSensitive = slotSensitive(kind, e);
  /* ---- scope: IMPORTED from engine/legal_scope.js, the one implementation (2026-09-11) ----
   * This block derived scope a second time off the planner's own carrier list, and the two disagreed on
   * three rows: Battle Bond counted in here (its one carrier is refused by the validator, which the planner
   * only found when its staging failed), Gluttony out here and in there, Simple in here and out there —
   * 847 against 845. The planner now asks, and decides only HOW to stage what is in scope. A mechanic in
   * scope that it finds no body for is refused as its own gap (PLANNER-CANNOT-CONSTRUCT), never as the
   * format's. */
  const SV = U.scope.verdict(KEYK[kind], e.id);
  out.scope = { inScope: SV.inScope, code: SV.code };
  const bearers = carriersFor(kind, e, trig);
  const conf = SV.code === 'CONFERRED' && BRK !== 'no-conferral' ? (SV.sources || []).filter(s => s.startsWith('move:')).map(s => ({ via: s })) : [];
  const injected = kind === 'moves' && SV.code === 'INJECTED';
  const inScope = BRK === 'second-scope' ? !!(bearers.length || conf.length || injected) : SV.inScope;
  if (!inScope) {
    const cf = U.scope.conferred.find(x => x.ability === e.id);
    out.refusal = { code: SV.code, reason: SV.why, outOfScope: true, basis: 'engine/legal_scope.js',
                    conferralChecked: kind === 'abilities', conferralSources: cf ? cf.via : [], illegalReaders: SV.illegalReaders };
    return out;
  }
  if (injected && !bearers.length) {
    /* NOTHING LEARNS IT AND THE SIMULATOR INJECTS IT (legal_scope cites the line): stage the state that makes the injection */
    out.injectedAt = SV.cite;
    try { out.fixtures.push(buildOne(kind, e, trig, null, 'injected', () => stageStruggle(e, { at: SV.cite }))); }
    catch (err) { out.refusal = { code: err instanceof PlanError ? err.code : 'PLANNER-ERROR', reason: String(err.reason || err.message) }; }
    return out;
  }
  if (!bearers.length && !conf.length) {
    out.refusal = { code: 'PLANNER-CANNOT-CONSTRUCT', reason: 'engine/legal_scope.js admits it (' + SV.code + ') and the planner found no body to stage it on', formatClaim: false };
    return out;
  }
  /* ---- the main fixture ---- */
  const attempt = (label, fn) => {
    try { const f = fn(); out.fixtures.push(f); return true; }
    catch (err) {
      if (!(err instanceof PlanError)) { out.attempts.push({ bearer: label, code: 'PLANNER-ERROR', reason: String(err.stack || err).split('\n').slice(0, 2).join(' ') }); return false; }
      out.attempts.push({ bearer: label, code: err.code, reason: err.reason, extra: err.extra }); return false;
    }
  };
  let ok = false;
  for (const b of bearers) { if (attempt(b.sheet + '/' + b.via, () => buildOne(kind, e, trig, b, 'main'))) { ok = true; break; } }
  if (!ok) for (const c of conf) { if (attempt('conferred via ' + c.via, () => buildOne(kind, e, trig, null, 'conferred', () => stageConferred(e, c)))) { ok = true; break; } }
  /* ---- a fixture per conflicting handler (the first is the main fixture) ---- */
  if (ok && kind !== 'moves') {
    const g = clickGroups(trig);
    if (g[0]) for (const h of g.slice(1)) for (const b of bearers) if (attempt(b.sheet + '/handler:' + h, () => buildOne(kind, e, trig, b, 'handler:' + h))) break;
  }
  /* ---- an immunity bypass and an adversary effect: the adversary gets its own fixture ---- */
  if (ok && trig.some(t => t.kind === 'bypass-immunity') && trig.some(t => t.kind === 'adversary-effect'))
    for (const b of bearers) if (attempt(b.sheet + '/adversary', () => buildOne(kind, e, trig, b, 'adversary'))) break;
  /* ---- the tag's second branch: a veil that covers its own holder as well as its partner ---- */
  const pa = (tagsOf('abilities', e.id).params || {}).protectsAllyFromStatus;
  if (ok && kind === 'abilities' && pa && pa.coversSelf && trig.some(t => t.kind === 'ally-guard')) {
    for (const b of bearers) if (attempt(b.sheet + '/covers-self', () => buildOne(kind, e, trig, b, 'covers-self'))) break;
  }
  /* ---- a fixture per named half ---- */
  const hv = kind === 'abilities' ? halvesOf(kind, e.id) : [];
  out.halves = [];
  for (const { tag, halves } of hv) {
    const list = BRK === 'one-half' ? halves.slice(0, 1) : halves;
    for (const h of list) {
      const b = bearers.find(x => x.via === 'slot');
      const got = b && attempt(b.sheet + '/half:' + h, () => buildOne(kind, e, trig, b, 'half:' + h, () => stageHalf(kind, e, b, tag, h)));
      out.halves.push({ tag, half: h, fixture: !!got });
    }
  }
  if (!out.fixtures.length) {
    const codes = out.attempts.map(a => a.code);
    const format = codes.length && codes.every(c => FORMAT_CODES.has(c));
    const pick = format ? codes.sort((a, b) => codes.filter(x => x === b).length - codes.filter(x => x === a).length)[0] : 'PLANNER-CANNOT-CONSTRUCT';
    out.refusal = { code: pick, reason: (out.attempts.find(a => a.code === pick) || out.attempts[0] || { reason: 'no attempt was possible' }).reason,
                    formatClaim: format, attempts: out.attempts.length };
  }
  /* ---- a capability the driver lacks: the fixture exists and cannot be played ---- */
  const cap = trig.find(t => t.kind === 'capability');
  /* 2026-09-11 — THE DRIVER HAS THE GENDER SEAM NOW (`declaredGender`, engine/game_differential.js
   * buildPair), so a gender fixture is PLAYABLE and is no longer refused. Detected off the driver's own
   * source rather than assumed, so a driver without it still refuses by the old code. */
  if (cap && cap.capability === 'gender' && U.genderSeam && out.fixtures.length) {
    for (const f of out.fixtures) f.notes.push('plays through the driver\'s declared-gender seam (' + U.genderSeam.at + '): the caller must pass declaredGender');
    out.needsSeam = { declaredGender: true, at: U.genderSeam.at };
  } else if (cap && out.fixtures.length) {
    out.refusal = { code: 'NEEDS-ENGINE-CAPABILITY', capability: cap.capability,
      reason: 'the handler reads .' + cap.capability + '; medicham2 has a reader (genderOf) but the DRIVER writes gender N on every body'
        + (U.genderPin ? ' (' + U.genderPin.at + ')' : '') + ', so no staged game can show it. The fixture below is legal and waits on that seam.',
      blockedAt: U.genderPin ? U.genderPin.at : 'engine/game_differential.js buildPair' };
    out.wouldBe = out.fixtures; out.fixtures = [];
  }
  return out;
}

/* ================= THE POPULATION WALK ============================================================== */
const BREAKS = {
  'illegal-team': 'the carrier is given 40 Speed SP (cap 32) and the planner skips its own validator — "every emitted team validates" must go red',
  'control-two-vars': 'the control also changes the carrier\'s nature — "exactly one leaf" must go red',
  'control-two-reasons': 'the control also swaps the trigger click — "exactly one inert reason" must go red',
  'omit-mechanic': 'the first mechanic is silently dropped — "every mechanic has a fixture or a refusal" must go red',
  'one-half': 'only the first half of a named-half tag is staged — "a fixture per half" must go red',
  'no-mirror': 'far-side variants are not emitted — "every fixture on both sides" must go red',
  'protect-ally': 'the partner clicks Protect whenever it can — the Hospitality case and the mask check must go red',
  'feraligatr-only': 'the receiver search is the harness default only — the Feraligatr-impossible case must go red',
  'no-mega': 'mega formes are dropped from the carriers — every stone and the mega-only abilities must go red',
  'no-conferral': 'conferral is ignored — Simple must go red',
  'no-setter': 'the duration-extension setter click is dropped — the weather-rock case must go red',
  'prankster-fast': 'the speed window is not enforced — the Prankster case must go red',
  'second-scope': 'the planner decides scope from its own carrier list again, as it did until 2026-09-11 — the one-scope clause must go red',
};
function plan(opt) {
  opt = opt || {};
  BRK = opt.brk !== undefined ? opt.brk : (process.env.STAGE_PLANNER_BREAK || null);
  if (BRK && !BREAKS[BRK]) throw new Error('stage_planner: unknown break ' + BRK);
  universe(opt);
  const t0 = Date.now();
  const only = opt.only ? new Set(opt.only.map(s => { const [k, v] = s.split(':'); return KEYK[k + 's'] ? k + ':' + id(v) : (k === 'ability' || k === 'item' || k === 'move' ? k + ':' + id(v) : s); })) : null;
  const all = [];
  for (const kind of ['moves', 'abilities', 'items']) {
    const pop = kind === 'moves' ? U.MOVES : kind === 'abilities' ? U.ABILITIES : U.ITEMS;
    for (const e of pop) {
      const key = KEYK[kind] + ':' + e.id;
      if (only && !only.has(key)) continue;
      let r;
      try { r = planMechanic(kind, e); }
      catch (err) { r = { key, kind: KEYK[kind], id: e.id, name: e.name, fixtures: [], refusal: { code: 'PLANNER-ERROR', reason: String(err.stack || err).split('\n').slice(0, 3).join(' ') } }; }
      all.push(r);
    }
  }
  if (BRK === 'omit-mechanic' && all.length) all.shift();
  /* THE TAG BRANCHES — a tag's members grouped by the shape of their params (keys, and the value of
   * every string or boolean param); a branch no member of which has a fixture is reported by name. */
  const byKey = new Map(all.map(m => [m.key, m]));
  const branches = [];
  for (const kind of ['moves', 'abilities', 'items']) {
    const groups = new Map();
    for (const [eid, row] of Object.entries(U.T[kind])) for (const t of row.tags) {
      const p = (row.params || {})[t];
      const sig = t + '|' + (p && typeof p === 'object' && !Array.isArray(p)
        ? Object.keys(p).sort().map(k => k + '=' + (typeof p[k] === 'string' || typeof p[k] === 'boolean' ? p[k] : typeof p[k] === 'number' ? '#' : Array.isArray(p[k]) ? '[]' : p[k] === null ? 'null' : '{}')).join(',') : typeof p);
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(KEYK[kind] + ':' + eid);
    }
    for (const [sig, members] of groups) {
      const planned = members.map(k => byKey.get(k)).filter(Boolean);
      if (!planned.length) continue;
      const covered = planned.filter(m => m.fixtures.length);
      branches.push({ kind: KEYK[kind], sig, members: members.length, covered: covered.length,
                      status: covered.length ? 'COVERED' : 'BRANCH-UNCOVERED', refusals: covered.length ? [] : uniq(planned.map(m => m.refusal && m.refusal.code)) });
    }
  }
  const S = summarise(all, branches);
  return { meta: { generated: new Date().toISOString(), by: 'engine/stage_planner.js', format: FORMAT, filter: FILTER,
                   tags: U.tags.source, tags_digest: U.tags.digest, showdown: SDP, break: BRK, ms: Date.now() - t0,
                   crit: U.crit, hitCheck: U.hitCheck, arms: U.arms, genderPin: U.genderPin, genderSeam: U.genderSeam || null, knobs: U.knobs.count,
                   validator: Object.assign({}, VSTATS), poolFails: U.POOL_FAILS.length,
                   /* PRINTED, NOT TRUSTED (LESSONS §4): what this module added to PRE's derivation and what it removed */
                   normalised: uniq(NORMALISED), overmatchDropped: uniq(OVERMATCH) },
           mechanics: all, branches, summary: S };
}
function summarise(all, branches) {
  const S = { mechanics: all.length, inScope: all.filter(m => !(m.refusal && m.refusal.outOfScope)).length, scopeBasis: 'engine/legal_scope.js',
              withFixture: 0, refused: {}, byKind: {}, controlAB: 0, controlBoardOnly: 0, variants: 0,
              halves: { needed: 0, staged: 0 }, branches: { total: branches.length, uncovered: branches.filter(b => b.status !== 'COVERED').length },
              assumptions: 0, arms: {} };
  for (const m of all) {
    const k = S.byKind[m.kind] || (S.byKind[m.kind] = { total: 0, fixture: 0, refused: {} });
    k.total++;
    if (m.fixtures.length && !m.refusal) { S.withFixture++; k.fixture++; }
    else { const c = (m.refusal || { code: 'NONE' }).code; S.refused[c] = (S.refused[c] || 0) + 1; k.refused[c] = (k.refused[c] || 0) + 1; }
    for (const f of m.fixtures) {
      if (f.control) S.controlAB++; else S.controlBoardOnly++;
      S.variants += f.variants.length; S.assumptions += f.assumptions.length;
      S.arms[f.arm] = (S.arms[f.arm] || 0) + 1;
    }
    for (const h of (m.halves || [])) { S.halves.needed++; if (h.fixture) S.halves.staged++; }
  }
  return S;
}

module.exports = { plan, planMechanic, universe, render, validateTeam, diffLeaves, holds, renderedMasks, masksFor, speedOf,
                   triggersOf, observeOf, halvesOf, slotSensitive, BREAKS, FORMAT, FILTER, TOP, BOTTOM, MIDDLE,
                   _state: () => ({ BRK }) };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const P = plan({ only: flag('--only') ? flag('--only').split(',') : null, tagsLive: argv.includes('--tags-live') });
  const S = P.summary;
  console.log('stage_planner — ' + P.meta.format + ' | tags ' + P.meta.tags + ' | ' + P.meta.ms + ' ms' + (P.meta.break ? ' | BREAK ' + P.meta.break : ''));
  console.log('  mechanics ' + S.mechanics + ' | in scope ' + S.inScope + ' (' + S.scopeBasis + ') | with a fixture ' + S.withFixture + ' | refused ' + (S.mechanics - S.withFixture));
  for (const [k, v] of Object.entries(S.byKind)) console.log('    ' + k.padEnd(8) + v.fixture + ' / ' + v.total + '   ' + Object.entries(v.refused).map(([c, n]) => c + ' ' + n).join(', '));
  console.log('  refusals ' + Object.entries(S.refused).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ' ' + n).join(' | '));
  console.log('  controls: A/B ' + S.controlAB + ', board-only ' + S.controlBoardOnly + ' | variants ' + S.variants + ' | halves ' + S.halves.staged + '/' + S.halves.needed
    + ' | branches uncovered ' + S.branches.uncovered + '/' + S.branches.total + ' | assumptions ' + S.assumptions + ' | arms ' + JSON.stringify(S.arms));
  console.log('  validator: ' + P.meta.validator.calls + ' teams validated (' + P.meta.validator.cached + ' cached) | crit ' + P.meta.crit.cite + ' ' + JSON.stringify(P.meta.crit.table) + ' | gender pin ' + (P.meta.genderPin || {}).at);
  console.log('  derivation: ' + P.meta.normalised.length + ' entities gained a need once `?.` read as `.`; ' + P.meta.overmatchDropped.length + ' PRE needs dropped as over-matches');
  if (argv.includes('--show-derivations')) for (const x of P.meta.normalised.concat(P.meta.overmatchDropped)) console.log('    ' + x);
  if (argv.includes('--show')) for (const m of P.mechanics) {
    console.log('\n' + m.key + (m.refusal ? '  REFUSED ' + m.refusal.code + ': ' + m.refusal.reason : ''));
    console.log('  triggers: ' + m.triggers.map(t => t.kind + (t.state ? ':' + t.state : '') + (t.need ? ':' + t.need.kind + '=' + (t.need.values || []).join('/') + '<' + t.by : '')).join(', '));
    for (const a of (m.attempts || []).slice(0, 4)) console.log('  attempt ' + a.bearer + ': ' + a.code + ' ' + String(a.reason).slice(0, 160));
    for (const f of m.fixtures.concat(m.wouldBe || [])) {
      console.log('  [' + f.branch + '] arm ' + f.arm + ' pool ' + f.hpPool + ' read after T' + f.readAfter + ' observe ' + f.observe.channel + ' ' + (f.observe.leaf || f.observe.leaves.join('/')));
      for (const [r, b] of Object.entries(f.bodies)) console.log('    ' + r.padEnd(3) + b.species + (b.field !== b.species ? '>' + b.field : '') + ' @' + (b.item || '-') + ' [' + b.ability + '] spe ' + b.speed + ' : ' + b.moves.join(', '));
      f.turns.forEach((t, i) => console.log('    T' + (i + 1) + ' ' + Object.entries(t).map(([r, c]) => r + ':' + (c.sw ? 'sw ' + c.sw : c.m + (c.at ? '>' + c.at : '') + (c.mega ? ' MEGA' : ''))).join('  ')));
      console.log('    control: ' + (f.control ? f.control.variable + ' — ' + f.control.why : 'REFUSED ' + f.controlRefusal.code + ': ' + f.controlRefusal.reason));
      console.log('    variants: ' + f.variants.map(v => v.layout + (v.validated ? '' : ' INVALID')).join(', ') + ' | plants: ' + f.plants.map(p => p.kind).join(', '));
      for (const n of f.notes.concat(f.assumptions.map(a => 'ASSUMED: ' + a))) console.log('    - ' + n);
    }
  }
  if (flag('--json')) { fs.writeFileSync(flag('--json'), JSON.stringify(P, null, 1)); console.log('  wrote ' + flag('--json')); }
}
