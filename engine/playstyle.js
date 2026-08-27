/* playstyle.js — label each real team by its PLAYSTYLE (not its species pair) and build a
 * playstyle x playstyle matchup matrix from real outcomes (Wilson CIs), same shape as
 * data/guru-matchups.json so SLOWKING can solve it. Answers: do stall / Trick Room / perish-trap /
 * setup / weather form stronger non-transitive cycles than the coarse species archetypes?
 *
 * Classification is a rule-based prior over the six species + any REVEALED moves/items (sets are
 * partial in Bo1, so species roles carry most of the signal). Priority order resolves overlaps.
 *   node engine/playstyle.js   ->  data/playstyle-matchups.json
 */
'use strict';
const fs = require('fs'), path = require('path');
const CS = require('./champions_sim.js');
const Q = require('./quality.js');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'playstyle-matchups.json');
const idn = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);

/* WHAT THE FORMAT ACTUALLY CONTAINS. Every species list below is a hand-typed guess at a role, and a
 * typo or a species that cannot legally appear does not error -- it silently never matches, and the
 * label it was supposed to produce quietly goes to whatever rule is next. Three separate ways to be
 * dead were found in one sitting, all of them invisible:
 *
 *   dead by ILLEGALITY  amoonguss, dondozo, alomomola, blissey, clefairy are Illegal tier here
 *   dead by USAGE       groudon, gigalith, ursaluna, cresselia... zero games in the usage table
 *   dead by NAMING      the store writes lowercase BASE forms. Across 20,387 teams and 273 distinct
 *                       species strings the only one containing "mega" is `meganium`. So every
 *                       `*mega` entry -- tyranitarmega, abomasnowmega, gengarmega -- never matched
 *                       anything. `hattrenemega` was also a transposition of `hatterene`, dead twice.
 *
 * So the lists are AUDITED against the usage table at load, and anything that cannot appear is
 * reported rather than left to rot. This does not decide the roles -- that is still a judgement, and
 * it is Will's -- it only refuses to keep members that can never fire.
 *
 * THE AUDIT DROPPED THEM AT RUN TIME AND LEFT THEM TYPED IN THE SOURCE, WHICH IS HALF A FIX.
 * 2026-08-27: six of the names below were `isNonstandard: 'Past'` -- groudon (SUN), gigalith (SAND),
 * rillaboom, mienshao, hitmontop and purugly (FAKEOUT). CLAUDE.md's cardinal rule is about NAMING,
 * "every example, every illustration and every derived result", so a name this format does not
 * contain is a defect wherever it is written, including in a list that is filtered before it is used.
 * They are removed. MEASURED, and it is why this is safe to do in a pass that runs nothing: none of
 * the six has a usage row at all, so none was ever in LIVE, and the resolved sets are byte-identical
 * before and after -- SUN {torkoal, ninetales, charizard}, SAND {tyranitar, hippowdon},
 * FAKEOUT {incineroar, meowscarada}. No team's label moves. The only artifact field that moves is
 * `dead_list_entries`, 7 -> 1, at the next regeneration.
 *
 * They were all TYPED, not DERIVED, and the distinction decides the fix. A literal in this file was
 * written by a human; replacing it repairs it for good. A value that arrives from the STORE cannot be
 * repaired by editing anything, because the next regeneration puts it back -- and the store does carry
 * these names: 76 of 88,179 games (0.09%) name at least one species this regulation does not contain,
 * 71 distinct, including rillaboom (9 games) and amoonguss (8). Those are custom-rule games still
 * tagged reg-mb. `data/quality-filter.json` has no legality rule, so they are CLEAN by every check
 * this project applies, and they reach data/meta-usage.json, data/bring-priors.json and
 * data/sheet-usage.json. That is a filter that belongs in engine/quality.js, not here. ROADMAP #471.
 *
 * AND THE FILTER MUST ASK ABOUT CARRIERS, NOT ABOUT `isNonstandard`. `LIVE` collapses to BASE forms,
 * and Floette-Mega and Floette-Eternal are LEGAL formes whose base, Floette, is `Past`/`Illegal`. So
 * `LIVE` contains `floette` today -- correctly -- and a naive legality filter would delete the single
 * largest usage row in the table (316,361 raw). A name is only outside this regulation when NO legal
 * forme collapses onto it. */
const USAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'smogon-priors.json'), 'utf8')).species || {};
/* COLLAPSED TO BASE FORMS, because that is the vocabulary the STORE speaks and the audit is
 * worthless in any other one. A first version of this filter kept every name with usage > 0, which
 * happily retained `tyranitarmega` -- a name with real usage in the Smogon table and ZERO occurrences
 * in the game store, because the store writes lowercase base forms. The audit would then have passed
 * an entry that can never match, which is the exact failure it exists to catch.
 *
 * This is not a tidy-up. 76 mega forms carry 17.7% of this format's usage and every one of them is
 * invisible here: Staraptor-Mega (428,748, and it gains CONTRARY), Charizard-Mega-Y (258,306, gains
 * Drought), Gengar-Mega (89,335, gains Shadow Tag). The mon that is actually on the field has a
 * different ability from the name recorded, and nothing downstream can tell. */
const LIVE = new Set();
for (const [k, v] of Object.entries(USAGE)) {
  if (!(v && v.raw > 0)) continue;
  const S = dex.species.get(k);
  LIVE.add(idn((S && S.exists && S.baseSpecies) ? S.baseSpecies : k));
}
const DEAD_ENTRIES = [];
/* WHY a member is dead, because "dead by illegality" and "dead by usage" are different bugs with
 * different fixes and the report pooled them. A name outside the regulation must be deleted from the
 * source; a legal name with no usage is a judgement about the metagame and is Will's to keep or drop.
 * Asked of the format, never of a list. A base form counts as inside the regulation when any legal
 * forme collapses onto it -- see the Floette note above. */
const LEGAL_BASES = new Set();
for (const S of dex.species.all()) {                    /* .all() is the NATIONAL dex — filtered */
  if (!S.exists || S.isNonstandard || S.tier === 'Illegal') continue;
  LEGAL_BASES.add(idn(S.baseSpecies || S.name));
}
/* THE ROW DECIDES, NOT THE WALK. Cosmetic formes (Florges-White, Alcremie-Salted-Cream) are LEGAL and
 * are not in `dex.species.all()` — they hang off the base — so a set built from that walk calls them
 * illegal. `dex.species.get` resolves them to a row that carries its own legality. The walk is still
 * needed for the other direction: Floette is Past while Floette-Eternal and Floette-Mega are legal, so
 * a legal forme collapsing onto an illegal BASE name keeps that base name inside the regulation. */
const inRegulation = (m) => {
  const S = dex.species.get(m);
  if (!S || !S.exists) return false;
  if (!S.isNonstandard && S.tier !== 'Illegal') return true;
  return LEGAL_BASES.has(S.id);
};
const whyDead = (m) => {
  const S = dex.species.get(m);
  if (!inRegulation(m)) return 'NOT IN THIS REGULATION — delete it from the source, the audit only hides it';
  if (S.id !== idn(S.baseSpecies || S.name)) return 'a forme name, and the store writes base forms';
  return 'no usage in the table';
};
function roleSet(name, members) {
  const live = members.filter(m => LIVE.has(m));
  for (const m of members) if (!LIVE.has(m)) DEAD_ENTRIES.push(`${name}:${m} (${whyDead(m)})`);
  return new Set(live);
}

// species role priors (Reg M-B relevant). A species can carry more than one signal.
const RAIN = roleSet('RAIN', ['pelipper', 'politoed']);
// Charizard in Reg M-B is overwhelmingly Mega-Y (Drought) → a sun setter. (Rare Charizardite-X exists.)
const SUN = roleSet('SUN', ['torkoal', 'ninetales', 'charizard']);
const SAND = roleSet('SAND', ['tyranitar', 'hippowdon', 'tyranitarmega']);
/* No SNOW and no TAILWIND set. Snow is a deleted class (2 games) and Tailwind is now decided by the
 * move, so both lists became unreachable. They are removed rather than left defined-but-unused --
 * an unused role list is indistinguishable from a live one that never happens to match, which is the
 * failure this file has already had four times. */
