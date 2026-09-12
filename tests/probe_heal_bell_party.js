/* probe_heal_bell_party.js — HEAL BELL WAS AN UNMODELLED CLICK, AND THE ROSTER'S ONLY BOARD-MATERIAL
 * MOVE ROW SAID SO.
 *
 *   node tests/probe_heal_bell_party.js
 *   MEDI_PARTY_CURE_UNMODELLED=1 node tests/probe_heal_bell_party.js     (the red demonstration)
 *
 * ================= WHAT WAS MEASURED, BEFORE ANYTHING WAS WRITTEN ================================
 *
 * `data/all-mechanics-fire.json`, release 48ac1c228e02, row `moves.healbell`, rung `ally-statused`.
 * It is the ONE move row in that artifact whose board verdict is STATE rather than ANNOUNCEMENT-ONLY:
 *
 *     showdown   |move|p1a: Chimecho|Heal Bell|p1a: Chimecho
 *                |-activate|p1a: Chimecho|move: Heal Bell
 *                |-curestatus|p1b: Venusaur|slp|[msg]
 *     medicham   |move|p1a: Chimecho|healbell|p1a: Chimecho
 *                (nothing)
 *
 *     board      p1 venusaur  party.status           showdown ""  we "slp"
 *                p1 venusaur  party.status_counter   showdown 0   we 2
 *
 * The click reached `moveAction`'s terminal `{kind:'pass'}` — medicham2-browser.js's own comment
 * names Heal Bell there as declared residue — so the whole move was a wasted turn.
 *
 * ================= THE AUTHORITY, READ WHOLE =====================================================
 *
 * `data/moves.ts` healbell.onHit (lines 8252-8270 at the pinned checkout). Champions overrides
 * `moves.ts`, and `data/mods/champions/moves.ts` was grepped for the id and holds no match, so the
 * mainline handler IS this format's handler — an absence that was read rather than assumed.
 *
 *     onHit(target, source) {
 *       this.add('-activate', source, 'move: Heal Bell');
 *       let success = false;
 *       const allies = [...target.side.pokemon, ...target.side.allySide?.pokemon || []];
 *       for (const ally of allies) {
 *         if (ally !== source && !this.suppressingAbility(ally)) {
 *           if (ally.hasAbility('soundproof'))  { this.add('-immune', ally, '[from] ability: Soundproof');   continue; }
 *           if (ally.hasAbility('goodasgold'))  { this.add('-immune', ally, '[from] ability: Good as Gold'); continue; }
 *         }
 *         if (ally.cureStatus()) success = true;
 *       }
 *       return success;
 *     }
 *
 * and `Pokemon#cureStatus` (sim/pokemon.ts:1680) opens `if (!this.hp || !this.status) return false;`
 * and writes `|-curestatus|BODY|STATUS|[msg]` for a benched body exactly as for an active one.
 *
 * Four facts fall out of that block and each has an arm below: the WHOLE PARTY is reached (not the
 * two actives); the USER is exempt from its own Soundproof/Good as Gold refusal (`ally !== source`);
 * a refused ally is NOT cured and says `-immune`; and a Heal Bell that cures nobody FAILS.
 *
 * ================= WHY A TAG AND NOT A NAME =====================================================
 *
 * `curesPartyStatus` is derived in engine/tag_dex.js from that handler's own text — the party walk,
 * the `cureStatus` call, the announcement string, and the two refusing abilities with their lines.
 * MEMBERSHIP PRINTED OVER THE WHOLE FORMAT BEFORE IT WAS WIRED (block 0 below re-prints it on every
 * run): exactly ONE legal move matches, and the one near miss — `worryseed`, whose handler also
 * calls `cureStatus` — is correctly refused, because it cures a single target after rewriting an
 * ability and walks no party.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('data', 'engine-data.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const TAGS = require(D('data', 'tags.json'));

const OFF = process.env.MEDI_PARTY_CURE_UNMODELLED === '1';
let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + what + (detail ? '\n          ' + detail : ''));
  if (!cond) bad++;
};

console.log('\n  HEAL BELL CURES THE WHOLE PARTY' + (OFF ? '   [MEDI_PARTY_CURE_UNMODELLED=1]' : ''));

/* ---- 0. THE MEMBERSHIP, PRINTED BEFORE ANYTHING IS ASSERTED ON IT ------------------------------
 * A derived tag that over-matches is this repository's most expensive recurring mistake, so the
 * carriers are printed on every run rather than at the moment the tag was written. */
