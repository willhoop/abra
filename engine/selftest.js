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
/* ---- BOARD READING ------------------------------------------------------------------------------
 * The scoring bot's failure modes are all silent. It still plays a full battle and writes a normal
 * corpus whether or not it is aiming, whether or not its weights line up with the features they were
 * fitted on, and whether or not it can see that a Pokemon is still alive. Each of those produced a
 * plausible run during development. */
console.log('\nboard reading');

const B = require('./board.js');

check('the fitted weights match the feature list the code computes', () => {
  const fs = require('fs');
  const f = path.join(__dirname, '..', 'data', 'policy-weights.json');
  if (!fs.existsSync(f)) return 'data/policy-weights.json missing — run node engine/fit_policy.js';
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  /* THE DRIFT GUARD. The weight vector is a plain array indexed through board.js FEATURES. Insert a
   * feature in the middle without refitting and every weight after it silently applies to a
   * different quantity — the bot runs, produces games, and is wrong with nothing to show for it. */
  const got = (j.features || []).join(','), want = B.FEATURES.join(',');
  if (got !== want) return `weights fitted against [${got}] but the code computes [${want}]`;
  if (!Array.isArray(j.weights) || j.weights.length !== B.FEATURES.length) return 'weight vector is the wrong length';
  return true;
});

check('the board-aware fit beat the behaviour clone it replaces', () => {
  const fs = require('fs');
  const f = path.join(__dirname, '..', 'data', 'policy-weights.json');
  if (!fs.existsSync(f)) return 'data/policy-weights.json missing';
  const h = (JSON.parse(fs.readFileSync(f, 'utf8')).heldOut) || {};
  if (!h.boardAware || !h.behaviourCloneOnly) return 'the weight file records no held-out comparison';
  /* A refit that comes out WORSE than the policy it replaces must not ship quietly. This is the
   * head-to-head gate from BACKLOG item 4, applied to the one thing already measurable. */
  return h.boardAware.ll > h.behaviourCloneOnly.ll ||
    `the fit scores ${h.boardAware.ll.toFixed(4)} against the clone's ${h.behaviourCloneOnly.ll.toFixed(4)} — do not ship it`;
});

check('a damaged Pokemon is not buried alive', () => {
  const bd = new B.Board();
  bd.switchIn('p2', 'a', 'Incineroar');
  const m = bd.slot('p2', 'a');
  m.hp = 0;                                   // stored games record damage but never healing
  if (!bd.field().some(f => f.mon === m)) return 'a mon at 0 tracked HP left the field without fainting';
  bd.faint('p2', 'a');
  return !bd.field().some(f => f.mon === m) || 'a fainted mon is still on the field';
});

/* The rest need the simulator for the type chart. Reported as skipped rather than passed when it is
 * absent, because a skipped check that prints "ok" is worse than no check at all. */
let dex = null;
try { const CS = require('./champions_sim.js'); dex = CS.sim().Dex.forFormat(CS.FORMAT); } catch (e) { dex = null; }
function checkDex(name, fn) {
  if (!dex) { process.stdout.write('  skip ' + name + '   -- no SHOWDOWN_PATH, type chart unavailable\n'); return; }
  check(name, fn);
}

function twoFoes() {
  const bd = new B.Board();
  bd.switchIn('p1', 'a', 'Pelipper'); bd.switchIn('p1', 'b', 'Archaludon');
  bd.switchIn('p2', 'a', 'Garchomp'); bd.switchIn('p2', 'b', 'Incineroar');
  return bd;
}
/* Effectiveness is one-hot now, so 'how effective' is read as the 4x bucket then the 2x bucket. */
const effOf = (c, user, bd, side) => { const x = B.featuresFor(c, user, bd, side, dex, 0);
  return 2 * x[B.FEATURE_INDEX.eff4] + x[B.FEATURE_INDEX.eff2] - x[B.FEATURE_INDEX.effHalf] - 2 * x[B.FEATURE_INDEX.effQuarter]; };

checkDex('a single-target move offers one candidate per foe, scored separately', () => {
  const bd = twoFoes(), user = bd.slot('p1', 'a');
  const cs = B.candidates(['icebeam'], user, bd, 'p1', dex);
  if (cs.length !== 2) return 'got ' + cs.length + ' candidates, expected one per living foe';
  const byFoe = {};
  for (const c of cs) byFoe[c.targetMon.species] = effOf(c, user, bd, 'p1');
  /* Ice Beam is 4x on Garchomp and resisted by Incineroar. If these ever come out equal the aim is
   * not being scored and the bot is back to a coin flip, which is the whole defect it was built for. */
  if (!(byFoe.garchomp > byFoe.incineroar)) return `Garchomp ${byFoe.garchomp} vs Incineroar ${byFoe.incineroar}`;
  return true;
});