/* THE TRAPPERS ARE DERIVED FROM THE ABILITY, and the old typed list could not fire at all.
 *
 * It read ['gothitelle','gengar','gengarmega','politoed'] and the rule that used it ALSO required
 * `s.includes('gothitelle')` -- a species with ZERO usage in this format. So PerishTrap only ever
 * fired on a revealed Perish Song; the species half was unreachable. Meanwhile the actual trapper
 * here is Mega Gengar (Shadow Tag, 89,335 usage), and `gengarmega` was dead by naming because the
 * store writes base forms.
 *
 * Politoed is deliberately NOT a trapper. It sat in the old list as a Perish Song enabler, but it is
 * a rain setter -- promoting it to "trapper" would hand every Politoed team to PerishTrap and steal
 * the Rain label from it. Perish Song is caught by the revealed-move clause where it belongs.
 *
 * WHAT THE BASE-FORM COLLAPSE COSTS, STATED: the store cannot distinguish Mega Gengar from base
 * Gengar -- both are `gengar`. Base Gengar has Cursed Body and traps nothing. By usage this reads
 * correctly 89% of the time (89,335 mega vs 11,453 base) and wrongly 11%. That is a population
 * inference, the same kind board.js makes for abilities, not a certainty. */
const TRAPPER = (() => {
  const out = new Set();
  for (const k of LIVE) {
    const S = dex.species.get(k);
    if (!S || !S.exists) continue;
    const abils = Object.values(S.abilities || {}).map(idn);
    if (abils.includes('shadowtag') || abils.includes('arenatrap')) out.add(idn(S.baseSpecies || S.name));
  }
  return out;
})();
const FAKEOUT = roleSet('FAKEOUT', ['incineroar', 'meowscarada']);

/* SETUP MOVES ARE DERIVED, NOT TYPED (S13). A setup move is one that raises the USER's own stats,
 * which is `move.boosts` on a self-targeted move or `move.self.boosts` -- a dex DATA field, exactly
 * as engine/board.js reads it. The typed list of eleven was measured against the format and it was
 * wrong in both directions: it MISSED nine moves that people actually run here (Acid Armor, Amnesia,
 * Clangorous Soul, Cosmic Power, Cotton Guard, Growth, Minimize, No Retreat, Shelter) and it carried
 * Work Up, which nobody in this format runs at all. Neither error could show up as a failure. */
const SETUP_MOVES = (() => {
  const out = new Set();
  for (const v of Object.values(USAGE)) {
    for (const row of (v.moves || [])) {
      const m = dex.moves.get(idn(row.move));
      if (!m || !m.exists) continue;
      const self = (m.target === 'self' && m.boosts) ? m.boosts : (m.self && m.self.boosts) ? m.self.boosts : null;
      if (self && Object.values(self).some(x => x > 0)) out.add(m.name.toLowerCase());
    }
  }
  return [...out];
})();
const TR_MOVE = 'trick room', PERISH_MOVE = 'perish song', TW_MOVE = 'tailwind';

