/* probe_entity_kind.js — THE ANNOTATOR MUST RESOLVE THE RIGHT ENTITY, NOT THE FIRST DEX HIT.
 *
 *   node tests/probe_entity_kind.js
 *   node tests/probe_entity_kind.js --artifact data/verification/game-differential.enginedata.json
 *
 * WHAT WENT WRONG. `engine/game_differential.js` annotates every divergence cause with the format
 * standing of every entity the two protocol lines name, and publishes `cannot_occur_in_format: true`
 * when nothing the cause names is reachable. That flag is a TRIAGE flag — a row wearing it is closed
 * without being read. It was wrong in the expensive direction three times over, and each time a REAL,
 * REACHABLE mechanic was labelled impossible and nothing ever went red:
 *
 *   1. `|-end|p1a|healblock` is the Heal Block VOLATILE, applied by Psychic Noise (`isNonstandard:
 *      null`, `secondary: { chance: 100, volatileStatus: 'healblock' }`). The MOVE Heal Block is
 *      `Past`. The volatile is not in the 35-entry standalone condition table, so the move table
 *      answered and a live mechanic was binned.
 *   2. `|-damage|p1a:floette|74/149` names Floette-Eternal / Floette-Mega, both in this format. The
 *      BASE species `floette` is `Past` AND `tier: 'Illegal'`, so the token answered `reachable:
 *      false` — and BOTH such rows in the run were `board_parted: 1, DIFFERENT-END-STATE`.
 *   3. `metronome` names a LEGAL item and a `Past` move. Moves are asked first.
 *
 * THE CONTROL IS A KNOB, NOT A MEMORY OF YESTERDAY. `makeStanding({ resolution: 'first-hit' })`
 * reproduces the old resolver exactly. Every claim below is asserted against BOTH arms, and a claim
 * that does not MOVE across the knob is reported as an unwired rule rather than as a pass — identical
 * output across a varied knob is the finding, not the absence of one.
 *
 * AND THE MEMBERSHIP IS DERIVED, NEVER LISTED. The three names above are what the format happens to
 * contain today; the probe asks `engine/effect_kind.js` for the collision set on every run and fails
 * if a name it did not know about is left mislabelled. A rule keyed to `healblock` would catch
 * `healblock`. This one catches the next collision whatever it is called.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const EK = require(path.join(__dirname, '..', 'engine', 'effect_kind.js'));

let FAIL = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok    ' : '  FAIL  ') + msg); if (!cond) FAIL++; };

/* Resolve the sibling checkout the way every other test here does. A throw is reported rather than
 * swallowed: the refusal below is right, but "the resolver is broken" and "there is no checkout" are
 * different facts and only one of them is the reader's problem. */
try { require('../engine/showdown_path.js'); }
catch (e) { console.error('  showdown_path.js threw while resolving the checkout: '
                        + String((e && e.message) || e).slice(0, 160)); }
if (!process.env.SHOWDOWN_PATH) {
  console.error('NOT RUN — the official simulator is absent. Set SHOWDOWN_PATH. This is not a pass.');
  process.exit(2);
}
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const dex = Dex.forFormat('gen9championsvgc2026regmb');

/* tags.json gives `uses`; the differential reads the RELEASE's copy and this probe reads the live one
 * on purpose — it is asserting a RESOLUTION rule, not a usage figure, and a usage figure that moved
 * would not change which table a token is asked of. */
const tags = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'tags.json'), 'utf8')); }
  catch (e) { console.error('  tags.json did not parse — every uses figure below reads UNKNOWN: ' + e.message); return {}; }
})();
const carriers = (() => {
  const m = new Map();
  for (const sp of dex.species.all()) {
    if (!EK.IN_FORMAT(sp)) continue;
    for (const a of Object.values(sp.abilities || {})) { const k = EK.ID(a); m.set(k, (m.get(k) || 0) + 1); }
  }
  return m;
})();

