/* THE ORDER END-OF-TURN EFFECTS RESOLVE IN, DERIVED FROM THE FORMAT — ROADMAP #221, #242.
 *
 * ================= WHY THIS FILE EXISTS ============================================================
 *
 * medicham2 runs its residuals BODY BY BODY: everything that happens to body A, then everything that
 * happens to body B. Showdown does the opposite — it builds ONE list of handlers across every body,
 * every side and the field, sorts it once, and walks it. The two produce different sequences whenever
 * two bodies carry different effects, which is almost always.
 *
 * The table below is what proves it rather than asserts it. **Leftovers is order 5 and poison is order
 * 9.** Different orders, so EVERY Leftovers heal on the field resolves before ANY poison chip, on
 * either side, regardless of speed. A body-major loop cannot produce that sequence at all: ours heals
 * and then poisons body A before it touches body B. This is not a tie-break subtlety, it is a
 * different grouping of the same events, and it is 16 of the 60 first divergences in the last
 * measured swarm — Leftovers against poison, Leftovers against Speed Boost, the sandstorm chip in the
 * wrong body order, and the expiry announcements (`-end|taunt`, `-sideend|lightscreen`,
 * `-fieldend|gravity`) landing in the wrong place.
 *
 * ================= ROADMAP #242 — THE TABLE WAS A SUBSET PRESENTED AS A POPULATION =================
 *
 * Until 2026-08-14 this file enumerated by HANDLER: an effect earned a row if it owned `onResidual`,
 * `onFieldResidual` or `onSideResidual`. 42 rows. But `Battle#fieldEvent` collects the residual walk
 * on TWO keys, not one:
 *
 *     let getKey; if (eventid === 'Residual') getKey = 'duration';
 *     handlers = findFieldEventHandlers(field, 'onFieldResidual', getKey) ...
 *     ... findSideEventHandlers(side, 'onSideResidual', getKey) ...
 *     ... findPokemonEventHandlers(active, 'onResidual', getKey) ...
 *
 * and every one of those collectors admits an effect on `callback !== undefined || state[getKey]`.
 * So an effect with a live `duration` and NO residual handler is in the walk, and `battle.ts`'s walk
 * body then spends its position:
 *
 *     if (eventid === 'Residual' && handler.end && handler.state?.duration) {
 *       handler.state.duration--;
 *       if (!handler.state.duration) { handler.end.call(...); continue; }
 *     }
 *
 * Tailwind owns no residual handler. It was in the authority's walk and not in our table.
 *
 * **AND THE ROW WE COULD NOT SEE WAS CARRYING ITS ORDER THE WHOLE TIME.** This is the part that was
 * mis-diagnosed first, by me, and it changes what the fix is. A duration-only effect is not
 * order-less: `tailwind.condition` declares `onSideResidualOrder: 26, onSideResidualSubOrder: 5` and
 * simply declares no `onSideResidual`. `resolvePriority` reads `effect[callbackName + 'Order']`
 * whether or not the matching callback exists, so the authority places Tailwind at 26 deterministically.
 * The order was in the format, in a field this file never looked at, because the `if (!hook) return`
 * guard threw the effect away before reading it.
 *
 * ================= THE SORT KEY IS NOT TRANSCRIBED HERE. IT IS CALLED. =============================
 *
 * `Battle#comparePriority` is `order ASC -> priority DESC -> speed DESC -> subOrder ASC ->
 * effectOrder ASC`, and **SPEED COMES BEFORE subOrder** — which corrects ROADMAP #221's own title,
 * `(residualOrder, subOrder, speed)`. A row written from that title would have sorted a Leftovers and
 * a Shed Skin by category when the authority sorts them by who is faster.
 *
 * The previous version of this file re-implemented `resolvePriority`'s subOrder defaults as a literal
 * map, and got two of them wrong in ways nothing could see:
 *
 *   - it applied `Condition -> 2` flat. The authority refines by WHERE THE EFFECT IS ATTACHED, not by
 *     effectType: `state.target instanceof Side` -> 4 (or 3 if `isSlotCondition`), `instanceof Field`
 *     -> 5, otherwise 2. Every side condition this file now emits would have been published as 2.
 *   - it filed the statuses as `Condition` and published subOrder 2 for `psn`, `tox` and `brn`. Their
 *     effectType is **Status**, which is not in the authority's map at all, so the real value is **0**.
 *
 * So this version does not own a copy of that rule. It calls `Battle.prototype.resolvePriority` on a
 * handler shaped exactly the way the collectors shape it, with a real `Side` / `Field` / `Pokemon`
 * prototype in `state.target` so the attachment-sensitive branch takes the same path it takes live.
 * `TYPE_SUBORDER` is still exported, but it is now PROBED out of that function rather than typed.
 *
 * `speedSort` shuffles genuine ties through `prng.shuffle`, so a residual tie is a coin flip in the
 * real game and is pinned in mode A like every other die.
 *
 * ================= WHAT A ROW IS ==================================================================
 *
 * A row is a WALK PARTICIPANT: one (effect, attachment site) pair. The site is not decoration — it
 * decides the callback name, hence which `*Order` field is read, hence where the effect lands:
 *
 *   site            collected by                                      callbackName       speed
 *   status          findPokemonEventHandlers(active, …, 'duration')    onResidual         the body's
 *   volatile        "                                                  onResidual         the body's
 *   ability         "                                                  onResidual         the body's
 *   item            "                                                  onResidual         the body's
 *   slot            "                                                  onResidual         the body's
 *   side            findSideEventHandlers(side, …, 'duration')         onSideResidual     none (0)
 *   pseudoweather   findFieldEventHandlers(field, …, 'duration')       onFieldResidual    none (0)
 *   weather         "                                                  onFieldResidual    none (0)
 *   terrain         "                                                  onFieldResidual    none (0)
 *   side@active     findSideEventHandlers(side, 'onResidual', undef, active)   onResidual  the body's
 *   field@active    findFieldEventHandlers(field, 'onResidual', undef, active) onResidual  the body's
 *
 * The last two rows are the reason this had to be modelled as pairs rather than as effects. **Grassy
 * Terrain is in the walk TWICE and eleven orders apart**: its heal arrives through the per-active
 * field collection at `onResidualOrder` 5 with the healed body's speed, and its expiry arrives
 * through the field collection at `onFieldResidualOrder` **27**, with no speed at all. One row could
 * not have said both, and the 42-row table said only the first.
 *
 * ================= WHAT IT ALSO SAYS, BECAUSE ENGINE NEEDS IT =====================================
 *
 * `route` — `handler`, `duration`, or `handler+duration`. A `handler+duration` row (Encore, the four
 * weathers, Perish Song, Uproar, Syrup Bomb, `partiallytrapped`, `lockedmove`) decrements FIRST and,
 * on the turn it hits zero, runs `end` and **skips its own residual callback** — the `continue` above.
 * That is one handler doing both jobs at one position, not two positions.
 *
 * `announces` / `announceLine` — whether the End handler for that site emits protocol, and the tag it
 * emits. Derived by reading the handler, not by listing names.
 *
 *   node engine/residual_order.js            # print it
 *   node engine/residual_order.js --write    # data/residual-order.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const SHOWDOWN = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const { Dex } = require(path.join(SHOWDOWN, 'dist', 'sim'));
const { Battle } = require(path.join(SHOWDOWN, 'dist', 'sim', 'battle.js'));
const { Side } = require(path.join(SHOWDOWN, 'dist', 'sim', 'side.js'));
const { Field } = require(path.join(SHOWDOWN, 'dist', 'sim', 'field.js'));
const { Pokemon } = require(path.join(SHOWDOWN, 'dist', 'sim', 'pokemon.js'));
/* S12 — the active format id is read from data/regulations.json, never restated here. A table that
 * claims to describe "this format" and hardcodes which one is the same shape as the ban list of four. */
