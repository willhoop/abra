/* test-tag-signature.js — TWO MOVES THAT CARRY THE SAME TAGS MUST NOT RESOLVE TO DIFFERENT THINGS.
 *
 * ROADMAP #127, and the row says outright that THE CHECK ITSELF IS THE DELIVERABLE. It was a one-off
 * script that resolved every move in data/tags.json through `playerAction` and grouped by the sorted
 * tag list; five groups came back split on the resolved kind, carrying 105,709 corpus uses. A
 * one-off script measures a day. This is the same measurement wired as a gate.
 *
 * WHAT A SPLIT MEANS, AND WHY IT IS NOT AUTOMATICALLY A DEFECT
 * -----------------------------------------------------------
 * `data/tags.json` gives every entity a TAG LIST and a PARAM BLOCK. The tag list is the coarse
 * description; the params are where the mechanic's actual numbers live. So two moves can legitimately
 * share a tag list and resolve differently — Crunch and Meteor Mash are both
 * `contact+moveClass+pp+secondaryStatEffect+statChange`, and one lowers the TARGET's Defence while
 * the other raises the USER's Attack. `statChange.target` versus `statChange.user` is right there in
 * the artifact, the engine reads it, and the two resolve to different action kinds because they ARE
 * different moves. Failing that would be failing correct behaviour.
 *
 * THE DEFECT IS THE OTHER CASE: two entities whose tag record is IDENTICAL — same tags, same params
 * — resolving to different kinds. Nothing in the artifact could have told them apart, so something
 * outside it did, and in this engine that has always meant a NAME. docs/TAGS.md forbids matching on
 * a name; CLAUDE.md's FACTS-ARE-GLOBAL rule is what it costs when you do. That is the FAILING clause
 * here and it is the only one.
 *
 * `pp` IS EXCLUDED FROM THE COMPARISON, DELIBERATELY. Champions restandardised PP, so `pp.max` and
 * `pp.base` differ between almost any two moves — including two that are otherwise identical. Leaving
 * it in would make every record unique and the failing clause could never fire, which is a gate that
 * cannot go red: worse than no gate, because it reads as coverage. `uses` is excluded for the same
 * reason one step further on — it is a corpus statistic, not a mechanic.
 *
 * THE SPLITS THAT ARE PARAM-SEPARATED ARE STILL PRINTED, RANKED BY USAGE. They are not failures and
 * they are the shortlist #127 was built to produce: a signature carrying two behaviours is where an
 * under-specified tag shows up first, and reading the list is how the protect/endure and the wish/rest
 * splits were found. A count would have shown neither.
 *
 * ONE FIXED BOARD, AND THAT IS PART OF THE MEASUREMENT. Every move is resolved against the same
 * attacker, the same target and the same empty field, so the only thing varying between two members
 * of a group is the move. The first version of this ran with a NULL target — `buildMon('Medicham')`
 * returns null, the capital letter is not a species id — and every damaging move fell out of the
 * attack branch and resolved as `affect` or `pass`. It reported SIX splits, five of them staging
 * artefacts of its own broken fixture. The bodies are asserted before anything is grouped.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const ART = require(D('data', 'tags.json'));

let P = 0, F = 0;
const ok = (c, m) => { if (c) { P++; console.log('  ok   ' + m); } else { F++; console.log('  FAIL ' + m); } };

/* ---- THE FIXTURE, ASSERTED RATHER THAN ASSUMED ------------------------------------------------ */
const bare = (sp) => { const b = M.buildMon(sp, {}); if (!b) return null; b.item = ''; b.ability = 'none'; return b; };
const me = bare('medicham'), tgt = bare('garchomp');
ok(!!me && !!tgt, 'both fixture bodies were built (a null body silently collapses every damaging move)');
if (!me || !tgt) { console.log('\nTAG SIGNATURE: cannot run'); process.exit(1); }
const FIELD = { weather: '', terrain: '', twA: 0, twB: 0, tr: 0, sgA: {}, sgB: {} };
/* The fixture must be able to reach the attack branch at all, or every group is a group of `pass`. */
ok((M.playerAction(me, 'closecombat', tgt, Object.assign({}, FIELD)) || {}).kind === 'attack',
   'the fixture resolves an ordinary damaging move as {kind:"attack"} — the board is live');

