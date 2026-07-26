/* selftest.js — assertions on the parts of the pipeline that fail SILENTLY.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every defect this project has shipped produced plausible output while being wrong. None of them
 * threw. A short list of the ones that cost real time:
 *
 *   - fillSet ignored a caller-supplied spread and re-sampled from the prior, so an experiment that
 *     thought it was holding the spread fixed was not. Found only because three "different" arms
 *     returned win rates identical to the decimal.
 *   - build_lab forwarded moves/item/ability into packTeam and dropped the spread, so every spread
 *     arm was the same team. Same tell, and it needed the tell because —
 *   - the results table never printed the spread, so the collapse looked like a tie.
 *   - the set-generator's PRNG did not mix its seed, so the first draw was near-linear in it and
 *     every set came out the same.
 *   - a cosmetic forme (vivillonmonsoon) matched no prior and produced an EMPTY moveset rather than
 *     an error.
 *   - a mega forme named differently by Smogon (Floette-Mega for Floette-Eternal) silently got no
 *     stone, and a Pokemon with no stone cannot mega — which is most of how the corpus ended up with
 *     0% megas in a format built around them.
 *
 * Every one is a one-line assertion. That is the whole argument for this file: the failure mode of
 * this codebase is not crashes, it is confident wrong numbers, and the only defence is checking the
 * things that would otherwise look fine.
 *
 * Deliberately fast and dependency-free — no Showdown checkout needed for most of it — so there is no
 * excuse not to run it before a long batch.
 *
 *   node engine/selftest.js
 */
'use strict';
const path = require('path');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  let ok = false, why = '';
  try { const r = fn(); ok = r === true || r === undefined; if (!ok) why = String(r); }
  catch (e) { ok = false; why = e.message; }
  if (ok) { pass++; }
  else { fail++; failures.push([name, why]); }
  process.stdout.write((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '   -- ' + why) + '\n');
}

const SP = require('./set_priors.js');
const SS = require('./set_space.js');
const SM = require('./smogon_priors.js');

console.log('SELFTEST — the checks that catch silent wrongness\n');

/* ---- set generation ---------------------------------------------------------------------------- */
console.log('set generation');

check('a forced spread survives fillSet', () => {
  const a = SP.fillSet('Garchomp', { moves: ['Dragon Claw', 'Rock Slide', 'Protect', 'Earthquake'], nature: 'Adamant', evs: [0, 66, 0, 0, 0, 0] }, 104729);
  if (!a.spread) return 'no spread returned';
  if (a.spread.nature !== 'Adamant') return 'nature became ' + a.spread.nature;
  if (a.spread.sp.atk !== 66) return 'atk became ' + a.spread.sp.atk;
  return true;
});

check('two different forced spreads produce different sets', () => {
  const k = { moves: ['Dragon Claw', 'Rock Slide', 'Protect', 'Earthquake'] };
  const a = SP.fillSet('Garchomp', Object.assign({ nature: 'Adamant', evs: [0, 66, 0, 0, 0, 0] }, k), 104729);
  const b = SP.fillSet('Garchomp', Object.assign({ nature: 'Jolly', evs: [2, 32, 0, 0, 0, 32] }, k), 104729);
  return a.spread.nature !== b.spread.nature || 'both came back ' + a.spread.nature;
});

check('a forced item survives fillSet', () => {
  const a = SP.fillSet('Garchomp', { item: 'Choice Scarf' }, 7);
  return norm(a.item) === 'choicescarf' || 'item became ' + a.item;
});

check('the seed actually changes the set (PRNG mixes)', () => {
  const seen = new Set();
  for (let s = 1; s <= 40; s++) {
    const f = SP.fillSet('Garchomp', {}, s);
    seen.add((f.moves || []).map(norm).sort().join(',') + '|' + norm(f.item));
  }
  return seen.size > 3 || 'only ' + seen.size + ' distinct sets across 40 seeds';
});

check('every generated set has exactly four moves', () => {
  for (let s = 1; s <= 60; s++) {
    for (const sp of ['Garchomp', 'Incineroar', 'Whimsicott', 'Kingambit', 'Sinistcha']) {
      const f = SP.fillSet(sp, {}, s * 31);
      if ((f.moves || []).length !== 4) return sp + ' seed ' + s + ' -> ' + (f.moves || []).length + ' moves';
    }
  }
  return true;
});

