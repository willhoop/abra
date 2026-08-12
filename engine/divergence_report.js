/* divergence_report.js — WHAT EXACTLY DIFFERS, ranked by how much of the real metagame it touches.
 *
 *   node engine/divergence_report.js                  the ranked worklist
 *   node engine/divergence_report.js --class ordering only that class
 *   node engine/divergence_report.js --all            every cause, not just the ranked head
 *   node engine/divergence_report.js --write          + data/divergence-report.json
 *
 * WHY THIS EXISTS. `engine/game_differential.js` has recorded the exact cause of every divergence
 * for as long as it has run — the two protocol lines side by side, and which moves and abilities are
 * named in them, with their corpus usage already attached. NOBODY HAS EVER ROLLED IT UP. The artifact
 * is read as `480 of 1213 diverged` and a list of class names, which is a number and not a worklist:
 * "ordering, 142 games" tells you nothing about what to fix first.
 *
 * (Will, 2026-08-11: *"re run it but we need specifics on what exactly differs"*.)
 *
 * THE RANKING IS BY USAGE, NOT BY COUNT, AND THAT IS THE WHOLE POINT.
 *
 * A cause that fired in 40 games on Struggle (0 corpus clicks) is worth less than a cause that fired
 * in 3 games on Make It Rain (2,881). The differential plays a SWARM steered by coverage, so its game
 * counts describe what the sampler chose to stage — they are a fact about the instrument. The corpus
 * counts describe what people actually click. Ranking by `n` optimises the engine for the test; the
 * only defensible order is how much real play a defect touches.
 *
 * `max_uses` is already on every cause: the largest corpus count among the entities the two mismatched
 * lines mention. This file does not recompute it — recomputing a number the artifact already carries
 * is how two figures come to disagree.
 *
 * WHAT IT REFUSES TO DO. It does not diagnose. Every line here is quoted out of the artifact, and a
 * cause is printed with BOTH protocol lines so a reader sees the disagreement rather than a summary of
 * it. The moment this file starts saying WHY something differs it becomes a second opinion competing
 * with the engine, and this repo has paid for that shape more than once.
 *
 * ENTITIES THAT CANNOT OCCUR IN THIS FORMAT ARE SEPARATED, NOT DROPPED. `cannot_occur_in_format` is
 * the differential's own verdict and it is carried through: a divergence over a body this regulation
 * does not contain is not a bug worth an evening, and silently binning it would hide a sampler that
 * had started staging illegal boards.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const ONLY = flag('--class', null);
const ALL = argv.includes('--all');
const WRITE = argv.includes('--write');

const SRC = D('data', 'game-differential.json');
let art;
try { art = JSON.parse(fs.readFileSync(SRC, 'utf8')); }
catch (e) {
  console.error('CANNOT ANSWER — data/game-differential.json is unreadable: ' + e.message);
  console.error('Run:  node engine/game_differential.js --release <id> --games 1200 --write');
  process.exit(2);
}

const ageH = ((Date.now() - fs.statSync(SRC).mtimeMs) / 3600000);
const pad = (s, n) => String(s === undefined || s === null ? '' : s).padEnd(n);
const num = (s, n) => String(s === undefined || s === null ? '' : s).padStart(n);

/* Flatten every cause out of every class, keeping the class name on each row. */
const rows = [];
for (const c of art.classes || []) {
  if (ONLY && c.cls !== ONLY) continue;
  for (const k of c.causes || []) {
    rows.push({
      cls: c.cls,
      cause: k.cause,
      games: k.n || 0,
      uses: k.max_uses || 0,
      impossible: !!k.cannot_occur_in_format,
      /* The entities the two lines name, with the usage already attached by the differential. */
      mentions: (k.mentions || []).map(m => ({
        kind: m.kind, id: m.id, uses: m.uses || 0,
        legal: m.legal, reachable: m.reachable, carriers: m.carriers,
      })),
    });
  }
}

const live = rows.filter(r => !r.impossible);
const dead = rows.filter(r => r.impossible);
live.sort((a, b) => (b.uses - a.uses) || (b.games - a.games));