const carriers = Object.keys(TAGS.moves || {})
  .filter(k => (TAGS.moves[k].tags || []).indexOf('curesPartyStatus') >= 0);
console.log('\n  DERIVED — legal moves carrying `curesPartyStatus`:');
for (const k of carriers) console.log('    ' + k + '  ' + JSON.stringify((TAGS.moves[k].params || {}).curesPartyStatus));
if (!carriers.length) console.log('    NONE');
ok(carriers.length === 1 && carriers[0] === 'healbell',
  'the tag matches exactly one legal move and it is Heal Bell',
  'matched: ' + (carriers.join(', ') || 'nothing') + '  — a second carrier is not a failure of the '
  + 'game, but it is a fact this probe must be re-read against');
const P = (TAGS.moves.healbell && TAGS.moves.healbell.params || {}).curesPartyStatus || null;
ok(!!P && P.scope === 'party' && P.exemptsUserFromRefusal === true && P.failsIfNothingCured === true
   && !!P.announce && Array.isArray(P.refusedByAbility) && P.refusedByAbility.length === 2,
  'the param carries the four facts the handler declares',
  JSON.stringify(P));

/* ---- THE FIXTURE -------------------------------------------------------------------------------
 * Four bodies a side, so the BENCH is real. Statuses are written onto the bodies directly: this
 * probe is about the cure, and staging four different status moves would make a failure ambiguous
 * between the cure and whatever put the status on.
 *
 * Every species is checked against the format by tests/roster.js's own population; each of chimecho,
 * venusaur, pikachu, blastoise, bastiodon, kommoo and feraligatr is `exists && !isNonstandard &&
 * tier !== 'Illegal'` in gen9championsvgc2026regmb and carries an MC row (printed by
 * scratch derivation before this file was written). */
const bare = (sp, ab) => {
  const b = M.buildMon(sp, {});
  if (!b) throw new Error('no MC row ' + sp);
  b.item = ''; b.ability = ab === undefined ? 'none' : ab;
  return b;
};
const rng5 = () => 0.5;

/* `o.mine` is [species, ability, status] per slot, party order (two actives then two benched).
 * `o.theirs` the same for the far side. The user is always my slot 0 and always clicks Heal Bell. */
function bell(o) {
  const mk = (r) => { const b = bare(r[0], r[1]); if (r[2]) { b.status = r[2]; if (r[2] === 'slp') { b.slpTurns = 2; b.slpTime = 2; } } return b; };
  const mine = (o.mine || []).map(mk);
  const theirs = (o.theirs || [['feraligatr', 'none', ''], ['charizard', 'none', ''],
                               ['blastoise', 'none', ''], ['venusaur', 'none', '']]).map(mk);
  const trace = [];
  const S = M.battleInit(mine, theirs, { seeded: true, trace });
  const a = M.playerAction(mine[0], o.click || 'healbell', mine[0], S.field);
  M.battleTurn(S, rng5,
    new Map([[mine[0], a], [mine[1], { kind: 'pass' }]]),
    new Map([[theirs[0], { kind: 'pass' }], [theirs[1], { kind: 'pass' }]]));
  return { kind: a && a.kind, trace,
           mine: mine.map(b => (b.status || '-')), theirs: theirs.map(b => (b.status || '-')),
           slp: mine.map(b => +b.slpTurns || 0) };
}
const show = (r) => 'kind=' + r.kind + '  my party [' + r.mine.join(' ') + ']  theirs [' + r.theirs.join(' ') + ']';
const lines = (r, re) => r.trace.filter(l => re.test(String(l)));

