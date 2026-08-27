/* probe_party_key_collision.js — TWO BODIES, ONE PARTY ROW.
 *
 *   SHOWDOWN_PATH=... node tests/probe_party_key_collision.js
 *
 * WHERE THIS CAME FROM. `engine/board_state.js`'s `partyMap` keys the party BY THE DISPLAYED SPECIES,
 * and its own header says why an INDEX is wrong (Showdown reorders `side.pokemon` on every switch-in;
 * index-matching manufactured 123 diverging games of 179). The header then leans on Species Clause to
 * argue the name is unique — and it is, of the bodies a side BROUGHT. It is not unique of the bodies
 * a side is HOLDING, because seven abilities in this format rewrite a displayed name mid-game:
 * Disguise, Forecast, Hunger Switch, Illusion, Imposter, Stance Change, Zero to Hero.
 *
 * `duplicate_species_in_party` HAS READ 20 ON EVERY PINNED 961-GAME RUN AND NOTHING ACTED ON IT.
 * A collision is not a cosmetic tally: the second row OVERWRITES the first, so one of the two bodies
 * is compared against the other engine's OTHER body and the survivor is decided by which of them
 * `sf.team` / `side.pokemon` happens to list last. On the pinned pool that was one of the two
 * remaining board-parted games:
 *
 *     p2.party.garchomp.hp     medi 123   sd 183
 *     p2.party.garchomp.maxhp  medi 123   sd 183
 *     p2.party.garchomp.item   medi lifeorb   sd choicescarf
 *     p2.party.garchomp.boosts.atk  medi -2   sd 0
 *
 * — one engine's row describing a transformed Ditto (its own 123 HP, its own Life Orb) and the
 * other's describing the real Garchomp it had copied (183, Choice Scarf). Four leaves that read as
 * four rule disagreements and are ONE reader losing a body.
 *
 * WHAT THIS PROBE ASSERTS, AND WHAT IT REFUSES TO ASSERT. It asserts the FIX, which since
 * 2026-08-26 is the DEFAULT: both bodies survive as separate rows in BOTH engines, the identity of
 * every row comes off a stamp rather than off display state, and the rename itself becomes a compared
 * leaf. It does NOT assert that the display key collides — it MEASURES that under the
 * `MEDI_PARTY_KEY_DISPLAY=1` control and prints it. A test that asserts the old behaviour is a test
 * that pins the bug, which is a failure mode this division has a written name for.
 *
 * THE ARMS SWAPPED WHEN THE RE-KEY LANDED. The PARENT is now the default identity keying and carries
 * the assertions; the CHILD is the display control and only measures. Nothing else about the fixture
 * changed, so a green parent here is the same claim it was before the flip.
 *
 * TWO PROCESSES, BECAUSE THE KNOB IS READ AT MODULE LOAD. `board_state.js` reads the env var once
 * when it is required, and `game_differential.js` holds its own reference to it, so flipping
 * `process.env` mid-run would change nothing and would look exactly like a knob that does not matter.
 * The second arm is a CHILD, and the parent fails if the child does not answer.
 *
 * THE FIXTURE IS CONSTRUCTED, NOT FOUND, and nothing in it is typed: the copier is derived as the
 * legal carrier of the transform-on-entry ability, and the copied body as a legal species the copier's
 * own side ALSO brings — which is the whole shape of the collision.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

/* THE CHILD IS THE DISPLAY CONTROL. The parent runs the shipped default, which is identity. */
const CHILD = process.env.MEDI_PARTY_KEY_DISPLAY === '1';

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const BS = require(D('engine', 'board_state.js'));
const M = require(D('engine', 'medicham2-browser.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---- THE FIXTURE, DERIVED ------------------------------------------------------------------------
 * The COPIER is the legal body carrying the ability whose tag says it transforms on entry — read off
 * data/tags.json rather than named, so a second carrier arriving in a later regulation is picked up
 * instead of being silently missed. The COPIED body is the slowest legal species that learns a move
 * both sides can click, and it is put on BOTH sides: opposite the copier so it is what gets copied,
 * and on the copier's own bench so the two rows collide. */
const TAGS = require(D('data', 'tags.json'));
const TRANSFORMERS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('transformsOnEntry')).map(([k]) => k);
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');
console.log('  abilities tagged transformsOnEntry: ' + (TRANSFORMERS.join(', ') || '(none)'));
if (!TRANSFORMERS.length) {
  console.log('  NO ABILITY IN data/abra-tags.js CARRIES transformsOnEntry — a claim about the artifact, '
    + 'not about the engine. Nothing staged.');
  process.exit(2);
}

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));

const COPIER = POOL.find(s => Object.values(s.abilities).some(a => TRANSFORMERS.includes(norm(a))));
if (!COPIER) { console.log('  NO LEGAL BODY CARRIES ANY transformsOnEntry ABILITY — a claim about the fixture.'); process.exit(2); }
const COPIER_ABILITY = Object.values(COPIER.abilities).find(a => TRANSFORMERS.includes(norm(a)));

