/* legal_scope.js — WHICH MOVES, ABILITIES AND ITEMS OF THE ACTIVE REGULATION CAN REACH A BOARD, AND WHY NOT.
 *
 *   const LS = require('./legal_scope.js');
 *   const S = LS.derive();                 // memoised per process
 *   S.inScope('ability', 'fairyaura')      -> true / false
 *   S.verdict('ability', 'simple')         -> { inScope, code, why, ... } — the one answer, with its reason
 *   S.why('move', 'spore')                 -> the reason it is out, or null
 *   node engine/legal_scope.js             -> prints the derivation
 *
 * ONE FACT, ONE IMPLEMENTATION (2026-09-11, MEASURE). "Which mechanics exist in Reg M-B" is decided HERE.
 * engine/coverage.js (the denominator) and engine/stage_planner.js (the fixtures) import it, and
 * tests/test-stage-planner.js clause oneScope fails if either returns a different in-scope set. The day the
 * planner's own carrier list met this file they printed 847 and 845 for one fact, and disagreed on three
 * rows the totals only partly showed (docs/_reports/2026-09-11-scope-unified.md). Three of ENGINE's files
 * still decide scope their own way — engine/all_mechanics_fire.js, tests/roster.js, engine/tag_dex.js
 * LEGAL_CARRIED — and that report names the lines that move to this module in the next engine pass.
 *
 * THE CODES — every part read off the format, never typed:
 *
 *   IN SCOPE
 *   CARRIED    ability  a legal species (`x.exists && !x.isNonstandard && x.tier !== 'Illegal'`, megas and
 *                       battle-only formes INCLUDED) carries it, and Showdown's own TeamValidator accepts that
 *                       species with it. Asked, not reasoned about; one accepted carrier is enough.
 *   LEARNED    move     a legal species can learn it (`dex.species.getMovePool`, the function the validator
 *                       reasons from). Checked against `champions_sim.canLearn` on 2026-09-11: every such move
 *                       has a learner the validator accepts, 0 exceptions.
 *   INJECTED   move     the simulator hands it to a body without a learnset — read out of `getMoves`' own
 *                       fallback literal, which is how Struggle stays in scope.
 *   CONFERRED  ability  no accepted carrier, but an in-scope source WRITES it onto a body (`setAbility` or a
 *                       forme change with a literal argument) and, for a move, the validator accepts a learner
 *                       holding that move. Simple, by way of Simple Beam on Audino.
 *   HELD       item     legal; a mega stone only when one of its mega formes is legal, and an item with
 *                       `itemUser` only when one of those users is legal.
 *
 *   OUT OF SCOPE
 *   NO-LEGAL-CARRIER    nothing legal carries, learns or holds it, and nothing in scope confers or injects it.
 *   VALIDATOR-REFUSED   legal species carry it and the validator refuses every one. Battle Bond: Greninja's
 *                       `S` slot names it and the validator answers "Greninja (Greninja-Bond) does not exist
 *                       in Gen 9".
 *   NO-LEGAL-READER     an ability or item whose EVERY handler only writes `abilityState.<k>`, where nothing in
 *                       the regulation reads <k> — no legal move, ability or item handler other than itself, no
 *                       line of the sim — and something out of the regulation does. It sits on a board and can
 *                       change none. Gluttony: its two handlers set `abilityState.gluttony`, and the fourteen
 *                       pinch berries that read it are all `isNonstandard: 'Past'`. An assignment reads nothing,
 *                       so Neutralizing Gas's `abilityState.gluttony = false` is not a reader. A MOVE is never
 *                       put out this way: it acts by being clicked, whatever its handlers write.
 *
 * CONFERRED ABILITIES ARE ADMITTED. The first version of this file reported them and left the decision to
 * Will. Measured since: Simple Beam is legal, the validator accepts Audino holding it, 37 of 17,381 pinned
 * games declare it and 19 click it; engine/tag_dex.js already admits Simple from this module's `conferred`
 * list, and engine/medicham2-browser.js now applies its multiplier. A denominator that leaves out a mechanic
 * the engine models and the ladder plays is not the regulation's. The tag plan filed it "out of scope unless
 * Will says so" (docs/_reports/2026-09-11-plan-tags.md, B6-b); if he says no, ADMIT_CONFERRED is the line. */
'use strict';
const fs = require('fs');
const path = require('path');

const FILTER = "x.exists && !x.isNonstandard && x.tier !== 'Illegal'";
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ADMIT_CONFERRED = true;
const IN_CODES = Object.freeze(['CARRIED', 'LEARNED', 'INJECTED', 'CONFERRED', 'HELD']);
const OUT_CODES = Object.freeze(['NO-LEGAL-CARRIER', 'VALIDATOR-REFUSED', 'NO-LEGAL-READER']);

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

