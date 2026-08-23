/* THE FORME ABSOLUTE-ASSERTION MODE — Will's design, 2026-08-10, built 2026-08-11.
 *
 *   SHOWDOWN_PATH=... node tests/test-forme-assert.js
 *   SHOWDOWN_PATH=... node tests/test-forme-assert.js --reds     (each assertion, shown red on its own)
 *   SHOWDOWN_PATH=... node tests/test-forme-assert.js --json
 *
 * ================= WHY THE A/B METHOD CANNOT ANSWER THIS FAMILY =================================
 *
 * `tests/roster.js` proves an ability by staging it, staging a CONTROL without it, and comparing the
 * two boards. Every body in this family carries its forme-changer as its ONLY ability, and Showdown
 * says so itself: the format flags them `notrace`, `noentrain`, `noreceiver`, `failroleplay`,
 * `failskillswap` and `cantsuppress`, which `data/tags.json` derives as `refusesCopy`. There is
 * nothing to swap the ability FOR, in the sheet or in play. So the control arm cannot be built and
 * the assertion has to become ABSOLUTE: subject against THE AUTHORITY, with no second arm.
 *
 * Will: *"THE FORM CHANGE ONES SHOULD BE EASY, DID THE FORM CHANGE? (AND DID THE UNDERLYING STATS
 * CHANGE WITH IT)"*, and *"MAKE SURE TO SET UP THE CONDITION FOR THE FORM CHANGE, SO KINGS SHIELD AND
 * THEN ATTACK FOR AEGISLASH, SWITCHING IN AND OUT FOR PALAFIN, ETC"*.
 *
 * ================= THE THREE ASSERTIONS, AND WHY THEY ARE THREE ==================================
 *
 *   A1  THE FORME CHANGED     the ACTIVE slot AND the PARTY ROW both name the new forme, in both
 *                             engines. Two halves, because an engine that renames the standing body
 *                             and leaves the bench row stale looks correct until something switches.
 *   A2  THE BASE LINE MOVED   on a body with a NEUTRAL nature and no investment, every stat equals the
 *                             authority's. This is "the stats are the new forme's".
 *   A3  THE SPREAD SURVIVED   on a body with a NON-NEUTRAL nature, every stat equals the authority's.
 *
 * A2 AND A3 ARE SEPARATE BODIES ON PURPOSE, and it is not tidiness. medicham2 rebases a forme change
 * as `newL50 + (st - oldL50)`. With UNNATURED anchors and a NATURED `st`, the delta carries
 * (mul - 1) x oldL50 instead of the investment, so the new forme lands wrong on exactly the stat the
 * nature moved — and it lands RIGHT on every neutral body. An assertion that only checked the new
 * forme's base line would pass that defect on every run. THREE PARTS THAT ONLY FAIL TOGETHER ARE ONE
 * PART, so each is shown red by its own plant under `--reds`.
 *
 * ================= WHAT THIS MODE FOUND ON ITS FIRST RUN ========================================
 *
 * An Adamant Aegislash going to Blade: this engine read atk 167 / spa 153 where the authority reads
 * 176 / 144. The MEGA path had already been corrected to carry the nature into both anchors
 * (`megaEvolveNow`, l50(bs, null, m._nature)) and `formeSwap` — the MID-BATTLE road — had not. One
 * fact, two implementations, one of them fixed: exactly the shape CLAUDE.md's facts-are-global rule
 * names. Fixed in the same pass; this file is the instrument that can never let it back.
 *
 * ================= WHAT IT CANNOT COVER, MEASURED RATHER THAN ASSUMED ===========================
 *
 * `data/engine-data.js` (which ENGINE may not edit and this pass does not regenerate) HAS NO ROW for
 * `mimikyu-busted`, `morpeko-hangry`, `castform-sunny`, `castform-rainy` or `castform-snowy`. There is
 * no body for medicham2 to become, so Disguise, Hunger Switch and Forecast are UNCOVERABLE by this
 * instrument today and are printed as such on every run — never as a pass, and never silently absent.
 * That is a data gap owned by whoever regenerates that artifact, not a coverage claim.
 *
 * ILLUSION IS BUILT FOR AND SHELVED. ROADMAP #160 closets Zoroark; the row is present, carries its
 * board, and is skipped with that reason printed. Nothing here decides to un-closet it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const SB = require(D('tests', 'staged_board.js'));
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const TAGSJSON = require(D('data', 'tags.json'));

const REDS = process.argv.includes('--reds');
const JSONOUT = process.argv.includes('--json');
const idOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/* THE INERT CLICK is roster.js's, and for roster.js's reason: Splash and Celebrate are
 * `isNonstandard: 'Past'` in this format, and Recycle hands a consumed berry back. Focus Energy is
 * legal, self-targeting, never misses, and its only effect is a crit-ratio volatile. */