/* The copied body must learn Protect so BOTH sides can hold a turn without the fixture turning into a
 * damage question, and it must not be the copier itself. */
const COPIED = POOL.filter(s => s.name !== COPIER.name && LEARNS(s, 'protect')
  && Object.values(s.abilities).every(a => !TRANSFORMERS.includes(norm(a))))
  .sort((a, b) => a.baseStats.hp - b.baseStats.hp)[0];
if (!COPIED) { console.log('  NO LEGAL BODY TO COPY — a claim about the fixture.'); process.exit(2); }

const FILLER = POOL.filter(s => LEARNS(s, 'protect') && s.name !== COPIER.name && s.name !== COPIED.name)
  .slice(0, 2);
if (FILLER.length < 2) { console.log('  NOT ENOUGH LEGAL FILLER — a claim about the fixture.'); process.exit(2); }

console.log('  copier : ' + COPIER.name + '  ability ' + COPIER_ABILITY + '  maxhp base ' + COPIER.baseStats.hp);
console.log('  copied : ' + COPIED.name + '  — stands OPPOSITE the copier AND sits on the copier\'s own bench,');
console.log('           which is what makes the two rows collide once the copier takes its name');
console.log('  keying this process: ' + (CHILD ? 'DISPLAY (MEDI_PARTY_KEY_DISPLAY=1, the control)' : 'IDENTITY (the default)')
  + '   board_state reports PARTY_KEY_IDENTITY=' + BS.PARTY_KEY_IDENTITY);
if (CHILD === !!BS.PARTY_KEY_IDENTITY) {
  console.log('  RED — the knob this process asked for is not the knob board_state.js is running.');
  process.exit(1);
}

/* ---- THE ARM -------------------------------------------------------------------------------------
 * TWO DIFFERENT ITEMS AND A BOOST, because the collision is only VISIBLE where the two bodies differ.
 * A Ditto and a Garchomp holding the same item and the same HP would overwrite each other silently
 * and the probe would agree with itself. */
const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
const SHEET_COPIER_SIDE = [
  mon(COPIER.name, ['Protect'], 'Life Orb', COPIER_ABILITY),
  mon(COPIED.name, ['Protect'], 'Choice Scarf'),
  mon(FILLER[0].name, ['Protect']),
  mon(FILLER[1].name, ['Protect']),
];
/* THE COPIED BODY SITS IN THE FOE'S SLOT **B**, NOT SLOT A, AND THE FIRST VERSION OF THIS FIXTURE HAD
 * IT WRONG. Imposter copies the body DIAGONALLY opposite, so a copier in slot a copies the foe's
 * slot b. With the copied species in slot a the arm still went green — because the derived filler
 * happened to be the body that actually got copied — which is precisely the shape of a probe agreeing
 * with itself. */
const SHEET_FOE_SIDE = [
  mon(FILLER[0].name, ['Protect']),
  mon(COPIED.name, ['Protect'], 'Sitrus Berry'),
  mon(FILLER[1].name, ['Protect']),
  mon(COPIER.name, ['Protect'], 'Leftovers', COPIER_ABILITY),
];

const a = G.buildPair(SHEET_COPIER_SIDE), b = G.buildPair(SHEET_FOE_SIDE);
if (!a || !b) { console.log('  COULD NOT BUILD THE PAIR — a claim about the fixture.'); process.exit(2); }

const seen = [];
const r = G.playGame(a, b, 'directed', 'partykey/' + (CHILD ? 'display' : 'identity'), {
  arm: G.ARM_BY_ID.get('middle'),
  script: [null, null, null],
  onBoundary: (snap, turnIdx, S, battle) => {
    seen.push({
      turn: turnIdx,
      /* THE PARTY AS EACH READER PRODUCES IT — never re-derived here. The question is what the
       * comparator holds, so the comparator's own output is what is read. */
      medi_keys: Object.keys(snap.medi.sides.p1.party),
      sd_keys: Object.keys(snap.sd.sides.p1.party),
      medi_display: (S.actA || []).filter(Boolean).map(m => norm(m.name)),
      sd_display: (battle.p1.active || []).filter(Boolean).map(p => norm(p.species.id)),
      medi_rows: snap.medi.sides.p1.party,
      identical: snap.identical,
      diffs: (snap.diffs || []).map(d => d.path),
    });
  },
});
if (r.err) { console.log('  THE GAME THREW: ' + r.err); process.exit(1); }
if (!seen.length) { console.log('  NO TURN BOUNDARY WAS EVER TAKEN — the probe measured nothing.'); process.exit(1); }

const FAILS = {};
BS.snapshot ? null : null;   // (the failure object rides on the ctx game_differential owns)

const last = seen[seen.length - 1];
console.log('\n  === WHAT THE READER HOLDS, at the last boundary (turn ' + last.turn + ') ===');
console.log('  the copier\'s side is displaying : ' + last.medi_display.join(', ')
  + '   (showdown: ' + last.sd_display.join(', ') + ')');
