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
/* ================= TRIGGERS THE FIRST DERIVATION DID NOT READ (force-fire-b, 2026-09-19) ============
 *
 * Will, 2026-09-19: "why cant we stage games that force the ability to fire what the hell man". Twelve ability
 * rows sat UNPROVEN-UNCONTROLLED because the fixture never reached the trigger — and for each the reason was a
 * shape this derivation did not read, not a fact about the format. Each clause below was PRINTED over every
 * legal ability before it was wired (docs/_reports/2026-09-19-force-fire-b.md, "what each clause matched").
 *
 *   STAT_CALC      a need read inside onModify{Atk,SpA,Def,SpD} is reached only from the damage calculation
 *                  (`runEvent('Modify' + statTable[attackStat], source, target, move, …)`, sim/battle-actions.ts:
 *                  1708-1709 — the move-less call at sim/pokemon.ts:634 hands no move to test), so a STATUS move of
 *                  the right type does not supply it. Fire Mane was staged with Sunny Day for exactly this.
 *   tag typeImmunity with no handler (`via: "not derivable -- no handler"`: the immunity lives in the simulator,
 *                  Pokemon#isGrounded) -> the RECEIVER must hit the holder with a damaging move of that type.
 *   tag condStatMult on def/spd `when: always` -> the RECEIVER must hit the holder with that category.
 *   onHitProtect   the holder's hit goes THROUGH a shield -> the target must click one ('target-protects').
 *   onTerrainChange reading `case "<x>terrain"` -> a terrain trigger, exactly as `isTerrain(...)` already is.
 *   a handler that DELEGATES to a condition's handler (`conditions.getByID("<c>").<onX>.call(this, …)`) -> the
 *                  delegate's own move needs, read by PRE, clicked by the holder: the WeatherModifyDamage event
 *                  runs on the ATTACKER (`priorityEvent('WeatherModifyDamage', pokemon, target, move, …)`,
 *                  data/mods/champions/scripts.ts:217). */