/* THE SHOWN-RED SWITCH, KEPT RATHER THAN REMEMBERED. `PROBE_ENTITY_KIND_ARM=first-hit` puts the OLD
 * resolver under test, so anyone can reproduce the red run in one command instead of trusting a
 * sentence in a report that the probe was once red. */
const ARM = process.env.PROBE_ENTITY_KIND_ARM === 'first-hit' ? 'first-hit' : 'by-kind';
if (ARM === 'first-hit') {
  console.log('\n  *** PROBE_ENTITY_KIND_ARM=first-hit — the OLD resolver is under test. This run is\n'
            + '      EXPECTED TO FAIL. It is the red baseline, not a regression. ***');
}
const NEW = EK.makeStanding({ dex, tags, abilityCarriers: carriers, resolution: ARM });
const OLD = EK.makeStanding({ dex, tags, abilityCarriers: carriers, resolution: 'first-hit' });

/* ================= PART 0 — WHAT THE RULE MATCHED, PRINTED BEFORE IT IS TRUSTED ================== */
const C = NEW.conditions, F = NEW.formes;
console.log('\n  THE DERIVED MEMBERSHIP — printed, because a tag that over-matches looks exactly like');
console.log('  one that works, and this repo has been caught by that twice.');
console.log('    ' + C.entities_scanned + ' legal moves/abilities/items scanned');
console.log('    ' + C.count + ' condition names in play (' + C.standalone + ' from the standalone table)');
console.log('    ' + C.collisions.length + ' of them also name a move NOT in this format:');
for (const c of C.collisions) {
  console.log('      ' + c.id.padEnd(12) + 'move=' + c.move_nonstandard
            + '  already covered by the standalone table: ' + c.in_standalone_table
            + '  set by ' + c.set_by.length + ' legal thing(s)');
}
console.log('    ' + F.rescues.length + ' illegal base species carry a legal forme:');
for (const r of F.rescues) console.log('      ' + r.id + ' -> ' + r.legal_formes.join(', '));

const ITEM_COLL = dex.items.all().filter(EK.IN_FORMAT)
  .filter(it => { const m = dex.moves.get(it.id); return m && m.exists && (m.isNonstandard || m.tier === 'Illegal'); })
  .map(it => it.id);
const ABIL_COLL = dex.abilities.all().filter(EK.IN_FORMAT)
  .filter(ab => { const m = dex.moves.get(ab.id); return m && m.exists && (m.isNonstandard || m.tier === 'Illegal'); })
  .map(ab => ab.id);
console.log('    legal items whose id collides with an illegal move: ' + ITEM_COLL.length
          + (ITEM_COLL.length ? ' (' + ITEM_COLL.join(', ') + ')' : ''));
console.log('    legal abilities whose id collides with an illegal move: ' + ABIL_COLL.length
          + (ABIL_COLL.length ? ' (' + ABIL_COLL.join(', ') + ')' : ''));

ok(C.count > C.standalone, 'the derived condition set is LARGER than the standalone table (' + C.count
   + ' > ' + C.standalone + ') — an equal count would mean the derivation matched nothing and the '
   + 'whole probe below would be vacuous');
ok(C.collisions.length > 0 || ITEM_COLL.length > 0 || F.rescues.length > 0,
   'at least one collision exists in this format, so a green run is evidence and not an empty set');

/* ================= PART 1 — EVERY DERIVED COLLISION, IN A CONDITION SLOT ========================= */
console.log('\n  PART 1 — a condition name is never answered out of the move table');
for (const c of C.collisions) {
  const cause = 'event missing from medicham2 :: |-end|p1a|' + c.id + ' <> |upkeep';
  const a = NEW.annotateCause(cause), b = OLD.annotateCause(cause);
  ok(a.cannot_occur_in_format !== true,
     '`' + cause.split(':: ')[1] + '` is NOT binned impossible — the ' + c.move_nonstandard
     + ' move of that name is not what the line is talking about');
  if (c.in_standalone_table) {
    ok(b.cannot_occur_in_format !== true, '  (control: `' + c.id + '` was already covered by the '
       + 'standalone table, so the knob is expected NOT to move it — stated, not discovered)');
  } else {
    ok(b.cannot_occur_in_format === true, '  and the `first-hit` control DOES bin it — the knob moves '
       + 'the outcome, so the rule is wired rather than decorative');
  }
}