const INERT = 'focusenergy';
const mk = (species, ability, moves, nature, item) =>
  ({ species, item: item || '', ability, moves: moves.concat([INERT]), nature: nature || 'Serious' });
/* four distinct species a side, none of which does anything on its own turn */
const FILL = [mk('Corviknight', 'Pressure', []), mk('Garchomp', 'Rough Skin', []), mk('Milotic', 'Marvel Scale', [])];
const FOES = [mk('Blastoise', 'Torrent', []), mk('Torkoal', 'Drought', []),
              mk('Vivillon', 'Shield Dust', []), mk('Weavile', 'Pressure', [])];
const idle = () => ({ m: INERT });

/* ---- THE MEMBERSHIP, DERIVED ------------------------------------------------------------------
 *
 * TWO derivations, both read at load time and both printed, because they answer different questions
 * and a hand-typed list of either is the stale-list failure this project has already paid for.
 *
 *   refusesCopy   WHICH abilities have no control body — the reason this mode exists at all.
 *   formeChange(  WHICH abilities actually change the forme — read out of the handler source in
 *                 `Dex.forFormat`, intersected with the species that legally carry them here.
 *
 * The sprint notes' hand-written table of nine is STALE for this regulation and this is what replaces
 * it: Ice Face, Shields Down and Mimicry are on it and NONE of the three has a legal carrier in Reg
 * M-B (Eiscue and Minior are absent; Mimicry changes TYPE, not forme). */
