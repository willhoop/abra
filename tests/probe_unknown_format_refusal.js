/* probe_unknown_format_refusal.js — AN UNAVAILABLE FORMAT ID MUST NOT RESOLVE TO MAINLINE GEN 9.
 *
 * WHAT THIS IS ABOUT
 * ------------------
 * `Dex.forFormat(id)` does not throw on an id Showdown has never heard of. It returns the BASE mod:
 * mainline Gen 9, the whole National Dex, every Champions override gone and every item this
 * regulation bans legal again. Measured on the checkout this repo pins, 2026-09-08:
 *
 *     gen9championsvgc2026regmb   exists=true    mod=champions  currentMod=champions  347 legal species
 *     <the next regulation>       exists=FALSE   mod=gen9       currentMod=BASE       911 legal species
 *
 * That is this project's signature failure — a capability is absent and everything reports success —
 * and it is armed for the exact moment `active` moves in `data/regulations.json`, because
 * `engine/champions_sim.js` derives `FORMAT` from that file and 228 call sites resolve it through
 * `CS.sim().Dex.forFormat(...)`. Nothing anywhere would say the dex had changed underneath them.
 *
 * NOTHING HERE NAMES A FORMAT ID. The unavailable id is DERIVED: take the active regulation's triple
 * out of `data/regulations.json` with `next_regulation.parseFormatId`, walk the token forward, and
 * take the first one this checkout does not carry. The day Showdown ships that format, this probe
 * walks past it on its own — which is the whole reason it is not written as `regmc`.
 *
 * THE CONTROL IS THE POINT. A refusal that also refuses the REAL format has broken the thing it
 * protects, so the live format is resolved through the same seam and must come back with a
 * champions mod, its own legal-species count, and Rocky Helmet still `isNonstandard: 'Past'`.
 *
 *   SHOWDOWN_PATH=/path/to/pokemon-showdown node tests/probe_unknown_format_refusal.js
 */
'use strict';

const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const CS = require(D('engine', 'champions_sim.js'));
const NR = require(D('engine', 'next_regulation.js'));

let bad = 0;
const ok = (cond, label, detail) => {
  if (!cond) bad++;
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + label + (detail ? '\n         ' + detail : ''));
};

let Dex;
try { ({ Dex } = CS.sim()); }
catch (e) {
  console.log('SKIP — no Showdown checkout: ' + String(e.message).split('\n')[0]);
  process.exit(0);
}

/* The legality filter, spelled out every time — `Dex.forFormat` is not one. */
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';

/* THE RAW SHOWDOWN DEX, reached around the seam under test. `CS.sim().Dex` is a proxy after the fix,
 * so resolving through it is the thing being ASSERTED, not the thing being described. The defect
 * block below is a statement about upstream Showdown and has to be measured upstream of our guard —
 * otherwise it would flip from red to green for the wrong reason and stop meaning anything. */
const RAWDEX = require(require(D('engine', 'showdown_path.js')).resolve() + '/dist/sim').Dex;
const raw = id => RAWDEX.forFormat(id);

/* ---- the fixture, DERIVED ---------------------------------------------------------------------- */

/* Walk the active regulation's token forward until this checkout does not carry the format. Only the
 * last character moves, so regm{b} -> regm{c} -> regm{d}; a token that runs off 'z' ends the walk and
 * the probe says so rather than inventing an id. */
function nextUnavailableRegulationId() {
  const t = NR.parseFormatId(CS.FORMAT);
  if (!t) return { id: null, why: 'the active format id does not parse as a Champions VGC regulation: ' + CS.FORMAT };
  const tried = [];
  let token = t.token;
  for (let i = 0; i < 24; i++) {
    const last = token.charCodeAt(token.length - 1);
    if (last >= 122 /* 'z' */) return { id: null, why: 'the regulation token ran off the end of the alphabet after ' + tried.join(', ') };
    token = token.slice(0, -1) + String.fromCharCode(last + 1);
    const id = 'gen' + t.gen + 'championsvgc' + t.year + 'reg' + token;
    tried.push(id);
    const f = Dex.formats.get(id);
    if (!f || !f.exists) return { id, why: null, shipped: tried.slice(0, -1) };
  }
  return { id: null, why: 'no unavailable regulation id found in 24 steps' };
}

