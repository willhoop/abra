/* probe_afterfaint_boundary.js — WHEN DOES THE ON-KO BOOST GET PAID, HOW BIG IS IT, AND DOES IT GET
 * PAID AT ALL ONCE THE BATTLE IS OVER?  2026-08-29, card D3 (cards 215 and 216 of
 * data/verification/divergence-turns.empirical.json).
 *
 *   SHOWDOWN_PATH=... node tests/probe_afterfaint_boundary.js                 # freezes the LIVE tree
 *   SHOWDOWN_PATH=... node tests/probe_afterfaint_boundary.js --release <id>  # a named release
 *   MEDI_AFTERFAINT_PER_TARGET=1 SHOWDOWN_PATH=... node tests/probe_afterfaint_boundary.js   # RED
 *
 * ================= THE AUTHORITY, READ WHOLE RATHER THAN RECALLED ===============================
 *
 * `sim/battle.ts:2532` `faintMessages()`. Champions overrides eight files and `abilities`,
 * `conditions` and `scripts` were all read for this; NONE of them touches `faintMessages`,
 * `checkWin` or the three abilities below, so mainline IS the authority here and that is a checked
 * statement rather than an assumption.
 *
 *     faintMessages(lastFirst = false, forceCheck = false, checkWin = true) {
 *       if (this.ended) return;
 *       const length = this.faintQueue.length;                                       :2534
 *       ...
 *       while (this.faintQueue.length) {            <- EVERY `|faint|` LINE IS WRITTEN IN HERE
 *         ...
 *         this.add('faint', pokemon);                                                :2549
 *         if (pokemon.side.pokemonLeft) pokemon.side.pokemonLeft--;
 *         this.runEvent('Faint', pokemon, faintData.source, faintData.effect);       :2551
 *       }
 *       ...
 *       if (checkWin && this.checkWin(faintData)) return true;                        :2592
 *       if (faintData && length) {
 *         this.runEvent('AfterFaint', faintData.target, faintData.source,
 *                       faintData.effect, length);                                    :2596
 *       }
 *
 * THREE STATEMENTS, AND THIS ENGINE DISAGREED WITH ALL THREE:
 *
 *   1. `AfterFaint` IS BELOW THE WHOLE `while` LOOP. Every `|faint|` of the drain is already on the
 *      wire before the event is raised. This engine paid inside the loop, one payment per corpse, so
 *      the boost was INTERLEAVED with the faint lines.
 *   2. IT IS RAISED ONCE, WITH `length` — the faint-queue depth at ENTRY — as the relay variable.
 *      `Moxie` is `this.boost({ atk: length }, source)` and `Eelevate` is
 *      `this.boost({ [source.getBestStat(true, true)]: length }, source)`, both read off
 *      `Dex.forFormat('gen9championsvgc2026regmb')`. So a double KO is ONE `+2`, not two `+1`s.
 *   3. `checkWin` RETURNS ABOVE IT (`:2592` above `:2596`). A drain that empties a side ends the
 *      battle and the event never runs at all. This engine's own win test
 *      (`if(sideWiped(S)) break _TURN`) sits at the TOP of the NEXT action, hundreds of lines below
 *      the faint step — so the boost was already paid onto a board that no longer exists.
 *
 * The `boost()` guard at `sim/battle.ts:2028` — `if (this.gen > 5 && !target.side.foePokemonLeft())
 * return false;` — refuses the same payment a second time and independently. It is NOT wired here;
 * `checkWin` gets there first on every board this probe stages, and a second guard for the same case
 * is filed rather than added.
 *
 * ================= WHO THIS REACHES, ENUMERATED FROM THE FORMAT =================================
 *
 * Twelve legal abilities carry a faint hook. They split on WHICH EVENT, and only one half is at this
 * boundary:
 *
 *   `runEvent('AfterFaint')`, :2596 — BELOW checkWin, this defect's blast radius:
 *       Eelevate, Moxie, Battle Bond, Beast Boost, Chilling Neigh, Grim Neigh, As One (Glastrier),
 *       As One (Spectrier).   LEGAL CARRIERS: Eelevate -> Eelektross-Mega; Moxie -> Pinsir,
 *       Gyarados, Heracross, Krookodile, Scrafty, Pyroar, Quaquaval; Battle Bond -> Greninja (and
 *       its handler needs `species.id === 'greninjabond'`, which no legal Greninja is, so it can
 *       never fire); the other five have ZERO legal carriers.
 *   `runEvent('Faint')`, :2551 — INSIDE the loop, ABOVE checkWin, and therefore NOT this defect:
 *       Soul-Heart (onAnyFaint), Receiver and Power of Alchemy (onAllyFaint), Illusion (onFaint).
 *
 * So the reachable population is **nine bodies across two abilities**: Eelektross-Mega with Eelevate
 * and seven Moxie carriers. This probe drives MOXIE, because Krookodile needs no mega step and the
 * two abilities are byte-identical at this boundary apart from which stat they name.
 *
 * ================= THE ARMS, AND WHAT EACH ONE SEPARATES ========================================
 *
 *   wipe     Krookodile's Earthquake takes both foes on turn 1 (p2 keeps two in the back -> the
 *            battle goes on) and the last two on turn 2 (-> the battle ENDS). One board, both of
 *            the clauses that are wrong, and the turns differ in NOTHING except whether p2 had a
 *            body left.
 *   single   THE OVER-FIRE CONTROL, AND IT IS THE POINT OF THE FILE. p2's slot b is a Rotom-Heat,
 *            which has Levitate and cannot be touched by Earthquake, so every turn is exactly ONE
 *            KO on a battle that keeps going. Every one of them MUST still pay +1. An engine that
 *            learned "stop after a faint" instead of "stop after the WIN" passes `wipe` and fails
 *            here.
 *   cleared  The same `wipe` board with Krookodile's OTHER legal ability, Intimidate. Neither
 *            engine may write a single boost onto the killer, AND the bodies must still die —
 *            otherwise `wipe` is being measured on a board where nothing could have happened.
 *
 * ================= WHAT IS ASSERTED AND WHAT IS ONLY REPORTED ===================================
 *
 * ASSERTED: the (body, stat, amount) of every boost the killer receives, and its POSITION against
 * that turn's `|faint|` lines. Those are the four fields `engine/game_differential.js` keeps.
 *
 * ALSO ASSERTED, WEAKLY AND ON PURPOSE: the NARRATION FORM. The authority announces
 * `|-ability|p1a: Krookodile|Moxie|boost` above a BARE `-boost`; this engine wrote no announcement
 * and tagged the boost `[from] ability: moxie` instead. BOTH forms are deleted by the comparator
 * before anything is compared — `EQUIV`'s `ability-announcement` rule drops `|-ability|` outright and
 * `stat-attribution` strips `[from]` — so NO instrument in this repo can go red on them and the
 * difference would rot unwatched. The counts are printed per arm and the two engines are asserted to
 * AGREE on them, which is a claim this file can make and the differential structurally cannot.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* WITHOUT `--release`, `engine/game_differential.js` CUTS A RELEASE INTO THE REAL STORE at require
 * time and repoints `data/engine-release.json` under whatever else is measuring. Preloading
 * `_live_release.js` redirects both `cut` and `open` to a throwaway store in the OS temp directory,
 * which is what lets this file freeze the tree an ENGINE agent has just edited. Same shape as
 * tests/probe_selfdestruct_winner.js. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

/* `--state` IS FORCED AND THE REASON IS THE MEASUREMENT. The default stop rule halts the game at the
 * first divergent LINE, and the `wipe` arm parts on turn 1 (that is the defect). Under the protocol
 * rule the battle-ending turn would never be played, so the clause this probe exists for would be
 * unreachable. CLAUDE.md: commentary may differ; boards may not — `onBoundary` below declares every
 * board identical so the driver plays the whole script. */