/* NO-LEGAL-READER, THE SHAPE: every handler body is nothing but `<x>.abilityState.<k> = <expr>;`. Returns the
 * keys written, or null when any handler does anything else (then it can act on its own). */
const STATE_WRITE = /[\w$.]+\.abilityState\.([A-Za-z_$][\w$]*)\s*=(?!=)[^;]*;/g;
function stateOnlyKeys(e) {
  const F = fnSources(e);
  if (!F.length) return null;
  const keys = new Set();
  for (const f of F) {
    const i = f.src.indexOf('{'), j = f.src.lastIndexOf('}');
    const body = i >= 0 && j > i ? f.src.slice(i + 1, j) : f.src;
    for (const m of body.matchAll(STATE_WRITE)) keys.add(m[1]);
    if (body.replace(STATE_WRITE, '').trim() !== '') return null;
  }
  return keys.size ? [...keys] : null;
}

let MEMO = null;
function derive(opts = {}) {
  if (MEMO && !opts.fresh) return MEMO;
  const CS = require('./champions_sim.js');
  const dex = CS.dexFor(CS.FORMAT);
  const simDir = path.join(require('./showdown_path.js').resolve() || '', 'dist', 'sim');
  const failures = [];
  const V = { move: new Map(), ability: new Map(), item: new Map() };

  const species = dex.species.all().filter(legal);

  /* abilities — carriers, then the validator */
  const abCarriers = new Map();
  for (const s of species) for (const [slot, name] of Object.entries(s.abilities || {})) {
    const k = idOf(name);
    if (!abCarriers.has(k)) abCarriers.set(k, []);
    abCarriers.get(k).push({ species: s.id, slot, mega: !!s.isMega, battleOnly: !!s.battleOnly });
  }
  const abilityIn = new Map(), refused = [];
  const legalAbilities = dex.abilities.all().filter(a => a.exists && !a.isNonstandard).map(a => a.id);
  for (const a of legalAbilities) {
    const list = abCarriers.get(a) || [];
    if (!list.length) { V.ability.set(a, { inScope: false, code: 'NO-LEGAL-CARRIER', why: 'no legal species carries it' }); continue; }
    let accepted = null;
    for (const c of list) {
      const entry = teamEntryFor(dex, c, a);
      const v = CS.checkLegal({ species: entry.species, ability: entry.ability, item: entry.item });
      if (v && v.legal) { accepted = Object.assign({ via: entry.via }, c); break; }
      refused.push({ ability: a, species: c.species, slot: c.slot, via: entry.via, problems: (v && v.problems) || [] });
    }
    if (accepted) { abilityIn.set(a, accepted); V.ability.set(a, { inScope: true, code: 'CARRIED', why: null, carrier: accepted }); }
    else V.ability.set(a, { inScope: false, code: 'VALIDATOR-REFUSED', why: 'every legal carrier is refused by the TeamValidator ('
      + list.map(c => c.species + ' slot ' + c.slot).join(', ') + ')',
      problems: refused.filter(r => r.ability === a).map(r => r.problems[0]).filter(Boolean) });
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
  for (const m of legalMoves) {
    const inj = injected.find(x => x.id === m);
    if ((learners.get(m) || []).length) V.move.set(m, { inScope: true, code: 'LEARNED', why: null, learners: learners.get(m).length });
    else if (inj) V.move.set(m, { inScope: true, code: 'INJECTED', why: null, cite: inj.cite });
    else V.move.set(m, { inScope: false, code: 'NO-LEGAL-CARRIER', why: 'no legal species learns it and the sim does not inject it' });
  }

  /* items */
  const legalItems = dex.items.all().filter(i => i.exists && !i.isNonstandard);
  for (const it of legalItems) {
    if (it.megaStone && !Object.entries(it.megaStone).some(([b, f]) => legal(dex.species.get(b)) && legal(dex.species.get(f))))
      V.item.set(it.id, { inScope: false, code: 'NO-LEGAL-CARRIER', why: 'a mega stone with no legal mega forme' });
    else if (it.itemUser && !it.itemUser.some(u => legal(dex.species.get(u))))
      V.item.set(it.id, { inScope: false, code: 'NO-LEGAL-CARRIER', why: 'no legal species can use it (' + it.itemUser.join(', ') + ')' });
    else V.item.set(it.id, { inScope: true, code: 'HELD', why: null });
  }

  /* conferred — abilities a legal source can WRITE onto a body with no accepted legal carrier. The list is
   * computed BEFORE admission, so its shape and `reason` are what engine/tag_dex.js already reads. */
  const writers = abilityWriters(simDir, failures);
  const sources = [];
  for (const m of legalMoves) if (V.move.get(m).inScope) sources.push({ kind: 'move', e: dex.moves.get(m) });
  for (const a of abilityIn.keys()) sources.push({ kind: 'ability', e: dex.abilities.get(a) });
  for (const i of legalItems) if (V.item.get(i.id).inScope) sources.push({ kind: 'item', e: i });
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
      reason: (V.ability.get(a) || {}).why || 'not a legal ability', via: [] });
    const c = conferredMap.get(a);
    if (!c.via.some(v => v.kind === w.kind && v.id === w.id))
      c.via.push({ kind: w.kind, id: w.id, handler: w.handler, call: w.via,
                   holders: w.kind === 'move' ? (learners.get(w.id) || []).length : null });
  }
  /* ADMISSION. A move source counts when the validator accepts one of its learners holding it (a mega
   * learner is asked as its base holding the stone); a carried ability or a held item is in scope already. */
  for (const c of conferredMap.values()) {
    c.admitted = false; c.admittedBy = null;
    if (!ADMIT_CONFERRED || !c.legalInDex) continue;
    for (const v of c.via) {
      if (v.kind !== 'move') { c.admittedBy = { kind: v.kind, id: v.id, accepted: 'in scope as ' + V[v.kind].get(v.id).code }; break; }
      const mv = dex.moves.get(v.id);
      const ls = (learners.get(v.id) || []).map(sid => dex.species.get(sid)).sort((x, y) => (!!x.isMega - !!y.isMega) || (!!x.battleOnly - !!y.battleOnly));
      for (const sp of ls) {
        const entry = teamEntryFor(dex, { species: sp.id }, null);
        const r = CS.checkLegal({ species: entry.species, item: entry.item, moves: [mv.name] });
        if (r && r.legal) { c.admittedBy = { kind: 'move', id: v.id, accepted: entry.species + (entry.item ? ' @ ' + entry.item : '') + ' with ' + mv.name }; break; }
      }
      if (c.admittedBy) break;
    }
    if (!c.admittedBy) continue;
    c.admitted = true;
    V.ability.set(c.ability, { inScope: true, code: 'CONFERRED', why: null, conferredBy: c.admittedBy, sources: c.via.map(v => v.kind + ':' + v.id) });
  }

  /* NO LEGAL READER — the effect is a flag only out-of-regulation entities read */
  let simSrc = '';
  for (const f of ['pokemon.js', 'battle.js', 'battle-actions.js', 'field.js', 'side.js']) {
    try { simSrc += fs.readFileSync(path.join(simDir, f), 'utf8') + '\n'; } catch (e) { failures.push('sim source unreadable: ' + f + ' (' + e.message + ')'); }
  }
  const everyEntry = dex.moves.all().concat(dex.abilities.all(), dex.items.all()).filter(x => x.exists);
  const srcOf = new Map();
  const text = x => { if (!srcOf.has(x)) srcOf.set(x, fnSources(x).map(f => f.src).join('\n')); return srcOf.get(x); };
  const noReader = [];
  for (const [kind, list] of [['ability', legalAbilities.map(a => dex.abilities.get(a))], ['item', legalItems]]) for (const e of list) {
    if (!V[kind].get(e.id).inScope) continue;
    const keys = stateOnlyKeys(e);
    if (!keys) continue;
    const per = keys.map(k => {
      const reads = new RegExp('abilityState\\.' + k + '\\b(?!\\s*=[^=])');
      const readers = everyEntry.filter(x => x.id !== e.id && reads.test(text(x)));
      return { key: k, legalReaders: readers.filter(x => !x.isNonstandard).map(x => x.id),
               illegalReaders: readers.filter(x => x.isNonstandard).map(x => x.id), sim: reads.test(simSrc) };
    });
    if (per.every(p => !p.legalReaders.length && !p.sim) && per.some(p => p.illegalReaders.length)) {
      const ill = [...new Set(per.flatMap(p => p.illegalReaders))];
      V[kind].set(e.id, { inScope: false, code: 'NO-LEGAL-READER', why: 'it only writes ' + per.map(p => 'abilityState.' + p.key).join(', ')
        + ', and every entity that reads it is out of the regulation (' + ill.join(', ') + ')', illegalReaders: ill, was: V[kind].get(e.id).code });
      noReader.push(kind + ':' + e.id);
    }
  }

  const ids = kind => [...V[kind].entries()];
  const inIds = kind => ids(kind).filter(([, v]) => v.inScope).map(([k]) => k);
  const count = kind => ids(kind).reduce((o, [, v]) => (o[v.code] = (o[v.code] || 0) + 1, o), {});
  MEMO = {
    format: CS.FORMAT, filter: FILTER, admitConferred: ADMIT_CONFERRED,
    species: species.length,
    speciesMega: species.filter(s => s.isMega).length,
    speciesBattleOnly: species.filter(s => s.battleOnly && !s.isMega).length,
    legal: { move: legalMoves.length, ability: legalAbilities.length, item: legalItems.length },
    inScopeCount: { move: inIds('move').length, ability: inIds('ability').length, item: inIds('item').length },
    codes: { move: count('move'), ability: count('ability'), item: count('item') },
    injected, refused, writers: [...writers].sort(), noReader,
    copies: writes.filter(w => !w.abilities).map(w => w.kind + ':' + w.id + ' ' + w.via + '(' + w.arg + ')'),
    conferred: [...conferredMap.values()],
    failures,
    verdict: (kind, id) => (V[kind] && V[kind].get(idOf(id))) || { inScope: false, code: 'NOT-LEGAL', why: 'not a legal ' + kind + ' in ' + CS.FORMAT },
    inScope: (kind, id) => V[kind] ? !!(V[kind].get(idOf(id)) || {}).inScope : null,
    inScopeIds: kind => V[kind] ? inIds(kind) : [],
    isLegal: (kind, id) => !!(V[kind] && V[kind].has(idOf(id))),
    why: (kind, id) => { const v = V[kind] && V[kind].get(idOf(id)); return v && !v.inScope ? v.why : null; },
    outOfScope: kind => ids(kind).filter(([, v]) => !v.inScope).map(([id, v]) => ({ id, code: v.code, why: v.why })),
  };
  return MEMO;
}