check('no set carries two moves from the same family (Protect+Detect)', () => {
  const FAM = [['protect', 'detect', 'spikyshield', 'banefulbunker'], ['sunnyday', 'raindance', 'sandstorm', 'snowscape']];
  for (let s = 1; s <= 80; s++) {
    for (const sp of ['Garchomp', 'Incineroar', 'Blaziken', 'Whimsicott']) {
      const mv = (SP.fillSet(sp, {}, s * 17).moves || []).map(norm);
      for (const fam of FAM) {
        const hits = mv.filter(m => fam.includes(m));
        if (hits.length > 1) return sp + ' got ' + hits.join(' + ');
      }
    }
  }
  return true;
});

/* EVERY FORME IN THE FORMAT, DERIVED — not a list somebody has to remember to extend.
 *
 * The first version of this check hand-listed five formes and failed on Tatsugiri-Droopy, which
 * turned out not to be legal in Champions at all. The test was wrong, not the code — and a
 * hand-typed list of formes is the same S13 violation the code was just fixed for. So take every
 * hyphenated name Smogon actually reports for THIS format and assert all of them resolve.
 *
 * The failure mode being guarded is silent: a name that matches nothing yields an EMPTY moveset, and
 * the Pokemon plays Struggle for the whole game without raising anything. */
check('every forme in the format gets a full moveset', () => {
  const S = SM.priors().species;
  const formes = Object.values(S).filter(x => x.name && x.name.includes('-')).map(x => x.name);
  if (formes.length < 5) return 'only ' + formes.length + ' formes found — parse may have broken';
  const bad = [];
  for (const sp of formes) {
    const f = SP.fillSet(sp, {}, 991);
    if (!f || (f.moves || []).length !== 4) bad.push(sp + '(' + ((f && f.moves) || []).length + ')');
  }
  return bad.length === 0 || bad.length + ' of ' + formes.length + ' short: ' + bad.slice(0, 6).join(', ');
});

/* And the general rule that fix rests on, checked directly so it cannot silently regress. */
check('an unlisted forme falls back to its base species', () => {
  const S = SM.priors().species;
  const base = Object.values(S).find(x => x.name && !x.name.includes('-') && (x.moves || []).length >= 4);
  if (!base) return 'no hyphen-free species with moves to test against';
  const invented = base.name + '-Nonexistent-Pattern';
  const r = SM.forSpecies(invented);
  return (r && r.name === base.name) || 'did not fall back: ' + invented + ' -> ' + (r && r.name);
});

/* ---- the build space --------------------------------------------------------------------------- */
console.log('\nbuild space');

check('move percentages sum to about 400 (four slots per set)', () => {
  const bad = [];
  for (const nm of ['Garchomp', 'Incineroar', 'Kingambit', 'Whimsicott']) {
    const s = SM.forSpecies(nm);
    if (!s || !s.moves) { bad.push(nm + '(missing)'); continue; }
    const tot = s.moves.reduce((a, m) => a + m.pct, 0);
    if (tot > 400.5) bad.push(nm + '=' + tot.toFixed(1));   /* under 400 is the Other bucket */
  }
  return bad.length === 0 || bad.join(', ');
});

check('freedom is between 0 and 4 slots', () => {
  const P = SM.priors().species;
  const names = Object.values(P).sort((a, b) => b.raw - a.raw).slice(0, 30).map(x => x.name);
  for (const nm of names) {
    const sp = SS.spaceFor(nm);
    if (!sp) continue;
    if (!(sp.freedom >= 0 && sp.freedom <= 4)) return nm + ' freedom=' + sp.freedom;
    if (!(sp.blind >= 0 && sp.blind <= 4)) return nm + ' blind=' + sp.blind;
  }
  return true;
});

check('every factorial arm is a legal four-move set', () => {
  const F = SS.factorial('Garchomp');
  if (!F) return 'no factorial for Garchomp';
  for (const mc of F.moveCombos) {
    if (mc.moves.length !== 4) return mc.label + ' has ' + mc.moves.length + ' moves';
    if (new Set(mc.moves.map(norm)).size !== 4) return mc.label + ' repeats a move';
  }
  return true;
});

check('the factorial reference build is the four most common moves', () => {
  const F = SS.factorial('Garchomp');
  const std = F.space.standard.map(m => norm(m.move)).sort().join(',');
  const ref = F.moveCombos.find(m => m.label === 'standard');
  return (ref && ref.moves.map(norm).sort().join(',') === std) || 'reference arm is not the standard four';
});