if (!process.argv.includes('--state')) {
  process.argv.push('--state');
  console.log('  --state FORCED — the `wipe` arm parts the stream on turn 1 (that IS the defect), and');
  console.log('    the protocol stop rule would end the game above the battle-ending turn.');
}
const CS = require(D('engine', 'champions_sim.js'));
const G = require(D('engine', 'game_differential.js'));

const mon = (species, ability, moves) => ({ species, item: '', ability, moves });

/* ---- THE CAST IS DERIVED, NEVER NAMED FROM MEMORY ---------------------------------------------- */
const NP = ['Nasty Plot', 'Protect'];
const KILLER = ab => [mon('krookodile', ab, ['Earthquake', 'Protect']),
                      /* THE PARTNER IS FLYING ON PURPOSE. Earthquake is `allAdjacent`, so a
                       * grounded partner would join the drain and change `length` — the arm would
                       * then be measuring a three-body faint while calling it a two-body one. */
                      mon('talonflame', 'Flame Body', ['Protect', 'Roost']),
                      mon('corviknight', 'Pressure', ['Protect']),
                      mon('milotic', 'Marvel Scale', ['Protect'])];
const WIPE_FOES = [mon('raichualola', 'Surge Surfer', NP), mon('houndoom', 'Early Bird', NP),
                   mon('liepard', 'Limber', NP), mon('watchog', 'Illuminate', NP)];