/* ================= PART 2 — A LEGAL FORME UNDER AN ILLEGAL BASE SPELLING ========================= */
console.log('\n  PART 2 — a body the format contains, addressed by a base spelling it does not');
for (const r of F.rescues) {
  const cause = '-damage field 3 :: |-damage|p1a|H/H <> |-damage|p1a|H/H  [values differ: '
              + '|-damage|p1a:' + r.id + '|74/149 vs |-damage|p1a:' + r.id + '|92/149]';
  const a = NEW.annotateCause(cause), b = OLD.annotateCause(cause);
  ok(a.cannot_occur_in_format !== true, '`p1a:' + r.id + '` is reachable — ' + r.legal_formes.join(' / ')
     + ' are in this format and the protocol addresses the slot by the base name');
  ok(b.cannot_occur_in_format === true, '  and the `first-hit` control bins it, which is what hid '
     + 'two BOARD-PARTED damage divergences');
  const st = a.mentions.find(m => m.id === r.id);
  ok(st && st.legal === false && Array.isArray(st.via) && st.via.length > 0,
     '  `legal` still reports the base spelling honestly (' + (st && st.legal) + ') and only '
     + '`reachable` is corrected, with `via: [' + (st && st.via || []).join(', ') + ']` saying why');
}

/* ================= PART 3 — A LEGAL ITEM UNDER AN ILLEGAL MOVE'S NAME ============================ */
console.log('\n  PART 3 — the first dex hit is not automatically the answer');
for (const id of ITEM_COLL) {
  const cause = 'event missing from medicham2 :: |-activate|p1a|item: ' + id + ' <> |upkeep';
  const a = NEW.annotateCause(cause), b = OLD.annotateCause(cause);
  ok(a.cannot_occur_in_format !== true, '`item: ' + id + '` is reachable — the ITEM is in this format '
     + 'even though the move of that name is ' + dex.moves.get(id).isNonstandard);
  ok(b.cannot_occur_in_format === true, '  and the `first-hit` control bins it');
  const st = a.mentions.find(m => m.id === id);
  ok(st && st.kind === 'items', '  and it is resolved as an ITEM, not as a move (got ' + (st && st.kind) + ')');
}

/* ================= PART 4 — THE CONTROLS. A CORRECT `impossible` MUST SURVIVE ==================== */
console.log('\n  PART 4 — what must NOT change, or the fix is a silencer');

/* (a) A volatile whose ONLY setter is a move this format does not contain genuinely cannot occur.
 *     Derived: a condition name in the dex at large that is NOT in the in-play set. */
const DEAD = ['octolock', 'telekinesis', 'iceball'].filter(id => {
  const m = dex.moves.get(id); return m && m.exists && (m.isNonstandard || m.tier === 'Illegal') && !C.has(id);
});
ok(DEAD.length > 0, 'at least one volatile has NO legal setter here, so the negative control exists ('
   + DEAD.join(', ') + ')');
for (const id of DEAD) {
  const a = NEW.annotateCause('event missing from medicham2 :: |-start|p1a|' + id + ' <> |upkeep');
  ok(a.cannot_occur_in_format === true, '`|-start|p1a|' + id + '` STAYS impossible — nothing legal '
     + 'here can set it, so the move table was right and the widening must not silence it');
}

/* (b) A CLICK of an out-of-format move is still impossible. `|move|SLOT|NAME` is the one position
 *     that names a move as a move. */
for (const c of C.collisions) {
  const a = NEW.annotateCause('event missing from medicham2 :: |move|p1a|' + c.id + '|p2a <> |upkeep');
  ok(a.cannot_occur_in_format === true, '`|move|p1a|' + c.id + '` — a CLICK of a ' + c.move_nonstandard
     + ' move — is still impossible; the condition rule does not reach the move-argument position');
}