const NEXT = nextUnavailableRegulationId();
/* A second, deliberately NOT regulation-shaped id. The claim under test is that ANY unavailable
 * format is refused, never that one id is special-cased. */
const NONSENSE = 'gen9thisformatdoesnotexistanywhere';

console.log('THE FIXTURE, DERIVED FROM data/regulations.json AND THIS CHECKOUT:');
console.log('  active format      : ' + CS.FORMAT);
if (NEXT.shipped && NEXT.shipped.length) console.log('  already shipped    : ' + NEXT.shipped.join(', ') + '  (walked past)');
console.log('  first UNAVAILABLE  : ' + (NEXT.id || '(none — ' + NEXT.why + ')'));
console.log('  non-shaped control : ' + NONSENSE);
console.log('');

if (!NEXT.id) { console.log('CANNOT STAGE: ' + NEXT.why); process.exit(1); }

/* ---- what the raw dex does with it, printed before anything is asserted ------------------------ */

const describe = id => {
  const f = Dex.formats.get(id);
  const d = raw(id);
  return {
    id,
    formats_exists: !!(f && f.exists),
    format_mod: f ? f.mod : null,
    currentMod: d.currentMod,
    legalSpecies: d.species.all().filter(legal).length,
    rockyhelmet: d.items.get('rockyhelmet').isNonstandard || 'LEGAL',
    silktrap: d.moves.get('silktrap').isNonstandard || 'LEGAL',
  };
};

const LIVE = describe(CS.FORMAT);
const GHOST = describe(NEXT.id);
console.log('WHAT `Dex.forFormat` RETURNS FOR EACH, UNGUARDED:');
for (const r of [LIVE, GHOST]) {
  console.log('  ' + r.id.padEnd(34) + ' exists=' + String(r.formats_exists).padEnd(6)
    + ' fmt.mod=' + String(r.format_mod).padEnd(12) + ' currentMod=' + String(r.currentMod).padEnd(11)
    + ' legalSpecies=' + String(r.legalSpecies).padEnd(5)
    + ' rockyhelmet=' + r.rockyhelmet + ' silktrap=' + r.silktrap);
}
console.log('');

/* This block is the DEFECT, stated as facts about the unguarded dex. It is true before the fix and
 * after it — the fix does not change what `Dex.forFormat` does, it changes what this repo's seam
 * lets through. Asserting it keeps the probe honest: if Showdown ever starts throwing here, these
 * fail and the whole premise below is void. */
console.log('THE DEFECT THE SEAM HAS TO REFUSE (raw Showdown behaviour, unchanged by any fix here):');
ok(GHOST.formats_exists === false, 'the unavailable id is absent from Dex.formats', GHOST.id);
ok(GHOST.currentMod === 'base', 'and yet Dex.forFormat resolves it — to the BASE mod', 'currentMod=' + GHOST.currentMod);
ok(GHOST.legalSpecies > LIVE.legalSpecies, 'which carries MORE species than the regulation',
  GHOST.legalSpecies + ' vs ' + LIVE.legalSpecies);
ok(GHOST.rockyhelmet === 'LEGAL' && LIVE.rockyhelmet === 'Past',
  'and makes a banned item legal again', 'ghost=' + GHOST.rockyhelmet + ' live=' + LIVE.rockyhelmet);
console.log('');

/* ---- the seam ---------------------------------------------------------------------------------- */

const throws = fn => { try { fn(); return null; } catch (e) { return String(e.message || e); } };