/* Rotom-Heat's Levitate is the whole of the `single` arm: it holds slot b for the entire game and
 * Earthquake cannot reach it, so each turn drains exactly one body and p2 is never emptied. */
const SINGLE_FOES = [mon('raichualola', 'Surge Surfer', NP), mon('rotomheat', 'Levitate', NP),
                     mon('houndoom', 'Early Bird', NP), mon('liepard', 'Limber', NP)];

{
  const seen = new Map();
  for (const t of [KILLER('Moxie'), WIPE_FOES, SINGLE_FOES])
    for (const p of t) for (const mv of p.moves) seen.set(p.species + '/' + mv, CS.canLearn(p.species, mv.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const bad = [...seen].filter(([, ok]) => !ok);
  console.log('  learnset (TeamValidator): ' + (seen.size - bad.length) + ' of ' + seen.size + ' cast rows LEGAL');
  for (const [k] of bad) console.log('    NOT LEGAL: ' + k);
  if (bad.length) { console.log('NOT RUN — the cast is not legal in this format.'); process.exit(2); }
}
{
  const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
  const Dx = Dex.forFormat('gen9championsvgc2026regmb');
  const k = Dx.species.get('krookodile');
  console.log('  Dex: krookodile ' + k.types.join('/') + '  abilities ' + Object.values(k.abilities).join(', ')
    + '   (both arms name one of THESE and differ in nothing else)');
  const r = Dx.species.get('rotomheat');
  console.log('  Dex: rotom-heat ' + r.types.join('/') + '  abilities ' + Object.values(r.abilities).join(', ')
    + '   Ground immune: ' + !Dx.getImmunity('Ground', r.types));
  console.log('  Dex: moxie onSourceAfterFaint -> ' + String(Dx.abilities.get('moxie').onSourceAfterFaint).replace(/\s+/g, ' '));
}

const EQ = { m: 'earthquake' }, PLOT = { m: 'nastyplot' }, PROT = { m: 'protect' };
const T = () => ({ p1: [EQ, PROT], p2: [PLOT, PLOT] });
const SCRIPT = n => Array.from({ length: n }, T);

function unsplit(log) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    const l = String(log[i]);
    if (/^\|split\|/.test(l)) { if (log[i + 1] !== undefined) out.push(String(log[i + 1])); i += 2; continue; }
    out.push(l);
  }
  return out;
}

const KILLER_IDENT = /^p1a: *krookodile$/i;

/* ONE TURN'S SHAPE ON EITHER STREAM: the faints, the boosts that landed on the KILLER, and whether
 * the battle ended, in the order they were written. Boosts on anybody else (the foes' own Nasty
 * Plot, Intimidate's drops) are deliberately not counted — the claim is about the killer. */
function turns(lines) {
  const out = []; let cur = null;
  const open = n => { cur = { n, faints: 0, boosts: [], shape: [], abil: 0, attributed: 0, won: false }; out.push(cur); };
  open(0);                       /* anything above `|turn|1` (Intimidate's switch-in announcement) */
  for (const raw of lines.map(String)) {
    const f = raw.split('|');
    if (f[1] === 'turn') { open(+f[2]); continue; }
    if (!cur) continue;
    if (f[1] === 'faint') { cur.faints++; cur.shape.push('faint'); continue; }
    if (f[1] === '-ability' && KILLER_IDENT.test(f[2] || '')) { cur.abil++; cur.shape.push('ABIL'); continue; }
    if (f[1] === '-boost' && KILLER_IDENT.test(f[2] || '')) {
      cur.boosts.push({ stat: String(f[3]).toLowerCase(), n: +f[4] });
      if (raw.match(/\[from\]/)) cur.attributed++;
      cur.shape.push('BOOST:' + String(f[3]).toLowerCase() + '+' + f[4]);
      continue;
    }
    if (f[1] === 'win') { cur.won = true; cur.shape.push('WIN'); continue; }
  }
  return out;
}