check('every factorial cell is distinct', () => {
  const F = SS.factorial('Garchomp');
  const keys = new Set();
  for (const mc of F.moveCombos) for (const it of F.items) for (const spr of F.spreads) {
    keys.add([mc.label, it.label, spr.label].join('|'));
  }
  const n = F.moveCombos.length * F.items.length * F.spreads.length;
  return keys.size === n || keys.size + ' distinct of ' + n;
});

/* ---- mega stones ------------------------------------------------------------------------------- */
console.log('\nmega stones');

check('Smogon knows the stone rate for the common megas', () => {
  const bad = [];
  for (const nm of ['Charizard', 'Garchomp', 'Tyranitar', 'Floette-Eternal']) {
    const mi = SM.megaInfo(nm);
    if (nm === 'Garchomp') continue;                 /* no mega — absence is correct */
    if (!mi || !(mi.rate > 0)) bad.push(nm);
  }
  return bad.length === 0 || 'no megaInfo for: ' + bad.join(', ');
});

check('the bring priors carry the measured mega numbers', () => {
  let P;
  try { P = require('../data/bring-priors.json'); } catch (e) { return 'bring-priors.json missing'; }
  if (!P.mega) return 'no mega block — rerun engine/bring_priors.js';
  if (!(P.mega.p_side_megas > 0.3 && P.mega.p_side_megas < 1)) return 'p_side_megas=' + P.mega.p_side_megas;
  if (!(P.mega.p_mega_is_lead > 0 && P.mega.p_mega_is_lead < 1)) return 'p_mega_is_lead=' + P.mega.p_mega_is_lead;
  return true;
});

check('a stone-holding species is offered its own stone, not another', () => {
  const bad = [];
  for (const nm of ['Charizard', 'Tyranitar', 'Swampert']) {
    const mi = SM.megaInfo(nm);
    if (!mi || !mi.formes) continue;
    for (const f of mi.formes) {
      const stem = norm(f.item || '').replace(/ite[xy]?$/, '');
      if (stem && !norm(nm).startsWith(stem.slice(0, 5))) bad.push(nm + ' -> ' + f.item);
    }
  }
  return bad.length === 0 || bad.join(', ');
});

/* ---- the honest-numbers guard ------------------------------------------------------------------- */
console.log('\nreporting');

check('the blind spot is reported and is plausible', () => {
  const sp = SS.spaceFor('Garchomp');
  if (!sp) return 'no space for Garchomp';
  if (!(sp.pSetAffected > 0.02 && sp.pSetAffected < 0.5)) return 'pSetAffected=' + sp.pSetAffected;
  const kg = SS.spaceFor('Kingambit');
  /* Kingambit is the format's most locked species; if it ever reports a big blind spot, the "Other"
   * parse has broken. */
  return (kg && kg.pSetAffected < sp.pSetAffected) || 'Kingambit is no longer the most locked species';
});

/* ---- THE ONE THAT KEEPS COMING BACK -------------------------------------------------------------
 * Bot games are not a realism baseline. The ladder store is 87% unusable — bots, forfeits, partial
 * brings, stubs — and any tool that reads it line by line instead of through quality.loadGames() is
 * silently comparing our bots against other people's bots and calling the difference realism. It has
 * happened repeatedly. These assertions make it a test failure instead of a conversation. */
console.log('\nclean-data discipline');

check('the ladder store is mostly NOT usable, and we know it', () => {
  const Q = require('./quality.js');
  const all = Q.readStore(), clean = Q.loadGames();
  if (!all.length) return 'store is empty';
  if (clean.length >= all.length) return 'filter removed nothing — is quality.js wired?';
  if (clean.length / all.length > 0.5) return 'clean fraction is ' + (100 * clean.length / all.length).toFixed(0) + '%, expected far lower — filter may have loosened';
  return true;
});

check('no engine tool reads the ladder store without the clean filter', () => {
  const fs = require('fs');
  const dir = __dirname;
  const offenders = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js'))) {
    if (['quality.js', 'selftest.js'].includes(f)) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    /* names the ladder store but never mentions the module that decides what is usable */
    if (/games\.ladder[\w.-]*\.jsonl/.test(src) && !/quality/.test(src)) offenders.push(f);
  }
  return offenders.length === 0 || 'reads the ladder store raw: ' + offenders.join(', ');
});

console.log('\n' + '-'.repeat(60));
console.log(`  ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\n  FAILURES');
  for (const [n, w] of failures) console.log('    ' + n + '\n      ' + w);
}
process.exit(fail ? 1 : 0);
