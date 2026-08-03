/* WHICH UNREAD TAG COSTS THE MOST? node tests/mechanics_rank.js
 *
 * Will tagged every move, ability and item in the format. A tag is a FACT in data/abra-tags.js and
 * something has to consume it -- Electro Shot carried `chargeTurn` since July while the engine's own
 * comment said the tag had "no state to land on". 122 of 172 distinct tags are never referenced by
 * name in medicham2-browser.js or board.js.
 *
 * COUNTING TAGS IS THE WRONG ORDER TO WORK IN. `statusCategory` sits on 175 moves and `flinches` on
 * 19, but Fake Out alone is clicked more than most of those 175 put together. The artifact records
 * `uses` per move -- real clicks from the corpus -- so the cost of a missing mechanic is the USAGE it
 * covers, not the number of ids.
 *
 * This ranks the work. It asserts nothing about whether a mechanic is implemented: a tag can be
 * unreferenced and still work (Choice Scarf, Fake Out's flinch and Filter all do). That question is
 * behavioural and tests/test-mechanics.js answers it one probe at a time. This file only says which
 * ones are worth probing first.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);

const raw = JSON.parse(fs.readFileSync(D('data', 'abra-tags.js'), 'utf8')
  .replace(/^[^{]*/, '').replace(/;\s*$/, ''));

/* Read as text, not by call shape. The first version of this matched TAGS.has('move', id, 'name')
 * and reported board.js as reading ZERO tags -- board.js goes through its own tagHas() wrapper. A
 * quoted-string search cannot miss a wrapper; it can over-match a coincidental identifier, so this
 * is an UPPER bound on what is inert. */
const src = ['engine/medicham2-browser.js', 'engine/board.js']
  .map(f => fs.readFileSync(D(f), 'utf8')).join('\n');
const referenced = t => src.includes(`'${t}'`) || src.includes(`"${t}"`);

const SECTIONS = { moves: 'move', abilities: 'ability', items: 'item' };
const rows = [];
for (const [sec, kind] of Object.entries(SECTIONS)) {
  const byTag = {};
  for (const [id, v] of Object.entries(raw[sec] || {})) {
    /* `uses` is present on moves. Abilities and items carry their own counts under whatever the
     * generator recorded; fall back to 1 per carrier so they rank by breadth rather than vanish. */
    const uses = typeof v.uses === 'number' ? v.uses : 1;
    for (const tag of (v.tags || [])) {
      const e = byTag[tag] = byTag[tag] || { n: 0, uses: 0, ex: [] };
      e.n++; e.uses += uses;
      if (e.ex.length < 3) e.ex.push(id);
    }
  }
  for (const [tag, e] of Object.entries(byTag)) {
    rows.push({ kind, tag, n: e.n, uses: e.uses, ex: e.ex, read: referenced(tag) });
  }
}

const inert = rows.filter(r => !r.read).sort((a, b) => b.uses - a.uses);
const totalUses = rows.filter(r => r.kind === 'move').reduce((s, r) => s + r.uses, 0);

console.log('UNREAD TAGS, RANKED BY THE USAGE THEY COVER\n');
console.log('  kind      tag                       carriers      uses   example');
for (const r of inert.slice(0, 28)) {
  console.log('  ' + r.kind.padEnd(9) + r.tag.padEnd(26) +
    String(r.n).padStart(8) + String(r.uses).padStart(10) + '   ' + r.ex.slice(0, 2).join(', '));
}
console.log(`\n  ${inert.length} of ${rows.length} tags are never referenced by name.`);
console.log('  Unreferenced is NOT the same as unimplemented -- Choice Scarf, Fake Out and Filter all');
console.log('  work without their tag being read. tests/test-mechanics.js settles each one by probe.');

fs.writeFileSync(D('data', 'mechanics-rank.json'), JSON.stringify({
  generated: new Date().toISOString(), by: 'tests/mechanics_rank.js',
  method: 'tag name appearing as a quoted string in medicham2-browser.js or board.js',
  caveat: 'An UPPER bound on inert tags: a mechanic can be implemented without consulting its tag, '
        + 'and three such were confirmed by probe (Choice Scarf, Fake Out flinch, Filter). Ranking '
        + 'is by corpus `uses` because carrier count is the wrong order to work in.',
  total_tags: rows.length, inert_tags: inert.length, move_uses_total: totalUses,
  ranked: inert.map(r => ({ kind: r.kind, tag: r.tag, carriers: r.n, uses: r.uses, examples: r.ex })),
}, null, 2) + '\n');
console.log('\n  wrote data/mechanics-rank.json');