/* ---- THE SHAPE CLUSTER --------------------------------------------------------------------------
 *
 * THE DIFFERENTIAL'S OWN CLASS NAMES ARE THE WRONG GROUPING AND THERE ARE NOW TWO PROOFS.
 *
 * The weather-residual defect was SIX causes that read as separate rows and turned out to be one
 * rule. Protect is FIFTEEN causes spread across FOUR of those classes at once — `ordering`,
 * `unrelated event mismatch`, `event missing` and `extra event` simultaneously — which is exactly why
 * the class view hid it for as long as anyone had been reading class names.
 *
 * So `300 causes, 251 of them appearing in exactly one game` is not a claim that there are 251 bugs.
 * It is a claim about SURFACE TEXT: two lines that name different slots or different bodies read as
 * different causes even when the same rule produced both.
 *
 * THIS GROUPS BY WHAT THE TWO LINES ACTUALLY DISAGREE ABOUT, which is a property of the pair and not
 * of a bucket somebody named:
 *
 *   ORDERING  same event, different slot   — the two engines did the same thing in a different order.
 *                                            This is the shape the weather residual had.
 *   RULE      same slot, different event   — they disagree about what happened to that body.
 *   FIELD     same event and slot, a field differs — they agree on the event and not on its value.
 *   EMISSION  one side has a line the other does not.
 *
 * A pair that is ordering-shaped is a scheduling question; a pair that is rule-shaped is a mechanic.
 * Those want different people and different fixes, and the differential's classes cut across both.
 *
 * AND THE PIN FLAG IS `suspect`, NOT `artefact`. Mode A pins five dice, and a cause naming a mechanic
 * that reads one of them MIGHT be an instrument coupling rather than a defect — that is how Protect
 * cost a wasted brief. But the Protect case then proved the opposite half: a coupling suspect can
 * still be a real disagreement, because the authority was pinned the same way and the divergence
 * survived anyway. So this marks and never excludes. A cause dropped for smelling like an artefact is
 * a defect nobody will look at again.
 */
const LINE = (s) => {
  const t = String(s || '').trim();
  if (!t.startsWith('|')) return null;
  const parts = t.split('|').slice(1);
  return { event: parts[0] || '', slot: (parts[1] || '').split(':')[0], rest: parts.slice(2).join('|') };
};
const PINNED = /accuracy|acc\b|crit|secondar|damage|protect|stall|miss|-fail/i;

function shapeOf(cause) {
  const body = String(cause).replace(/^[^:]*:: /, '');
  const half = body.split(' <> ');
  const a = LINE(half[0]), b = LINE(half[1]);
  if (!a || !b) return { shape: 'UNPARSED', key: body.slice(0, 40) };
  if (a.event === b.event && a.slot !== b.slot) return { shape: 'ORDERING', key: a.event };
  if (a.slot === b.slot && a.event !== b.event) return { shape: 'RULE', key: a.event + ' vs ' + b.event };
  if (a.event === b.event && a.slot === b.slot) return { shape: 'FIELD', key: a.event };
  return { shape: 'EMISSION', key: a.event + ' vs ' + b.event };
}

for (const r of rows) {
  const s = shapeOf(r.cause);
  r.shape = s.shape; r.shapeKey = s.key;
  r.pinSuspect = PINNED.test(r.cause);
}

/* ---- THE ENTITY ROLLUP -------------------------------------------------------------------------
 * The same move can appear in causes spread across four classes, and a per-cause list hides that.
 * An entity named in eleven distinct causes is one suspect, not eleven. */
const byEntity = new Map();
for (const r of live) {
  for (const m of r.mentions) {
    const key = m.kind + '/' + m.id;
    const e = byEntity.get(key) || { key, kind: m.kind, id: m.id, uses: m.uses, causes: 0, games: 0, classes: new Set() };
    e.causes++; e.games += r.games; e.classes.add(r.cls);
    e.uses = Math.max(e.uses, m.uses);
    byEntity.set(key, e);
  }
}
const ents = [...byEntity.values()].sort((a, b) => (b.uses - a.uses) || (b.games - a.games));

/* ---- OUTPUT -------------------------------------------------------------------------------------- */
console.log('\n  WHAT EXACTLY DIFFERS — ranked by corpus usage, not by how often the swarm staged it\n');
console.log('    source   data/game-differential.json, ' + ageH.toFixed(1) + ' h old, release '
            + (art.engine_release || '?'));
console.log('    run      ' + art.games + ' games, ' + art.diverged + ' diverged ('
            + (100 * art.diverged / art.games).toFixed(1) + '%), ' + art.threw + ' threw');
console.log('    mode     ' + String(art.mode || '').slice(0, 96));
console.log('    proof    planted divergence caught: ' + art.planted_divergence_proof_ok);
if (art.planted_divergence_proof_ok !== true) {
  console.log('    *** THE PLANTED PROOF DID NOT FIRE. Nothing below is trustworthy — an instrument');
  console.log('        that cannot see a divergence it planted itself cannot be believed about 480.');
}
console.log('');

console.log('  BY CLASS — the differential\'s own buckets, for orientation only');
for (const c of (art.classes || []).slice().sort((a, b) => b.games - a.games)) {
  const cr = rows.filter(r => r.cls === c.cls);
  const top = cr.filter(r => !r.impossible).sort((a, b) => b.uses - a.uses)[0];
  console.log('    ' + num(c.games, 4) + ' games  ' + pad(c.cls, 32)
              + (cr.length + ' distinct cause' + (cr.length === 1 ? '' : 's'))
              + (top ? ', worst touches ' + top.uses.toLocaleString() + ' clicks' : ''));
}