const FORMAT = (() => {
  const r = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
  const f = (r.regulations[r.active] || {}).showdownFormat;
  if (!f) throw new Error('data/regulations.json names no showdownFormat for active regulation ' + r.active);
  return f;
})();
const DEX = Dex.forFormat(FORMAT);

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => !!x && x.exists && !x.isNonstandard;

/* ---- THE AUTHORITY'S OWN PRIORITY RESOLVER, CALLED ----------------------------------------------
 * `resolvePriority` touches `this` only inside the `SwitchIn` / `RedirectTarget` branches, which a
 * residual callbackName cannot enter, so it is safe to call unbound. */
const RESOLVE = Battle.prototype.resolvePriority;
const COMPARE = Battle.prototype.comparePriority;

/* ---- WHERE CAN EACH EFFECT BE ATTACHED? DERIVED FROM THE REGULATION, NEVER LISTED ---------------
 * A move declares its attachment (`sideCondition`, `slotCondition`, `pseudoWeather`, `weather`,
 * `terrain`, `volatileStatus`, `status`) or performs it inside a handler (`addVolatile('x')`,
 * `addSideCondition('x')`, …). Both routes are read, because the authority uses both. Every walk is
 * filtered to the regulation first — `.all()` is the National Dex until it is filtered, and this is
 * the file that publishes what a Champions turn looks like. */