/* (c) The entities that carry the worklist keep their usage weight. Protect and Tailwind are volatiles
 *     named after their own legal moves; if the widening dropped the move half, the top of the ranking
 *     would vanish silently. Asserted on the OUTCOME (`max_uses`), not on the classification. */
for (const id of ['protect', 'tailwind', 'encore', 'reflect', 'substitute']) {
  const cause = 'ordering :: |-singleturn|p1a|' + id + ' <> |upkeep';
  const a = NEW.annotateCause(cause), b = OLD.annotateCause(cause);
  ok(a.cannot_occur_in_format === false, '`' + id + '` is reachable');
  ok(a.max_uses === b.max_uses && typeof a.max_uses === 'number',
     '  and its corpus weight is unchanged across the knob (' + a.max_uses + ' uses) — the legal move '
     + 'is kept BESIDE the condition, so the widening cannot delete the top of the worklist');
}

/* ================= PART 5 — THE ARTIFACT'S OWN LABELS, BEFORE AND AFTER ========================== */
const ART = (() => {
  const i = process.argv.indexOf('--artifact');
  return i > 0 ? process.argv[i + 1] : path.join(__dirname, '..', 'data', 'verification', 'game-differential.enginedata.json');
})();
console.log('\n  PART 5 — re-annotating the stored artifact. No game is played; only labels move.');
let art = null, artErr = null;
try { art = JSON.parse(fs.readFileSync(ART, 'utf8')); }
catch (e) { artErr = String((e && e.message) || e); art = null; }
if (!art) {
  /* NOT a silent skip. The artifact is the only place the BEFORE labels exist, so a run without it
   * has not measured the thing this probe was written for, and it says so in the failure column. */
  ok(false, 'PART 5 DID NOT RUN — ' + ART + ' could not be read: ' + artErr
     + '. Pass --artifact <path>. This is not a pass; PARTS 0-4 still stand on their own.');
} else {
  const causes = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o.cause === 'string' && Object.prototype.hasOwnProperty.call(o, 'cannot_occur_in_format')) {
      causes.push({ cause: o.cause, was: !!o.cannot_occur_in_format });
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(art);
  const wasTrue = causes.filter(c => c.was);
  const relabelled = [], stillTrue = [], newlyTrue = [];
  for (const c of causes) {
    const now = NEW.annotateCause(c.cause).cannot_occur_in_format === true;
    if (c.was && !now) relabelled.push(c.cause);
    else if (c.was && now) stillTrue.push(c.cause);
    else if (!c.was && now) newlyTrue.push(c.cause);
  }
  console.log('    ' + path.basename(ART) + '  generated ' + art.generated);
  console.log('    ' + causes.length + ' annotated causes; ' + wasTrue.length + ' wore `cannot_occur_in_format: true`');
  console.log('    ' + relabelled.length + ' relabelled REACHABLE, ' + stillTrue.length
            + ' still impossible, ' + newlyTrue.length + ' newly impossible');
  for (const c of relabelled) console.log('      RESCUED  ' + c.slice(0, 150));
  for (const c of stillTrue) console.log('      KEPT     ' + c.slice(0, 150));
  for (const c of newlyTrue) console.log('      NEW      ' + c.slice(0, 150));
  ok(newlyTrue.length === 0, 'nothing the run called reachable becomes impossible — the fix only ever '
     + 'REMOVES the flag, so it cannot hide work of its own');
  ok(wasTrue.length === 0 || relabelled.length > 0,
     'the rows the artifact binned are re-examined and at least one is rescued (' + relabelled.length
     + ' of ' + wasTrue.length + ')');
}

console.log('');
if (FAIL) { console.log('  ' + FAIL + ' FAILURE(S)\n'); process.exit(1); }
console.log('  PASS — every derived entity-kind collision resolves to the entity actually in play,\n'
          + '         and every correctly-impossible cause is still impossible\n');
