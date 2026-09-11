/* legal_scope.js — WHICH MOVES, ABILITIES AND ITEMS OF THE ACTIVE REGULATION CAN REACH A BOARD.
 *
 *   const LS = require('./legal_scope.js');
 *   const S = LS.derive();          // memoised per process
 *   S.inScope('ability', 'fairyaura')   -> true / false
 *   S.why('move', 'spore')              -> the reason it is out, or null
 *   node engine/legal_scope.js          -> prints the derivation
 *
 * ONE IMPLEMENTATION, AND IT IS NOT YET THE ONLY ONE (2026-09-11, MEASURE). Scope is decided in four
 * places today and they disagree:
 *
 *   engine/all_mechanics_fire.js  LEGAL_SPECIES drops `isMega` and `battleOnly`, so the 14 abilities
 *                                 only a mega carries are reported NO LEGAL CARRIER, and it excuses all
 *                                 75 mega stones as out of scope. It is the artifact's scope.
 *   tests/roster.js               CARRIERS keeps megas and battle-only formes and has no tier check.
 *   engine/tag_dex.js             LEGAL_CARRIED filters species only, abilities only.
 *   engine/coverage.js            read the artifact's `unreachable` / `out_of_scope` flags, and so
 *                                 inherited the first file's error. It now calls THIS.
 *
 * The first three are ENGINE's files. This module is where they should come, so there is one answer.
 *
 * THE RULE, EVERY PART READ OFF THE FORMAT:
 *
 *   species   `x.exists && !x.isNonstandard && x.tier !== 'Illegal'` — megas and battle-only formes
 *             INCLUDED. A mega's ability is on the board the turn it evolves, and Fairy Aura sits on
 *             the third most-held stone in the pinned pool.
 *   ability   in scope when a legal species carries it AND Showdown's own TeamValidator accepts that
 *             species with that ability. The validator is asked, not reasoned about: Greninja's `S`
 *             slot names Battle Bond, and the validator refuses it ("Greninja-Bond does not exist in
 *             Gen 9"). One accepted carrier is enough; carriers are tried until one is accepted.
 *   move      in scope when a legal species can learn it (`dex.species.getMovePool`, the function the
 *             validator reasons from) OR the simulator injects it without a learnset. The injected set
 *             is read out of the sim's own `getMoves` fallback, never typed: it is how Struggle, which
 *             nothing learns and every body can use, stays in scope.
 *   item      in scope when it is legal, and a mega stone only when one of its mega formes is legal,
 *             and an item with `itemUser` only when one of those users is legal.
 *
 * CONFERRED ABILITIES ARE REPORTED, NOT ADMITTED. A legal move can put an ability on a body that no
 * legal species carries (Simple Beam writes Simple). Whether that makes the ability in scope is Will's
 * call, not this file's, so `conferred` lists every such ability with the sources that can write it
 * and `inScope` does NOT count it. The list is derived: the simulator methods that write an ability
 * are found by reading the sim source, and every legal move, carried ability and legal item handler is
 * scanned for a call to one of them with a literal argument. */
'use strict';
const fs = require('fs');
const path = require('path');

const FILTER = "x.exists && !x.isNonstandard && x.tier !== 'Illegal'";
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* every function reachable on a dex entry (its own handlers, `condition`, `secondary`, `self`) */
function fnSources(o, depth = 0, seen = new Set(), pre = '') {
  const out = [];
  if (!o || typeof o !== 'object' || seen.has(o) || depth > 3) return out;
  seen.add(o);
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'function') out.push({ handler: pre + k, src: v.toString() });
    else if (v && typeof v === 'object') out.push(...fnSources(v, depth + 1, seen, pre + k + '.'));
  }
  return out;
}