const legalSpecies = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const CARRIERS = (() => {
  const out = {};
  for (const s of dex.species.all()) {
    if (!legalSpecies(s)) continue;
    for (const a of Object.values(s.abilities || {})) (out[idOf(a)] = out[idOf(a)] || []).push(s.name);
  }
  return out;
})();
const abilitySrc = a => Object.keys(a).map(k => (typeof a[k] === 'function' ? String(a[k]) : '')).join(' ');
const FORME_ABILITIES = dex.abilities.all()
  .filter(a => a.exists && !a.isNonstandard && /formeChange\s*\(/.test(abilitySrc(a)))
  .map(a => ({ id: a.id, name: a.name, carriers: CARRIERS[a.id] || [] }));
const REFUSES_COPY = Object.entries(TAGSJSON.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('refusesCopy')).map(([k]) => k);

/* ---- CAN medicham2 EVEN BECOME THE TARGET FORME? ----------------------------------------------
 * Asked of the engine's own dex before a board is built, so an absent row is a DECLARED gap and not a
 * row that quietly reads "the forme did not change". */
require(D('data', 'engine-data.js'));
const MEDI = require(D('engine', 'medicham2-browser.js'));
const hasRow = key => { try { return !!MEDI.buildMon(key, {}); } catch (e) { return false; } };

/* ---- THE ROWS ---------------------------------------------------------------------------------- */
const ROWS = [
  { id: 'stancechange', ability: 'Stance Change', trigger: 'MID-BATTLE — an attacking click',
    from: 'aegislash', to: 'aegislash-blade', sdTo: 'aegislashblade', boundary: 1,
    nature: 'Adamant',
    why: "Will's own script: an attacking move takes Aegislash to Blade. The reverse (King's Shield "
       + 'back to Shield) is the second boundary of the same game, so one board tests both directions.',
    lead: n => mk('Aegislash', 'Stance Change', ['Iron Head', 'Kings Shield'], n),
    script: [{ p1: [{ m: 'ironhead', t: 0 }, idle()], p2: [idle(), idle()] },
             { p1: [{ m: 'kingsshield' }, idle()], p2: [idle(), idle()] }],
    back: { boundary: 2, to: 'aegislash', sdTo: 'aegislash' } },

  { id: 'zerotohero', ability: 'Zero to Hero', trigger: 'MID-BATTLE — switch OUT (the transform is on the way OUT)',
    from: 'palafin', to: 'palafin-hero', sdTo: 'palafinhero', boundary: 1,
    nature: 'Adamant', onBench: true,
    why: 'THE TRANSFORM IS ON THE WAY OUT, NOT THE WAY BACK, and that is exactly the defect this '
       + 'project already recorded once (2026-08-07: "Zero to Hero firing at the wrong MOMENT — '
       + 'Showdown transforms Palafin on switch-OUT; this engine does it on the return"). So the body '
       + 'is read OFF THE BENCH at the boundary after it left: the party row is the whole question, '
       + 'and an engine that waits for the return has a stale row here and a correct-looking one later.',
    /* GARCHOMP AND NOT CORVIKNIGHT: Corviknight is the ACTIVE partner on this board, and Showdown
     * answers a switch to an already-active body by refusing the choice — which the driver turns into
     * a `pass`, which Showdown then also refuses, and the game throws. The bench is [Garchomp,
     * Milotic]; that is where a switch has to aim. Found by the instrument on its own first run.
     *
     * AND THE RETURN LEG IS NOT SCRIPTABLE HERE, SAID RATHER THAN QUIETLY DROPPED. The driver stamps
     * medicham2's `_switchKey` at BUILD time and never changes it, while Showdown resolves a bench ask
     * against the body's CURRENT `species.id` — which for a Palafin that has already left is
     * `palafinhero`. So `{sw:'palafin'}` and `{sw:'palafinhero'}` each resolve on exactly one of the
     * two engines and the game throws on the other. That is a harness limitation, not an engine
     * finding, and it is why this row asserts the OUT leg. */
    lead: n => mk('Palafin', 'Zero to Hero', ['Jet Punch'], n),
    script: [{ p1: [{ sw: 'garchomp' }, idle()], p2: [idle(), idle()] }] },

  { id: 'megastone', ability: 'mega evolution', trigger: 'TURN ONE — the stone, on a choice',
    from: 'abomasnow', to: 'abomasnow-mega', sdTo: 'abomasnowmega', boundary: 1,
    nature: 'Jolly',
    why: 'the SAME three assertions on the other road into formeSwap. tests/test-nature-differential.js '
       + "PART 4 already pins this body's STAT LINE; what it does not ask is the PARTY ROW, and a mega "
       + 'that renames the standing body and leaves the bench row stale is invisible to it.',
    lead: n => mk('Abomasnow', 'Snow Warning', ['Ice Shard'], n, 'Abomasite'),
    script: [{ p1: [{ m: 'iceshard', t: 0, mega: true }, idle()], p2: [idle(), idle()] }] },

  /* ================= THE THREE THAT WERE UNCOVERABLE UNTIL 2026-08-22 ==========================
   * Every one of these printed `UNCOVERABLE ... data/engine-data.js has NO ROW for it` on every run
   * of this file since it was built. ROADMAP #204 added the five rows — mimikyu-busted,
   * morpeko-hangry, castform-sunny, castform-rainy, castform-snowy — each field DERIVED from
   * `Dex.forFormat('gen9championsvgc2026regmb')` and spliced in beside its base row, so these three
   * abilities can be ASSERTED for the first time instead of declared absent. */

  { id: 'disguise', ability: 'Disguise', trigger: 'MID-BATTLE — the first damaging hit taken',
    from: 'mimikyu', to: 'mimikyu-busted', sdTo: 'mimikyubusted', boundary: 1,
    nature: 'Adamant',
    why: 'THE FOE CLICKS, NOT THE SUBJECT. Every other row in this file is triggered by something the '
       + 'subject does; Disguise fires on a hit it RECEIVES, so the script is on p2 and the subject '
       + 'idles. Weavile\'s Ice Shard is Ice into Ghost/Fairy — neutral, so `eff > 0` and the guard '
       + 'that asks "would this move have connected damagingly" is satisfied — and it is priority, so '
       + 'it lands before anything else can change the board. The disguise absorbs the damage '
       + 'entirely and the body then pays maxhp/8, which is why no KO can end this game early.',
    foes: [mk('Weavile', 'Pressure', ['Ice Shard']), mk('Blastoise', 'Torrent', []),
           mk('Vivillon', 'Shield Dust', []), mk('Torkoal', 'White Smoke', [])],
    lead: n => mk('Mimikyu', 'Disguise', ['Play Rough'], n),
    script: [{ p1: [idle(), idle()], p2: [{ m: 'iceshard', t: 0 }, idle()] }] },

  { id: 'hungerswitch', ability: 'Hunger Switch', trigger: 'RESIDUAL — every turn, both ways',
    from: 'morpeko', to: 'morpeko-hangry', sdTo: 'morpekohangry', boundary: 1,
    nature: 'Jolly',
    why: 'NOBODY CLICKS ANYTHING. The flip is a residual and it ALTERNATES, so a fix that transformed '
       + 'once would be wrong from turn 2 onward — which is why this row carries a reverse leg on the '
       + 'second boundary exactly as Stance Change does. Both sides idle so nothing but the residual '
       + 'can move the board.',
    lead: n => mk('Morpeko', 'Hunger Switch', ['Aura Wheel'], n),
    script: [{ p1: [idle(), idle()], p2: [idle(), idle()] },
             { p1: [idle(), idle()], p2: [idle(), idle()] }],
    back: { boundary: 2, to: 'morpeko', sdTo: 'morpeko' } },

  { id: 'forecast', ability: 'Forecast', trigger: 'THE SKY — a foe\'s Drought, from turn zero',
    from: 'castform', to: 'castform-sunny', sdTo: 'castformsunny', boundary: 1,
    nature: 'Modest',
    why: 'THE TRIGGER IS ON THE OTHER SIDE OF THE FIELD AND IT IS ALREADY UP BEFORE TURN ONE. Torkoal '
       + 'is the default foe partner and its Drought fires on switch-in, so the sky is sun at the '
       + 'first boundary and no click is needed. Castform is the ONE member of this family whose '
       + 'formes differ in TYPE and not in stats, which is the whole reason A4 exists — without it '
       + 'this row could only be judged on its species label.',
    lead: n => mk('Castform', 'Forecast', ['Facade'], n),
    script: [{ p1: [idle(), idle()], p2: [idle(), idle()] }],
    /* DECLARED KNOWN-OPEN, MEASURED 2026-08-22, AND IT IS NOT THIS DIVISION'S TO CLOSE TODAY.
     *
     * A1 is red and A4 is green, and that pair is the whole diagnosis: medicham2 applies the RIGHT
     * TYPE and does not move the species LABEL. It is deliberate and it is documented at
     * medicham2-browser.js's `syncWeatherFormes` — the retype model was chosen precisely BECAUSE
     * data/engine-data.js had no castform-sunny/rainy/snowy row to `formeSwap` into, and the engine
     * counts every application as `formeWeatherNameUnchanged` rather than leaving it to be discovered.
     *
     * THE ROWS NOW EXIST AND THE ENGINE STILL DOES NOT READ THEM. Measured on this pass with a
     * control release that had the five rows excised: `weatherRetyped +1, formeWeatherNameUnchanged
     * +1` on BOTH arms, byte-identical — `syncWeatherFormes` never calls `formeSwap` and never
     * consults a row, so adding the rows changed nothing here. Closing this means editing
     * `engine/medicham2-browser.js`, which was owned by another agent on the day this row landed.
     * ROADMAP #204's remaining half. */
    knownOpen: { A1: {
      measured: ['active slot: ours castform, authority castformsunny',
                 'party row: the authority carries castformsunny on its bench list'],
      owed: 'medicham2-browser.js syncWeatherFormes models Forecast as a RETYPE and leaves the '
          + 'species label alone (counted as formeWeatherNameUnchanged). The three castform-* rows '
          + 'now exist, so the retype can become a formeSwap — engine change, not a data change.' } } },
];

/* ---- THE PLANTS — one per assertion, so each is shown red ALONE --------------------------------
 * Applied to medicham2's LIVE state at the boundary, before anything is read, because a plant applied
 * to the OUTPUT would prove only that a comparison can subtract. */
const PLANTS = {
  'A1-active': { on: 'A1', why: 'the standing body keeps the OLD forme name',
    apply: (S, row) => { const m = (S.actA || [])[0]; if (m) m.name = row.from; } },
  'A1-party': { on: 'A1', why: 'the standing body is renamed and the PARTY ROW is left stale',
    apply: (S, row) => { const t = ((S.sfA || {}).team || []); if (t[0]) t[0] = { ...t[0], name: row.from }; } },
  'A2-base': { on: 'A2', why: 'the stat line is left on the OLD forme entirely',
    apply: (S) => { const m = (S.actA || [])[0]; if (m) m.st = { ...m.st, at: m.st.at - 40 }; } },
  'A3-spread': { on: 'A3', why: "the investment is dropped and the NEW forme's bare line is adopted",
    apply: (S, row) => { const m = (S.actA || [])[0]; const r = dex.species.get(row.to);
      if (m && r && r.exists) m.st = { ...m.st, at: MEDI.natureL50(r.baseStats, 'Serious').at }; } },
  /* THE OBVIOUS PLANT HERE — "keep the OLD forme's types" — IS INERT ON THE ROW THE RED DEMO USES,
   * and an inert plant is a green test asking nothing (CLAUDE.md's own lesson). Aegislash and
   * Aegislash-Blade are both Steel/Ghost, Palafin and Palafin-Hero are both Water, Abomasnow and
   * Abomasnow-Mega are both Grass/Ice — all three of this file's original rows change NO type, which
   * is precisely why A4 did not exist until a Castform row needed it. So the plant is a type line
   * that is wrong for every forme in this file, and the leak check below is what proves it stays
   * inside A4. */
  'A4-types': { on: 'A4', why: 'the type line is replaced by one no forme in this file carries',
    apply: (S, row) => { const m = row.onBench
        ? (((S.sfA || {}).team) || []).find(x => x && (idOf(x.name) === idOf(row.to) || idOf(x.name) === idOf(row.from)))
        : (S.actA || [])[0];
      if (m) m.types = ['Bug']; } },
};

function statsOf(p) {
  return { hp: p.maxhp, at: p.storedStats.atk, df: p.storedStats.def,
           sa: p.storedStats.spa, sd: p.storedStats.spd, sp: p.storedStats.spe };
}
function readAt(row, nature, boundary, plant) {
  const G = SB.harness(null);
  const sheet = [row.lead(nature)].concat(FILL);
  /* NO HP BOOST, AND THAT IS A CORRECTION THE INSTRUMENT MADE TO ITSELF. At `hpBoost: 4` the mega row
   * read `hp: ours 660, authority 165` — 165 x 4 against 165 — because the harness's boost is applied
   * to the BUILT body and Showdown's `setSpecies` recomputes `maxhp` from the species on a permanent
   * forme change, wiping it. That is a FIXTURE artefact and it would have been published as an engine
   * defect. Nothing on these boards attacks the subject, so the boost buys nothing here. */
  const A = G.buildPair(sheet, { hpBoost: 1 }), B = G.buildPair(row.foes || FOES, { hpBoost: 1 });
  if (!A || !B) return { bad: 'NOT-STAGED', why: 'buildPair returned null for a side' };
  let seen = null;
  const r = G.playGame(A, B, 'directed', 'formeassert:' + row.id, { script: row.script,
    onBoundary: (snap, t, S, battle) => {
      if (t === boundary) {
        if (plant) PLANTS[plant].apply(S, row);
        /* THE SUBJECT IS NOT ALWAYS THE STANDING BODY. Zero to Hero transforms on the way OUT, so its
         * subject is a BENCH row — found by species in each engine's own party list, never by index,
         * because the two engines order a bench differently once something has left. */
        const m = row.onBench
          ? (((S.sfA || {}).team) || []).find(x => x && (idOf(x.name) === idOf(row.to) || idOf(x.name) === idOf(row.from)))
          : (S.actA || [])[0];
        const p = row.onBench
          ? battle.sides[0].pokemon.find(x => idOf(x.species.id) === idOf(row.sdTo)
              || idOf(x.species.id) === idOf(row.from))
          : battle.sides[0].active[0];
        if (!m || !p) return;
        seen = { medi_active: idOf(m && m.name), sd_active: idOf(p && p.species && p.species.id),
                 medi_party: (((S.sfA || {}).team) || []).map(x => idOf(x.name)),
                 sd_party: battle.sides[0].pokemon.map(x => idOf(x.species.id)),
                 medi_st: { ...m.st }, sd_st: statsOf(p),
                 medi_types: (m.types || []).map(x => String(x).toLowerCase()),
                 sd_types: (p.getTypes ? p.getTypes() : p.types || []).map(x => String(x).toLowerCase()) };
      }
      snap.identical = true; snap.diffs = [];
    } });
  if (r.err) return { bad: 'THREW', why: r.err };
  if (r.turns !== row.script.length) return { bad: 'SHORT',
    why: 'the script declares ' + row.script.length + ' turn(s) and ' + r.turns + ' were played' };
  if (!seen) return { bad: 'SHORT', why: 'boundary ' + boundary + ' was never taken' };
  return seen;
}

/* ---- THE THREE ASSERTIONS ---------------------------------------------------------------------- */
function assertForme(s, row, to, sdTo) {
  const out = [];
  if (s.sd_active !== idOf(sdTo)) out.push('THE AUTHORITY DID NOT CHANGE FORME EITHER — it stands as '
    + s.sd_active + ', so the FIXTURE never reached the trigger and nothing here is about the engine');
  if (s.medi_active !== idOf(to)) out.push('active slot: ours ' + s.medi_active + ', authority ' + s.sd_active);
  const mp = s.medi_party.includes(idOf(to)), sp = s.sd_party.includes(idOf(sdTo));
  if (sp && !mp) out.push('party row: the authority carries ' + idOf(sdTo) + ' on its bench list ['
    + s.sd_party.join(' ') + '] and ours does not [' + s.medi_party.join(' ') + ']');
  return out;
}
function assertStats(s, label) {
  const out = [];
  for (const k of ['hp', 'at', 'df', 'sa', 'sd', 'sp'])
    if (s.medi_st[k] !== s.sd_st[k]) out.push(label + ' ' + k + ': ours ' + s.medi_st[k]
      + ', authority ' + s.sd_st[k]);
  return out;
}
/* A4 — THE TYPE LINE, AND IT IS NOT TIDINESS EITHER (ROADMAP #204, 2026-08-22).
 *
 * A1 asks for the NAME, A2/A3 ask for the STATS. A forme whose stats do not move and whose TYPE does
 * is invisible to all three — and that is exactly the Castform family, whose three formes are
 * byte-identical in base stats to Castform (derived, not assumed: `sameStats: true` in
 * data/tags.json, and this pass re-derived it off `Dex.forFormat` before adding the rows). Without
 * this assertion a Forecast row could only ever be judged on its species label, which would have
 * scored medicham2's deliberate retype model as a total failure and said nothing about whether the
 * type it actually applies is the right one. */
function assertTypes(s) {
  const a = (s.medi_types || []).join('/'), b = (s.sd_types || []).join('/');
  return a === b ? [] : ['types: ours [' + a + '], authority [' + b + ']'];
}

/* ---- RUN --------------------------------------------------------------------------------------- */
const results = [];
let failed = 0, uncoverable = 0, knownOpen = 0;
const say = (...a) => { if (!JSONOUT) console.log(...a); };

say('\nFORME ABSOLUTE-ASSERTION MODE — subject against the authority, no control arm\n');
say('  THE CLASS, DERIVED — abilities the format flags uncopyable (`refusesCopy`): ' + REFUSES_COPY.length);
say('    ' + REFUSES_COPY.join(', '));
say('  OF THOSE AND EVERY OTHER, the ones whose handler calls formeChange(), with a LEGAL carrier here:');
for (const f of FORME_ABILITIES)
  say('    ' + (f.carriers.length ? 'IN SCOPE  ' : 'no carrier') + '  ' + f.id
      + (f.carriers.length ? '  [' + f.carriers.join(', ') + ']' : ''));

say('\n  THE ENGINE\'S OWN DEX — can medicham2 become the target forme at all?');
for (const f of FORME_ABILITIES) {
  if (!f.carriers.length) continue;
  const targets = f.carriers.map(c => idOf(c)).filter(c => !ROWS.some(r => idOf(r.from) === c));
  for (const t of targets) {
    const key = f.carriers.find(c => idOf(c) === t);
    const k = String(key).toLowerCase().replace(/\s+/g, '');
    if (!hasRow(k) && !hasRow(k.replace(/^([a-z]+)/, '$1-'))) {
      uncoverable++;
      say('    UNCOVERABLE  ' + f.id + ' -> ' + key + ' — data/engine-data.js has NO ROW for it, so '
        + 'there is no body to become. NOT a pass and NOT an engine finding: a gap in a generated '
        + 'artifact ENGINE may not edit.');
    }
  }
}

say('');
for (const row of ROWS) {
  const rec = { id: row.id, ability: row.ability, trigger: row.trigger, assertions: {} };
  const run = (nature, boundary, to, sdTo, plant) => {
    const s = readAt(row, nature, boundary, plant);
    if (s.bad) return { bad: s.bad + ' — ' + s.why };
    return { s };
  };
  /* A1 and A2 ride the NEUTRAL body; A3 rides the natured one. Two games, three assertions. */
  const flat = run('Serious', row.boundary, row.to, row.sdTo);
  const nat = run(row.nature, row.boundary, row.to, row.sdTo);
  if (flat.bad || nat.bad) {
    rec.verdict = 'COULD-NOT-STAGE'; rec.why = flat.bad || nat.bad; failed++;
    say('  COULD-NOT-STAGE  ' + row.id + ' — ' + rec.why);
    results.push(rec); continue;
  }
  const a1 = assertForme(flat.s, row, row.to, row.sdTo);
  const a2 = assertStats(flat.s, 'neutral');
  const a3 = assertStats(nat.s, row.nature);
  const a4 = assertTypes(flat.s);
  let a1b = [], a4b = [];
  if (row.back) {
    const bk = run('Serious', row.back.boundary, row.back.to, row.back.sdTo);
    a1b = bk.bad ? ['the reverse leg did not run: ' + bk.bad]
                 : assertForme(bk.s, row, row.back.to, row.back.sdTo);
    a4b = bk.bad ? [] : assertTypes(bk.s).map(x => 'reverse leg — ' + x);
  }
  rec.assertions = { A1: a1.concat(a1b), A2: a2, A3: a3, A4: a4.concat(a4b) };
  rec.observed = { neutral: flat.s.medi_st, neutral_authority: flat.s.sd_st,
                   natured: nat.s.medi_st, natured_authority: nat.s.sd_st, nature: row.nature,
                   types: flat.s.medi_types, types_authority: flat.s.sd_types };
  /* A DECLARED KNOWN-OPEN IS NOT A PASS AND IT IS NOT A FILED FAILURE EITHER. A row may name an
   * assertion it is known to fail, with the MEASURED text of that failure and the reason the fix does
   * not belong to this file. It still prints RED beside the assertion, it still keeps the row out of
   * the AGREES count, and it is carried into the artifact under its own key — it simply does not
   * exit non-zero, because "red until somebody else's division lands" is the state CLAUDE.md bans
   * REPORTING, not the state itself. If the declared text stops matching what is measured, the row
   * goes red for real: a stale declaration cannot silence anything. */
  const declared = {};
  for (const k of ['A1', 'A2', 'A3', 'A4']) {
    const d = (row.knownOpen || {})[k];
    if (!d || !rec.assertions[k].length) continue;
    /* PAIRWISE AND EXHAUSTIVE. `measured` is one pattern PER OBSERVED LINE, matched in order, and the
     * counts must be equal — so a declaration cannot swallow a SECOND, different failure that turns
     * up later on the same assertion. A loose single-substring match ("castformsunny appears
     * somewhere") would have done exactly that. */
    if (rec.assertions[k].length === d.measured.length
        && rec.assertions[k].every((line, i) => line.indexOf(d.measured[i]) >= 0)) {
      declared[k] = { measured: d.measured, owed: d.owed, observed: rec.assertions[k] };
      rec.assertions[k] = [];
    }
  }
  rec.known_open = declared;
  const bad = rec.assertions.A1.length + rec.assertions.A2.length + rec.assertions.A3.length
            + rec.assertions.A4.length;
  rec.verdict = bad ? 'DIFFERS' : (Object.keys(declared).length ? 'KNOWN-OPEN' : 'AGREES');
  if (bad) failed++;
  if (Object.keys(declared).length) knownOpen++;
  const mark = k => (declared[k] ? 'RED (DECLARED KNOWN-OPEN)  ' + declared[k].observed.join(' | ')
                                  + '   OWED: ' + declared[k].owed : null);
  say('  ' + (bad ? 'DIFFERS ' : (Object.keys(declared).length ? 'KNOWN-OPEN' : 'AGREES  '))
      + ' ' + row.id + '   ' + row.trigger);
  say('        ' + row.why);
  say('        A1 forme changed (active + party)   ' + (mark('A1') || (a1.concat(a1b).length ? 'RED  ' + a1.concat(a1b).join(' | ') : 'ok')));
  say('        A2 the base line is the new forme\'s ' + (mark('A2') || (a2.length ? 'RED  ' + a2.join(' | ') : 'ok')));
  say('        A3 the body\'s own spread survived   ' + (mark('A3') || (a3.length ? 'RED  ' + a3.join(' | ') : 'ok'))
      + '   [' + row.nature + ']');
  say('        A4 the type line is the new forme\'s ' + (mark('A4') || (a4.concat(a4b).length ? 'RED  ' + a4.concat(a4b).join(' | ') : 'ok')));
  results.push(rec);
}

/* ---- THE RED DEMONSTRATION --------------------------------------------------------------------- */
let redsMissed = 0;
if (REDS) {
  say('\n  --reds — EACH ASSERTION AGAINST ITS OWN PLANT. A plant that only one assertion catches is');
  say('  the proof that the three are three and not one.');
  const row = ROWS[0];
  for (const [name, pl] of Object.entries(PLANTS)) {
    const flat = readAt(row, 'Serious', row.boundary, name);
    const nat = readAt(row, row.nature, row.boundary, name);
    if (flat.bad || nat.bad) { say('    ' + name + '   COULD-NOT-STAGE'); redsMissed++; continue; }
    const caught = { A1: assertForme(flat, row, row.to, row.sdTo).length > 0,
                     A2: assertStats(flat, 'neutral').length > 0,
                     A3: assertStats(nat, row.nature).length > 0,
                     A4: assertTypes(flat).length > 0 };
    /* the plant must be caught by ITS OWN assertion. A2's plant necessarily shows in A3 as well —
     * both read a stat line — so only the OWNER is required, and what is required of the others is
     * that A1's plants leave the STATS alone and A3's plant leaves the FORME alone. */
    const own = caught[pl.on];
    const leaks = Object.entries(caught).filter(([k, v]) => v && k !== pl.on
      && !(pl.on === 'A2' && k === 'A3')).map(([k]) => k);
    const ok = own && !leaks.length;
    if (!ok) redsMissed++;
    say('    ' + (ok ? 'ok   ' : 'MISS ') + name + '  (' + pl.why + ')  caught by '
      + Object.entries(caught).filter(([, v]) => v).map(([k]) => k).join('+') + ' — owner ' + pl.on
      + (leaks.length ? '; LEAKED into ' + leaks.join('+') : ''));
  }
}

/* ---- WHAT MAY BE PUBLISHED, AND BY WHICH RUN — 2026-08-23 -------------------------------------
 * This file used to write data/forme-assert.json and THEN exit 1, so a red run published an artifact
 * carrying no field at all that said the run had failed. Two different reds were being treated alike,
 * and only one of them is a finding:
 *
 *   `failed`      A FORME DISAGREES WITH THE AUTHORITY. The instrument worked; the disagreement is
 *                 the measurement, and the rows below are the only record of WHICH forme. This still
 *                 publishes — suppressing it would delete the finding — but it now stamps a run
 *                 status, so no consumer can mistake it for a clean run. (engine/provenance.js sweeps
 *                 data/*.json on freshness and web/quarantine-data.js lists this file by name;
 *                 neither could previously tell the two apart.)
 *   `redsMissed`  AN ASSERTION FAILED TO CATCH A PLANT AIMED AT IT. That is the instrument failing
 *                 the test of its own trustworthiness, exactly like the planted-divergence proof in
 *                 tests/test-game-diff.js. Nothing it measured means anything, so it publishes
 *                 NOTHING and the artifact on disk is left alone.
 *
 * WRITE-POLICY: findings — a disagreeing row IS the measurement and publishes with `run_ok:false`;
 * a run whose own plant went uncaught refuses to write at all. */
if (redsMissed) {
  say('\n  REFUSED to write data/forme-assert.json — ' + redsMissed + ' plant(s) went uncaught by the '
    + 'assertion that owns them. An assertion that cannot see a defect planted in it is not evidence '
    + 'about any forme, so none of the rows above is published. The artifact on disk is left as it was.');
  say('\nFORME ASSERT: RED');
  process.exit(1);
}

const art = { generated: new Date().toISOString(),
  by: 'tests/test-forme-assert.js',
  what: 'the forme absolute-assertion mode — four assertions against the authority, no control arm',
  write_policy: 'FINDINGS. A disagreement with the authority IS the measurement and is published with '
      + 'run_ok:false. A run in which a plant went uncaught (--reds) publishes nothing — the '
      + 'instrument failed its own proof and its rows are not evidence.',
  run_ok: !failed,
  failed,
  refuses_copy: REFUSES_COPY,
  forme_abilities: FORME_ABILITIES,
  uncoverable_for_want_of_an_engine_data_row: uncoverable,
  known_open_rows: knownOpen,
  rows: results, reds_run: REDS, reds_missed: redsMissed };
fs.writeFileSync(D('data', 'forme-assert.json'), JSON.stringify(art, null, 1));
if (JSONOUT) console.log(JSON.stringify(art, null, 1));

say('\n  wrote data/forme-assert.json');
say('  ' + (results.length - failed - knownOpen) + ' of ' + results.length + ' rows agree with the '
  + 'authority on all four assertions; ' + knownOpen + ' carry a DECLARED KNOWN-OPEN assertion (red, '
  + 'named, not a pass); ' + uncoverable + ' forme(s) uncoverable for want of an engine-data row.');
if (failed || redsMissed) { say('\nFORME ASSERT: RED'); process.exit(1); }
say('\nFORME ASSERT: ' + (knownOpen ? 'no undeclared disagreement; ' + knownOpen
    + ' declared KNOWN-OPEN row(s) above' : 'all rows agree'));
