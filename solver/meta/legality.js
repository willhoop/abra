/* solver/meta/legality.js — is an entity in Reg M-C? Asked of the M-C Showdown checkout, never typed.
 *
 * The checkout and the two format ids are READ from data/regulations.json (`regmc`), not restated.
 * An entity is legal iff it exists, is not isNonstandard, is not tier 'Illegal' (CLAUDE.md's filter),
 * AND the format's own rule table does not ban it. The whole-team check is Showdown's TeamValidator. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, toID } = require('./lib.js');

function checkout() {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regulations.json'), 'utf8'));
  const e = (reg.runtime && reg.runtime.regmc) || reg.regmc;
  if (!e || !e.checkout || !e.showdownFormat || !e.bo3Format) throw new Error('data/regulations.json has no complete regmc runtime entry');
  const dir = path.resolve(ROOT, '..', e.checkout);
  if (!fs.existsSync(path.join(dir, 'dist', 'sim'))) throw new Error('M-C checkout not built at ' + dir);
  // The commit is read from the checkout's own .git files — no git command is run.
  let head = null;
  try {
    const h = fs.readFileSync(path.join(dir, '.git', 'HEAD'), 'utf8').trim();
    if (/^ref: /.test(h)) {
      const ref = h.slice(5);
      const loose = path.join(dir, '.git', ref);
      if (fs.existsSync(loose)) head = fs.readFileSync(loose, 'utf8').trim();
      else {
        const packed = fs.readFileSync(path.join(dir, '.git', 'packed-refs'), 'utf8');
        const m = packed.split('\n').find(l => l.endsWith(' ' + ref));
        head = m ? m.split(' ')[0] : null;
      }
    } else head = h;
  } catch (e) { head = null; }
  return { dir, bo1: e.showdownFormat, bo3: e.bo3Format, pinned: e.pinnedCommit || null, head };
}

function open() {
  const co = checkout();
  const { Dex, TeamValidator } = require(path.join(co.dir, 'dist', 'sim'));
  const D = Dex.forFormat(co.bo1);
  const F1 = Dex.formats.get(co.bo1), F3 = Dex.formats.get(co.bo3);
  if (!F1.exists || !F3.exists) throw new Error('M-C checkout does not know ' + co.bo1 + ' / ' + co.bo3);
  const RT = Dex.formats.getRuleTable(F1);
  const base = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
  const cache = new Map();
  function check(kind, name) {
    const key = kind + ':' + toID(name);
    if (cache.has(key)) return cache.get(key);
    let x, ok, why = null;
    if (kind === 'species') x = D.species.get(name);
    else if (kind === 'item') x = D.items.get(name);
    else if (kind === 'ability') x = D.abilities.get(name);
    else if (kind === 'move') x = D.moves.get(name);
    else if (kind === 'nature') x = D.natures.get(name);
    if (!x || !x.exists) { ok = false; why = 'does not exist'; }
    else if (kind === 'nature') ok = true;
    else if (kind === 'species' && x.battleOnly) {
      // an in-battle forme (a mega) is legal iff its out-of-battle base is
      const b = D.species.get(Array.isArray(x.battleOnly) ? x.battleOnly[0] : x.battleOnly);
      ok = base(b) && !RT.isBannedSpecies(b); if (!ok) why = 'base forme not legal';
    } else if (!base(x)) { ok = false; why = 'isNonstandard=' + x.isNonstandard + ' tier=' + x.tier; }
    else if (kind === 'species' && RT.isBannedSpecies(x)) { ok = false; why = 'banned by rule table'; }
    else if (kind !== 'species' && RT.isBanned(kind + ':' + x.id)) { ok = false; why = 'banned by rule table'; }
    else ok = true;
    const r = { ok, why, name: x && x.exists ? x.name : String(name), id: x && x.exists ? x.id : toID(name) };
    cache.set(key, r);
    return r;
  }
  const V1 = new TeamValidator(F1), V3 = new TeamValidator(F3);
  /** Validate one sheet (array of store slots) under bo1 or bo3. Returns problem strings. */
  function validate(sheet, fmt) {
    const team = sheet.map(s => ({
      name: '', species: D.species.get(s.species).name, item: s.item || '', ability: s.ability || '',
      moves: (s.moves || []).map(m => D.moves.get(m).name || m), nature: s.nature || '', gender: s.gender || '',
      level: s.level || 50, evs: undefined, ivs: undefined,
    }));
    return (fmt === 'bo3' ? V3 : V1).validateTeam(team) || [];
  }
  /* The store records no Stat Points (evs null on every slot), so the zero-investment clause is a
   * claim about the RECONSTRUCTION, not the team (data/team-pool-frozen-regmc/FROZEN.md says the same).
   * It and its continuation line are classed apart from every real rejection. */
  const isReconstructionArtifact = msg => /has exactly 0 Stat Points/.test(msg);
  const megaStone = id => { const it = D.items.get(id); return !!(it && it.exists && it.megaStone); };
  const legalCounts = () => {
    const f = x => base(x);
    return {
      species: D.species.all().filter(x => f(x) && !RT.isBannedSpecies(x)).length,
      items: D.items.all().filter(x => f(x) && !RT.isBanned('item:' + x.id)).length,
      abilities: D.abilities.all().filter(x => f(x) && !RT.isBanned('ability:' + x.id)).length,
      moves: D.moves.all().filter(x => f(x) && !RT.isBanned('move:' + x.id)).length,
    };
  };
  const displayName = (kind, id) => check(kind, id).name;
  return { co, D, check, validate, isReconstructionArtifact, megaStone, legalCounts, displayName };
}

module.exports = { open, checkout };