function runArm(label, foes, ability, nTurns, note) {
  const a = G.buildPair(KILLER(ability)), b = G.buildPair(foes);
  if (!a || !b) return { label, note, verdict: 'NOT-STAGED', why: 'buildPair returned null', sd: [], me: [] };
  const r = G.playGame(a, b, 'directed', 'probe-afterfaint:' + label, {
    script: SCRIPT(nTurns), onBoundary: (snap) => { snap.identical = true; snap.diffs = []; },
  });
  return { label, note, verdict: r.err ? 'THREW' : 'RAN', why: r.err,
           sd: turns(unsplit((G.lastSdLog ? G.lastSdLog() : []).map(String))),
           me: turns(((r && r.mediTrace) || []).map(String)),
           stop: (r && r.endReason) || null, turnsPlayed: r && r.turns };
}

console.log('\nTHE AFTER-FAINT BOUNDARY — one payment, sized by the drain, and none once the battle is over\n');
console.log('  mode ' + G.MODE + '   release ' + (G.REL && G.REL.id)
  + '   knob MEDI_AFTERFAINT_PER_TARGET=' + (process.env.MEDI_AFTERFAINT_PER_TARGET || '(unset)'));

const ARMS = [
  runArm('wipe', WIPE_FOES, 'Moxie', 2,
    'TURN 1 drains TWO foes with two still in the back — the authority pays ONE +2 below BOTH faint '
    + 'lines. TURN 2 drains the LAST two — `checkWin` returns above `AfterFaint` and the authority '
    + 'pays NOTHING. The two turns are the same click on the same board and differ only in whether '
    + 'p2 had a body left, which is the clause.'),
  runArm('single', SINGLE_FOES, 'Moxie', 3,
    'THE OVER-FIRE CONTROL. Rotom-Heat holds slot b behind Levitate, so Earthquake drains exactly '
    + 'ONE body a turn and p2 is never emptied. Every turn MUST still pay +1 on both engines — an '
    + 'engine that stopped paying after ANY faint, rather than after the WIN, is caught here and '
    + 'nowhere else.'),
  runArm('cleared', WIPE_FOES, 'Intimidate', 3,
    'THE CLEARED CONTROL: the same board and the same clicks on Krookodile\'s OTHER legal ability. '
    + 'Neither engine may write a boost onto the killer, and the foes must still die.'),
];

let fails = 0;
const ok = (cond, label, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + label + (detail ? '\n          ' + detail : ''));
  if (!cond) fails++;
};
const sig = t => t ? (t.boosts.map(b => b.stat + '+' + b.n).join(',') || '-') : '(none)';
/* Did the boost come out below EVERY faint line of its turn? Compares positions inside `shape`. */
const belowAllFaints = t => {
  if (!t || !t.boosts.length) return true;
  const lastFaint = t.shape.map((x, i) => x === 'faint' ? i : -1).reduce((a, b) => Math.max(a, b), -1);
  const firstBoost = t.shape.findIndex(x => x.startsWith('BOOST:'));
  return lastFaint < 0 || firstBoost > lastFaint;
};