console.log('\n  THE WORKLIST — every cause, most-played entity first');
console.log('    ' + pad('uses', 8) + pad('games', 6) + pad('class', 30) + 'the two lines');
const head = ALL ? live : live.slice(0, 40);
for (const r of head) {
  console.log('    ' + pad(r.uses.toLocaleString(), 8) + num(r.games, 4) + '  '
              + pad(r.cls, 30) + r.cause.replace(/^[^:]*:: /, ''));
}
if (!ALL && live.length > head.length) {
  console.log('    … ' + (live.length - head.length) + ' more causes; --all to print them, '
              + '--write for the artifact');
}

if (dead.length) {
  console.log('\n  SEPARATED, NOT DROPPED — ' + dead.length + ' cause(s) over entities this regulation '
              + 'does not contain.');
  console.log('    Kept visible because a sampler that started staging illegal boards would look');
  console.log('    exactly like this, and binning them quietly is how that goes unnoticed.');
  for (const r of dead.slice(0, 6)) console.log('      ' + pad(r.cls, 26) + r.cause.slice(0, 96));
}

/* THE ANSWER THE PASS EXISTS FOR: does 251 singletons collapse, and into how many things. */
console.log('\n  BY SHAPE — what the two lines actually disagree ABOUT, not which bucket they landed in');
const byShape = new Map();
for (const r of live) {
  const k = r.shape + ' :: ' + r.shapeKey;
  const e = byShape.get(k) || { shape: r.shape, key: r.shapeKey, causes: 0, games: 0, uses: 0, pin: 0 };
  e.causes++; e.games += r.games; e.uses = Math.max(e.uses, r.uses); if (r.pinSuspect) e.pin++;
  byShape.set(k, e);
}
const fams = [...byShape.values()].sort((a, b) => (b.games - a.games) || (b.uses - a.uses));
console.log('    ' + pad('games', 7) + pad('causes', 8) + pad('uses', 9) + pad('shape', 10) + 'what disagrees');
for (const f of fams.slice(0, 22)) {
  console.log('    ' + num(f.games, 5) + '  ' + num(f.causes, 4) + '    ' + pad(f.uses.toLocaleString(), 9)
              + pad(f.shape, 10) + f.key + (f.pin ? '   [' + f.pin + ' pin-suspect]' : ''));
}
const tot = {};
for (const r of live) { tot[r.shape] = (tot[r.shape] || 0) + 1; }
console.log('\n    ' + live.length + ' causes collapse to ' + fams.length + ' families.  '
            + Object.entries(tot).map(([k, v]) => k + ' ' + v).join(', '));
const singles = live.filter(r => r.games === 1);
const singleFams = new Set(singles.map(r => r.shape + ' :: ' + r.shapeKey));
console.log('    ' + singles.length + ' single-game causes collapse to ' + singleFams.size + ' families.');
console.log('    ' + live.filter(r => r.pinSuspect).length + ' cause(s) name a mechanic that reads a '
            + 'pinned die — SUSPECT, never excluded (the Protect case proves a suspect can be real).');

console.log('\n  THE SUSPECTS — one entity across every cause that names it');
console.log('    ' + pad('uses', 9) + pad('causes', 8) + pad('entity', 26) + 'classes it appears in');
for (const e of ents.slice(0, 20)) {
  console.log('    ' + pad(e.uses.toLocaleString(), 9) + num(e.causes, 4) + '    '
              + pad(e.kind.replace(/s$/, '') + ' ' + e.id, 26) + [...e.classes].join(', '));
}

/* THE ONE NUMBER WORTH ACTING ON. Causes are long-tailed; the head is where an evening goes. */
const totalUses = live.reduce((s, r) => s + r.uses, 0);
let acc = 0, k = 0;
for (const r of live) { acc += r.uses; k++; if (acc >= 0.5 * totalUses) break; }
console.log('\n  ' + k + ' of ' + live.length + ' causes account for half of all the usage that diverges.');
console.log('  ' + dead.length + ' cause(s) cannot occur in this format at all.');

if (WRITE) {
  const OUT = D('data', 'divergence-report.json');
  fs.writeFileSync(OUT, JSON.stringify({
    what: 'THE ROLLUP OF engine/game_differential.js — every divergence cause ranked by the corpus '
        + 'usage of the entities it names, rather than by how often the coverage-steered swarm '
        + 'happened to stage it. Reads only; recomputes nothing the differential already published.',
    generated: new Date().toISOString(),
    source: 'data/game-differential.json',
    source_release: art.engine_release || null,
    source_generated: art.generated || null,
    run: { games: art.games, diverged: art.diverged, threw: art.threw, mode: art.mode,
           planted_divergence_proof_ok: art.planted_divergence_proof_ok },
    causes_half_the_usage: k,
    causes_total: live.length,
    causes_impossible_in_format: dead.length,
    worklist: live,
    impossible: dead,
    suspects: ents.map(e => ({ ...e, classes: [...e.classes] })),
  }, null, 2) + '\n');
  console.log('\n  wrote data/divergence-report.json');
}