console.log('  medicham2 party keys : ' + last.medi_keys.join(', '));
console.log('  showdown  party keys : ' + last.sd_keys.join(', '));

/* THE COPIER'S OWN SLOT, NOT THE SIDE. Asking whether the copied NAME appears anywhere on this side
 * is always true — the copied body is on the bench by construction — so that question passes on a
 * fixture where nothing ever transformed. Slot a is the copier's. */
const meRenamed = last.medi_display[0] && last.medi_display[0] !== norm(COPIER.name);
const sdRenamed = last.sd_display[0] && last.sd_display[0] !== norm(COPIER.name);
let bad = 0;

/* THE ARM MUST HAVE HAPPENED. A fixture where nothing ever transformed would show four clean rows on
 * both keyings and read as a pass — the strongest way this probe could lie to itself. */
if (!meRenamed || !sdRenamed) {
  console.log('\n  RED — NOTHING TRANSFORMED (medicham2 renamed: ' + !!meRenamed + ', showdown renamed: '
    + !!sdRenamed + '). The copier never took another body\'s name, so the collision was never staged '
    + 'and neither keying was tested.');
  bad++;
}
/* AND IT MUST HAVE COLLIDED. A transform onto a name this side does NOT also carry produces four
 * distinct rows under either keying, so the fixture would test nothing while looking staged. */
if (last.medi_display[0] !== norm(COPIED.name)) {
  console.log('\n  RED — THE COPIER TOOK ' + JSON.stringify(last.medi_display[0]) + ', NOT '
    + JSON.stringify(norm(COPIED.name)) + '. The body it copied is not the one on its own bench, so '
    + 'no two rows can collide and the fixture is staging a different question.');
  bad++;
}

console.log('\n  === THE VERDICT ===');
if (CHILD) {
  /* MEASURED, NOT ASSERTED. See the header: asserting the collision would pin the bug. */
  const lost = 4 - last.medi_keys.length;
  console.log('  DISPLAY KEY — medicham2 holds ' + last.medi_keys.length + ' of 4 party rows'
    + (lost > 0 ? '  <- ' + lost + ' BODY LOST TO A COLLISION' : '  (no collision on this board)'));
  console.log('  DISPLAY KEY — showdown  holds ' + last.sd_keys.length + ' of 4 party rows');
  console.log('  this arm asserts nothing about the collision; the PARENT arm, on the shipped default, asserts the fix.');
} else {
  const need = (what, got, want) => {
    const ok = got === want;
    console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + got + (ok ? '' : '  (wanted ' + want + ')'));
    if (!ok) bad++;
  };
  need('IDENTITY KEY: medicham2 holds every body it brought', last.medi_keys.length, 4);
  need('IDENTITY KEY: showdown holds every body it brought', last.sd_keys.length, 4);
  /* THE ROWS MUST BE THE SAME FOUR IN BOTH ENGINES, or the party is keyed on something that is not
   * shared and the comparison is against whichever row happened to line up. */
  const same = JSON.stringify([...last.medi_keys].sort()) === JSON.stringify([...last.sd_keys].sort());
  console.log('  ' + (same ? 'green' : 'RED  ') + '  IDENTITY KEY: both engines key the party on the SAME four bodies');
  if (!same) bad++;
  /* AND THE RENAME IS NOW A LEAF RATHER THAN A LOST ROW. */
  const row = last.medi_rows[norm(COPIER.name)];
  const carries = !!(row && typeof row.species === 'string');
  console.log('  ' + (carries ? 'green' : 'RED  ') + '  IDENTITY KEY: the copier\'s row carries its DISPLAYED species as a compared leaf'
    + (row ? ' — ' + JSON.stringify(row.species) : ' — THE COPIER HAS NO ROW UNDER ITS OWN IDENTITY'));
  if (!carries) bad++;
  const renamed = carries && row.species !== norm(COPIER.name);
  console.log('  ' + (renamed ? 'green' : 'RED  ') + '  IDENTITY KEY: ...and that leaf shows the rename rather than the identity');
  if (!renamed) bad++;
}

if (!CHILD) {
  /* ---- THE OTHER KEYING, IN A CHILD --------------------------------------------------------------
   * Spawned rather than toggled, because the knob is read at module load. The parent FAILS if the
   * child does not answer: a silent child is indistinguishable from a passing one. */
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_PARTY_KEY_DISPLAY=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [__filename],
    { env: { ...process.env, MEDI_PARTY_KEY_DISPLAY: '1' }, encoding: 'utf8' });
  process.stdout.write(String(c.stdout || '').split('\n').map(l => '  |' + l).join('\n'));
  if (c.stderr) process.stderr.write(String(c.stderr));
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (c.status !== 0) { console.log('\n  RED — the display-control arm failed (exit ' + c.status + ').'); bad++; }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