const SITES = new Map();
const mark = (id, s) => { id = norm(id); if (!id) return;
  if (!SITES.has(id)) SITES.set(id, new Set()); SITES.get(id).add(s); };

const srcOf = obj => { let s = ''; const walk = (v, d) => { if (d > 3 || v == null) return;
  if (typeof v === 'function') { s += String(v); return; }
  if (typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], d + 1); };
  walk(obj, 0); return s; };

let ALLSRC = '';
for (const mv of DEX.moves.all()) {
  if (!legal(mv)) continue;
  const decl = [[mv.volatileStatus, 'volatile'], [mv.self && mv.self.volatileStatus, 'volatile'],
                [mv.status, 'status'], [mv.sideCondition, 'side'], [mv.self && mv.self.sideCondition, 'side'],
                [mv.slotCondition, 'slot'], [mv.pseudoWeather, 'pseudoweather'],
                [mv.weather, 'weather'], [mv.terrain, 'terrain']];
  for (const sec of (mv.secondaries || [])) {
    decl.push([sec.volatileStatus, 'volatile'], [sec.status, 'status'],
              [sec.self && sec.self.volatileStatus, 'volatile']);
  }
  for (const [v, s] of decl) if (v) mark(v, s);
  ALLSRC += srcOf(mv);
}
for (const a of DEX.abilities.all()) { if (!legal(a)) continue; mark(a.id, 'ability'); ALLSRC += srcOf(a); }
for (const it of DEX.items.all()) { if (!legal(it)) continue; mark(it.id, 'item'); ALLSRC += srcOf(it); }
/* The six real statuses are asked for by name — the ONE hand-written list in this file, and it is a
 * list of status IDS rather than of behaviours, so it cannot drift into a claim about what they do. */