function classify(six, sets) {
  const s = six.map(idn);
  /* ONLY THIS TEAM'S SETS. `g.sets` is keyed by species across BOTH teams -- twelve entries in an
   * open-sheet game -- and this function was handed the whole object and pooled every move in it. So
   * every move-based rule was answering a question about the MATCH, not about the team: a team was
   * labelled TrickRoom because its OPPONENT had Trick Room, Setup because its opponent had Swords
   * Dance. It survived scrutiny while the move clauses were one half of an `||` with a species clause
   * that usually fired first; making Trick Room require the move would have turned it into the
   * dominant error instead. Restricted to the six species actually on this side. */
  const mine = new Set(s);
  const moves = [];
  for (const k in (sets || {})) {
    if (!mine.has(idn(k))) continue;
    for (const mv of (sets[k].moves || [])) moves.push(mv.toLowerCase());
  }
  const has = set => s.some(x => set.has(x));
  const hasMove = m => moves.some(x => x.includes(m));

  // priority: explicit strategy signals first, then weather, then tempo, then default
  /* PERISHTRAP AND SNOW ARE DELETED, on the same rule as Stall and by the same decision. Once the
   * corpus became clean open sheets they held 14 and 2 games. A class that cannot reach a usable
   * sample is not a small class, it is a NOISE class: every cell in its row and column is a Wilson
   * interval spanning most of the unit line, and SLOWKING's Nash solver weights it anyway -- which is
   * exactly how eleven Stall observations came to carry 5% of a recommended strategy. Teams that
   * would have matched fall through to the next rule, which is the honest answer for a label we
   * cannot measure. The TRAPPER derivation above is kept because it is correct and cheap to revive if
   * the corpus ever supports the class. */
  /* TRICK ROOM REQUIRES TRICK ROOM. Will's ruling, and it removes the single largest distortion in
   * this file. The old second clause -- "a TR setter is present AND a slow attacker is present" --
   * needed no Trick Room to have been seen at all, and its notion of "slow" was a typed list holding
   * Kingambit (base Speed 50), Incineroar (60), Basculegion (78) and Archaludon (85). Those are four
   * of the most-used Pokemon in the format and none of them is a Trick Room attacker, so essentially
   * any team with an Incineroar and any bulky mon was labelled TrickRoom: 29.5% of all teams, ahead
   * of every real archetype. The `slowLeaning`/`SLOW_ATK` helper existed only for that clause and is
   * deleted with it.
   *
   * THIS IS WHY THE CORPUS IS NOW OPEN SHEETS. On the closed ladder store, requiring the move would
   * merely trade one error for another: Bo1 reveals sets only partially, so a genuine Trick Room team
   * that never got to click it would be labelled something else, and the label would be UNDER-
   * inclusive by an unknown amount. On an open team sheet all six sets are declared before the first
   * turn, so "is Trick Room on this team" is a FACT that is read, not a reveal that is waited for.
   * The ruling and the corpus have to move together; either alone is a worse number than before. */
  if (hasMove(TR_MOVE)) return 'TrickRoom';
  if (moves.some(m => SETUP_MOVES.some(su => m.includes(su)))) return 'Setup';
  /* STALL IS GONE, by Will's decision, and the reason is worth keeping. Of its seven species five
   * were Illegal in this format and a sixth (Sinistcha) is not a stall Pokemon, which left the rule
   * -- which required TWO members -- meaning exactly "this team has both Toxapex and Sinistcha". It
   * matched 22 team-slots, and SLOWKING's Nash solver was assigning ~5% of its strategy to that cell.
   * A label that cannot reach a usable sample is worse than no label, because it still gets weighted. */
  if (has(RAIN)) return 'Rain';
  if (has(SUN)) return 'Sun';
  if (has(SAND)) return 'Sand';
  /* TAILWIND REQUIRES TAILWIND -- the same ruling as Trick Room, and for the same reason. Keying on
   * species alone, this label inherited exactly the role TrickRoom used to play: it fired on any team
   * carrying a Whimsicott and became the single largest class at 29% of all team-slots. Whether a
   * Whimsicott is running Tailwind is a FACT on an open sheet, so there is no reason to infer it from
   * the species. The species clause is kept as a disjunct only for... nothing: it is removed.
   *
   * The `countAtk >= 3` gate that used to guard this line is also gone. It counted "members of the
   * six that are in neither the stall nor the TR-setter list", which is not a count of attackers, and
   * measured against the store it admitted 40,761 of 40,774 team-slots -- it blocked THIRTEEN. Any
   * threshold up to five was a no-op. It answered "why three?" with "it never mattered". */
  if (hasMove(TW_MOVE)) return 'TailwindOffense';
  if (has(FAKEOUT)) return 'FakeOutBalance';
  return 'HyperOffense';
}

// ---- accumulate matchups from real human games -------------------------------------------------
const seen = new Set();
const N = {};       // N[a][b] = games where a-team beat b-team (a is p1-perspective winner)
const G = {};       // G[a][b] = total games between a and b
const styleCount = {};
function bump(o, a, b) { o[a] = o[a] || {}; o[a][b] = (o[a][b] || 0) + 1; }