/* ---- 1. THE ACTIVE ALLY, THE BENCH, AND THE USER ---------------------------------------------- */
const all = bell({ mine: [['chimecho', 'none', 'brn'], ['venusaur', 'none', 'slp'],
                          ['pikachu', 'none', 'par'], ['blastoise', 'none', 'psn']] });
ok(all.mine.join('') === '----',
  'every body in the party is cured — the user, the active ally AND both benched bodies',
  show(all) + '\n          trace: ' + all.trace.join(' | '));
ok(all.slp[1] === 0,
  'the sleep COUNTER goes with the sleep — the roster read `status_counter` medi 2 / sd 0',
  'slpTurns across the party [' + all.slp.join(' ') + ']');

/* ---- 2. THE ANNOUNCEMENT, ON THE USER, VERBATIM ------------------------------------------------ */
ok(lines(all, /-activate/).length === 1 && /chimecho/i.test(String(lines(all, /-activate/)[0]))
   && /move: Heal Bell/.test(String(lines(all, /-activate/)[0])),
  'one `-activate` naming the USER with `move: Heal Bell`',
  (lines(all, /-activate/).join(' | ') || '(no -activate line)'));
ok(lines(all, /-curestatus/).length === 4
   && lines(all, /-curestatus/).every(l => /\[msg\]/.test(String(l))),
  'one `-curestatus|BODY|STATUS|[msg]` per body cured, benched bodies included',
  lines(all, /-curestatus/).join(' | ') || '(none)');

/* ---- 3. THE FAR SIDE IS NOT A PARTY OF OURS ---------------------------------------------------- */
const foes = bell({ mine: [['chimecho', 'none', 'brn'], ['venusaur', 'none', ''],
                           ['pikachu', 'none', ''], ['blastoise', 'none', '']],
                    theirs: [['feraligatr', 'none', 'par'], ['charizard', 'none', 'brn'],
                             ['blastoise', 'none', 'psn'], ['venusaur', 'none', 'slp']] });
ok(foes.theirs.join('') === 'parbrnpsnslp' && foes.mine[0] === '-',
  'the opposing party keeps every one of its statuses',
  show(foes));

/* ---- 4. SOUNDPROOF REFUSES IT ON THE FIELD, AND SAYS SO ---------------------------------------- */
/* bastiodon is one of this format's three Soundproof carriers (bastiodon, abomasnow, kommoo —
 * derived over the legal species list, not chosen). It is the ACTIVE ally here.
 *
 * STAGED IN THE OFFICIAL SIMULATOR BEFORE THIS ARM WAS WRITTEN:
 *     |move|p1a: Chimecho|Heal Bell|p1a: Chimecho
 *     |-activate|p1a: Chimecho|move: Heal Bell
 *     |-immune|p1b: Bastiodon|[from] ability: Soundproof
 *     |-curestatus|p1: Pikachu|par|[msg]      ... and Bastiodon ends the turn still paralysed. */
const sp = bell({ mine: [['chimecho', 'none', 'brn'], ['bastiodon', 'soundproof', 'par'],
                         ['pikachu', 'none', 'par'], ['blastoise', 'none', 'psn']] });
ok(sp.mine[1] === 'par',
  'an ACTIVE Soundproof ally is NOT cured', show(sp));
ok(lines(sp, /-immune/).length === 1 && /bastiodon/i.test(String(lines(sp, /-immune/)[0]))
   && /ability: Soundproof/.test(String(lines(sp, /-immune/)[0])),
  'and it says `-immune ... [from] ability: Soundproof`',
  lines(sp, /-immune/).join(' | ') || '(no -immune line)');