/* ---- RESOLVE EVERY MOVE ----------------------------------------------------------------------- */
/* The param block with the two fields that are properties rather than mechanics removed. Stable-keyed
 * so two records that differ only in key ORDER compare equal. */
const canon = (o) => {
  if (o === null || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(canon);
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = canon(o[k]);
  return out;
};
const recordOf = (rec) => {
  const p = Object.assign({}, rec.params || {});
  delete p.pp;
  return JSON.stringify(canon(p));
};

const groups = new Map();
let threw = 0;
for (const [id, rec] of Object.entries(ART.moves || {})) {
  const sig = (rec.tags || []).slice().sort().join('+');
  let kind;
  try { kind = (M.playerAction(me, id, tgt, Object.assign({}, FIELD)) || {}).kind || 'NULL'; }
  catch (e) { kind = 'THREW'; threw++; }
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push({ id, kind, uses: rec.uses || 0, rec: recordOf(rec) });
}
ok(groups.size > 100, `${Object.keys(ART.moves || {}).length} moves resolved into ${groups.size} tag signatures`);
ok(threw === 0, `no move threw while being resolved (${threw})`);

/* ---- CLAUSE 1, THE FAILING ONE: identical record, different kind ------------------------------- */
const nameDecided = [];
for (const [sig, ms] of groups) {
  const byRecord = new Map();
  for (const m of ms) {
    if (!byRecord.has(m.rec)) byRecord.set(m.rec, []);
    byRecord.get(m.rec).push(m);
  }
  for (const [, same] of byRecord) {
    const kinds = new Set(same.map(m => m.kind));
    if (kinds.size > 1) nameDecided.push({ sig, members: same });
  }
}
ok(nameDecided.length === 0,
   `no tag signature has two members with an IDENTICAL param record resolving to different kinds `
   + `(${nameDecided.length}) — a split there can only have been decided by a NAME`);
for (const n of nameDecided) {
  console.log('       [' + n.sig + ']');
  for (const m of n.members) console.log('         ' + m.kind.padEnd(12) + m.id + '  (' + m.uses + ' uses)');
}

/* ---- CLAUSE 2, INFORMATIONAL: split but param-separated --------------------------------------- */
const split = [];
for (const [sig, ms] of groups) {
  if (new Set(ms.map(m => m.kind)).size < 2) continue;
  split.push({ sig, ms, uses: ms.reduce((s, m) => s + m.uses, 0) });
}
split.sort((a, b) => b.uses - a.uses);
console.log(`\n  ${split.length} signature(s) carry more than one resolved kind and ARE separated by their`);
console.log('  params, so the artifact does hold the distinction. Not failures — the shortlist #127');
console.log('  exists to produce, ranked by the corpus usage sitting on them:');
if (!split.length) console.log('    (none)');
for (const s of split) {
  console.log(`    ${String(s.uses).padStart(7)} uses  [${s.sig}]`);
  const byk = {};
  for (const m of s.ms) (byk[m.kind] || (byk[m.kind] = [])).push(m.id + '(' + m.uses + ')');
  for (const [k, v] of Object.entries(byk)) console.log('              ' + k.padEnd(12) + v.join(' '));
}

/* ---- WHAT THIS CANNOT SEE, SAID OUT LOUD ------------------------------------------------------ */
console.log('\n  WHAT THIS STRUCTURALLY CANNOT SEE: a kind is a COARSE verdict. Two moves that both');
console.log('  resolve to {kind:"attack"} and then behave differently inside that branch are one');
console.log('  group here and are invisible. It measures the DISPATCH, which is where the name lists');
console.log('  live; tests/test-mechanics.js and the deliberate roster measure the behaviour.');

console.log(`\nTAG SIGNATURE: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