module.exports = { derive, FILTER, IN_CODES, OUT_CODES, abilityWriters, simInjectedMoves };

if (require.main === module) {
  const t0 = Date.now();
  const S = derive();
  const tally = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([c, n]) => c + ' ' + n).join(', ');
  console.log(`LEGAL SCOPE — ${S.format}, species filter ${S.filter}`);
  console.log(`  species ${S.species} (${S.speciesMega} mega formes, ${S.speciesBattleOnly} other battle-only formes included)`);
  const total = ['move', 'ability', 'item'].reduce((n, k) => n + S.inScopeCount[k], 0);
  const legalN = ['move', 'ability', 'item'].reduce((n, k) => n + S.legal[k], 0);
  console.log(`  IN SCOPE ${total} of ${legalN} legal mechanics`);
  for (const k of ['move', 'ability', 'item']) {
    const o = S.outOfScope(k);
    console.log(`  ${{ move: 'moves', ability: 'abilities', item: 'items' }[k]}: ${S.inScopeCount[k]} in scope of ${S.legal[k]} legal (${tally(S.codes[k])})`
      + (o.length && o.length <= 12 ? ' — out: ' + o.map(x => x.id + ' [' + x.code + ']').join(', ') : ''));
  }
  console.log('  injected by the sim: ' + (S.injected.map(x => x.id + ' ' + x.cite).join(', ') || 'none'));
  console.log('  validator refusals: ' + (S.refused.map(r => r.species + '/' + r.ability + ' slot ' + r.slot + ': '
    + (r.problems[0] || '')).join(' | ') || 'none'));
  console.log('  no legal reader: ' + (S.noReader.map(k => k + ' — ' + S.verdict(...k.split(':')).why).join(' | ') || 'none'));
  console.log('  sim methods that write an ability: ' + S.writers.join(', '));
  console.log('  copies (confer only an ability already on a body): ' + S.copies.length + ' — ' + S.copies.join('; '));
  console.log('  CONFERRED (no accepted carrier, written by an in-scope source): ' + (S.conferred.map(c => c.name + ' via '
    + c.via.map(v => v.kind + ':' + v.id + (v.holders != null ? ' (' + v.holders + ' legal learners)' : '')).join(', ')
    + (c.admitted ? ' — ADMITTED, the validator accepts ' + c.admittedBy.accepted : ' — not admitted')).join('; ') || 'none'));
  if (S.failures.length) { console.log('  DERIVATION FAILURES: ' + S.failures.join(' | ')); process.exitCode = 1; }
  console.log(`  ${Date.now() - t0} ms`);
}