ok(sp.mine[0] === '-' && sp.mine[2] === '-' && sp.mine[3] === '-',
  'the rest of the party is still cured around it', show(sp));

/* ---- 5. AND OFF THE FIELD IT IS NOT A GATE AT ALL ---------------------------------------------- */
/* THE ARM THAT READING THE HANDLER ALONE GETS BACKWARDS. `hasAbility` ends in
 * `!this.ignoringAbility()` and `ignoringAbility` opens `if (gen >= 5 && !this.isActive) return true`
 * (sim/pokemon.ts:865, 1957-1963) — so a BENCHED Soundproof body has no ability as far as this
 * handler is concerned and IS cured. Staged: `|-curestatus|p1: Bastiodon|par|[msg]`. An engine that
 * refused it would be running a strictly better Soundproof than the real one. */
const spBench = bell({ mine: [['chimecho', 'none', 'brn'], ['venusaur', 'none', 'slp'],
                              ['bastiodon', 'soundproof', 'par'], ['blastoise', 'none', 'psn']] });
ok(spBench.mine[2] === '-' && lines(spBench, /-immune/).length === 0,
  'a BENCHED Soundproof body IS cured and no `-immune` is written for it',
  show(spBench) + '   immune lines: ' + (lines(spBench, /-immune/).join(' | ') || '(none)'));
ok(lines(spBench, /-curestatus\|p1: bastiodon/i).length === 1,
  'and the benched body is named `p1: <name>` — no slot letter, as `Pokemon#toString` writes it',
  lines(spBench, /-curestatus/).join(' | '));

/* ---- 5b. `ally !== source` — THE USER IS EXEMPT FROM ITS OWN REFUSAL --------------------------- */
/* kommoo is a Soundproof carrier that learns Heal Bell in this format. The handler skips the whole
 * ability gate when the body IS the source, so a Soundproof singer cures itself — staged, and it
 * does.
 *
 * ONE DECLARED SHORTFALL, MEASURED AND NOT GUESSED: the authority ALSO writes an earlier
 * `|-immune|p1a: Kommo-o|[from] ability: Soundproof` from Soundproof's `onAllyTryHitSide`, which
 * fires for any sound move aimed at its own side and does not stop the move. That is an ability-side
 * narration line for every sound move rather than a Heal Bell fact; this engine does not emit it and
 * the branch says so in as many words. The arm below therefore asserts the CURE, and records the
 * missing line rather than pretending it is not owed. */
const self = bell({ mine: [['kommoo', 'soundproof', 'brn'], ['venusaur', 'none', 'slp'],
                           ['pikachu', 'none', 'par'], ['blastoise', 'none', 'psn']] });
ok(self.mine[0] === '-' && self.mine.join('') === '----',
  'a SOUNDPROOF user still cures itself and the whole party — the exemption is identity, not ability',
  show(self) + '\n          trace: ' + self.trace.join(' | '));
console.log('          OWED (declared, not asserted): the authority also writes an earlier '
  + '`|-immune|p1a: Kommo-o|[from] ability: Soundproof` from `onAllyTryHitSide`. Not emitted here.');

/* ---- 6. GOOD AS GOLD IS THE SECOND REFUSER, AND IT IS DERIVED NOT NAMED ------------------------ */
const gag = bell({ mine: [['chimecho', 'none', 'brn'], ['gholdengo', 'goodasgold', 'par'],
                          ['pikachu', 'none', 'par'], ['blastoise', 'none', 'psn']] });
ok(gag.mine[1] === 'par' && /ability: Good as Gold/.test(lines(gag, /-immune/).join(' ')),
  'a Good as Gold ally is refused with its own line',
  show(gag) + '   ' + (lines(gag, /-immune/).join(' | ') || '(no -immune line)'));