console.log('THE SEAM — `CS.sim().Dex.forFormat(...)`, which 228 call sites use:');
const eGhost = throws(() => Dex.forFormat(NEXT.id));
const eNonsense = throws(() => Dex.forFormat(NONSENSE));
const eEmpty = throws(() => Dex.forFormat(''));
ok(eGhost !== null, 'REFUSES the unavailable regulation id', eGhost ? eGhost.split('\n')[0] : 'RETURNED A DEX — the base mod, silently');
ok(eNonsense !== null, 'REFUSES an unavailable id of any shape', eNonsense ? eNonsense.split('\n')[0] : 'RETURNED A DEX — the base mod, silently');
ok(eEmpty !== null, 'REFUSES an empty format id', eEmpty ? eEmpty.split('\n')[0] : 'RETURNED A DEX — the base mod, silently');
console.log('');

/* ---- THE CONTROL: the real format must still resolve, through the same seam -------------------- */

console.log('THE CONTROL — the live regulation must be unharmed:');
let live = null;
const eLive = throws(() => { live = Dex.forFormat(CS.FORMAT); });
ok(eLive === null, 'the active format resolves without throwing', eLive || '');
ok(!!live && /^champions/.test(String(live && live.currentMod)),
  'and it resolves to a champions mod', 'currentMod=' + (live && live.currentMod));
ok(!!live && live.species.all().filter(legal).length === LIVE.legalSpecies,
  'with the regulation\'s own legal-species count, not the National Dex',
  'legalSpecies=' + (live ? live.species.all().filter(legal).length : 'n/a') + ' (expected ' + LIVE.legalSpecies + ')');
ok(!!live && live.items.get('rockyhelmet').isNonstandard === 'Past',
  'and the banned item is still banned', 'rockyhelmet=' + (live ? (live.items.get('rockyhelmet').isNonstandard || 'LEGAL') : 'n/a'));
ok(!!live && live.moves.get('silktrap').isNonstandard === 'Past',
  'and the banned move is still banned', 'silktrap=' + (live ? (live.moves.get('silktrap').isNonstandard || 'LEGAL') : 'n/a'));
console.log('');

/* ---- AND A REAL CALLER, END TO END ------------------------------------------------------------- */

/* The two blocks above test the seam. This one tests that a caller actually goes THROUGH it, which is
 * the claim the whole fix rests on: `sim().Dex` is a proxy, so a file that never mentions the refusal
 * still gets it. The rehearsal is the real failure — `data/regulations.json` names a regulation the
 * checkout does not carry — staged by moving `CS.FORMAT` in a CHILD process, so nothing on disk is
 * touched and this probe's own state is not poisoned.
 *
 * `tag_dex.js` is the witness because it is one of the six the readiness sweep named as unguarded,
 * and because it resolves the dex at module load and writes nothing before it does. */
const { spawnSync } = require('child_process');
const witness = spawnSync(process.execPath, ['-e', `
  const CS = require(${JSON.stringify(D('engine', 'champions_sim.js'))});
  if (CS.sim().Dex.forFormat !== CS.dexFor) { console.log('SEAM-NOT-WIRED'); process.exit(0); }
  CS.FORMAT = ${JSON.stringify(NEXT.id)};            // as if data/regulations.json had flipped
  try { require(${JSON.stringify(D('engine', 'tag_dex.js'))}); console.log('LOADED-WITHOUT-REFUSAL'); }
  catch (e) { console.log('REFUSED:' + String(e.message).split('\\n')[0]); }
`], { encoding: 'utf8', env: process.env });
const w = String(witness.stdout || '').split('\n').filter(Boolean).pop() || String(witness.stderr || '').slice(0, 200);

console.log('THE END-TO-END REHEARSAL — engine/tag_dex.js, with the active regulation moved to ' + NEXT.id + ':');
ok(/^REFUSED:/.test(w), 'a named caller that never mentions the refusal is refused anyway', w);
console.log('');

console.log(bad === 0 ? 'PASS' : 'FAIL — ' + bad + ' assertion(s)');
process.exit(bad === 0 ? 0 : 1);