for (const id of ['brn', 'psn', 'tox', 'slp', 'frz', 'par']) mark(id, 'status');
for (const [re, s] of [
  [/addVolatile\(\s*['"]([A-Za-z0-9]+)['"]/g, 'volatile'],
  [/addSideCondition\(\s*['"]([A-Za-z0-9]+)['"]/g, 'side'],
  [/addSlotCondition\([^,]+,\s*['"]([A-Za-z0-9]+)['"]/g, 'slot'],
  [/addPseudoWeather\(\s*['"]([A-Za-z0-9]+)['"]/g, 'pseudoweather'],
  [/setWeather\(\s*['"]([A-Za-z0-9]+)['"]/g, 'weather'],
  [/setTerrain\(\s*['"]([A-Za-z0-9]+)['"]/g, 'terrain'],
  [/(?:trySetStatus|setStatus)\(\s*['"]([a-z]+)['"]/g, 'status'],
]) { let m; while ((m = re.exec(ALLSRC))) mark(m[1], s); }
/* A move's own `.condition` is attached under the MOVE's id — the two-turn moves (Fly, Dig, Dive,
 * Bounce, Phantom Force) reach the walk this way and carry `duration: 2`. */
for (const mv of DEX.moves.all()) {
  if (!legal(mv) || !mv.condition) continue;
  if (!SITES.has(mv.id)) mark(mv.id, 'volatile');
}

/* THE `state` OBJECTS ARE STAGED, NOT SHAPED BY HAND, AND THE FIRST VERSION OF THIS FILE GOT IT WRONG
 * BY SHAPING THEM. `resolvePriority`'s subOrder default for a Condition is decided by
 * `state.target instanceof Side | Field`, so the table's answer depends on what each attach method
 * actually WRITES into its state — and they do not agree. `side.addSideCondition` records
 * `target: this`; **`field.addPseudoWeather` records no `target` at all**. Handing it a
 * `Object.create(Field.prototype)` published Fairy Lock at subOrder 5 when the authority resolves it
 * to 2, and `tests/test-residual-order-population.js` caught it against a live battle within a minute
 * of existing. That is the whole argument for the gate in one line: a derivation that models the
 * authority instead of asking it will be wrong in exactly the places nobody thought to model.
 *
 * So one throwaway battle is staged and the REAL state object each attach method produces is kept as
 * the template. A site that cannot be staged throws — a COULD-NOT-STAGE is a claim about the fixture
 * and must never be quietly replaced by a guess. */
const STATE_OF_SITE = (() => {
  const { Battle: B, Teams } = require(path.join(SHOWDOWN, 'dist', 'sim'));
  const pool = DEX.species.all().filter(s => s.exists && !s.isNonstandard && s.tier !== 'Illegal');
  const pick = n => pool.slice(0, 0).concat(pool.filter(s => !s.types.includes('Flying')
    && !Object.values(s.abilities).some(a => /Levitate/i.test(a))).slice(0, n));
  const chosen = pick(2);
  if (chosen.length < 2) throw new Error('COULD NOT STAGE: fewer than two grounded legal species');
  const anyMove = DEX.moves.all().find(legal);
  if (!anyMove) throw new Error('COULD NOT STAGE: the regulation contains no legal move');
  const mk = s => ({ name: s.name, species: s.name, item: '',
    ability: Object.values(s.abilities)[0], gender: 'N', moves: [anyMove.name],
    evs: {}, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, level: 50 });
  const b = new B({ formatid: FORMAT, seed: [1, 2, 3, 4] });
  b.setPlayer('p1', { name: 'A', team: Teams.pack(chosen.map(mk)) });
  b.setPlayer('p2', { name: 'B', team: Teams.pack(chosen.map(mk)) });
  if (b.requestState === 'teampreview') { b.choose('p1', 'team 1, 2'); b.choose('p2', 'team 1, 2'); }
  const a = b.p1.active[0];
  const out = { status: a.statusState, ability: a.abilityState, item: a.itemState };
  /* S12 — NOT ONE MECHANIC IS NAMED HERE. The candidates at each site come out of `SITES`, which was
   * derived from the regulation twenty lines above, so a format that drops Tailwind stages whatever
   * it has instead of throwing on a literal that no longer exists. */
  const candidates = site => [...SITES].filter(([, ss]) => ss.has(site)).map(([id]) => id);
  for (const v of candidates('volatile')) { if (a.addVolatile(v, b.p2.active[0])) { out.volatile = a.volatiles[v]; break; } }
  for (const c of candidates('side')) { if (b.p1.addSideCondition(c, a)) { out.side = b.p1.sideConditions[c]; break; } }
  for (const c of candidates('slot')) { if (b.p1.addSlotCondition(a, c, a)) { out.slot = b.p1.slotConditions[a.position][c]; break; } }
  for (const c of candidates('pseudoweather')) { if (b.field.addPseudoWeather(c, a)) { out.pseudoweather = b.field.pseudoWeather[c]; break; } }
  for (const c of candidates('weather')) { if (b.field.setWeather(c, a)) { out.weather = b.field.weatherState; break; } }
  for (const c of candidates('terrain')) { if (b.field.setTerrain(c, a)) { out.terrain = b.field.terrainState; break; } }
  const missing = ['status', 'ability', 'item', 'volatile', 'side', 'slot', 'pseudoweather', 'weather', 'terrain']
    .filter(k => !out[k]);
  if (missing.length) throw new Error('COULD NOT STAGE the state shape for: ' + missing.join(', ')
    + ' — that is a claim about the fixture, never about the mechanic, and guessing it is what #242 '
    + 'was already caught doing.');
  /* proof the classes are what the branch tests for, so a Showdown refactor of these fields is loud */
  out.__evidence = {
    'side.target instanceof Side': out.side.target instanceof Side,
    'slot.target instanceof Side': out.slot.target instanceof Side,
    'slot.isSlotCondition': !!out.slot.isSlotCondition,
    'volatile.target instanceof Pokemon': out.volatile.target instanceof Pokemon,
    'pseudoWeather.target': out.pseudoweather.target === undefined ? 'UNSET — no Field refinement' : 'set',
    'weatherState.target': out.weather.target === undefined ? 'UNSET' : 'set',
    'terrainState.target': out.terrain.target === undefined ? 'UNSET' : 'set',
    /* MEASURED CONSEQUENCE: `resolvePriority`'s `state.target instanceof Field -> subOrder 5` branch
     * is UNREACHABLE in this Showdown build, because not one of the three field attach methods writes
     * a `target`. Every field condition therefore falls back to the plain Condition default of 2
     * unless it declares its own subOrder — which all four terrains and all four rooms happen to do,
     * so nothing in this format is currently mis-sorted by it. Recorded because a table that quietly
     * assumed 5 would agree with the authority today and diverge the moment one does not declare. */
    'any field state target instanceof Field':
      [out.pseudoweather, out.weather, out.terrain].some(s => s.target instanceof Field),
  };
  return out;
})();
const CALLBACK_OF = {
  status: 'onResidual', volatile: 'onResidual', ability: 'onResidual', item: 'onResidual',
  slot: 'onResidual', side: 'onSideResidual', pseudoweather: 'onFieldResidual',
  weather: 'onFieldResidual', terrain: 'onFieldResidual',
};
/* The two per-active collections pass NO getKey and a customHolder, so `end` is null: these rows can
 * never expire, and they carry the holder's speed. Their state is still the side's / field's. */
const PER_ACTIVE = { 'side@active': 'side', 'field@active': 'pseudoweather' };

function resolveAt(effect, site) {
  const base = PER_ACTIVE[site] || site;
  const cb = PER_ACTIVE[site] ? 'onResidual' : CALLBACK_OF[base];
  const h = RESOLVE.call(null, {
    effect,
    state: STATE_OF_SITE[base],
    /* effectHolder is deliberately absent: `speed` belongs to a live battle, not to an effect, and
     * baking one in is how a static table becomes a second disagreeing implementation. */
  }, cb);
  return { callbackName: cb, order: h.order === false ? null : h.order,
           priority: h.priority, subOrder: h.subOrder };
}

/* TYPE_SUBORDER IS PROBED, NOT TYPED. Kept exported because callers read it, but it is now an
 * OBSERVATION of `resolvePriority` rather than a transcription of it — the previous literal had
 * `Condition: 2` flat and no `Status` key, and both were wrong. The `Condition@<site>` entries are
 * the values that come out at a REAL staged attachment, which is the only way to see that a
 * pseudo-weather does NOT get the field refinement its effectType would suggest. */
const TYPE_SUBORDER = (() => {
  const out = {};
  for (const t of ['Condition', 'Status', 'Weather', 'Terrain', 'Format', 'Rule', 'Ruleset', 'Ability', 'Item']) {
    out[t] = RESOLVE.call(null, { effect: { effectType: t, name: '_probe_' }, state: {} }, 'onResidual').subOrder;
  }
  for (const site of ['volatile', 'slot', 'side', 'pseudoweather', 'weather', 'terrain']) {
    out['Condition@' + site] = resolveAt({ effectType: 'Condition', name: '_probe_' }, site).subOrder;
  }
  return out;
})();


/* The effect object the authority would resolve at that site: a Pokemon's ability slot reads the
 * ABILITY, its item slot the ITEM, and everything else goes through `conditions.getByID` — which is
 * also how an ability's or a move's own `.condition` sub-object is reached. */
const effectAt = (id, site) => site === 'ability' ? DEX.abilities.get(id)
                             : site === 'item' ? DEX.items.get(id)
                             : DEX.conditions.getByID(id);

const END_HOOK = { status: 'onEnd', volatile: 'onEnd', ability: 'onEnd', item: 'onEnd', slot: 'onEnd',
                   side: 'onSideEnd', pseudoweather: 'onFieldEnd', weather: 'onFieldEnd', terrain: 'onFieldEnd' };

/* PUBLISHED NAMESPACE. `ns` is what a consumer keys on — medicham2 builds `Map(rows.map(r => [ns+':'+id]))`
 * — and it has been stable since 2026-08-12; `site` is the authority's attachment and is the
 * load-bearing field. The rule is one line and it is what keeps 42 old keys pointing at exactly what
 * they pointed at before:
 *
 *   a row that carries a residual HANDLER keeps its legacy namespace;
 *   a row that is in the walk ONLY to spend a `duration` is published under `expiry`.
 *
 * WITHOUT THAT SPLIT THE FIRST RUN OF THIS FILE LOST A ROW WITHOUT SAYING SO. Grassy Terrain has two
 * participants — the heal at order 5 and the expiry at order 27 — and both wanted the key
 * `field:grassyterrain`. A Map keeps the LAST, so `field:grassyterrain` would have become 27, and
 * medicham2's `terrain` step would have moved eleven orders down the walk while still reporting itself
 * placed. That is the exact silent-success failure this repo is named for, arriving inside the fix
 * for another one. The generator now REFUSES to publish a duplicate key and prints it.
 *
 * Two volatiles keep an inherited namespace: the first version of this table reached them through its
 * status list and published them under `status`, and renaming them now would unplace a medicham2 step. */
const NS_COMPAT = { partiallytrapped: 'status', confusion: 'status' };
const NS_OF_SITE = { status: 'status', volatile: 'condition', slot: 'condition', side: 'condition',
                     pseudoweather: 'field', weather: 'field', terrain: 'field',
                     ability: 'ability', item: 'item',
                     'side@active': 'condition', 'field@active': 'field' };

function rowsFor() {
  const rows = [];
  const push = (id, site) => {
    const eff = effectAt(id, site);
    if (!eff || !eff.exists) return;
    const base = PER_ACTIVE[site] || site;
    const cb = PER_ACTIVE[site] ? 'onResidual' : CALLBACK_OF[base];
    const hasHandler = typeof eff[cb] === 'function';
    const hasDuration = !!(eff.duration || eff.durationCallback);
    /* The per-active collections pass no getKey, so a duration alone does NOT put an effect there. */
    const expiresHere = !PER_ACTIVE[site] && hasDuration;
    if (!hasHandler && !expiresHere) return;

    const k = resolveAt(eff, site);
    const endHook = END_HOOK[base];
    const endSrc = String(eff[endHook] || '');
    const addLit = /this\.add\(\s*['"]([^'"]+)['"]/.exec(endSrc);
    const route = hasHandler && expiresHere ? 'handler+duration' : hasHandler ? 'handler' : 'duration';
    rows.push({
      ns: hasHandler ? (NS_COMPAT[id] || NS_OF_SITE[site]) : 'expiry', id, name: eff.name || id,
      site, effectType: eff.effectType,
      route,
      hook: hasHandler ? cb : null,
      callbackName: k.callbackName,
      order: k.order, priority: k.priority, subOrder: k.subOrder,
      orderField: k.callbackName + 'Order',
      orderDeclared: eff[k.callbackName + 'Order'] !== undefined,
      subOrderSource: eff[k.callbackName + 'SubOrder'] !== undefined ? 'declared'
        : 'resolvePriority default for effectType ' + eff.effectType
          + (eff.effectType === 'Condition' ? ' attached at ' + base : ''),
      speedFrom: (base === 'side' || base === 'pseudoweather' || base === 'weather' || base === 'terrain')
        && !PER_ACTIVE[site] ? 'none — the holder is a Side/Field and has no speed, so this sorts as 0'
        : 'the body carrying it',
      expiresInWalk: expiresHere,
      duration: eff.duration === undefined ? null : eff.duration,
      durationCallback: !!eff.durationCallback,
      endHook: expiresHere ? endHook : null,
      announces: expiresHere && /this\.add\(/.test(endSrc),
      announceLine: expiresHere && addLit ? addLit[1] : null,
    });
  };

  for (const [id, sites] of SITES) for (const site of sites) push(id, site);
  /* An effect that owns `onResidual` while attached to a SIDE or the FIELD is collected a second time,
   * once per active body, with the body's speed and `end: null`. Grassy Terrain is the whole reason
   * this branch exists; it is derived rather than special-cased so a second one arrives on its own. */
  for (const [id, sites] of SITES) {
    for (const site of sites) {
      if (!['side', 'pseudoweather', 'weather', 'terrain'].includes(site)) continue;
      const eff = effectAt(id, site);
      if (eff && eff.exists && typeof eff.onResidual === 'function') {
        push(id, site === 'side' ? 'side@active' : 'field@active');
      }
    }
  }

  /* A DUPLICATE KEY WOULD SILENTLY OVERWRITE A CONSUMER'S LOOKUP — medicham2 builds a Map from these
   * rows, so the LAST duplicate would win and the first would vanish without a word. */
  const seen = new Map();
  const dups = [];
  const out = [];
  for (const r of rows) {
    const k = r.ns + ':' + r.id;
    if (seen.has(k)) { dups.push(k + ' (' + seen.get(k).site + ' vs ' + r.site + ')'); continue; }
    seen.set(k, r); out.push(r);
  }
  out.__dups = dups;
  return out;
}

/* THE AUTHORITY'S COMPARATOR, CALLED — minus the two terms a static table cannot carry. `speed` and
 * `effectOrder` belong to a live battle (which body holds the effect, and when it was applied), so
 * this sorts by what is knowable and the CONSUMER interleaves speed between order and subOrder. */
function sortRows(rows) {
  return rows.slice().sort((x, y) =>
    COMPARE({ order: x.order, priority: x.priority, subOrder: x.subOrder },
            { order: y.order, priority: y.priority, subOrder: y.subOrder })
    || (x.ns + ':' + x.id).localeCompare(y.ns + ':' + y.id));
}

const _raw = rowsFor();
const rows = sortRows(_raw);
rows.__dups = _raw.__dups;

const population = {
  total: rows.length,
  byRoute: rows.reduce((a, r) => (a[r.route] = (a[r.route] || 0) + 1, a), {}),
  bySite: rows.reduce((a, r) => (a[r.site] = (a[r.site] || 0) + 1, a), {}),
  expireInWalk: rows.filter(r => r.expiresInWalk).length,
  announcing: rows.filter(r => r.announces).length,
  silentButOrderBearing: rows.filter(r => r.expiresInWalk && !r.announces).length,
  noDeclaredOrder: rows.filter(r => r.order == null).length,
};

if (require.main === module) {
  console.log('\nRESIDUAL ORDER — ' + rows.length + ' walk participants in ' + FORMAT);
  console.log('  key: order ASC -> priority DESC -> SPEED DESC -> subOrder ASC -> effectOrder ASC');
  console.log('  (Battle#comparePriority, CALLED not transcribed; speed sorts BEFORE subOrder)\n');
  console.log('  order  sub  route            expires  announces        site           effect');
  for (const r of rows) {
    console.log('  ' + String(r.order == null ? '—' : r.order).padStart(5)
      + '  ' + String(r.subOrder).padStart(3)
      + '  ' + r.route.padEnd(15)
      + '  ' + (r.expiresInWalk ? '  yes  ' : '   -   ')
      + '  ' + String(r.announceLine || (r.expiresInWalk ? 'silent' : '-')).padEnd(15)
      + '  ' + r.site.padEnd(13) + '  ' + r.name);
  }
  const groups = new Map();
  for (const r of rows) groups.set(r.order, (groups.get(r.order) || 0) + 1);
  console.log('\n  distinct order values: ' + groups.size
    + '   groups where SPEED decides between effects: ' + [...groups].filter(([, n]) => n > 1).length);
  console.log('  POPULATION: ' + JSON.stringify(population));
  console.log('  probed subOrder defaults: ' + JSON.stringify(TYPE_SUBORDER));
  console.log('  staged state shapes:      ' + JSON.stringify(STATE_OF_SITE.__evidence));
  if (rows.__dups.length) console.log('  DUPLICATE PUBLISHED KEYS (a consumer would lose one): ' + rows.__dups.join(', '));
  console.log('\n  the tail — every participant with NO declared order sorts at the 4294967296 sentinel,\n'
    + '  i.e. after everything above, by holder speed:');
  for (const r of rows.filter(r => r.order == null)) console.log('      ' + r.site.padEnd(13) + r.name);

  if (process.argv.includes('--write')) {
    const art = {
      generated: new Date().toISOString(),
      by: 'engine/residual_order.js',
      format: FORMAT,
      what: 'Every WALK PARTICIPANT in this format: one (effect, attachment site) pair for each way an '
          + 'effect enters Battle#fieldEvent\'s residual list, whether it gets there by owning a residual '
          + 'handler or by carrying a live `duration`. The table ROADMAP #221\'s restructure consumes and '
          + 'ROADMAP #242 corrected from a subset to the population.',
      key: 'order ASC, priority DESC, speed DESC, subOrder ASC, effectOrder ASC '
         + '(Battle#comparePriority) — speed sorts BEFORE subOrder',
      key_provenance: 'order/priority/subOrder are produced by CALLING Battle.prototype.resolvePriority '
         + 'with the handler shape each collector builds; this file owns no copy of that rule.',
      not_carried: 'speed and effectOrder are properties of a live battle, not of an effect, so this '
                 + 'table sorts by (order, subOrder) and the consumer interleaves speed between them',
      no_declared_order: 'order: null means the effect declares no `<callbackName>Order`. '
                 + 'resolvePriority stores `false` and comparePriority substitutes 4294967296, so these '
                 + 'sort LAST in the walk — after every declared order — and among themselves by holder '
                 + 'speed DESC then subOrder ASC.',
      subOrder_defaults: TYPE_SUBORDER,
      duplicate_published_keys: rows.__dups,
      population,
      rows,
    };
    fs.writeFileSync(D('data', 'residual-order.json'), JSON.stringify(art, null, 2) + '\n');
    console.log('\n  wrote data/residual-order.json');
  }
}

module.exports = { rows, sortRows, resolveAt, TYPE_SUBORDER, SITES, population, FORMAT };