for (const x of ARMS) {
  console.log('\n' + '='.repeat(100));
  console.log('  ' + x.label + '   (' + x.verdict + (x.why ? ' — ' + x.why : '') + ')');
  console.log('  STOPPED: ' + x.stop + '   (turns played ' + x.turnsPlayed + ')');
  console.log('  ' + x.note);
  const n = Math.max(x.sd.length, x.me.length);
  console.log('    turn |         SHOWDOWN                                    |         MEDICHAM');
  for (let i = 0; i < n; i++) {
    const s = x.sd[i], m = x.me[i];
    const f = t => t ? (t.shape.join(',') || '(quiet)') : '(none)';
    console.log('    ' + String(s ? s.n : (m ? m.n : '?')).padEnd(5) + '| ' + f(s).padEnd(51) + '| ' + f(m));
  }
  /* THE TWO FORMS THE COMPARATOR DELETES — this file is the only place they can be checked at all. */
  const abilS = x.sd.reduce((a, t) => a + t.abil, 0), abilM = x.me.reduce((a, t) => a + t.abil, 0);
  const attS = x.sd.reduce((a, t) => a + t.attributed, 0), attM = x.me.reduce((a, t) => a + t.attributed, 0);
  console.log('    NARRATION (deleted by EQUIV before the differential compares anything, so this file '
    + 'is its only watcher): `|-ability|<killer>| lines showdown ' + abilS + ' / medicham ' + abilM
    + ';  `-boost` carrying `[from]` showdown ' + attS + ' / medicham ' + attM);
  ok(abilS === abilM && attS === attM,
     'NARRATION: the two engines write the same announcement/attribution forms on the killer',
     '`|-ability|` ' + abilS + ' vs ' + abilM + ';  `[from]` on `-boost` ' + attS + ' vs ' + attM
     + '   (`boost()` resolves an Ability effect to an announcement + a BARE `-boost`, '
     + 'sim/battle.ts:2058-2064)');

  if (x.label === 'cleared') {
    const sTot = x.sd.reduce((a, t) => a + t.boosts.length, 0), mTot = x.me.reduce((a, t) => a + t.boosts.length, 0);
    ok(sTot === 0 && mTot === 0, 'no boost lands on the killer on either engine',
       'showdown ' + sTot + ' boost line(s), medicham ' + mTot);
    const sF = x.sd.reduce((a, t) => a + t.faints, 0), mF = x.me.reduce((a, t) => a + t.faints, 0);
    ok(sF > 0 && mF > 0, 'the foes still die on both engines — the arm above is on a live board',
       'faints: showdown ' + sF + ', medicham ' + mF);
    continue;
  }

  if (x.label === 'wipe') {
    const t1s = x.sd.find(t => t.n === 1), t1m = x.me.find(t => t.n === 1);
    const t2s = x.sd.find(t => t.n === 2), t2m = x.me.find(t => t.n === 2);
    ok(!!t1s && t1s.faints === 2 && !!t2s && t2s.faints === 2,
       'THE FIXTURE STAGED: two foes drained on turn 1 and two on turn 2, on the authority',
       'showdown faints t1 ' + (t1s && t1s.faints) + ', t2 ' + (t2s && t2s.faints));
    ok(!!t2s && t2s.won, 'THE FIXTURE STAGED: the authority ENDED the battle on turn 2',
       'without the win this arm cannot ask the question at all');
    ok(!!t1s && t1s.boosts.length === 1 && t1s.boosts[0].n === 2 && t1s.boosts[0].stat === 'atk',
       'THE AUTHORITY, turn 1: ONE payment of +2 — `length` is the drain, not the body count',
       'showdown ' + sig(t1s));
    ok(!!t2s && t2s.boosts.length === 0,
       'THE AUTHORITY, turn 2: NOTHING — `checkWin` returns at :2592, above `AfterFaint` at :2596',
       'showdown ' + sig(t2s));
    ok(!!t1m && t1m.boosts.length === 1 && t1m.boosts[0].n === 2 && t1m.boosts[0].stat === 'atk',
       'turn 1: medicham2 pays ONE +2 as well', 'medicham ' + sig(t1m) + '   shape ' + (t1m && t1m.shape.join(',')));
    ok(belowAllFaints(t1m), 'turn 1: medicham2 pays BELOW both `|faint|` lines, as the authority does',
       'medicham shape ' + (t1m && t1m.shape.join(',')));
    ok(!!t2m && t2m.boosts.length === 0,
       'turn 2: medicham2 pays NOTHING once the drain has emptied a side',
       'medicham ' + sig(t2m) + '   shape ' + (t2m && t2m.shape.join(',')));
    continue;
  }

  /* single */
  const live = x.sd.filter(t => t.faints > 0);
  ok(live.length >= 3, 'THE FIXTURE STAGED: at least three single-KO turns on the authority',
     live.map(t => 'turn ' + t.n + ' faints ' + t.faints).join('; '));
  ok(live.every(t => t.faints === 1), 'every measured turn drains exactly ONE body',
     live.map(t => t.faints).join(','));
  ok(x.sd.every(t => !t.won) && x.me.every(t => !t.won),
     'the battle never ends — so a missing boost here can only be an over-fire',
     'showdown win lines ' + x.sd.filter(t => t.won).length);
  for (const s of live) {
    const m = x.me.find(t => t.n === s.n);
    ok(s.boosts.length === 1 && s.boosts[0].n === 1, 'THE AUTHORITY, turn ' + s.n + ': +1', 'showdown ' + sig(s));
    ok(!!m && m.boosts.length === 1 && m.boosts[0].n === 1 && m.boosts[0].stat === s.boosts[0].stat,
       'turn ' + s.n + ': medicham2 still pays the same +1 — THE OVER-FIRE CONTROL',
       'showdown ' + sig(s) + '   medicham ' + sig(m));
    ok(belowAllFaints(m), 'turn ' + s.n + ': and it is below the `|faint|`',
       'medicham shape ' + (m && m.shape.join(',')));
  }
}

console.log('\n' + (fails ? 'RED — ' + fails + ' assertion(s) failed' : 'GREEN — every assertion held'));
process.exit(fails ? 1 : 0);