/* the first argument of every `.<name>(` call, scanned to its balanced end */
function firstArgs(src, name) {
  const out = [];
  const re = new RegExp('\\.' + name + '\\(', 'g');
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length, d = 0, q = null;
    const s = i;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) { if (d === 0) break; d--; }
      else if (c === ',' && d === 0) break;
    }
    out.push(src.slice(s, i).trim());
  }
  return out;
}
const literalOf = a => { const m = a.match(/^['"`]([^'"`$]+)['"`]$/); return m ? m[1] : null; };

/* THE SIM METHODS THAT WRITE AN ABILITY, read out of the compiled simulator. A method is a writer if
 * its body assigns `.ability =` or calls `.setAbility(`. This finds `skillSwap` (Skill Swap and
 * Wandering Spirit reach an ability through it, and neither handler names `setAbility`), which a scan
 * for `setAbility(` alone misses. `constructor` is excluded: no handler constructs a Pokemon. */
function abilityWriters(simDir, failures) {
  const writers = new Set();
  for (const f of ['pokemon.js', 'battle.js', 'battle-actions.js']) {
    let src;
    try { src = fs.readFileSync(path.join(simDir, f), 'utf8'); }
    catch (e) { failures.push('sim source unreadable: ' + f + ' (' + e.message + ')'); continue; }
    let cur = null;
    for (const line of src.split('\n')) {
      const h = line.match(/^ {2}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
      if (h) { cur = h[1]; continue; }
      if (cur && cur !== 'constructor' && /\.ability\s*=(?!=)|\.setAbility\(/.test(line)) writers.add(cur);
    }
  }
  if (!writers.has('setAbility')) failures.push('the sim source did not yield setAbility as a writer — the method parse is broken');
  return writers;
}

/* THE MOVES THE SIM INJECTS WITHOUT A LEARNSET, from `getMoves`' own fallback literal. */
function simInjectedMoves(simDir, failures) {
  const file = path.join(simDir, 'pokemon.js');
  let src;
  try { src = fs.readFileSync(file, 'utf8'); }
  catch (e) { failures.push('sim source unreadable: pokemon.js (' + e.message + ')'); return []; }
  const out = [];
  const re = /moves\s*=\s*\[\s*\{\s*move:\s*['"]([^'"]+)['"],\s*id:\s*['"]([a-z0-9]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    out.push({ id: m[2], cite: 'READ:dist/sim/pokemon.js:' + line });
  }
  if (!out.length) failures.push('the getMoves fallback in dist/sim/pokemon.js did not parse — an injected move (Struggle) may read as out of scope');
  return out;
}

/* A MEGA OR BATTLE-ONLY FORME IS NOT A TEAM ENTRY, so it is put to the validator the way it is
 * reached. Asked as itself, the validator refuses every mega outright — "Feraligatr-Mega transforms
 * in-battle with Feraligite, please fix its item" — and the first run of this file took that as 14
 * abilities out of scope, which is the all_mechanics_fire.js error arriving by a different door. A
 * mega is its base species holding the stone (the base is read off the STONE's own `megaStone` map,
 * never off the forme's name), and a battle-only forme is its `battleOnly` base. The ability then
 * arrives with the forme change, so it is not named in the set. */
function teamEntryFor(dex, c, ability) {
  const sp = dex.species.get(c.species);
  if (sp.isMega) {
    const stones = [].concat(sp.requiredItem || [], sp.requiredItems || []);
    for (const s of stones) {
      const it = dex.items.get(s);
      const base = it && it.megaStone && Object.keys(it.megaStone).find(b => idOf(it.megaStone[b]) === sp.id);
      if (base) return { species: base, item: it.name, via: base + ' holding ' + it.name };
    }
    return { species: c.species, ability, via: 'no stone maps to this forme' };
  }
  if (sp.battleOnly) {
    const base = Array.isArray(sp.battleOnly) ? sp.battleOnly[0] : sp.battleOnly;
    return { species: base, via: 'battle-only forme of ' + base };
  }
  return { species: c.species, ability, via: null };
}

let MEMO = null;
function derive(opts = {}) {
  if (MEMO && !opts.fresh) return MEMO;
  const CS = require('./champions_sim.js');
  const dex = CS.dexFor(CS.FORMAT);
  const simDir = path.join(require('./showdown_path.js').resolve() || '', 'dist', 'sim');
  const failures = [];

  const species = dex.species.all().filter(legal);

  /* abilities — carriers, then the validator */
  const abCarriers = new Map();
  for (const s of species) for (const [slot, name] of Object.entries(s.abilities || {})) {
    const k = idOf(name);
    if (!abCarriers.has(k)) abCarriers.set(k, []);
    abCarriers.get(k).push({ species: s.id, slot, mega: !!s.isMega, battleOnly: !!s.battleOnly });
  }
  const abilityOut = new Map(), abilityIn = new Map(), refused = [];
  const legalAbilities = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.id);
  for (const a of legalAbilities) {
    const list = abCarriers.get(a) || [];
    if (!list.length) { abilityOut.set(a, 'no legal species carries it'); continue; }
    let accepted = null;
    for (const c of list) {
      const entry = teamEntryFor(dex, c, a);
      const v = CS.checkLegal({ species: entry.species, ability: entry.ability, item: entry.item });
      if (v && v.legal) { accepted = Object.assign({ via: entry.via }, c); break; }
      refused.push({ ability: a, species: c.species, slot: c.slot, via: entry.via, problems: (v && v.problems) || [] });
    }
    if (accepted) abilityIn.set(a, accepted);
    else abilityOut.set(a, 'every legal carrier is refused by the TeamValidator ('
      + list.map(c => c.species + ' slot ' + c.slot).join(', ') + ')');
  }

  /* moves — learners, plus what the sim injects */
  const learners = new Map();
  for (const s of species) {
    let pool;
    try { pool = dex.species.getMovePool(s.id); }
    catch (e) { failures.push('getMovePool(' + s.id + '): ' + e.message); continue; }
    for (const mv of pool) { if (!learners.has(mv)) learners.set(mv, []); learners.get(mv).push(s.id); }
  }
  const legalMoves = dex.moves.all().filter(m => m.exists && !m.isNonstandard).map(m => m.id);
  /* only an injected LEGAL move matters; the fallback also names moves this dex does not carry */
  const injectedAll = simInjectedMoves(simDir, failures);
  const injected = injectedAll.filter(x => legalMoves.includes(x.id));
  const injectedSet = new Set(injected.map(x => x.id));
  const moveOut = new Map(), moveIn = new Set();
  for (const m of legalMoves) {
    if ((learners.get(m) || []).length || injectedSet.has(m)) moveIn.add(m);
    else moveOut.set(m, 'no legal species learns it and the sim does not inject it');
  }

  /* items */
  const itemOut = new Map(), itemIn = new Set();
  const legalItems = dex.items.all().filter(i => i.exists && !i.isNonstandard);
  for (const it of legalItems) {
    if (it.megaStone && !Object.entries(it.megaStone).some(([b, f]) => legal(dex.species.get(b)) && legal(dex.species.get(f))))
      itemOut.set(it.id, 'a mega stone with no legal mega forme');
    else if (it.itemUser && !it.itemUser.some(u => legal(dex.species.get(u))))
      itemOut.set(it.id, 'no legal species can use it (' + it.itemUser.join(', ') + ')');
    else itemIn.add(it.id);
  }

  /* conferred — abilities a legal source can WRITE onto a body with no legal species carrier */
  const writers = abilityWriters(simDir, failures);
  const sources = [];
  for (const m of legalMoves) if (moveIn.has(m)) sources.push({ kind: 'move', e: dex.moves.get(m) });
  for (const a of abilityIn.keys()) sources.push({ kind: 'ability', e: dex.abilities.get(a) });
  for (const i of itemIn) sources.push({ kind: 'item', e: dex.items.get(i) });
  const writes = [];
  for (const S of sources) for (const f of fnSources(S.e)) for (const w of writers) for (const arg of firstArgs(f.src, w)) {
    const lit = literalOf(arg);
    let abilities = null;
    if (lit && w === 'setAbility') abilities = [idOf(lit)];
    else if (lit && w === 'formeChange') { const sp = dex.species.get(lit); abilities = sp.exists ? Object.values(sp.abilities || {}).map(idOf) : null; }
    writes.push({ kind: S.kind, id: S.e.id, handler: f.handler, via: w, arg: arg.slice(0, 60), abilities });
  }
  const conferredMap = new Map();
  for (const w of writes) for (const a of (w.abilities || [])) {
    if (!a || abilityIn.has(a)) continue;
    const A = dex.abilities.get(a);
    if (!conferredMap.has(a)) conferredMap.set(a, { ability: a, name: A.name, legalInDex: !!(A.exists && !A.isNonstandard),
      reason: abilityOut.get(a) || 'not a legal ability', via: [] });
    const c = conferredMap.get(a);
    if (!c.via.some(v => v.kind === w.kind && v.id === w.id))
      c.via.push({ kind: w.kind, id: w.id, handler: w.handler, call: w.via,
                   holders: w.kind === 'move' ? (learners.get(w.id) || []).length : null });
  }

  const out = { move: moveOut, ability: abilityOut, item: itemOut };
  const inn = { move: moveIn, ability: new Set(abilityIn.keys()), item: itemIn };
  MEMO = {
    format: CS.FORMAT, filter: FILTER,
    species: species.length,
    speciesMega: species.filter(s => s.isMega).length,
    speciesBattleOnly: species.filter(s => s.battleOnly && !s.isMega).length,
    legal: { move: legalMoves.length, ability: legalAbilities.length, item: legalItems.length },
    inScopeCount: { move: moveIn.size, ability: abilityIn.size, item: itemIn.size },
    injected, refused, writers: [...writers].sort(),
    copies: writes.filter(w => !w.abilities).map(w => w.kind + ':' + w.id + ' ' + w.via + '(' + w.arg + ')'),
    conferred: [...conferredMap.values()],
    failures,
    inScope: (kind, id) => inn[kind] ? inn[kind].has(idOf(id)) : null,
    inScopeIds: kind => [...(inn[kind] || [])],
    isLegal: (kind, id) => ({ move: legalMoves, ability: legalAbilities, item: legalItems.map(i => i.id) }[kind] || []).includes(idOf(id)),
    why: (kind, id) => (out[kind] && out[kind].get(idOf(id))) || null,
    outOfScope: kind => [...(out[kind] || new Map()).entries()].map(([id, why]) => ({ id, why })),
  };
  return MEMO;
}

module.exports = { derive, FILTER, abilityWriters, simInjectedMoves };

if (require.main === module) {
  const t0 = Date.now();
  const S = derive();
  console.log(`LEGAL SCOPE — ${S.format}, species filter ${S.filter}`);
  console.log(`  species ${S.species} (${S.speciesMega} mega formes, ${S.speciesBattleOnly} other battle-only formes included)`);
  for (const k of ['move', 'ability', 'item']) {
    const o = S.outOfScope(k);
    console.log(`  ${{ move: 'moves', ability: 'abilities', item: 'items' }[k]}: ${S.inScopeCount[k]} in scope of ${S.legal[k]} legal; ${o.length} out`
      + (o.length && o.length <= 12 ? ' — ' + o.map(x => x.id + ' (' + x.why + ')').join('; ') : ''));
  }
  console.log('  injected by the sim: ' + (S.injected.map(x => x.id + ' ' + x.cite).join(', ') || 'none'));
  console.log('  validator refusals: ' + (S.refused.map(r => r.species + '/' + r.ability + ' slot ' + r.slot + ': '
    + (r.problems[0] || '')).join(' | ') || 'none'));
  console.log('  sim methods that write an ability: ' + S.writers.join(', '));
  console.log('  copies (confer only an ability already on a body): ' + S.copies.length + ' — ' + S.copies.join('; '));
  console.log('  CONFERRED with no legal carrier: ' + (S.conferred.map(c => c.name + ' via '
    + c.via.map(v => v.kind + ':' + v.id + (v.holders != null ? ' (' + v.holders + ' legal learners)' : '')).join(', ')).join('; ') || 'none'));
  if (S.failures.length) { console.log('  DERIVATION FAILURES: ' + S.failures.join(' | ')); process.exitCode = 1; }
  console.log(`  ${Date.now() - t0} ms`);
}