const STAT_CALC = /^(modifyatk|modifyspa|modifydef|modifyspd)$/;
/* The handler runs the consumed berry's own `Eat` a second time. Printed over every ability in scope: Cud Chew only. */
const reEatsBerry = e => handlersOf(e).some(h => /singleEvent\(\s*["']Eat["']/.test(h.src));
/* PRE's need test, plus the one widening the delegation clause below writes: `orMoves`, the legal moves whose
 * own handlers read the user's weather through `effectiveWeather(`. Identical to PRE's answer wherever a need
 * carries no `orMoves`, which is every need but that clause's. */
function needMet(m, n, ctx) {
  /* `ohko` — a knockout the planner can promise without a damage calculator: the move's own `ohko` field */
  if (n && n.kind === 'ohko') return !!D.moves.get(m).ohko;
  if (PRE.satisfiesNeed(m, n, ctx)) return true;
  if (!n || !n.orMoves || !n.orMoves.includes(id(m))) return false;
  return !(n.damagingOnly && D.moves.get(m).category === 'Status');
}
let EW_READERS = null;
function effectiveWeatherReaders() {
  if (!EW_READERS) EW_READERS = U.MOVES.filter(d => d.category !== 'Status' && handlersOf(d).some(h => /\.effectiveWeather\(/.test(h.src))).map(d => d.id).sort();
  return EW_READERS;
}
function derivedAbilityTriggers(e, preNeeds) {
  const out = [];
  const tg = tagsOf('abilities', e.id);
  const p = tg.params || {};
  const has = (by, kind) => preNeeds.some(n => n.by === by && n.kind === kind);
  const ti = p.typeImmunity;
  const functional = handlersOf(e).some(h => /^on[A-Z]/.test(h.name));
  const hasBy = by => preNeeds.some(n => n.by === by);
  const DMG = ['Physical', 'Special'];
  /* the immunity is the WHOLE ability only where it has no handler of its own; a mega that also carries it
   * (Eelevate) has a real trigger elsewhere, and its base forme's sheet ability already masks the same hit */
  if (ti && ti.type && /no handler/.test(String(ti.via || '')) && !functional && !has('receiver', 'type'))
    out.push({ kind: 'click', by: 'receiver', need: { kind: 'type', values: [ti.type], damagingOnly: true },
               handler: 'tag:typeImmunity', source: 'tag typeImmunity (' + ti.via + ')' });
  const cs = p.condStatMult;
  if (cs && cs.when === 'always' && (cs.stat === 'def' || cs.stat === 'spd') && !has('receiver', 'category'))
    out.push({ kind: 'click', by: 'receiver', need: { kind: 'category', values: [cs.stat === 'def' ? 'Physical' : 'Special'], damagingOnly: true },
               handler: 'tag:condStatMult', source: 'tag condStatMult ' + cs.stat + ' x' + cs.mult + ' always' });
  /* A HIT ON THE HOLDER IS THE TRIGGER, named by the tag rather than by a literal PRE can read: a forme broken
   * by a hit, or an attacker punished for any hit that does not have to faint the holder. Only where PRE
   * named nothing the receiver must click, so a row whose receiver need is already derived is untouched. */
  const pa = p.punishesAttacker;
  if (!hasBy('receiver') && ((tg.tags || []).includes('formeOnHit') || (pa && pa.trigger === 'anyHit' && !pa.onFaintOnly)))
    out.push({ kind: 'click', by: 'receiver', need: { kind: 'category', values: DMG, damagingOnly: true },
               handler: 'tag:' + ((tg.tags || []).includes('formeOnHit') ? 'formeOnHit' : 'punishesAttacker'), source: 'tag: a damaging hit on the holder' });
  /* THE HOLDER'S OWN ATTACK IS THE TRIGGER: a forme keyed on the category of the move it uses */
  if (!hasBy('actor') && (tg.tags || []).includes('formeOnMoveCategory'))
    out.push({ kind: 'click', by: 'actor', need: { kind: 'category', values: DMG, damagingOnly: true },
               handler: 'tag:formeOnMoveCategory', source: 'tag formeOnMoveCategory' });
  /* THE HIT MUST KNOCK THE HOLDER OUT (punishesAttacker.onFaintOnly). The planner runs no damage calculator, so
   * the knockout it can PROMISE is an OHKO move (`move.ohko`); at the bottom corner its accuracy draw succeeds. */
  if (!hasBy('receiver') && pa && pa.trigger === 'anyHit' && pa.onFaintOnly)
    out.push({ kind: 'click', by: 'receiver', need: { kind: 'ohko', values: [], damagingOnly: true, idleTwin: true },
               handler: 'tag:punishesAttacker', source: 'tag punishesAttacker.onFaintOnly' });
  /* THE HOLDER MUST KNOCK A FOE OUT WITH A MOVE (boostsOnKO.requiresMoveKO) — staged by stageHolderKOs */
  if (p.boostsOnKO && p.boostsOnKO.requiresMoveKO) {
    out.push({ kind: 'holder-kos', source: 'tag boostsOnKO.requiresMoveKO' });
    /* the knocking-out hit is the holder's; its twin is the holder not hitting */
    if (!hasBy('actor')) out.push({ kind: 'click', by: 'actor', need: { kind: 'category', values: DMG, damagingOnly: true, idleTwin: true },
                                    handler: 'tag:boostsOnKO', source: 'tag boostsOnKO: the holder\'s move lands the knockout' });
  }
  /* THE HOLDER'S SINGLE-TARGET HIT IS THE TRIGGER (tag hitsTwice). The handler's own bare-return guard names
   * the moves that are NOT triggers; where it names `move.spreadHit`, a spread move of the same category is the
   * one-click twin (data/abilities.ts, parentalbond.onPrepareHit). */
  if (!hasBy('actor') && (tg.tags || []).includes('hitsTwice')) {
    const guard = handlersOf(e).map(h => h.src).join('\n');
    out.push({ kind: 'click', by: 'actor', need: { kind: 'category', values: DMG, damagingOnly: true, singleTarget: true,
               spreadTwin: /move\.spreadHit/.test(guard) }, handler: 'tag:hitsTwice', source: 'tag hitsTwice' });
  }
  /* THE FOE IS HELD ON THE FIELD (tag preventsSwitch). The authority holds this only as `pokemon.trapped`,
   * recomputed at the end of every turn (sim/battle.ts:1723-1727) and read into the request, so the fixture is
   * read on the REQUEST, never by making the switch choice the authority would reject. */
  if (p.preventsSwitch && p.preventsSwitch.source === 'ability') out.push({ kind: 'foe-trapped', source: 'tag preventsSwitch' });
  /* THE CARRIER LEAVING THE FIELD IS THE TRIGGER (an `onSwitchOut` forme change, tag switchOutTrigger) */
  if (p.switchOutTrigger) out.push({ kind: 'carrier-switches-out', source: 'tag switchOutTrigger (' + (p.switchOutTrigger.does || '') + ')' });
  /* A FORME THAT FOLLOWS THE WEATHER needs one of the weathers it names on the field */
  const fw = p.formeFollowsWeather;
  if (fw && fw.byWeather && Object.keys(fw.byWeather).length)
    out.push({ kind: 'weather', values: Object.keys(fw.byWeather), source: 'tag formeFollowsWeather.byWeather' });
  for (const h of handlersOf(e)) {
    const sh = splitHandler(h.name); if (!sh || sh.prefix) continue;
    if (sh.base === 'hitprotect') out.push({ kind: 'target-protects', handler: h.name, source: 'handler:onHitProtect' });
    if (sh.base === 'terrainchange') {
      const v = uniq([...h.src.matchAll(/case\s+["']([a-z]+terrain)["']/g)].map(m => m[1]));
      if (v.length) out.push({ kind: 'terrain', values: v, source: 'handler:onTerrainChange case' });
    }
    const del = /conditions\.getByID\(\s*["']([a-z]+)["']/.exec(h.src);
    const via = new RegExp('\\.(' + h.name + ')\\b').exec(h.src);
    if (del && via && sh.base === 'weathermodifydamage') {
      const c = D.conditions.get(del[1]);
      const f = c && c.exists ? c[h.name] : null;
      if (typeof f === 'function') {
        const stub = normEntity({ exists: true, id: e.id + '>' + c.id, name: c.name, [h.name]: f });
        /* A WEATHER DELEGATE MAKES THE HOLDER'S OWN WEATHER THAT WEATHER: `Pokemon#effectiveWeather` returns it
         * while the active mover holds the ability (sim/pokemon.ts:2198-2202). So every move whose own handler
         * reads `effectiveWeather(` is a reader too, beside the delegate's type test. */
        const orMoves = c.effectType === 'Weather' ? effectiveWeatherReaders() : null;
        for (const n of PRE.moveNeeds(stub).needs)
          out.push({ kind: 'click', by: 'actor', need: Object.assign({ kind: n.kind, values: n.values || [], damagingOnly: true }, orMoves ? { orMoves } : {}),
                     handler: h.name, source: 'delegated to ' + c.id + '.' + h.name + ' (read by fixture_preflight.moveNeeds)' + (orMoves ? ' + ' + orMoves.length + ' effectiveWeather readers' : '') });
      }
    }
  }
  return out;
}
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
    for (const n of mn.needs) add({ kind: 'click', by: n.by, need: { kind: n.kind, values: n.values || [], damagingOnly: !!n.damagingOnly || (kind === 'abilities' && STAT_CALC.test((splitHandler(n.handler) || {}).base || '')) },
                                    handler: n.handler, source: 'fixture_preflight.moveNeeds' });
    if (kind === 'abilities') for (const t of derivedAbilityTriggers(e, mn.needs)) add(t);
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
      /* 2026-09-19 — A HANDLER THAT COUNTS THE SIDE'S DEAD AS IT ENTERS (`pokemon.side.totalFainted` in
       * onStart) reads nothing on a board where nobody has fainted, so the holder must enter AFTER a faint
       * on its own side. Membership printed before wiring: supremeoverlord only. */
      const fallen = /\.side\.totalFainted\b/.test(h.src) ? 'side-fainted' : null;
      const need = fallen || acts.find(n => n === 'screens-up') || (onPartner ? acts.find(n => n !== 'screens-up') : null);
      add({ kind: 'entry', handler: h.name, needsBeforeEntry: need || null, source: 'handler:' + h.name });
    }
    /* WEATHER AND TERRAIN the handler tests for. */
    const wx = uniq([...S.matchAll(/isWeather\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]))
      .concat([...S.matchAll(/effectiveWeather\(\)\s*===?\s*["']([a-z]+)["']/g)].map(m => m[1]))
      /* FORCE-FIRE (2026-09-19): the list-first spelling, `["raindance", …].includes(pokemon.effectiveWeather())`
       * — Swift Swim's whole guard — which neither pattern above reads, so its row was staged with no sky. */
      .concat([...S.matchAll(/\[([^\]]*)\]\.includes\(\s*\w+\.effectiveWeather\(\)\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]))));
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
      /* ---- FORCE-FIRE (2026-09-19): SIX MORE SHAPES, EACH A HANDLER STATING ITS OWN TRIGGER ------------
       * Printed before wiring (docs/_reports/2026-09-19-force-fire-a.md, "what each shape matched"). */
      /* the holder's WEIGHT is rewritten — only a move whose power reads a weight can show it */
      if (sh.base === 'modifyweight' && !sh.prefix) add({ kind: 'weight', handler: h.name, source: 'handler:onModifyWeight' });
      /* the holder TAKES the item of the body its own move hit — that body must be holding one */
      if (sh.base === 'aftermovesecondaryself' && !sh.prefix && /\.takeItem\(/.test(h.src)) add({ kind: 'target-holds-item', handler: h.name, source: 'handler:onAfterMoveSecondarySelf takeItem' });
      /* the holder restores a BERRY it has already eaten (`lastItem` + `isBerry` on an empty hand) */
      if (!sh.prefix && /\.lastItem\b/.test(h.src) && /\.isBerry\b/.test(h.src) && /!\s*\w+\.item\b/.test(h.src) && !/usedItemThisTurn/.test(h.src))
        add({ kind: 'holder-ate-berry', handler: h.name, source: 'handler reads lastItem.isBerry on an empty hand' });
      /* the holder picks up an item ANOTHER body used this turn */
      if (!sh.prefix && /\.usedItemThisTurn\b/.test(h.src) && /\.lastItem\b/.test(h.src))
        add({ kind: 'nearby-item-used', handler: h.name, source: 'handler reads another body\'s usedItemThisTurn/lastItem' });
      /* the holder reads the FOES' movesets for a move that is super-effective on it */
      if (!sh.prefix && /^(start|switchin)$/.test(sh.base) && /\.foes\(\)/.test(h.src) && /moveSlots/.test(h.src) && /getEffectiveness\(/.test(h.src))
        add({ kind: 'foe-carries-se-move', handler: h.name, source: 'handler walks foes().moveSlots through getEffectiveness' });
      /* an accuracy handler that makes a move ALWAYS hit, on either side of the holder — only the corner
       * where a sub-100 move misses can show it (PRE's `accuracy-roll` needs EVERY handler in the family) */
      if (ACC_EVENTS.test(sh.prefix === 'Any' || sh.prefix === 'Source' || !sh.prefix ? sh.base : '') && /return\s+true/.test(h.src)
          && !PRE.boardNeeds(NE_OF(e)).some(n => n.kind === 'accuracy-roll'))
        add({ kind: 'board', state: 'accuracy-roll', values: [], handler: h.name, alwaysHits: true, source: 'handler:' + h.name + ' returns true (planner-derived)' });
    }
    /* A FRACTIONAL PRIORITY WRITTEN AS A NUMBER, NOT A HANDLER (`onFractionalPriority: -0.1`) — invisible
     * to every handler walk above. Negative: the holder moves LAST in its bracket, visible only if it would
     * otherwise move first; positive: the reverse, which is the existing `carrier-slower` shape. */
    if (typeof e.onFractionalPriority === 'number' && e.onFractionalPriority !== 0)
      add(e.onFractionalPriority < 0 ? { kind: 'carrier-faster', value: e.onFractionalPriority, source: 'field:onFractionalPriority ' + e.onFractionalPriority }
                                     : { kind: 'carrier-slower', value: e.onFractionalPriority, source: 'field:onFractionalPriority ' + e.onFractionalPriority });
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
      /* ---- FORCE-FIRE (2026-09-19): THREE STATUS SHAPES THE READS ABOVE NEVER SAW ----------------------
       * Will: "why cant we stage games that force the ability to fire". Each was a DID-NOT-FIRE row whose
       * handler states its trigger in a spelling the matchers above skip. Printed before wiring
       * (docs/_reports/2026-09-19-force-fire-a.md): each adds a trigger to exactly the rows named there.
       *   1. A BARE TRUTH TEST — `if (pokemon.status)` — which the negative lookahead `(?!\s*\))` above
       *      excludes by construction (Guts, Marvel Scale, Quick Feet). Marked `any-acting`: the holder's
       *      stat or speed only shows if the holder can still act, so the stager resolves it to the
       *      statuses whose condition has no `onBeforeMove` (see ACTING_STATUSES), never to sleep.
       *   2. A STATUS NAMED AS THE DAMAGE'S EFFECT — `effect.id === "psn"` in the holder's own onDamage
       *      (Poison Heal): the chip it rewrites is the status's residual, so the holder carries it.
       *   3. `onAfterSetStatus` — the holder is the one statused (Synchronize). Every status the handler
       *      does NOT return early on is a trigger; the early-return guards are read, not listed. */
      if (!sts.size && !foeSts.size) for (const m of h.src.matchAll(/if\s*\(\s*(\w+)\.status\s*\)|(\w+)\.status\s*&&/g)) {
        const v = m[1] || m[2];
        if (/^(pokemon|source|target)$/.test(v) && !foeVar.test(v)) { sts.add('any-acting'); break; }
      }
      if (sh.base === 'damage') for (const m of h.src.matchAll(/effect\.id\s*===\s*["'](brn|par|psn|tox|slp|frz)["']/g)) sts.add(m[1]);
      /* only the shape that hands the status BACK to its source — printed first, the bare event also caught
       * Lum Berry, whose own `any` already covers it */
      if (sh.base === 'aftersetstatus' && /source\.\w*[sS]etStatus\(/.test(h.src)) {
        const skipped = new Set();
        for (const g of h.src.matchAll(/if\s*\(([^)]*)\)\s*return/g)) for (const s of g[1].matchAll(/["'](brn|par|psn|tox|slp|frz)["']/g)) skipped.add(s[1]);
        for (const s of STATUS_IDS) if (!skipped.has(s)) sts.add(s);
      }
    }
    /* FORCE-FIRE (2026-09-19): A MECHANIC READ INSIDE A STATUS'S OWN `onBeforeMove` (Early Bird is read at
     * the `slp` condition's `onBeforeMove`, data/conditions.ts:68) needs its holder to CARRY that status and
     * to try to move under it. The status is the condition block that encloses the reading line, read off
     * the authority's file rather than named. */
    for (const t of out.filter(x => x.kind === 'read-elsewhere')) for (const s of t.sites || []) {
      if (s.fn !== 'onBeforeMove') continue;
      const st = enclosingCondition(s.at);
      if (st && STATUS_IDS.includes(st)) { sts.add(st); t.statusRead = st; }
    }
    if (sts.size && !out.some(t => t.kind === 'ally-guard')) add({ kind: 'holder-statused', values: [...sts], source: 'status reads on the holder, resolved by event role' });
    /* 2026-09-19 — AND WHEN THE STATUS IS READ ON THE WAY OUT, the holder has to LEAVE. A statused holder
     * that stays on the field is byte-identical to one without the ability. Membership printed before
     * wiring: naturalcure only (its Champions override, data/mods/champions/abilities.ts:63-71). */
    if (sts.size && H.some(h => h.name === 'onSwitchOut' && /\.status\b/.test(h.src)))
      add({ kind: 'switch-out', handler: 'onSwitchOut', source: 'handler:onSwitchOut reads the holder\'s status' });
    if (foeSts.size) add({ kind: 'foe-statused', values: [...foeSts], source: 'status reads on the foe, resolved by event role' });
    /* A TYPE IMMUNITY THE HANDLER SWITCHES OFF (`move.ignoreImmunity["Normal"] = true`). */
    const byp = uniq([...S.matchAll(/ignoreImmunity\[\s*["']([A-Za-z]+)["']\s*\]\s*=\s*true/g)].map(m => m[1]));
    if (byp.length) add({ kind: 'bypass-immunity', values: byp, source: 'handler writes move.ignoreImmunity' });
    /* A BASE-POWER CEILING the holder's own move must sit under. */
    for (const h of H) { const sh = splitHandler(h.name); const m = /\bbasePower\w*\s*<=\s*(\d+)/.exec(h.src); /* FORCE-FIRE 2026-09-19: `basePowerAfterMultiplier <= 60` (Technician) is the same ceiling */ if (sh && sh.base === 'basepower' && !sh.prefix && m) add({ kind: 'click-bp', max: +m[1], handler: h.name, source: 'handler:onBasePower basePower <= ' + m[1] }); }
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
    /* 2026-09-19 (close-two-clauses) — A MOVE THAT REWRITES THE TARGET'S STAGES OUT OF THE TARGET'S STAGES has
     * nothing to act on against an unboosted receiver: Topsy-Turvy returns false, and Guard Swap / Power Swap
     * exchange two empty pairs and move no board leaf in either engine. Derived from the handler, never the
     * name: it READS `target.boosts` AND WRITES stages (`setBoost(` or a `boosts[..] =` assignment), on a move
     * that lands on a foe. The stats are the handler's own array literal when it has one (`["def", "spd"]`).
     * Membership printed before wiring, over the legal moves: guardswap [def,spd], powerswap [atk,spa],
     * psychup [any], topsyturvy [any]. */
    {
      const S = handlersOf(e).map(h => h.src).join('\n');
      const FOE_T = ['normal', 'any', 'adjacentFoe', 'randomNormal', 'allAdjacentFoes', 'allAdjacent'];
      if (!has('punishesBoostedTarget') && FOE_T.includes(e.target) && /target\.boosts\b/.test(S)
          && /setBoost\(|\.boosts\[\w+\]\s*=(?!=)/.test(S)) {
        const stats = uniq([...S.matchAll(/\[\s*((?:["'](?:atk|def|spa|spd|spe|accuracy|evasion)["']\s*,?\s*)+)\]/g)]
          .flatMap(x => x[1].match(/atk|def|spa|spd|spe|accuracy|evasion/g)));
        add({ kind: 'target-boosted', stats: stats.length ? stats : null, source: 'handler reads target.boosts and writes stages' });
      }
    }
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
      /* an OHKO move into an ability whose own handler tests `move.ohko` and returns false (read, not named) */
      if (mv.ohko && target.ability && handlersOf(D.abilities.get(target.ability)).some(h => /move\.ohko/.test(h.src) && /return\s+(null|false)/.test(h.src))) r.push('ability ' + target.ability + ' refuses OHKO moves');
      /* a typed OHKO (`ohko: "Ice"`) cannot knock out a body of its own type (sim/battle-actions.ts, the ohko branch of the hit check) */
      if (typeof mv.ohko === 'string' && tt.includes(mv.ohko)) r.push('the ' + mv.ohko + '-typed OHKO cannot knock out a ' + mv.ohko + ' type');
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
  /* FORCE-FIRE (2026-09-19): A CURE CAN ONLY WRITE WHERE THERE IS A STATUS. A handler whose only write is
   * `cureStatus(` is silent on a board where no click inflicts one (Healer beside an Aroma Veil fixture,
   * whose trigger is a Taunt), and counting it as noise refused the only control that board had. */
  const clicks = ((rc && rc.turns) || []).flatMap(t => Object.values(t)).filter(c => c && c.m).map(c => D.moves.get(c.m));
  const stagesStatus = clicks.some(d => d && d.exists && !!PRE.statusOf(d));
  return handlersOf(a).filter(h => {
    const s = splitHandler(h.name); if (!s) return false;
    const onlyCures = /cureStatus\(/.test(h.src) && !LEAF_RULES.filter(([re]) => !re.test('cureStatus(')).some(([re]) => re.test(h.src));
    if (onlyCures && !stagesStatus) return false;
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
        /* a click that faints its user: the replacement the driver sends takes the slot after the turn */
        if (c.faintsInto) swaps.push([s, i, c.faintsInto]);
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
/* FORCE-FIRE (2026-09-19) — TWO STATUS PARTITIONS, READ OFF THE FORMAT'S OWN CONDITIONS (the Champions mod
 * dex, so its `par`/`slp`/`frz` overrides are the ones read):
 *   ACTING  a status whose condition has no `onBeforeMove` — the body still acts under it. A holder whose
 *           mechanic multiplies its own attack or speed only shows it while it acts; at the bottom corner a
 *           paralysed body is fully paralysed and a sleeping one never moves.
 *   STABLE  a status whose condition never calls `cureStatus` — it is still on the body at end of turn.
 *           A frozen partner thaws on its own click at the bottom corner, so a residual cure found nothing
 *           to cure (the Healer fixture before this pass). */
const ACTING_STATUSES = () => STATUS_IDS.filter(s => { const c = D.conditions.get(s); return c && c.exists && typeof c.onBeforeMove !== 'function'; });
const STABLE_STATUSES = () => STATUS_IDS.filter(s => { const c = D.conditions.get(s); return c && c.exists && !handlersOf(c).some(h => /cureStatus\(/.test(h.src)); });
/* THE CONDITION BLOCK THAT ENCLOSES A CITED LINE (`data/conditions.ts:68` -> `slp`), read off the file: the
 * nearest `\t<id>: {` at one tab of indentation above it. Null when the file or the block is not found. */
/* A RESIST BERRY THAT ANSWERS THIS HIT on a holder of these types, read off the tag params (`resistBerry`:
 * `onType`, `requiresSuperEffective`), or null. */
function resistBerryFor(d, holderTypes) {
  if (!d || d.category === 'Status' || d.target !== 'normal' || !D.getImmunity(d.type, holderTypes)) return null;
  const se = D.getEffectiveness(d.type, holderTypes) > 0;
  return U.ITEMS.filter(i => i.isBerry).map(i => ({ i, p: tagsOf('items', i.id).params.resistBerry }))
    .filter(o => o.p && o.p.onType === d.type && (!o.p.requiresSuperEffective || se))
    .sort((a, b) => (a.i.id < b.i.id ? -1 : 1)).map(o => o.i)[0] || null;
}
/* THE HOLDER'S WEIGHT AFTER ITS OWN `onModifyWeight`, by calling the handler on the species weight. */
function modifiedWeight(e, handler, w) {
  try { return e[handler].call({ trunc: D.trunc.bind(D) }, w); }
  catch (err) { refuse('PLANNER-CANNOT-CONSTRUCT', e.name + '.' + handler + ' could not be evaluated on weight ' + w + ': ' + err.message); }
}
/* A WEIGHT-READ MOVE'S POWER, by calling its own `basePowerCallback` with two bodies that answer
 * `getWeight()`. Null when the callback throws — counted as "no change", so the move is never chosen. */
function weightPower(d, wUser, wTarget) {
  const body = w => ({ getWeight: () => w, volatiles: {}, hasAbility: () => false, hasItem: () => false });
  const ctx = { debug() {}, add() {}, hint() {}, dex: D, trunc: D.trunc.bind(D) };
  try { return d.basePowerCallback.call(ctx, body(wUser), body(wTarget), d); }
  catch (err) { return 'THREW:' + err.message; }
}
/* THE QUIETEST ITEM A BODY CAN HOLD WITHOUT MOVING THE MEASURED LEAF: fewest functional handlers (a weight
 * or take-item hook is not one), then fewest tags — the formula the partner's passed item has always used.
 * `removable` also drops any item with an `onTakeItem` hook, which is how an item refuses to leave. */
function quietItem(rc, side, opt) {
  return U.ITEMS.filter(i => !i.megaStone && !i.isBerry && !i.itemUser && !rc.items[side].has(i.id)
      && !(opt && opt.removable && typeof i.onTakeItem !== 'undefined'))
    .map(i => ({ i, h: handlersOf(i).filter(h => !/^on(ModifyWeight|TakeItem)$/.test(h.name)).length, t: tagsOf('items', i.id).tags.filter(t => t !== 'flingable').length }))
    .sort((a, b) => a.h - b.h || a.t - b.t || (a.i.id < b.i.id ? -1 : 1)).map(o => o.i)[0] || null;
}
function enclosingCondition(at) {
  const m = /^(.+):(\d+)$/.exec(String(at || '')); if (!m) return null;
  let L; try { L = srcOf(m[1]); } catch (e) { console.error('  stage_planner: cannot read ' + m[1] + ' for ' + at + ' (' + e.message + ')'); return null; }
  for (let i = +m[2] - 1; i >= 0; i--) { const b = /^\t([a-z0-9]+):\s*\{/.exec(L[i]); if (b) return b[1]; }
  return null;
}
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
  /* `side-fainted` needs no partner at all: the lead faints and the carrier REPLACES it, so the partner
   * may guard like any idle body. Every other entry need acts on the partner and keeps it live. */
  if (en) { entry = en.needsBeforeEntry; rc.lineup.p1 = ['LP', 'CA', 'C', null]; if (entry !== 'side-fainted') rc.live.add('CA'); }
  /* ---- WHO THE PARTNER IS ---- */
  const allyTrig = trig.filter(t => /^ally-/.test(t.kind) || (t.kind === 'click' && t.by === 'ally'));
  const bodyType = T('body-type')[0];
  const needCA = [];
  if (allyTrig.length || (entry && entry !== 'side-fainted') || bodyType) rc.live.add('CA');
  if (T('ally-ability').length) needCA.push({ values: T('ally-ability')[0].values });
  /* ---- THE RECEIVER'S REQUIREMENTS ---- */
  let reqR = [];                                 /* { key, pred(d, sp), at, turn } */
  for (const t of T('click').filter(t => t.by === 'receiver' || t.by === 'either')) {
    const redirect = /RedirectTarget/.test(t.handler || '');
    reqR.push({ key: 'need:' + t.need.kind, handler: t.handler, at: redirect ? 'CA' : 'C', turn: 'trigger',
                pred: (d, sp) => needMet(d.id, t.need, { userTypes: sp.types, targetTypes: typesOf(rc.bodies.C) })
                  && (d.category !== 'Status' || d.target !== 'self'),
                except: redirect ? [] : exceptSelf, why: 'the handler ' + t.handler + ' needs ' + t.need.kind + '=' + t.need.values.join('/') });
    if (redirect) rc.live.add('CA');
  }
  const stTrig = T('holder-statused')[0];
  if (stTrig) {
    const want = stTrig.values.includes('any') || !stTrig.values.length ? STATUS_IDS
      : stTrig.values.includes('any-acting') ? ACTING_STATUSES() : stTrig.values;
    if (!want.length) refuse('PLANNER-CANNOT-CONSTRUCT', 'the holder must carry a status it can still act under, and no status condition in the format lacks onBeforeMove');
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
    pred: d => needMet(d.id, { kind: 'statDrop', values: [] }), why: 'the handler restores a dropped stat' });
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
  /* FORCE-FIRE (2026-09-19): TWO MORE WAYS A BERRY MUST HAVE BEEN EATEN. `holder-ate-berry` — the holder
   * restores one it ate (the carrier eats it); `nearby-item-used` — the holder picks up one ANOTHER body
   * used this turn (the receiver eats it, off the carrier's own hit). Both are built as a RESIST berry: it
   * is eaten on the first hit of its type from full HP, so the fixture assumes no damage number at all —
   * unlike the heal-threshold berry, whose two real-pool hits are an assumption the Ripen control disproved
   * by fainting the holder a turn early (moveNotOnRequest on 2026-09-19's run). */
  if (T('nearby-item-used').length) berry = { kind: 'resist', holder: 'R', thrower: 'C' };
  else if (T('holder-ate-berry').length) { berry = { kind: 'resist', holder: 'C', thrower: 'R' };
    reqR.push({ key: 'berry-resist', at: 'C', turn: 'trigger', except: exceptSelf,
                pred: d => !!resistBerryFor(d, typesOf(rc.bodies.C)), why: 'the carrier must eat a berry: a hit its resist berry answers' }); }
  if (!berry && (board('item-consumed') || T('ally-item-consumed').length)) {
    const holderRole = T('ally-item-consumed').length ? 'CA' : 'C';
    const events = handlersOf(e).map(h => (splitHandler(h.name) || {}).base);
    const cureBerries = U.ITEMS.filter(i => i.isBerry && (tagsOf('items', i.id).params.curesStatus || {}).statuses && tagsOf('items', i.id).params.curesStatus.statuses !== 'any');
    /* `onSourceModifyDamage` splits to base `modifydamage` with prefix `Source`, so the bare-name test below
     * never matched it and a resist-berry mechanic (Ripen's `berryWeaken`) was staged on the heal berry.
     * FORCE-FIRE 2026-09-19: the handler NAME is asked as well. */
    if (events.includes('sourcemodifydamage') || handlersOf(e).some(h => h.name === 'onSourceModifyDamage')) {
      berry = { kind: 'resist' };
    } else if (events.includes('tryheal')) {
      berry = { kind: 'heal', item: U.ITEMS.find(i => (tagsOf('items', i.id).params.healsAtThreshold || {}).restores) };
    } else {
      berry = { kind: 'cure', options: cureBerries.map(i => ({ item: i, status: tagsOf('items', i.id).params.curesStatus.statuses[0] })) };
    }
    berry.holder = holderRole;
    /* A HANDLER THAT EATS THE BERRY A SECOND TIME needs a status that is still there when it does: one whose own
     * condition never calls `cureStatus` (derived: frz and slp cure themselves in `onBeforeMove`, and at the bottom
     * corner every thaw and wake die succeeds, so the first Cud Chew fixture's freeze was gone by the re-eat). */
    if (berry.kind === 'cure' && isAb && reEatsBerry(e)) {
      const lasting = berry.options.filter(o => !handlersOf(D.conditions.get(o.status)).some(h => /cureStatus\(/.test(h.src)));
      if (lasting.length) { berry.options = lasting; rc.notes.push('the berry cures a status that does not cure itself (' + uniq(lasting.map(o => o.status)).join('/') + '), so it is still there at the second eat'); }
    }
    if (berry.kind === 'cure') reqR.push({ key: 'berry-status', at: holderRole, turn: 'setup', except: [],
      pred: d => berry.options.some(o => statusMoveFor(o.status)(d)), why: 'a status the berry on ' + holderRole + ' cures' });
    if (berry.kind === 'resist' && holderRole === 'C') { berry.thrower = 'R';
      reqR.push({ key: 'berry-resist', at: 'C', turn: 'trigger', except: exceptSelf,
                  pred: d => !!resistBerryFor(d, typesOf(rc.bodies.C)), why: 'the holder must eat a resist berry: a hit of its type' }); }
    if (holderRole === 'CA') rc.live.add('CA');
  }
  const allyGuard = T('ally-guard')[0];
  const pa = (tagsOf('abilities', e.id).params || {}).protectsAllyFromStatus;
  if (allyGuard) {
    const at = branch === 'covers-self' ? 'C' : 'CA';
    const vols = pa && pa.volatiles && pa.volatiles.length ? pa.volatiles : null;
    const sts = pa && Array.isArray(pa.statuses) && pa.statuses.length ? pa.statuses : null;
    let pred;
    /* FORCE-FIRE (2026-09-19): NOT A VOLATILE WHOSE OWN CONDITION READS `.gender`. The veil's list names
     * Attract first, and Attract fails on a genderless partner before the veil is ever asked — the Aroma
     * Veil fixture clicked it and nothing on either board could move. */
    const genderGated = v => { const c = D.conditions.get(v); return !!(c && c.exists && handlersOf(c).some(h => /\.gender\b/.test(h.src))); };
    if (allyGuard.base === 'tryaddvolatile') pred = d => d.category === 'Status' && !!d.volatileStatus && (!vols || vols.includes(d.volatileStatus)) && d.target === 'normal' && !genderGated(d.volatileStatus);
    else if (allyGuard.base === 'setstatus') pred = d => (sts || STATUS_IDS).some(s => statusMoveFor(s)(d));
    else pred = d => needMet(d.id, { kind: 'statDrop', values: [] }) && d.category === 'Status';
    reqR.push({ key: 'ally-guard', at, turn: 'trigger', except: at === 'C' ? exceptSelf : [], pred, why: 'the veil must be asked on ' + at + ' (' + allyGuard.handler + ')' });
    rc.live.add('CA');
  }
  /* A VEIL'S OWN HANDLER IS ONE TRIGGER, not two: the move need PRE reads off `onAllyTryBoost` and the
   * veil request for the same handler are the same click, aimed where the veil is asked. */
  if (allyGuard) reqR = reqR.filter(q => !(q.key.startsWith('need:') && q.handler === allyGuard.handler));
  if (T('ally-hit').length) reqR.push({ key: 'ally-hit', at: 'CA', turn: 'trigger', except: [], pred: d => d.category !== 'Status' && d.target === 'normal', why: 'the partner must take a hit' });
  /* FORCE-FIRE (2026-09-19): the partner's status must still be ON it when the cure is asked — a STABLE
   * status (see STABLE_STATUSES). The Healer fixture froze its partner, which thawed on its own click. */
  if (T('ally-statused').length) reqR.push({ key: 'ally-status', at: 'CA', turn: 'setup', except: [], pred: d => STABLE_STATUSES().some(s => statusMoveFor(s)(d)), why: 'the partner must carry a status that stays on it' });
  if (entry === 'ally-damaged') reqR.push({ key: 'entry-hurt', at: 'CA', turn: 'setup', except: [], pred: d => d.category !== 'Status' && d.target === 'normal', why: 'the partner must be damaged before the holder enters' });
  if (entry === 'ally-statused') reqR.push({ key: 'entry-status', at: 'CA', turn: 'setup', except: [], pred: d => STABLE_STATUSES().some(s => statusMoveFor(s)(d)), why: 'the partner must be statused before the holder enters' });
  /* FORCE-FIRE (2026-09-19): not a screen that FAILS without its sky (tag `failsWithoutWeather`) — the Screen
   * Cleaner fixture clicked Aurora Veil on a clear board and there was no screen for it to clean. */
  if (entry === 'screens-up') reqR.push({ key: 'entry-screen', at: null, turn: 'setup', except: [], pred: d => !!d.sideCondition && !!d.condition && Object.keys(d.condition).some(k => /ModifyDamage/.test(k)) && !tagsOf('moves', d.id).tags.includes('failsWithoutWeather'), why: 'a screen must be up before the holder enters' });
  /* FORCE-FIRE (2026-09-19): A WEIGHT MODIFIER — the receiver throws a move whose power is read off the
   * holder's weight, and ONLY one whose power CHANGES when the holder's handler rewrites that weight. The
   * power is the move's own `basePowerCallback`, called on the two weights (the handler's own arithmetic
   * decides the second); a callback that throws is refused by name, never guessed. */
  const wt = T('weight')[0];
  if (wt) {
    const wC = spOf(rc.bodies.C.species).weighthg;
    const wC2 = modifiedWeight(e, wt.handler, wC);
    reqR.push({ key: 'weight', at: 'C', turn: 'trigger', except: exceptSelf,
                pred: (d, sp) => d.category !== 'Status' && typeof d.basePowerCallback === 'function' && /getWeight\(/.test(String(d.basePowerCallback))
                  && weightPower(d, sp.weighthg, wC) !== weightPower(d, sp.weighthg, wC2),
                why: 'a weight-read move whose power moves when ' + e.name + ' rewrites the holder\'s weight (' + wC + ' -> ' + wC2 + ' hg)' });
  }
  /* FORCE-FIRE (2026-09-19): THE FOE MUST CARRY (not click) a move super-effective on the holder, which the
   * holder's entry handler reads off `foes().moveSlots`. */
  if (T('foe-carries-se-move').length)
    reqR.push({ key: 'carry-se', at: null, turn: 'carry', except: [], pred: d => d.category !== 'Status' && D.getImmunity(d.type, typesOf(rc.bodies.C)) && D.getEffectiveness(d.type, typesOf(rc.bodies.C)) > 0,
                why: 'a foe must carry a move super-effective on the holder' });
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
        /* FORCE-FIRE (2026-09-19): A FLINCH LANDS ONLY IF ITS THROWER MOVES FIRST — by priority, or by
         * Speed on the authority's own statModify. The legacy arm has refused a slower flincher since
         * 2026-08-12; the planner staged Steadfast behind a slower Bite and read DID-NOT-FIRE. */
        if (q.key === 'need:flinch' && !((d.priority || 0) > 0 || speedOf(body) > speedOf(rc.bodies.C))) return false;
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
  /* FORCE-FIRE (2026-09-19): a NEGATIVE fractional priority (`carrier-faster`) is visible only where the
   * holder would otherwise move first, so the receiver is strictly slower on the authority's statModify. */
  const faster = T('carrier-faster').length > 0;
  const rSpeed = faster ? (s) => s < speedOf(rc.bodies.C) : slower ? (BRK === 'prankster-fast' ? (s) => s < speedOf(rc.bodies.C) : (s) => s > speedOf(rc.bodies.C)) : multWindow ? multWindow : speedOrder ? (s) => s > speedOf(rc.bodies.C) && s < speedOf(rc.bodies.C) * (speedOrder.multiplier || 2) : null;
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
  /* FORCE-FIRE (2026-09-19): the holder takes the item of the body it hits, so that body holds one — the
   * quietest removable item in the format (see `quietItem`). */
  if (T('target-holds-item').length) {
    const it = quietItem(rc, 'p2', { removable: true });
    if (!it) refuse('PLANNER-CANNOT-CONSTRUCT', 'no quiet removable item for the receiver to hold');
    setItem(rc, 'R', it.name);
    rc.notes.push('R holds ' + it.name + ' (the quietest removable item) for the holder\'s own hit to take');
  }
  const rMoves = {};
  for (const { q, m } of rPick.moves) rMoves[q.key] = addMove(rc, 'R', m);

  /* ======== THE PARTNER ======== */
  const caReq = [];
  if (T('click').some(t => t.by === 'ally')) for (const t of T('click').filter(t => t.by === 'ally'))
    caReq.push({ key: 'need', at: 'R', pred: (d, sp) => needMet(d.id, t.need, { userTypes: sp.types, targetTypes: typesOf(rc.bodies.R) }) });
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
    if (actor.length) pred = d => actor.every(t => needMet(d.id, t.need, { userTypes: typesOf(rc.bodies.C), targetTypes: typesOf(R) }))
      && (actor.every(t => t.need.kind === 'statRaise') || d.category !== 'Status' || d.target !== 'self' || actor.some(t => t.need.kind === 'category'));
    if (actor.some(t => t.need.singleTarget)) { const q = pred; pred = d => q(d) && d.target === 'normal'; }
    if (bp) { const q = pred; pred = d => q(d) && d.category !== 'Status' && d.basePower > 0 && d.basePower <= bp.max; }
    if (accPlan && accPlan.holderAttacks) { const q = pred; pred = d => q(d) && accPlan.good(d); }
    if (critPlan) { const q = pred; pred = d => q(d) && d.category !== 'Status' && (d.critRatio || 1) === 1 && (d.accuracy === true || d.accuracy >= 100); }
    if (T('target-punishes-contact').length) { const q = pred; pred = d => q(d) && d.flags && d.flags.contact; }
    void p0;
    const byp = T('bypass-immunity')[0];
    if (byp) { const q = pred; pred = d => q(d) && d.category !== 'Status' && byp.values.includes(d.type); }
    /* the type immunity IS the trigger of a bypass fixture, so it is excepted on that click only */
    const exceptAcc = (accPlan && accPlan.holderAttacks ? ['accuracy'] : []).concat(byp ? ['type'] : [])
      /* A SHIELD-PIERCING HOLDER: the target's shield IS the trigger, so it is excepted on this click only */
      .concat(T('target-protects').length ? ['guard'] : []);
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
                  'entry-status': ['CA', 0], 'entry-screen': [null, 0], acc: ['C', 1], 'acc-vol': ['C', 0],
                  'berry-resist': [berry && berry.holder, 1], weight: ['C', 1] };
    /* a CARRIED move is on the receiver's sheet for the holder to read, and is never clicked */
    if (key === 'carry-se') { rc.notes.push('R carries ' + m + ' (super-effective on the holder) and never clicks it'); continue; }
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
  /* ---- a foe held on the field: read off the authority's request for the receiver ---- */
  if (T('foe-trapped').length) {
    rc.observe = { role: 'R', leaf: 'trapped', channel: 'request', leaves: ['trapped'] };
    rc.notes.push('the receiver\'s trapped flag is read at each boundary — the authority\'s `pokemon.trapped`, ours by asking switchTrapVerdict — never by a switch choice');
  }
  /* ---- the carrier switches out on the trigger turn; the bench row is where the forme is read ---- */
  if (T('carrier-switches-out').length && !board('trapped')) {
    acts.push({ role: 'C', click: { sw: 'CB' }, phase: 1 });
    rc.conditions.push({ kind: 'click', role: 'C', sw: 'CB', phase: 1 });
    rc.observe = { role: 'C', leaf: 'species', channel: 'board', leaves: ['species'] };
    rc.notes.push('the carrier switches to the bench on the trigger turn; its switch-out handler writes the bench row');
  }
  /* ---- A HANDLER THAT EATS THE CONSUMED BERRY AGAIN (force-fire-b, 2026-09-19) ----
   * The second eat runs the berry's own `Eat` (`singleEvent('Eat', item, …)` in the handler), and a cure berry
   * cures nothing on a holder the first eat already cured — Cud Chew read `authority_moved: false` for exactly
   * that. So the status is delivered AGAIN on the trigger turn, and the second eat has something to cure. */
  if (isAb && berry && berry.kind === 'cure' && rc.rMoves && rc.rMoves['berry-status'] && reEatsBerry(e)
      && !acts.some(a => a.role === 'R' && a.phase === 1)) {
    const m = rc.rMoves['berry-status'];
    acts.push({ role: 'R', click: { m, at: berry.holder }, phase: 1 });
    tc('R', berry.holder, m, 1, { except: [], statusIsTrigger: true });
    rc.conditions.push({ kind: 'click', role: 'R', move: m, phase: 1 });
    rc.notes.push(D.moves.get(m).name + ' lands again on the trigger turn, so the berry eaten a second time has a status to cure');
  }
  /* ---- the target raises a shield the holder's hit goes through (onHitProtect) ---- */
  if (T('target-protects').length) {
    if (acts.some(a => a.role === 'R' && a.phase === 1)) refuse('PLANNER-CANNOT-CONSTRUCT', 'the receiver must shield on the trigger turn and already has a trigger click');
    /* the plain shield only — the one every pad in this file already clicks — so no contact punisher rides in */
    const g = ['protect'].find(m => legal(D.moves.get(m)) && learns(rc.bodies.R.species, m));
    if (!g) refuse('NO-TRIGGER-SUPPLIER', 'the receiver ' + rc.bodies.R.species + ' does not learn Protect for the holder to hit through');
    acts.push({ role: 'R', click: { m: addMove(rc, 'R', g) }, phase: 1 });
    rc.conditions.push({ kind: 'click', role: 'R', move: g, phase: 1 });
    rc.notes.push('the receiver shields with ' + D.moves.get(g).name + ' on the trigger turn; the holder\'s hit is read through it (onHitProtect)');
  }
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
    } else if (berry.kind === 'resist' && berry.thrower === 'R') {
      /* FORCE-FIRE (2026-09-19): the receiver's hit of the berry's type lands on the holder from full HP */
      const m = rc.rMoves['berry-resist'];
      const b = m && resistBerryFor(D.moves.get(m), typesOf(rc.bodies[berry.holder]));
      if (!b) refuse('PLANNER-CANNOT-CONSTRUCT', 'no resist berry answers the receiver\'s hit ' + m);
      setItem(rc, berry.holder, b.name);
      rc.notes.push(berry.holder + ' holds ' + b.name + ' and eats it when ' + D.moves.get(m).name + ' lands (tag resistBerry)');
    } else if (berry.kind === 'resist' && berry.thrower === 'C') {
      /* FORCE-FIRE (2026-09-19): the CARRIER's own hit makes the receiver eat its berry this turn */
      const pool = [...(U.POOL.get(spOf(rc.bodies.C.species).id) || [])].filter(k => { const d = D.moves.get(k); return legal(d) && !!resistBerryFor(d, typesOf(rc.bodies.R)); });
      const m = rankMoves(pool).find(k => !masksFor(k, rc.bodies.C, rc.bodies.R, { arm: rc.arm }).length);
      if (!m) refuse('NO-TRIGGER-SUPPLIER', 'the carrier ' + rc.bodies.C.species + ' learns no hit a resist berry on ' + rc.bodies.R.species + ' answers');
      const b = resistBerryFor(D.moves.get(m), typesOf(rc.bodies.R));
      setItem(rc, 'R', b.name);
      const mv = addMove(rc, 'C', m);
      acts.push({ role: 'C', click: { m: mv, at: 'R' }, phase: 1 });
      tc('C', 'R', m, 1, {});
      rc.conditions.push({ kind: 'click', role: 'C', move: m, phase: 1 });
      rc.notes.push('R holds ' + b.name + ' and eats it when the carrier\'s ' + D.moves.get(m).name + ' lands (tag resistBerry)');
    } else refuse('PLANNER-CANNOT-CONSTRUCT', 'a resist-berry consumption fixture with holder ' + berry.holder + ' is not built by this planner yet');
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
  /* ---- entry after a FAINT on the carrier's own side (the handler counts `side.totalFainted`) ----
   * The lead clicks a move that ALWAYS faints its user (tag userFaints.faints === 'always', derived), the
   * carrier REPLACES it — the driver sends the first healthy bench body, which is C by the lineup — and on
   * the next turn the carrier hits the receiver. The board leaf is the receiver's HP; the control (same
   * body, the other ability) takes the same faint and hits for the unboosted amount. */
  if (entry === 'side-fainted') {
    const always = U.MOVES.filter(d => ((U.T.moves[d.id] || { params: {} }).params.userFaints || {}).faints === 'always');
    let lp = null;
    for (const sid of speciesOrder()) {
      const sp = D.species.get(sid);
      if (rc.used.has(id(sp.baseSpecies || sp.name))) continue;
      const m = rankMoves(always.filter(d => learns(sp.name, d.id)).map(d => d.id))[0];
      const ab = quietAbility(sp.name, weatherish().concat([e.id]));
      if (m && ab) { lp = { sp, m, ab }; break; }
    }
    if (!lp) refuse('NO-TRIGGER-SUPPLIER', 'no legal lead learns a move that always faints its user (tag userFaints)');
    useSpecies(rc, lp.sp.name);
    setBody(rc, 'LP', { species: lp.sp.name, field: lp.sp.name, ability: lp.ab });
    const km = addMove(rc, 'LP', lp.m);
    acts.push({ role: 'LP', click: { m: km, at: null, faintsInto: 'C' }, phase: 0 });
    rc.conditions.push({ kind: 'click', role: 'LP', move: lp.m, turn: 1 });
    const h = hitFor(rc, 'C', 'R', {});
    if (!h) refuse('NO-TRIGGER-SUPPLIER', 'the carrier ' + rc.bodies.C.species + ' has no hit that lands on ' + rc.bodies.R.species);
    acts.push({ role: 'C', click: { m: h, at: 'R' }, phase: 1 });
    tc('C', 'R', h, 1, {});
    rc.conditions.push({ kind: 'click', role: 'C', move: id(h), phase: 1 });
    rc.observe = { role: 'R', leaf: 'hp', channel: 'board', leaves: ['hp'] };
    rc.notes.push(lp.sp.name + ' clicks ' + D.moves.get(lp.m).name + ' (userFaints always) and the carrier replaces it: one fallen before entry');
  } else if (T('switch-out').length) {
    /* the statused holder LEAVES on the trigger turn; its status on the bench is the leaf */
    /* 2026-09-19 — THE MERGE STAGED THIS SWITCH TWICE. Two batches taught the planner the same exit
     * independently: the `carrier-switches-out` block above (tag `switchOutTrigger`, which names Natural Cure,
     * Regenerator and Zero to Hero) and this branch (handler `onSwitchOut` reading `.status`, which names
     * Natural Cure alone). Merged, Natural Cure got both, `layTurns` refused "C is asked for two trigger clicks
     * on one turn", and the row fell back to a legacy fixture that never switched — DID-NOT-FIRE on
     * `d92bdfb50d88`. One exit is the trigger; the second click is dropped, and the STATUS leaf this branch
     * names is kept, because the carrier-switches-out block's `species` leaf is Zero to Hero's, not Natural
     * Cure's. */
    if (!acts.some(a => a.role === 'C' && a.phase === 1 && a.click && a.click.sw === 'CB')) {
      acts.push({ role: 'C', click: { sw: 'CB' }, phase: 1 });
      rc.conditions.push({ kind: 'click', role: 'C', sw: 'CB', phase: 1 });
    }
    rc.observe = { role: 'C', leaf: 'status', channel: 'board', leaves: ['status'] };
    rc.notes.push('the statused carrier switches out on the trigger turn (onSwitchOut reads its status)');
  }
  /* ---- entry: the setup turn, then the carrier arrives ---- */
  if (entry && entry !== 'side-fainted') {
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
    /* FORCE-FIRE (2026-09-19): A STAT MULTIPLIER SHOWS ONLY ON A HIT THAT READS THAT STAT. The holder's own
     * `onModifyAtk`/`onModifySpA` is read by the holder's hit of that category, its `onModifyDef`/`onModifySpD`
     * by the receiver's. Read off the handler names; with neither, the exchange is unchanged. */
    const bases = handlersOf(e).map(h => splitHandler(h.name)).filter(s => s && !s.prefix).map(s => s.base);
    const cCat = bases.includes('modifyatk') ? 'Physical' : bases.includes('modifyspa') ? 'Special' : undefined;
    const rCat = bases.includes('modifydef') ? 'Physical' : bases.includes('modifyspd') ? 'Special' : undefined;
    const h1 = hitFor(rc, 'C', 'R', { category: cCat });
    const h2 = hitFor(rc, 'R', 'C', { except: exceptSelf, category: rCat });
    if ((cCat && !h1) || (rCat && !h2)) refuse('NO-TRIGGER-SUPPLIER', 'the exchange needs a ' + (cCat && !h1 ? cCat + ' hit from the carrier' : rCat + ' hit from the receiver') + ', and none lands unmasked');
    if (!h1 && !h2) refuse('PLANNER-CANNOT-CONSTRUCT', 'neither side can hit the other');
    if (h1) { acts.push({ role: 'C', click: { m: h1, at: 'R' }, phase: 1 }); tc('C', 'R', h1, 1, {}); }
    if (h2) { acts.push({ role: 'R', click: { m: h2, at: 'C' }, phase: 1 }); tc('R', 'C', h2, 1, { except: exceptSelf }); }
  }
  for (const t of trig) if (!consumed.has(t.kind) && !['weather', 'terrain', 'holder-statused', 'indirect-damage', 'foe-forces-switch', 'foe-boost-then-hit',
    'ally-guard', 'ally-hit', 'ally-statused', 'ally-hits-holder', 'ally-faints', 'ally-item-consumed', 'target-punishes-contact', 'carrier-slower', 'click-bp',
    'foe-statused', 'bypass-immunity', 'speed-mult',
    /* FORCE-FIRE (2026-09-19) — each staged above: */
    'weight', 'target-holds-item', 'holder-ate-berry', 'nearby-item-used', 'foe-carries-se-move', 'carrier-faster', 'switch-out',
    'target-protects', 'carrier-switches-out', 'foe-trapped'].includes(t.kind)) {
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
  const onField = t => { const o = { p1: [rc.lineup.p1[0], rc.lineup.p1[1]], p2: [rc.lineup.p2[0], rc.lineup.p2[1]] }; for (let i = 0; i < t; i++) for (const s of ['p1', 'p2']) for (let j = 0; j < 2; j++) { const c = rc.turns[i][o[s][j]]; if (c && (c.sw || c.faintsInto)) o[s][j] = c.sw || c.faintsInto; } return o; };
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
    if (need.boosted) {
      /* a stat-pair exchange needs a stage on ONE OF ITS OWN stats; the rest take any self boost */
      const want = need.boosted.stats;
      const m = pool.find(d => d.category === 'Status' && d.target === 'self' && d.boosts
                            && (!want || want.some(s => (d.boosts[s] || 0) > 0)));
      if (!m) continue; moves.boost = m.id;
    }
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

/* ================= THE HOLDER KNOCKS A FOE OUT WITH A MOVE (force-fire-b, 2026-09-19) ===================
 *
 * A knockout the planner can PROMISE without a damage calculator, in two turns:
 *   T1  the receiver R clicks the move whose own condition keeps it at 1 HP (`onDamage` returning `target.hp - 1`
 *       — derived; Endure in this format), and the partner CA clicks an OHKO move (`move.ohko`) into it. At the
 *       bottom corner the OHKO's accuracy draw succeeds and the 1-HP floor holds.
 *   T2  the holder hits R. Any hit that lands knocks a 1-HP body out, and it is the HOLDER's move that does it.
 * The control (second chain, idle twin) is the holder not hitting on T2, so no knockout happens. */
function stageHolderKOs(e, bearer, trig) {
  const rc = newRecipe({ kind: 'abilities', id: e.id, name: e.name });
  useSpecies(rc, bearer.sheet);
  setBody(rc, 'C', { species: bearer.sheet, field: bearer.field, ability: bearer.via === 'slot' ? e.name : quietAbility(bearer.sheet) });
  if (bearer.via === 'mega') { setItem(rc, 'C', bearer.stone); rc.conditions.push({ kind: 'field', role: 'C', field: 'item', value: bearer.stone }); rc.megaRole = 'C'; }
  else if (bearer.via === 'slot') rc.conditions.push({ kind: 'field', role: 'C', field: 'ability', value: e.name });
  else refuse('PLANNER-CANNOT-CONSTRUCT', 'the knockout stager takes a slot or mega carrier, not ' + bearer.via);
  const floorMoves = U.MOVES.filter(d => d.condition && typeof d.condition.onDamage === 'function' && /hp\s*-\s*1/.test(String(d.condition.onDamage))).map(d => d.id);
  const ohkos = U.MOVES.filter(d => d.ohko).map(d => d.id);
  if (!floorMoves.length || !ohkos.length) refuse('NO-TRIGGER-SUPPLIER', 'the format has no 1-HP floor move or no OHKO move');
  for (const rid of speciesOrder(RECEIVER_FIRST)) {
    const rsp = D.species.get(rid);
    if (rc.used.has(id(rsp.baseSpecies || rsp.name))) continue;
    const floor = floorMoves.find(m => learns(rsp.name, m)); if (!floor) continue;
    const rab = quietAbility(rsp.name, [e.id]); if (!rab) continue;
    const R = { species: rsp.name, field: rsp.name, ability: rab };
    const hit = rankMoves([...(U.POOL.get(spOf(bearer.sheet).id) || [])].filter(k => { const d = D.moves.get(k); return legal(d) && d.category !== 'Status' && d.target === 'normal'; }))
      .find(k => !masksFor(k, rc.bodies.C, R, { arm: rc.arm }).length);
    if (!hit) continue;
    let ca = null;
    for (const cid of speciesOrder()) {
      const csp = D.species.get(cid);
      if (cid === rid || rc.used.has(id(csp.baseSpecies || csp.name))) continue;
      const cab = quietAbility(csp.name, weatherish().concat([e.id])); if (!cab) continue;
      const cb = { species: csp.name, field: csp.name, ability: cab };
      const k = ohkos.find(m => learns(csp.name, m) && !masksFor(m, cb, R, { arm: rc.arm }).length);
      if (k) { ca = { body: cb, move: k }; break; }
    }
    if (!ca) continue;
    useSpecies(rc, rsp.name); setBody(rc, 'R', R);
    useSpecies(rc, ca.body.species); setBody(rc, 'CA', ca.body); rc.live.add('CA');
    const acts = [];
    acts.push({ role: 'R', click: { m: addMove(rc, 'R', floor) }, phase: 0 });
    acts.push({ role: 'CA', click: { m: addMove(rc, 'CA', ca.move), at: 'R' }, phase: 0 });
    rc.triggerClicks.push({ role: 'CA', at: 'R', move: id(ca.move), phase: 0, ctx: { except: ['guard'] } }); /* the floor IS the setup, not a mask */
    const h = addMove(rc, 'C', hit);
    acts.push({ role: 'C', click: { m: h, at: 'R' }, phase: 1 });
    rc.triggerClicks.push({ role: 'C', at: 'R', move: id(hit), phase: 1, ctx: {} });
    rc.conditions.push({ kind: 'click', role: 'C', move: id(hit), phase: 1 });
    rc.hpPool = 'x1';
    rc.observe = { role: 'C', leaf: 'boosts', channel: 'board', leaves: ['boosts'] };
    rc.notes.push('T1 ' + rsp.name + ' clicks ' + D.moves.get(floor).name + ' and ' + ca.body.species + ' clicks ' + D.moves.get(ca.move).name
      + ' into it (1 HP left); T2 the holder\'s ' + D.moves.get(hit).name + ' knocks it out');
    return layTurns(rc, acts);
  }
  refuse('NO-TRIGGER-SUPPLIER', 'no receiver learns a 1-HP floor move with a partner that can OHKO it and a holder hit that lands');
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
  for (const n of PRE.moveNeeds(normEntity(a)).needs) if (clicks.some(m => needMet(m, n, { userTypes: typesOf(C), targetTypes: typesOf(C) }))) { why.push('a click on this board supplies its ' + n.kind + '=' + (n.values || []).join('/')); break; }
  const staged = new Set(rc.conditions.map(c => c.kind));
  for (const n of PRE.boardNeeds(normEntity(a))) if (['hp-threshold', 'item-consumed', 'volatile-present', 'own-stat-dropped', 'trapped', 'ko-hit'].includes(n.kind) && (rc.hpPool === 'x1' || staged.size > 2)) { why.push('the board stages its ' + n.kind); break; }
  return why;
}
/* ==== 2026-09-19 -- A QUIET CONTROL IS PREFERRED, AND "QUIET" IS JUDGED ON THIS BOARD ============================
 *
 * An ability swap is one-variable evidence only if the CONTROL ability does nothing on the board: otherwise the two
 * arms differ because the control acted, and the pair cannot say which of the two moved the game. `reactsTo` reads
 * three things -- a shared tag, an entry/residual write, a click that meets one of the alternative's MOVE NEEDS -- and
 * so it cannot see a handler that fires on EVERY hit the carrier takes and therefore has no need to meet. Measured on
 * release d92bdfb50d88: Hyper Cutter's control was ANGER POINT (`PRE.moveNeeds(angerpoint)` is empty; its gate is
 * the crit, and the `bottom-tie-first` arm lands every crit), so the control arm maxed Attack on the receiver's crit
 * Chilling Water -- and that control game is where a real engine divergence surfaced. Crabominable's third ability,
 * Iron Fist, needs a punching click and there is none.
 *
 * `loudOnBoard` asks, for every handler that WRITES (the `reactsToOnBoard` test: a leaf rule, a `chainModify`, a
 * returned number) and runs when the carrier is STRUCK or STRIKES: does that event happen on this board (a damaging
 * click lands on C / C clicks a damaging move), and if so, is the handler gated off? Gated off means it has a move
 * need no click on the board meets, or a crit gate on an arm that is not the bottom corner. A handler with no gate, or
 * a met one, is LOUD, and the reason is named.
 *
 * IT IS A PREFERENCE AND NEVER A GATE. Among the alternatives the existing chain already ACCEPTS, a quiet one is
 * taken; where none is quiet the old first choice stands and the fixture says `quiet: false` with the reasons. So no
 * row can lose its control to this change -- measured over the whole plan, see the report. `quiet` / `loud` /
 * `first_passing` are stamped on `fixture.control` so the artifact can carry them.
 * `STAGE_PLANNER_FIRST_PASSING_CONTROL=1` restores the first-passing choice (the stamp is still written). */
const FIRST_PASSING_CONTROL = process.env.STAGE_PLANNER_FIRST_PASSING_CONTROL === '1';
const STRUCK_EVENT = s => (!s.prefix && /^(hit|damaginghit|aftermovesecondary|damage|modifydef|modifyspd|tryhit|sourcemodifydamage)$/.test(s.base))
  || (s.prefix === 'Source' && /^(modifydamage|modifyatk|modifyspa|basepower)$/.test(s.base));
const STRIKE_EVENT = s => !s.prefix && /^(basepower|modifyatk|modifyspa|modifydamage|modifymove|modifytype|modifycritratio|sourcehit)$/.test(s.base);
function loudOnBoard(alt, rc) {
  const a = D.abilities.get(alt);
  if (!a || !a.exists) return ['unknown ability ' + alt];
  const clicks = boardClicks(rc);
  const struck = clicks.filter(c => c.role !== 'C' && c.lands.includes('C') && c.d.category !== 'Status');
  const strikes = clicks.filter(c => c.role === 'C' && c.d.category !== 'Status');
  const needs = PRE.moveNeeds(normEntity(a)).needs;
  const wx = uniq(clicks.filter(c => c.d.weather).map(c => id(c.d.weather)));
  const tx = uniq(clicks.filter(c => c.d.terrain).map(c => id(c.d.terrain)));
  const why = [];
  for (const h of handlersOf(a)) {
    /* A `condition.` handler runs only once its own volatile is up, and the handler that raises it is judged on
     * its own line (Flash Fire's boost needs its absorb first). */
    if (/^condition\./.test(h.name)) continue;
    const s = splitHandler(h.name); if (!s) continue;
    const writes = LEAF_RULES.some(([re]) => re.test(h.src)) || /chainModify|return\s+\d/.test(h.src);
    if (!writes) continue;
    const onStruck = STRUCK_EVENT(s), onStrike = STRIKE_EVENT(s);
    if (!onStruck && !onStrike) continue;
    /* THE GATES THE HANDLER WRITES IN ITS OWN TEXT, each narrowing the clicks that can run it -- the stat an Atk/SpA
     * modifier reads (Physical/Special, from the event's own name), a typed gate (`move.type === "Fire"`), a contact
     * gate, a weather or terrain the board's clicks never set, and a faint gate on a pool no single hit can empty. */
    const types = [...h.src.matchAll(/move\.type\s*===\s*["'](\w+)["']/g)].map(m => m[1]);
    const cat = /spa$/.test(s.base) ? 'Special' : /atk$/.test(s.base) ? 'Physical' : null;
    const contact = /checkMoveMakesContact|flags\.contact|flags\[["']contact["']\]/.test(h.src);
    const pool = (onStruck ? struck : strikes).filter(c => (!cat || c.d.category === cat)
      && (!types.length || types.includes(c.d.type)) && (!contact || !!(c.d.flags && c.d.flags.contact)));
    if (!pool.length) continue;
    const w = [...h.src.matchAll(/isWeather\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]));
    if (w.length && !w.some(x => wx.includes(x))) continue;
    const t = [...h.src.matchAll(/isTerrain\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]));
    if (t.length && !t.some(x => tx.includes(x))) continue;
    /* `!target.hp && …` REQUIRES the faint (Aftermath); `if (!target.hp) return;` is the opposite, an early exit
     * for a body already down (Anger Point) -- matched first time as a gate, and it hid Anger Point. */
    if (/!\s*target\.hp\s*&&/.test(h.src) && rc.hpPool !== 'x1') continue;
    const hn = needs.filter(n => n.handler === h.name);
    const ctx = c => ({ userTypes: typesOf(rc.bodies[c.role]), targetTypes: typesOf(onStruck ? rc.bodies.C : (rc.bodies[c.lands[0]] || rc.bodies.C)) });
    if (hn.length && !pool.some(c => hn.some(n => needMet(c.d.id, n, ctx(c))))) continue;
    if (/\.crit\b/.test(h.src) && rc.arm !== BOTTOM) continue;
    why.push(h.name + ' runs on ' + (onStruck ? 'a hit C takes' : 'a hit C lands') + ' (' + pool[0].role + ':' + pool[0].d.name + ')'
      + (/\.crit\b/.test(h.src) ? ', and the ' + rc.arm + ' arm lands every crit' : '') + (hn.length ? ', its need met' : ', with no need to meet'));
  }
  return why;
}
function preferQuiet(passing, rc) {
  const judged = passing.map(p => Object.assign({}, p, { loud: loudOnBoard(p.alt, rc) }));
  const first = judged[0];
  const pick = FIRST_PASSING_CONTROL ? first : (judged.find(p => !p.loud.length) || first);
  return { alt: pick.alt, k: pick.k,
           stamp: { quiet: !pick.loud.length, loud: pick.loud.length ? pick.loud : null,
                    first_passing: first.alt, first_passing_quiet: !first.loud.length,
                    passing: judged.map(p => p.alt + (p.loud.length ? ' [loud]' : ' [quiet]')) } };
}
function buildControl(rc, kind, e, bearer, trig) {
  if (BRK === 'control-two-vars' || BRK === 'control-two-reasons') void 0;
  const done = (k, variable, why, stamp) => {
    if (BRK === 'control-two-vars') k.bodies.C.nature = D.natures.get('adamant').name;
    if (BRK === 'control-two-reasons') { const c = rc.conditions.find(x => x.kind === 'click' && x.move); if (c) { const t = k.turns[c.turn - 1]; if (t && t[c.role]) t[c.role] = { m: 'protect' }; } }
    return Object.assign({ rc: k, variable, why }, stamp || {});
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
    /* 2026-09-19 -- EVERY PASSING ALTERNATIVE IS COLLECTED, AND A QUIET ONE IS PREFERRED. This loop used to return
     * the FIRST alternative `reactsTo` and the judge accepted; see `loudOnBoard` for what `reactsTo` cannot see. */
    const passing = [];
    for (const alt of alts) {
      const r = reactsTo(alt, rc, e);
      if (r.length) { tried.push(alt + ': ' + r.join('; ')); continue; }
      const k = cloneRc(rc); k.bodies.C.ability = alt;
      const j = judge(rc, k, {});
      if (j.diff.length === 1 && j.inert.length === 1) { passing.push({ alt, k }); continue; }
      tried.push(alt + ': ' + j.inert.length + ' inert reasons, ' + j.diff.length + ' leaves');
    }
    if (passing.length) {
      const q = preferQuiet(passing, rc, e);
      return done(q.k, 'C.ability', 'the same body carries ' + q.alt + ' instead', q.stamp);
    }
    rc.controlTried = tried;
  }
  /* TRIGGER REMOVAL — the click that supplies the need is swapped for one on the same body that does not */
  const needs = trig.filter(t => t.kind === 'click').map(t => t.need);
  for (const c of rc.conditions.filter(x => x.kind === 'click' && x.move)) {
    const b = rc.bodies[c.role]; const d0 = D.moves.get(c.move);
    if (b.moves.length >= 4 || !needs.length) continue;
    const alt = [...(U.POOL.get(spOf(b.species).id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && d.id !== d0.id
      && d.category === d0.category && d.target === d0.target && !needs.some(n => needMet(d.id, n, { userTypes: typesOf(b), targetTypes: typesOf(rc.bodies.C) })));
    if (!alt) continue;
    addMove(rc, c.role, alt.id);
    const k = cloneRc(rc);
    k.turns[c.turn - 1][c.role] = { m: alt.name, at: rc.turns[c.turn - 1][c.role].at };
    const j = judge(rc, k, {});
    if (j.diff.length === 1 && j.inert.length === 1) return done(k, c.role + '.click@' + c.turn, 'the trigger click ' + d0.name + ' becomes ' + alt.name + ', which supplies none of the needs');
    rc.bodies[c.role].moves = rc.bodies[c.role].moves.filter(m => m !== alt.name);
  }
  /* THE SECOND CHAIN runs ONLY where everything above refused, so a row that already had a control keeps
   * exactly the one it had — asserted over the whole population by planning it before and after. */
  if (BRK !== 'no-second-chain') {
    const second = secondChainControl(rc, kind, e, bearer, trig, done);
    if (second) return second;
  }
  return { refusal: { code: 'NO-SINGLE-VARIABLE-CONTROL',
    reason: (bearer && bearer.via !== 'slot' ? 'the mechanic rides a ' + bearer.via + ' (' + bearer.field + '): no legal body carries it with a second ability, and removing the forme change also moves stats and typing'
      : 'no alternative ability is inert on this board and no trigger click can be swapped for a non-trigger one' + (rc.controlTried ? ' (' + rc.controlTried.join(' | ') + ')' : ''))
      + (rc.controlTried2 && rc.controlTried2.length ? ' || second chain: ' + rc.controlTried2.slice(0, 6).join(' | ') : ''),
    mode: 'board-only: prove the trigger off the authority log, as the boards plan HB-1 specifies' } };
}

/* ================= THE SECOND CHAIN — A CONTROL WHERE THE FIRST ONE REFUSED (force-fire-b, 2026-09-19) ====
 *
 * Will, 2026-09-19: "why cant we stage games that force the ability to fire what the hell man". Thirty-two
 * ability rows carried NO control, and every one was refused NO-SINGLE-VARIABLE-CONTROL by the chain above —
 * which has two failure shapes, both in the CHOOSER and neither in the format:
 *
 *   1. `reactsTo` reads every click on the board as if the CARRIER were both user and target
 *      (`{ userTypes: typesOf(C), targetTypes: typesOf(C) }`), and counts a handler as writing state on its
 *      own whenever its source mentions a write — including handlers that can only act on a status, a
 *      weather or a click the board never supplies. So Flash Fire was "loud" beside Drought on a board with
 *      no Fire move aimed at the carrier, and Solid Rock "reacted" to the carrier's OWN High Horsepower.
 *   2. The trigger-removal swap only looks at clicks named in `conditions`, only for a same-category,
 *      same-target alternative — so a CATEGORY need (Weak Armor, Good as Gold) can never be removed, a field
 *      SETTER (Surge Surfer's Electric Terrain) is never considered, and a spread trigger (Surf) has no twin.
 *
 * It runs ONLY where the chain above refused, so no row that had a control changes it. The control it
 * builds obeys the same two invariants and is judged by the same `judge()`: one leaf, one inert reason.
 *
 *   (a) THE SAME BODY WITH ANOTHER OF ITS ABILITIES, where every click is read against its REAL user and
 *       target, and a handler gated on a weather, a terrain or a holder status the board does not supply —
 *       or on a click need the click reading already answered — is not counted as acting on its own.
 *   (c) THE TRIGGER CLICK SWAPPED on the body that makes it: for a need, a move of the same aim class that
 *       supplies none of the needs that click supplied (a CATEGORY need swaps the category; a damaging click
 *       stays damaging); for a field SETTER, the body's inert click. The authority's board must move between
 *       the arms and ours must move identically — both arms are compared, boundary by boundary.
 *
 * (b), suppression, was derived and not built: Reg M-B has no legal Neutralizing Gas carrier, and Gastro
 * Acid and a Mold Breaker attacker each change a second body — see the report. */
const AIM_SINGLE = new Set(['normal', 'any', 'adjacentFoe', 'randomNormal']);
const AIM_SPREAD = new Set(['allAdjacent', 'allAdjacentFoes']);
const aimClass = t => AIM_SINGLE.has(t) ? 'single' : AIM_SPREAD.has(t) ? 'spread' : t;
function onFieldAt(rc, i) {
  const o = { p1: [rc.lineup.p1[0], rc.lineup.p1[1]], p2: [rc.lineup.p2[0], rc.lineup.p2[1]] };
  for (let t = 0; t < i; t++) for (const s of ['p1', 'p2']) for (let j = 0; j < 2; j++) { const c = (rc.turns[t] || {})[o[s][j]]; if (c && c.sw) o[s][j] = c.sw; }
  return o;
}
/* Every click on the board with the bodies it LANDS on: its aim, or for a spread move every adjacent body. */
function boardClicks(rc) {
  const out = [];
  rc.turns.forEach((turn, i) => {
    const o = onFieldAt(rc, i);
    for (const s of ['p1', 'p2']) for (const role of o[s]) {
      const c = turn[role]; if (!c || !c.m) continue;
      const d = D.moves.get(c.m); if (!d || !d.exists) continue;
      const foe = s === 'p1' ? 'p2' : 'p1';
      let lands = c.at ? [c.at] : d.target === 'allAdjacentFoes' ? o[foe].slice() : d.target === 'allAdjacent' ? o[foe].concat(o[s].filter(r => r !== role)) : [];
      out.push({ turn: i + 1, role, d, lands: lands.filter(Boolean) });
    }
  });
  return out;
}
/* The statuses a click can put on the body it lands on, at this arm: its own status, or a secondary's — which
 * at the bottom corner always fires (engine/game_differential.js makeArm), at the top only at chance 100. */
function statusesOf(d, arm) {
  const s = [];
  if (d.status) s.push(d.status);
  for (const x of [].concat(d.secondaries || [], d.secondary ? [d.secondary] : [])) if (x && x.status && (arm === BOTTOM || (x.chance || 100) >= 100)) s.push(x.status);
  return s;
}
function clickRel(c, by) {
  const actor = c.role === 'C', receiver = c.role !== 'C' && c.lands.includes('C');
  return by === 'actor' ? actor : by === 'receiver' ? receiver : by === 'ally' ? c.role === 'CA' : actor || receiver;
}
/* Would this alternative ability ACT on this board? Returns the reasons it would (empty = quiet). */
function reactsToOnBoard(alt, rc, e) {
  const a = D.abilities.get(alt);
  const why = [];
  const clicks = boardClicks(rc);
  /* A SHARED TAG WHOSE PARAMS NAME WHAT IT GUARDS (`statuses`, `volatiles`) reacts only where a click on this
   * board delivers one of THOSE — Aroma Veil and Sweet Veil share protectsAllyFromStatus and guard disjoint
   * lists, so beside a Sing the one that guards against attraction is quiet. Every other shared tag stays loud. */
  const delivered = new Set(clicks.flatMap(c => statusesOf(c.d, rc.arm).concat(c.d.volatileStatus ? [c.d.volatileStatus] : [])));
  const shared = tagsOf('abilities', a.id).tags.filter(t => {
    if (t === 'breakable' || !tagsOf('abilities', e.id).tags.includes(t)) return false;
    const q = (tagsOf('abilities', a.id).params || {})[t] || {};
    const guards = [].concat(Array.isArray(q.statuses) ? q.statuses : [], Array.isArray(q.volatiles) ? q.volatiles : []);
    return !guards.length || guards.some(g => delivered.has(g));
  });
  if (shared.length) why.push('shares ' + shared.join(','));
  const NE = normEntity(a);
  const needs = PRE.moveNeeds(NE).needs;
  const needH = new Set(needs.map(n => n.handler));
  const wx = uniq(clicks.filter(c => c.d.weather).map(c => id(c.d.weather)));
  const tx = uniq(clicks.filter(c => c.d.terrain).map(c => id(c.d.terrain)));
  const onC = clicks.filter(c => (c.role !== 'C' && c.lands.includes('C')) || (c.role === 'C' && c.d.target === 'self'));
  const st = uniq(onC.flatMap(c => statusesOf(c.d, rc.arm)));
  const gate = (src) => {
    const w = [...src.matchAll(/isWeather\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]));
    if (w.length && !w.some(x => wx.includes(x))) return 'weather ' + w.join('/');
    const t = [...src.matchAll(/isTerrain\(\s*\[?([^)\]]*)\]?\s*\)/g)].flatMap(m => [...m[1].matchAll(/["']([a-z]+)["']/g)].map(x => x[1]));
    if (t.length && !t.some(x => tx.includes(x))) return 'terrain ' + t.join('/');
    if (/\.status\b/.test(src) && /cureStatus\(/.test(src) && !st.length) return 'a holder status';
    return null;
  };
  const switches = rc.turns.some(t => t.C && t.C.sw);
  for (const h of handlersOf(a)) {
    const s = splitHandler(h.name); if (!s) continue;
    const writes = LEAF_RULES.some(([re]) => re.test(h.src)) || /chainModify|return\s+\d/.test(h.src);
    if (!writes) continue;
    const own = (!s.prefix && /^(start|switchin|residual|update)$/.test(s.base)) || (!s.prefix && /^(end|switchout)$/.test(s.base) && switches)
      || /^(Any|Foe|Ally)$/.test(s.prefix);
    if (!own || needH.has(h.name) || gate(h.src)) continue;
    why.push('writes state on its own (' + h.name + ')'); break;
  }
  for (const n of needs) {
    const f = a[n.handler];
    if (f && gate(String(f))) continue;
    const hit = clicks.find(c => clickRel(c, n.by) && needMet(c.d.id, n, {
      userTypes: typesOf(rc.bodies[c.role]), targetTypes: typesOf(c.role === 'C' ? (rc.bodies[c.lands[0]] || rc.bodies.C) : rc.bodies.C) }));
    if (hit) { why.push('the click ' + hit.role + ':' + hit.d.name + ' supplies its ' + n.kind + '=' + (n.values || []).join('/')); break; }
  }
  const staged = new Set(rc.conditions.map(c => c.kind));
  for (const n of PRE.boardNeeds(NE)) if (['hp-threshold', 'item-consumed', 'volatile-present', 'own-stat-dropped', 'trapped', 'ko-hit'].includes(n.kind) && (rc.hpPool === 'x1' || staged.size > 2)) { why.push('the board stages its ' + n.kind); break; }
  return why;
}
function secondChainControl(rc, kind, e, bearer, trig, done) {
  if (kind !== 'abilities') return null;
  const tried = rc.controlTried2 = [];
  /* (a) the same body, another ability */
  if (bearer && bearer.via === 'slot') {
    const alts = uniq(Object.values(spOf(bearer.sheet).abilities)).filter(a => id(a) !== e.id && abilityAccepted(bearer.sheet, a))
      .sort((x, y) => abilityNoise(x) - abilityNoise(y) || (x < y ? -1 : 1));
    const passing = [];
    for (const alt of alts) {
      const r = reactsToOnBoard(alt, rc, e);
      if (r.length) { tried.push('ability ' + alt + ': ' + r.join('; ')); continue; }
      const k = cloneRc(rc); k.bodies.C.ability = alt;
      const j = judge(rc, k, {});
      if (j.diff.length === 1 && j.inert.length === 1) { passing.push({ alt, k }); continue; }
      tried.push('ability ' + alt + ': ' + j.inert.length + ' inert reasons, ' + j.diff.length + ' leaves');
    }
    if (passing.length) {
      const q = preferQuiet(passing, rc, e);
      return done(q.k, 'C.ability', 'the same body carries ' + q.alt + ' instead (second chain: each click read against its real user and target)', q.stamp);
    }
  }
  /* (c) the trigger click swapped on the body that makes it */
  const clickNeeds = trig.filter(t => t.kind === 'click');
  const fieldT = trig.filter(t => t.kind === 'weather' || t.kind === 'terrain');
  const setsField = d => fieldT.some(t => (t.kind === 'weather' && !!d.weather && (t.anyOf || t.values.some(v => id(d.weather) === v || id(d.weather).includes(v) || v.includes(id(d.weather)))))
    || (t.kind === 'terrain' && !!d.terrain && (t.anyOf || t.values.includes(id(d.terrain)))));
  const clicks = boardClicks(rc);
  /* the body's idle click on a turn: Protect where nothing lands on it, else the self move whose own onTry
   * fails for a healthy body (the rule `inertFor` uses) */
  const idleCands = (role, turn, notId) => {
    const aimed = clicks.some(c => c.turn === turn && c.lands.includes(role));
    return [...(U.POOL.get(spOf(rc.bodies[role].species).id) || [])].map(k => D.moves.get(k)).filter(d => legal(d) && d.id !== notId && !d.weather && !d.terrain
      && ((d.id === 'protect' && !aimed) || (d.category === 'Status' && d.target === 'self' && typeof d.onTry === 'function' && /return\s+[^;]*\.status\s*===/.test(String(d.onTry)))))
      .map(d => d.id);
  };
  const tryTwin = (role, turn, next, why, addCond) => {
    if (addCond) rc.conditions.push(addCond);
    const k = cloneRc(rc);
    k.turns[turn - 1][role] = next;
    const j = judge(rc, k, {});
    if (j.diff.length === 1 && j.inert.length === 1) return done(k, role + '.click@' + turn, why + ' (second chain)');
    tried.push(why + ': ' + j.inert.length + ' inert reasons, ' + j.diff.length + ' leaves');
    if (addCond) rc.conditions.pop();
    return null;
  };
  /* A FIELD SET ON THE CARRIER'S ARRIVAL, WHERE THE ARRIVAL IS A MEGA EVOLUTION. The arrival cannot be removed
   * without removing the forme, so the FIELD is pre-set instead: a setup turn is put in front, the carrier megas on
   * turn 2, and the one leaf is the partner's turn-1 click — idle in the fixture, the same field's setter in the
   * control. The authority refuses a second set of the field already up (`if (this.terrain === status.id) return
   * false`, sim/field.ts:137; `setWeather` likewise), so in the control the ability's set is a no-op and the field's
   * clock is the partner's, one turn older. */
  const entrySets = uniq(handlersOf(e).filter(h => { const s = splitHandler(h.name); return s && !s.prefix && /^(start|switchin)$/.test(s.base); })
    .flatMap(h => [...h.src.matchAll(/set(Terrain|Weather)\(\s*["']([a-z]+)["']/g)].map(m => m[1].toLowerCase() + ':' + m[2])));
  if (entrySets.length === 1 && rc.megaRole === 'C' && rc.turns.length && rc.turns[0].C && rc.turns[0].C.mega) {
    const [fk, fid] = entrySets[0].split(':');
    const setterOf = sp => [...(U.POOL.get(spOf(sp).id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && id(d[fk]) === fid);
    const caOnlyIdle = rc.turns.every(t => !t.CA || (t.CA.m && id(t.CA.m) === 'protect'));
    let body = null;
    if (caOnlyIdle) for (const sid of speciesOrder()) {
      const sp = D.species.get(sid);
      if (rc.used.has(id(sp.baseSpecies || sp.name)) || !learns(sp.name, 'protect')) continue;
      const setter = setterOf(sp.name); if (!setter) continue;
      const ab = uniq(Object.values(sp.abilities || {})).filter(a => abilityAccepted(sp.name, a)).sort((x, y) => padNoise(x) - padNoise(y) || abilityNoise(x) - abilityNoise(y) || (x < y ? -1 : 1))[0];
      if (!ab || padNoise(ab) > 0) continue;
      const idle = [...(U.POOL.get(sp.id) || [])].map(k => D.moves.get(k)).find(d => legal(d) && d.category === 'Status' && d.target === 'self' && typeof d.onTry === 'function' && /return\s+[^;]*\.status\s*===/.test(String(d.onTry)));
      if (!idle) continue;
      body = { sp, ab, setter, idle };
      break;
    }
    if (!body) tried.push('pre-set ' + fid + ': ' + (caOnlyIdle ? 'no quiet partner learns its setter and an idle click' : 'the partner has a non-idle click'));
    else {
      const oldCA = rc.bodies.CA;
      rc.used.delete(id(spOf(oldCA.species).baseSpecies || oldCA.species));
      useSpecies(rc, body.sp.name);
      setBody(rc, 'CA', { species: body.sp.name, ability: body.ab });
      for (const m of ['protect', body.idle.id, body.setter.id]) addMove(rc, 'CA', m);
      const t0 = {};
      const o = onFieldAt(rc, 0);
      for (const s of ['p1', 'p2']) for (const role of o[s]) t0[role] = role === 'CA' ? { m: body.idle.name } : role === 'C' ? inertFor(rc, 'C', { noGuard: true }) : inertFor(rc, role, {});
      rc.turns.unshift(t0);
      for (const c of rc.conditions) if (c.turn != null) c.turn++;
      for (const c of rc.triggerClicks) if (c.turn != null) c.turn++;
      if (rc.readAfter != null) rc.readAfter++;
      rc.notes.push('a setup turn is put in front; the carrier megas on turn 2, and its partner ' + body.sp.name + ' idles on turn 1 (the control sets ' + body.setter.name + ' there instead)');
      const r = tryTwin('CA', 1, { m: body.setter.name }, 'the partner sets ' + body.setter.name + ' on turn 1, before the carrier\'s mega brings the ability that sets the same field',
        { kind: 'click', role: 'CA', move: body.idle.id, turn: 1 });
      if (r) return r;
      refuse('PLANNER-CANNOT-CONSTRUCT', 'the pre-set field control did not judge to one leaf and one reason: ' + tried.slice(-1)[0]);
    }
  }
  /* A FOE HELD ON THE FIELD: the twin is the receiver holding the item whose tag lets it leave anyway
   * (`escapesTrap`, read off data/tags.json — Shed Shell in this format), so the one leaf is R's item. */
  if (trig.some(t => t.kind === 'foe-trapped') && rc.bodies.R && !rc.bodies.R.item) {
    const esc = U.ITEMS.filter(i => (tagsOf('items', i.id).tags || []).includes('escapesTrap') && !rc.items.p2.has(i.id));
    for (const it of esc) {
      const k = cloneRc(rc); k.bodies.R.item = it.name;
      rc.conditions.push({ kind: 'field', role: 'R', field: 'item', value: '' });
      const j = judge(rc, k, {});
      if (j.diff.length === 1 && j.inert.length === 1) return done(k, 'R.item', 'the receiver holds ' + it.name + ' (tag escapesTrap), so the trap cannot hold it (second chain)');
      tried.push('R holds ' + it.name + ': ' + j.inert.length + ' inert reasons, ' + j.diff.length + ' leaves');
      rc.conditions.pop();
    }
  }
  /* THE CARRIER'S SWITCH IS THE TRIGGER (a switch-out handler): the twin is the carrier staying in, idle */
  for (const c of rc.conditions.filter(x => x.kind === 'click' && x.role === 'C' && x.sw)) {
    for (const mid of idleCands('C', c.turn, null).slice(0, 4)) {
      const b = rc.bodies.C, alt = D.moves.get(mid), had = b.moves.includes(alt.name);
      if (!had && b.moves.length >= 4) continue;
      if (!had) addMove(rc, 'C', alt.id);
      const r = tryTwin('C', c.turn, { m: alt.name }, 'the carrier stays in and clicks ' + alt.name + ' instead of switching to ' + c.sw, null);
      if (r) return r;
      if (!had) b.moves = b.moves.filter(m => m !== alt.name);
    }
  }
  /* THE TRIGGER IS THE END OF A TURN THE CARRIER IS ACTIVE FOR (an unprefixed `onResidual`, and the handler
   * needs nothing a click supplies): the twin is the carrier leaving on that turn, so no residual runs for it */
  if (handlersOf(e).some(h => h.name === 'onResidual') && !trig.some(t => t.kind === 'click') && rc.lineup.p1.includes('CB') && rc.bodies.CB) {
    const turn = rc.readAfter || rc.turns.length;
    const cur = (rc.turns[turn - 1] || {}).C;
    if (cur && cur.m && !cur.mega && onFieldAt(rc, turn - 1).p1.includes('C')) {
      const r = tryTwin('C', turn, { sw: 'CB' }, 'the carrier switches to the bench on turn ' + turn + ' instead of clicking ' + D.moves.get(cur.m).name
        + ', so its end-of-turn handler does not run', { kind: 'click', role: 'C', move: id(cur.m), turn });
      if (r) return r;
    }
  }
  const order = rc.triggerClicks.slice().sort((x, y) => (y.phase - x.phase) || (x.turn - y.turn));
  for (const tc of order) {
    const cur = (rc.turns[tc.turn - 1] || {})[tc.role];
    if (!cur || !cur.m || id(cur.m) !== id(tc.move)) continue;
    const b = rc.bodies[tc.role];
    const d0 = D.moves.get(tc.move);
    const on = clicks.find(c => c.turn === tc.turn && c.role === tc.role) || { role: tc.role, lands: tc.at ? [tc.at] : [] };
    const tgt = tc.role === 'C' ? (rc.bodies[on.lands[0]] || rc.bodies.R) : rc.bodies.C;
    const ctx = { userTypes: typesOf(b), targetTypes: typesOf(tgt) };
    const supplied = clickNeeds.filter(t => clickRel(on, t.by) && needMet(d0.id, t.need, ctx));
    const setter = setsField(d0);
    if (!supplied.length && !setter) continue;
    const catNeed = supplied.some(t => t.need.kind === 'category');
    /* a need that EVERY damaging move supplies (a hit of any category) has no damaging twin */
    const anyHit = supplied.some(t => t.need.idleTwin || (t.need.kind === 'category' && ['Physical', 'Special'].every(c => t.need.values.includes(c))));
    const aimAt = tc.at ? rc.bodies[tc.at] : null;
    let cands;
    const spreadTwin = supplied.some(t => t.need.spreadTwin) && d0.category !== 'Status';
    if (spreadTwin) {
      /* the handler's own guard excludes spread hits: the twin is a spread move of the SAME category, unmasked into
       * the receiver, so the one leaf that moves is whether the hit is single-target */
      cands = rankMoves([...(U.POOL.get(spOf(b.species).id) || [])].filter(k => {
        const d = D.moves.get(k);
        return legal(d) && d.category === d0.category && aimClass(d.target) === 'spread' && !d.multihit && !(d.flags && (d.flags.charge || d.flags.recharge))
          && !d.selfSwitch && !d.selfdestruct && (!aimAt || !masksFor(d.id, b, aimAt, { arm: rc.arm }).length);
      }));
    } else if ((setter && !supplied.length) || anyHit) {
      /* the twin is the body's idle click — the protect a pad clicks where nothing aims at it, else the self
       * move whose own onTry fails for a healthy body (the same rule `inertFor` uses) */
      const aimed = clicks.some(c => c.turn === tc.turn && c.lands.includes(tc.role));
      cands = [...(U.POOL.get(spOf(b.species).id) || [])].map(k => D.moves.get(k)).filter(d => legal(d) && d.id !== d0.id && !d.weather && !d.terrain
        && ((d.id === 'protect' && !aimed) || (d.category === 'Status' && d.target === 'self' && typeof d.onTry === 'function' && /return\s+[^;]*\.status\s*===/.test(String(d.onTry)))))
        .map(d => d.id);
    } else {
      cands = rankMoves([...(U.POOL.get(spOf(b.species).id) || [])].filter(k => {
        const d = D.moves.get(k);
        if (!legal(d) || d.id === d0.id || rc.guards.includes(d.id)) return false;
        if (aimClass(d.target) !== aimClass(d0.target)) return false;
        /* a CATEGORY need swaps the category and the twin is always a damaging move; any other need keeps it */
        if (catNeed ? (d.category === d0.category || d.category === 'Status') : d.category !== d0.category) return false;
        if (supplied.some(t => needMet(d.id, t.need, { userTypes: typesOf(b), targetTypes: typesOf(tgt) }))) return false;
        if (setter && (d.weather || d.terrain)) return false;
        if (d.selfSwitch || d.forceSwitch || d.selfdestruct || (d.flags && (d.flags.charge || d.flags.recharge))) return false;
        return !aimAt || !masksFor(d.id, b, aimAt, { arm: rc.arm }).length;
      }));
    }
    cands.sort((x, y) => (b.moves.includes(D.moves.get(y).name) - b.moves.includes(D.moves.get(x).name)));
    for (const mid of cands.slice(0, 10)) {
      const alt = D.moves.get(mid);
      const had = b.moves.includes(alt.name);
      if (!had && b.moves.length >= 4) continue;
      if (!had) addMove(rc, tc.role, alt.id);
      const addCond = !rc.conditions.some(c => c.kind === 'click' && c.role === tc.role && c.turn === tc.turn && id(c.move) === d0.id);
      if (addCond) rc.conditions.push({ kind: 'click', role: tc.role, move: d0.id, turn: tc.turn });
      const k = cloneRc(rc);
      const next = Object.assign({}, cur, { m: alt.name });
      if (aimClass(alt.target) !== 'single') delete next.at;
      k.turns[tc.turn - 1][tc.role] = next;
      const j = judge(rc, k, {});
      if (j.diff.length === 1 && j.inert.length === 1)
        return done(k, tc.role + '.click@' + tc.turn, 'the trigger click ' + d0.name + ' becomes ' + alt.name
          + (spreadTwin ? ', a spread hit of the same category, which the handler\'s own guard excludes' : ', which supplies none of '
          + (supplied.map(t => t.need.kind + '=' + t.need.values.join('/')).join(', ') || 'the field the handler reads')) + ' (second chain)');
      tried.push('swap ' + tc.role + ':' + d0.name + '->' + alt.name + ': ' + j.inert.length + ' inert reasons, ' + j.diff.length + ' leaves');
      if (addCond) rc.conditions.pop();
      if (!had) rc.bodies[tc.role].moves = rc.bodies[tc.role].moves.filter(m => m !== alt.name);
    }
    if (!cands.length) tried.push('swap ' + tc.role + ':' + d0.name + ': no twin in the pool');
  }
  return null;
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
    /* FORCE-FIRE (2026-09-19): A COSMETIC FORME IS NOT A SECOND BEARER. Eight Alcremie formes — the same
     * types, stats and abilities — filled the eight-bearer window and pushed Aromatisse, the one Aroma Veil
     * bearer with a quiet alternative ability, out of it. A forme is kept only if something a fixture can
     * read (types, base stats, abilities, field forme) differs from a bearer already kept. */
    const seen = new Set();
    b = b.filter(x => { const s = spOf(x.sheet), f = spOf(x.field);
      const k = [id(s.baseSpecies || s.name), x.via, s.types.join('/'), JSON.stringify(s.baseStats), JSON.stringify(s.abilities), f.name === s.name ? '' : f.name].join('|');
      if (seen.has(k)) return false; seen.add(k); return true; });
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
  const rc = stager ? stager() : kind === 'moves' ? stageMove(e, bearer.sheet)
    : (kind === 'abilities' && trig.some(t => t.kind === 'holder-kos')) ? stageHolderKOs(e, bearer, trig)
    : stageEntity(kind, e, trig, bearer, branch);
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
    control: control.rc ? Object.assign({ variable: control.variable, why: control.why },
      'quiet' in control ? { quiet: control.quiet, loud: control.loud, first_passing: control.first_passing,
                             first_passing_quiet: control.first_passing_quiet, passing: control.passing } : {}) : null,
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
  /* FORCE-FIRE (2026-09-19): A BEARER WITH A CONTROL BEATS ONE WITHOUT. The first bearer that stages is
   * kept only if it also carries a one-leaf control; otherwise the remaining bearers are tried and the first
   * that DOES replaces it. An uncontrolled fixture can only be credited off the authority's receipt, and
   * Guts and Aroma Veil sat board-only on their first carrier while a later one had a quiet alternative.
   * The replaced bearer is recorded on the fixture, never dropped silently. */
  if (ok && kind === 'abilities' && out.fixtures[0].controlRefusal) {
    const first = out.fixtures[0];
    for (const b of bearers.slice(bearers.findIndex(x => x.sheet === first.bearer.sheet && x.via === first.bearer.via) + 1)) {
      let f = null;
      try { f = buildOne(kind, e, trig, b, 'main'); }
      catch (err) { out.attempts.push({ bearer: b.sheet + '/' + b.via + ' (for a control)', code: err instanceof PlanError ? err.code : 'PLANNER-ERROR',
                                        reason: err instanceof PlanError ? err.reason : String(err.stack || err).split('\n').slice(0, 2).join(' ') }); continue; }
      if (f.controlRefusal) continue;
      f.notes.push('bearer ' + b.sheet + ' chosen over ' + first.bearer.sheet + ', whose fixture had no one-leaf control (' + first.controlRefusal.code + ')');
      f.replacedUncontrolled = { sheet: first.bearer.sheet, refusal: first.controlRefusal.code };
      out.fixtures[0] = f;
      break;
    }
  }
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
  'no-second-chain': 'the control chooser stops where it stopped until 2026-09-19 — the rows only the second chain controls (Fur Coat, Drought, Surge Surfer, Good as Gold, Weak Armor, Mimicry, Sweet Veil, Mega Sol) must go red',
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
                   /* 2026-09-11 (ROADMAP #318): tests/roster.js restages its illegal fixture bodies on this module's
                    * judgement of the quietest legal ability rather than inventing a second one. */
                   abilityNoise, quietAbility,
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