checkDex('a spread move is scored against everything it hits, not as a status move', () => {
  /* Both foes weak to Rock, DELIBERATELY. The first version of this check used Garchomp and
   * Incineroar, whose Rock Slide effectiveness is -1 and +1 — an average of exactly zero. It failed
   * while the code was correct, which is the same class of error as the bug it is guarding against:
   * a test whose expected value is arrived at by assumption rather than arithmetic. */
  const bd = new B.Board();
  bd.switchIn('p1', 'a', 'Archaludon');
  bd.switchIn('p2', 'a', 'Charizard'); bd.switchIn('p2', 'b', 'Incineroar');
  const user = bd.slot('p1', 'a');
  const cs = B.candidates(['rockslide'], user, bd, 'p1', dex);
  if (cs.length !== 1) return 'a spread move should be one candidate, got ' + cs.length;
  if (!cs[0].spread || cs[0].spread.length !== 2) return 'the spread list did not pick up both foes';
  const x = B.featuresFor(cs[0], user, bd, 'p1', dex, 0);
  /* Scoring these against no target at all read their effectiveness as zero and made Rock Slide,
   * Heat Wave and Dazzling Gleam look like status moves — a large share of all damage in doubles. */
  if (x[B.FEATURE_INDEX.isStatus] !== 0) return 'a damaging spread move was scored as a status move';
  return (x[B.FEATURE_INDEX.eff4] + x[B.FEATURE_INDEX.eff2]) > 0 || 'Rock Slide hit no super-effective bucket against two Rock-weak foes';
});

checkDex('a move that cannot work right now is marked dead', () => {
  const bd = twoFoes(), user = bd.slot('p1', 'a');
  const before = B.candidates(['tailwind'], user, bd, 'p1', dex)[0];
  const iDead = B.FEATURE_INDEX.deadSide;
  if (B.featuresFor(before, user, bd, 'p1', dex, 0)[iDead] !== 0) return 'Tailwind read as dead before it was set';
  const mv = dex.moves.get('tailwind');
  bd.startSide('p1', mv.sideCondition, mv.condition && mv.condition.duration);
  if (B.featuresFor(before, user, bd, 'p1', dex, 0)[iDead] !== 1) return 'Tailwind not marked dead with Tailwind already up';
  /* And it must expire on its own, from the dex duration rather than a number written here. */
  for (let i = 0; i < (mv.condition.duration || 4); i++) bd.endTurn();
  return B.featuresFor(before, user, bd, 'p1', dex, 0)[iDead] === 0 || 'Tailwind never expired';
});

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