/* ---- 7. A HEAL BELL THAT CURES NOBODY FAILS ---------------------------------------------------- */
/* `return success` — the handler's last line. Showdown's failed Heal Bell is
 * `|move|p1a: Chimecho|Heal Bell||[still]` then `|-fail|p1a: Chimecho`, which is the earlier rungs
 * of the roster row verbatim. */
const none = bell({ mine: [['chimecho', 'none', ''], ['venusaur', 'none', ''],
                           ['pikachu', 'none', ''], ['blastoise', 'none', '']] });
ok(lines(none, /^\|?-fail|\|-fail\|/).length === 1 || none.trace.some(l => /-fail/.test(String(l))),
  'a Heal Bell with nothing to cure FAILS', 'trace: ' + none.trace.join(' | '));
ok(none.trace.some(l => /\|healbell\|\|\[still\]/.test(String(l))),
  'and the move line is blanked with `[still]`, as `attrLastMove` does',
  'trace: ' + none.trace.join(' | '));
ok(lines(none, /-curestatus/).length === 0,
  'and it cures nothing', lines(none, /-curestatus/).join(' | ') || '(none — correct)');

/* ---- 8. A FAINTED BENCH BODY IS NOT CURED ------------------------------------------------------ */
/* `if (!this.hp || !this.status) return false;` — the first clause of cureStatus. A corpse keeps its
 * status, and it must not raise `success` either. */
const dead = (() => {
  const mine = [bare('chimecho'), bare('venusaur'), bare('pikachu'), bare('blastoise')];
  mine[0].status = 'brn';
  mine[2].status = 'par'; mine[2].curHP = 0; mine[2].fainted = true;
  const theirs = [bare('feraligatr'), bare('charizard'), bare('blastoise'), bare('venusaur')];
  const trace = [];
  const S = M.battleInit(mine, theirs, { seeded: true, trace });
  M.battleTurn(S, rng5,
    new Map([[mine[0], M.playerAction(mine[0], 'healbell', mine[0], S.field)], [mine[1], { kind: 'pass' }]]),
    new Map([[theirs[0], { kind: 'pass' }], [theirs[1], { kind: 'pass' }]]));
  return { mine: mine.map(b => b.status || '-'), trace };
})();
ok(dead.mine[2] === 'par' && dead.mine[0] === '-',
  'a fainted benched body keeps its status and the living ones are still cured',
  '[' + dead.mine.join(' ') + ']  trace: ' + dead.trace.join(' | '));

/* ---- 9. THE KNOB MOVES THE OUTCOME ------------------------------------------------------------- */
ok(OFF || all.mine.join('') !== 'brnslpparpsn',
  'the knob MOVES the outcome — identical readings across it would mean the wire is dead',
  'cured party [' + all.mine.join(' ') + ']  against the unmodelled reading [brn slp par psn]');

/* ---- 10. NOTHING ELSE CLAIMS THE CLICK --------------------------------------------------------- */
/* Heal Bell must not still be arriving at the terminal `{kind:'pass'}`; `unmodelledClickBy` is the
 * engine's own census of that road and it is read rather than inferred from the board. */
const fails = M.MEDFAILS || {}, seen = M.MEDSEEN || {};
ok(OFF ? true : !((fails.unmodelledClickBy || {}).healbell > 0),
  'Heal Bell no longer reaches the unmodelled-click terminal',
  'unmodelledClickBy.healbell=' + ((fails.unmodelledClickBy || {}).healbell || 0));

console.log('\n  COUNTERS  partyCured=' + (seen.partyStatusCured || 0)
  + '  partyCureRefused=' + (seen.partyCureRefusedByAbility || 0)
  + '  partyCureFailed=' + (seen.partyCureFailed || 0)
  + '  partyCureUnmodelledRestored=' + (fails.partyCureUnmodelledRestored || 0));

console.log('\n  ' + (bad ? bad + ' FAILED' : 'all checks passed') + '\n');
process.exit(bad ? 1 : 0);