/* OPEN SHEETS, AND FILTERED. Two changes to the corpus, and neither is cosmetic.
 *
 * OPEN SHEETS. This read data/games.ladder.jsonl, where sheets are CLOSED and a team's moves are
 * known only as far as they were revealed in play. Every move-based rule in classify() was therefore
 * asking "was this clicked" while claiming to ask "is this on the team" -- and the two differ most on
 * short games, which is exactly where forfeits live. data/games.ots.jsonl declares all six sets up
 * front (3,557 of 4,167 games carry both full sheets), so the move rules now read the team.
 *
 * FILTERED. The old loop dropped self-identifying bots by name only, which is not the project's
 * clean-data rule (GARBODOR): engine/quality.js also removes behavioural bots, stubs and forfeits,
 * and it is the single definition every other behavioural number in this repo goes through. Reading
 * the store raw here meant the playstyle matrix -- and the cycle result built on it -- were computed
 * over a population that is 87% bots and stubs on the ladder store and 49% unusable on this one. */
const RAW = Q.loadGames({ path: path.join(ROOT, 'data', 'games.ots.jsonl'), clean: false });
const GAMES = Q.loadGames({ path: path.join(ROOT, 'data', 'games.ots.jsonl') });
let nGames = 0;
for (const g of GAMES) {
  if (seen.has(g.id)) continue; seen.add(g.id);
  if (!g.winner || g.p1.bot || g.p2.bot) continue;
  const six1 = g.six && g.six.p1, six2 = g.six && g.six.p2;
  if (!six1 || !six2 || six1.length < 6 || six2.length < 6) continue;
  const s1 = classify(six1, g.sets), s2 = classify(six2, g.sets);
  styleCount[s1] = (styleCount[s1] || 0) + 1; styleCount[s2] = (styleCount[s2] || 0) + 1;
  const p1win = idn(g.winner) === idn(g.p1.name);
  bump(G, s1, s2); bump(G, s2, s1);
  if (p1win) bump(N, s1, s2); else bump(N, s2, s1);
  nGames++;
}

const styles = Object.keys(styleCount).sort((a, b) => styleCount[b] - styleCount[a]);
function wilson(w, n) {
  if (!n) return { p: null, lo: null, hi: null, n: 0 };
  const z = 1.96, ph = w / n, d = 1 + z * z / n;
  const c = (ph + z * z / (2 * n)) / d, m = z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d;
  return { p: +ph.toFixed(3), lo: +(c - m).toFixed(3), hi: +(c + m).toFixed(3), n };
}
const matrix = {};
for (const a of styles) {
  matrix[a] = {};
  for (const b of styles) {
    if (a === b) { matrix[a][b] = null; continue; }
    const n = (G[a] && G[a][b]) || 0, w = (N[a] && N[a][b]) || 0;
    matrix[a][b] = n ? wilson(w, n) : null;
  }
}
const out = {
  generated: 'engine/playstyle.js — playstyle matchup matrix from REAL outcomes (Wilson CIs)',
  corpus: 'data/games.ots.jsonl',
  open_sheets: true,
  clean: true,
  raw_store_ok: false,
  corpus_raw: RAW.length,
  corpus_clean: GAMES.length,
  n_games: nGames, n_archetypes: styles.length,
  archetypes: styles,
  style_counts: styleCount,
  derived_setup_moves: SETUP_MOVES.slice().sort(),
  dead_list_entries: DEAD_ENTRIES,
  matrix,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`playstyle matrix: ${nGames} games, ${styles.length} styles`);
console.log(`  corpus: data/games.ots.jsonl — ${RAW.length} raw, ${GAMES.length} clean (open sheets)`);
console.log('  distribution:', styles.map(s => `${s} ${styleCount[s]}`).join(' | '));
console.log(`  setup moves DERIVED from the dex: ${SETUP_MOVES.length}`);
/* REPORTED, NOT SWALLOWED. A role list member that cannot appear in this format is the failure mode
 * this file was full of -- five Illegal species in the stall list, nine dead Trick Room setters, four
 * mega names the store never writes. Dropping them silently would fix today's numbers and leave the
 * next edit free to add another. */
if (DEAD_ENTRIES.length) {
  console.log(`  DROPPED ${DEAD_ENTRIES.length} role-list entries that cannot appear in this format:`);
  console.log('    ' + DEAD_ENTRIES.join(', '));
} else console.log('  every role-list species can appear in this format.');