check('every raw reader of the ladder store declares why', () => {
  const fs = require('fs'), pathm = require('path');
  const ROOT = pathm.join(__dirname, '..');
  const offenders = [];
  for (const r of ['engine', 'build', 'web', 'app', 'tests']) {
    const dir = pathm.join(ROOT, r);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(js|py)$/.test(f)) continue;
      if (['quality.js', 'quality.py', 'selftest.js'].includes(f)) continue;
      let src; try { src = fs.readFileSync(pathm.join(dir, f), 'utf8'); } catch (e) { continue; }
      if (!/games\.ladder[\w.-]*\.jsonl/.test(src)) continue;
      /* Either it filters, or it states in the file why it must not. The declaration lives at the
       * SITE OF USE rather than as a list of filenames in this test: a list here would rot the
       * moment somebody adds a file, and is exactly the hand-maintained state S13 forbids. */
      /* `.reasons(` is the other genuine filter idiom and is recognised deliberately, not as a
       * loophole. quality.js exposes exactly two entry points: loadGames() for records that carry a
       * store id, and reasons() for a record judged on its own structure — which is what a self-play
       * or open-sheet game needs, since it has no id in the ladder store to look up. Rejecting
       * reasons() would have pushed correctly-filtered files into declaring RAW-STORE-OK, which is
       * the opposite of what this check is for. */
      /* DEFINING A LOADER IS NOT USING THE CLEAN ONE — a false NEGATIVE, and the worst kind.
       *
       * This matched the bare string `load_games`, so a file that declares its OWN
       * `def load_games()` reading the store line by line with no filter at all satisfied the check by
       * naming a function. Three files did exactly that and passed silently for weeks:
       * engine/xatu_context.py, engine/xatu_belief.py and engine/train_value.py. The first of those
       * builds data/xatu-context-sets.json, which CHOMP consumes — so a CHOMP input was derived from a
       * store that is ~87% bots, forfeits and stubs, while the guard reported no offence.
       *
       * On 2026-07-27 this check was corrected from 17 offenders to 12 by removing three files that
       * only MENTION the path. That correction was right and incomplete: the same pass should have
       * found these three, so the true debt was 15. Over-counting is noise; under-counting is a clean
       * bill of health for contaminated data.
       *
       * Stripping the definition out and re-testing is NOT enough, which was the first attempt: the file
       * goes on to CALL its own loader, so the name still appears and the check still passes. The rule
       * has to be structural — a loader name counts as evidence of filtering only if the file did not
       * define that loader itself. */
      const definesOwnLoader = /(^|\n)[ \t]*(?:def[ \t]+_?load_games[ \t]*\(|function[ \t]+loadGames[ \t]*\(|const[ \t]+loadGames[ \t]*=)/.test(src);
      const importsQuality = /quality\.(?:js|py)|_quality\b|from[ \t]+quality|require\([^)]*quality/.test(src);
      /* Idioms that cannot be satisfied by naming a local function: they name quality.js's own surface. */
      const otherFilterIdiom = /isClean|clean=True|cleanIds|_cleanIds|\.reasons\(/.test(src);
      const borrowsTheRealLoader = /load_games|loadGames/.test(src) && !definesOwnLoader;
      /* fit_policy's loadCorpus IS a clean entry point, and not recognising it made this check report
       * a correctly-filtered file as an offender. It applies Q.config(), Q.reasons() and the
       * behavioural bot set, requires openSheet and sheets, and dedupes by replay id -- strictly more
       * screening than the bare `.reasons(` idiom already accepted above. A false POSITIVE here is
       * the opposite of what this check is for, exactly as the note on reasons() argues: it would push
       * correctly-filtered files into declaring RAW-STORE-OK, which would be a false statement about
       * the data they actually read.
       *
       * STRUCTURAL, for the same reason borrowsTheRealLoader is: naming a function must not be enough,
       * or a file could define its own loadCorpus that reads the store unfiltered and pass the check
       * by having chosen the name. Found by engine/forced_switch_audit.js tripping it on 2026-07-30. */
      const definesOwnCorpus = /(^|\n)[ \t]*(?:function[ \t]+loadCorpus[ \t]*\(|const[ \t]+loadCorpus[ \t]*=|def[ \t]+load_corpus[ \t]*\()/.test(src);
      const borrowsTheCleanCorpus = /loadCorpus|load_corpus/.test(src) && !definesOwnCorpus;
      const filters = importsQuality || otherFilterIdiom || borrowsTheRealLoader || borrowsTheCleanCorpus;
      const declares = /RAW-STORE-OK/.test(src);
      /* MENTIONING THE PATH IS NOT READING IT.
       *
       * This greps for the filename anywhere in the file, so it counted three files that never open the
       * store: engine/coach.js names it in a console.log describing what WOULD happen to a game,
       * engine/stamp.js shows it as `corpus: 'games.ladder.jsonl'` in a usage docstring, and
       * engine/mew_farm.js resolves the path only to REFUSE to write output over it — a safety guard,
       * counted as a violation of the rule it protects.
       *
       * The count matters, because this check is deliberately left failing while offenders remain, so
       * its number IS the project's measure of remaining GARBODOR debt. Reporting 16 when the truth is
       * 13 makes the one honest signal noisy, and a noisy signal gets ignored.
       *
       * Stripping comments and string literals before matching is the obvious fix and is WRONG:
       * `fs.readFileSync('data/games.ladder.jsonl')` puts the path inside a string, so that would
       * create false NEGATIVES — the one error this check must never make. So the declaration is
       * explicit and separate instead. RAW-STORE-OK means "I read the raw store, and here is why that
       * is legitimate". RAW-STORE-NOT-READ means "I name this path and never open it", and it has to
       * say what for. Both live at the site of use, never as a list of filenames in this file. */
      const notRead = /RAW-STORE-NOT-READ/.test(src);
      if (!filters && !declares && !notRead) offenders.push(r + '/' + f);
    }
  }
  return offenders.length === 0 ||
    offenders.length + ' file(s) read the ladder store with neither a clean filter nor a ' +
    'RAW-STORE-OK declaration: ' + offenders.join(', ');
});

console.log('\n' + '-'.repeat(60));
console.log(`  ${pass} passed, ${fail} failed`);
if (fail) {
  console.log('\n  FAILURES');
  for (const [n, w] of failures) console.log('    ' + n + '\n      ' + w);
}
process.exit(fail ? 1 : 0);
