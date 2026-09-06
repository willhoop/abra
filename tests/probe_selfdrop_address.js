#!/usr/bin/env node
/* tests/probe_selfdrop_address.js — THE PHANTOM SELF-DROP DIE AND THE POST-HIT ABILITY COIN
 * ==================================================================================================
 * DO THE TWO ENGINES FLIP THE SAME COIN FOR A POST-HIT ABILITY PROC WHEN THE MOVE THAT HIT ALSO
 * LOWERS THE ATTACKER'S OWN STATS?
 *
 * NO. THEY FLIP TWO DIFFERENT ONES, AND THE REASON IS AN AUTHORITY DRAW NOBODY READS.
 *
 *     sim/battle-actions.ts:1316-1334   BattleActions#selfDrops
 *       if (!isSecondary && moveData.self.boosts) {
 *         const secondaryRoll = this.battle.random(100);              <-- ALWAYS DRAWN
 *         if (typeof moveData.self.chance === 'undefined' || secondaryRoll < moveData.self.chance) {
 *
 * `selfDrops` runs at `spreadMoveHit` step 4 (battle-actions.ts:1096); `runEvent('DamagingHit')` --
 * which is where Poison Touch, Flame Body, Cursed Body, Static, Poison Point and Effect Spore all
 * live -- runs at :1121, AFTER it. Neither method is one of the four the middle arm wraps
 * (`hitStepAccuracy`/`secondaries`/`getDamage`/`getConfusionDamage`), so BOTH draws are addressed
 * `<seed>|<turn>|any|<move>|<target>|<nth>` and they land in ONE bucket in `nth` order.
 *
 * medicham2 does not take the self-drop draw at all. So on a self-drop move the authority's ability
 * coin is `nth 1` and this engine's is `nth 0` -- two independent values for one event.
 *
 * MEASURED BEFORE ANYTHING MOVED, one staged turn, both address logs side by side:
 *
 *     authority   20260813|1|any|closecombat|p20|0     <- the self-drop roll, VALUE NEVER READ
 *                 20260813|1|any|closecombat|p20|1     <- Poison Touch's 30%
 *     this engine 20260813|1|any|closecombat|p20|0     <- Poison Touch's 30%, a DIFFERENT number
 *
 * and the same pair of lines with `dracometeor` (Cursed Body) and with `closecombat` into a Flame
 * Body holder. The control -- the identical board with a contact move that has no self-drop
 * (`shadowclaw`, `poisonjab`, `dragonpulse`) -- shares every address, before this fix and after it.
 *
 * THE VALUE IS NEVER READ IN THIS REGULATION, AND THAT IS DERIVED ON EVERY RUN (§0). All TEN legal
 * moves with `self.boosts` carry `self.chance === undefined`, so the `typeof ... === 'undefined'`
 * short-circuit fires first and `secondaryRoll` is discarded every single time. It is a pure phantom:
 * it decides nothing and it moves everything after it.
 *
 * THE BOARD CONSEQUENCE IS STAGED, NOT ARGUED (arms 7 and 8). Two independent coins agree about two
 * thirds of the time, so the address is the claim and the board is the consequence -- but with three
 * and four padding turns in front of the same board the two engines part on exactly the shape
 * `data/game-differential.json` carries seven times over:
 *
 *     p2.party.swampert.status   medicham ""     showdown "psn"     (pad 3)
 *     p2.party.swampert.status   medicham "psn"  showdown ""        (pad 4)
 *
 * THE FIX IS THE ARM'S OWN RULE, ALREADY WRITTEN DOWN FOR `tgtla`. ROADMAP #478 put the authority's
 * lookahead target resolutions in a bucket medicham2 never draws in, *"so the one draw that decides
 * the board is nth 0 on both sides"*, and kept them as real address-keyed values rather than pinning
 * them so the authority's own behaviour is unchanged. `selfDrops` is the same shape through a
 * different door: a draw the authority always takes, always ignores, and this engine never takes.
 *
 * IT IS AN INSTRUMENT CHANGE ON ONE SIDE. `engine/medicham2-browser.js` is not touched by it, and
 * that is the point -- there is no engine behaviour here to fix, only an address to stop sharing.
 * IT MOVES `PIN_DIGEST`, because the addressing contract is in `DICE_MODEL`: a run before this and a
 * run after it played different games and `engine/arms_comparable.js` must refuse to table them.
 *
 * RED-FIRST KNOB: `MEDI_MID_SELFDROP_SHARED=1` puts the draw back in the shared `any` bucket. Under
 * it arms 1, 3, 5 go RED on the address and arms 7 and 8 go RED on the address AND the board; the
 * three controls stay green, which is what makes a red arm an accusation of the self-drop draw rather
 * than of `any` addressing in general. Any run carrying it also reports
 * `midWrapState().selfDropShared === true` and `selfDropDraws === 0`.
 * ================================================================================================== */
'use strict';
process.env.SHOWDOWN_PATH = process.env.SHOWDOWN_PATH || 'C:/Users/willj/Projects/Pokemon/pokemon-showdown';
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
if (process.argv.indexOf('--games') < 0) process.argv.push('--games', '18');

const SB = require(path.join(ROOT, 'tests', 'staged_board.js'));

let bad = 0;
const ok = (cond, what, detail) => {
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + what);
  if (detail) console.log('          ' + String(detail).split('\n').join('\n          '));
  if (!cond) bad++;
};

const KNOB = process.env.MEDI_MID_SELFDROP_SHARED === '1';
console.log('\ntests/probe_selfdrop_address.js — the phantom self-drop die and the post-hit ability coin');
console.log('  MEDI_MID_SELFDROP_SHARED=' + (KNOB ? '1  (PRE-FIX INSTRUMENT)' : '0'));

/* ---- 0. THE AUTHORITY AND THE MEMBERSHIP, DERIVED ON EVERY RUN --------------------------------- */
const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
const D = Dex.forFormat('gen9championsvgc2026regmb');
const legal = x => x.exists && !x.isNonstandard && x.tier !== 'Illegal';

console.log('\n0. WHAT THIS REGULATION ACTUALLY CONTAINS');
const SELFDROPS = D.moves.all().filter(m => legal(m) && m.self && m.self.boosts);
console.log('     legal moves whose `self.boosts` makes the authority draw random(100): '
  + SELFDROPS.map(m => m.id).sort().join(', '));
ok(SELFDROPS.length > 0,
   'the self-drop family is a live population in this format — the arms below are not vacuous',
   SELFDROPS.length ? null : 'nothing matched; every arm is about a draw that never happens');
const READ = SELFDROPS.filter(m => typeof m.self.chance !== 'undefined');
ok(READ.length === 0,
   'and NOT ONE of them defines `self.chance`, so `secondaryRoll` is discarded every time it is drawn',
   READ.length ? 'these DO read it, and pulling the draw out of `any` would change their outcome: '
     + READ.map(m => m.id + ' chance=' + m.self.chance).join(', ')
   : 'all ' + SELFDROPS.length + ' short-circuit on `typeof self.chance === "undefined"`');
/* THE STATIC LIST IS NOT THE WHOLE MEMBERSHIP, AND THE POOL SAID SO BEFORE THIS LINE EXISTED.
 * `selfdrop_seen` on the 961-game run reads `curse|random(100)` 19 times, and Curse is not in the
 * ten above: `curse.onTryHit` ASSIGNS `move.self = { boosts: { spe: -1, atk: 1, def: 1 } }` at
 * runtime for a non-Ghost user (data/moves.ts, no Champions override). So the population is derived
 * two ways -- the static `self.boosts` and every handler that writes one -- and both are printed. */
const ASSIGNS = D.moves.all().filter(m => legal(m) && !m.self &&
  /move\.self\s*=\s*\{[^}]*boosts/.test(JSON.stringify(m, (k, v) => typeof v === 'function' ? String(v) : v)));
console.log('     ...and moves that ASSIGN `move.self.boosts` at runtime: '
  + (ASSIGNS.map(m => m.id).sort().join(', ') || '(none)'));
ok(ASSIGNS.every(m => !/self\s*=\s*\{[^}]*chance/.test(
     JSON.stringify(m, (k, v) => typeof v === 'function' ? String(v) : v))),
   'none of those assigns a `chance` either — the phantom stays a phantom on that road too',
   null);

/* The three abilities the arms stage, read out of the format rather than named from memory. */
const PROCS = ['poisontouch', 'flamebody', 'cursedbody'];
for (const id of PROCS) {
  const a = D.abilities.get(id);
  const src = JSON.stringify(a, (k, v) => typeof v === 'function' ? String(v) : v);
  ok(legal(a) && /randomChance\(3, 10\)/.test(src),
     a.name + ' is legal here and its coin is a `randomChance(3, 10)` in an on-hit handler',
     legal(a) ? null : 'NOT LEGAL in this regulation — this arm proves nothing');
}
/* CHAMPIONS **DOES** OVERRIDE `spreadMoveHit`, AND THE FIRST CUT OF THIS CHECK SAID SO AND STOPPED
 * THERE. That was a wrong question: the claim is not "the mod leaves it alone", it is "the mod's own
 * copy still runs `selfDrops` ABOVE `runEvent('DamagingHit')`", which is the ordering the collision
 * depends on. `selfDrops` ITSELF is not overridden, so battle-actions.ts:1325 is the draw either way.
 * Both halves are read out of the mod on every run rather than remembered. */
const MODDIR = process.env.SHOWDOWN_PATH + '/data/mods/champions/';
const MODSCRIPTS = fs.readFileSync(MODDIR + 'scripts.ts', 'utf8');
ok(!/^\t(?:actions:\s*\{[\s\S]*?)?\tselfDrops\s*\(/m.test(MODSCRIPTS)
   && !/\n\t\tselfDrops\s*\(/.test(MODSCRIPTS),
   'Champions does NOT override `selfDrops` itself — battle-actions.ts:1325 is the draw in this format',
   'the mod defines its own selfDrops; read that block instead of the mainline one');
const SMH = MODSCRIPTS.indexOf('spreadMoveHit(targets');
const CALL = MODSCRIPTS.indexOf('this.selfDrops(', SMH);
const DHIT = MODSCRIPTS.indexOf("runEvent('DamagingHit'", SMH);
ok(SMH >= 0 && CALL > SMH && DHIT > CALL,
   'and its own `spreadMoveHit` still calls selfDrops ABOVE runEvent(\'DamagingHit\') — the order '
   + 'the whole collision rests on',
   SMH < 0 ? 'the mod does not override spreadMoveHit at all — mainline :1096/:1121 applies'
   : (CALL > SMH && DHIT > CALL ? null
      : 'THE ORDER IS NOT WHAT THIS PROBE ASSUMES — selfDrops at ' + CALL + ', DamagingHit at ' + DHIT));

/* ==================================================================================================
 * THE BOARDS — one carrier per sub-family, each with its own control on the SAME bodies
 * ================================================================================================== */
const mon = (species, item, ability, moves) => ({ species, item: item || '', ability: ability || '', moves });
const FILL = (...names) => names.map(n => mon(n, '', '', ['Protect']));

/* Sneasler carries Poison Touch and learns both Close Combat (self-drop) and Shadow Claw (no
 * self-drop); both are contact, so the ability's own gate is satisfied either way and the ONLY thing
 * that varies between the arm and its control is whether the authority takes the phantom draw. */
const PT_SIDE = () => [mon('sneasler', '', 'Poison Touch', ['Close Combat', 'Shadow Claw', 'Protect']),
                       mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(FILL('toxapex', 'corviknight'));
const PT_FOE = () => [mon('swampert', '', 'Torrent', ['Protect', 'Waterfall']),
                      mon('garchomp', '', 'Sand Veil', ['Protect'])].concat(FILL('weavile', 'incineroar'));
/* Talonflame carries Flame Body; Toxicroak learns Close Combat AND Poison Jab, both contact. Dry
 * Skin rather than Toxicroak's hidden Poison Touch, so only ONE post-hit coin is in play. */
const FB_SIDE = () => [mon('talonflame', '', 'Flame Body', ['Roost', 'Protect']),
                       mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(FILL('toxapex', 'corviknight'));
const FB_FOE = () => [mon('toxicroak', '', 'Dry Skin', ['Close Combat', 'Poison Jab', 'Protect']),
                      mon('garchomp', '', 'Sand Veil', ['Protect'])].concat(FILL('weavile', 'incineroar'));
/* Cursed Body needs no contact at all, so the pair is Draco Meteor (self-drop) against Dragon Pulse
 * (none) — and Dragon is neutral into a Ghost, where Close Combat is refused outright. Sap Sipper
 * rather than Goodra's hidden Gooey, which is itself a `punishesAttacker`. */
const CB_SIDE = () => [mon('gengar', '', 'Cursed Body', ['Nasty Plot', 'Protect']),
                       mon('milotic', '', 'Marvel Scale', ['Protect'])].concat(FILL('toxapex', 'corviknight'));
const CB_FOE = () => [mon('goodra', '', 'Sap Sipper', ['Draco Meteor', 'Dragon Pulse', 'Protect']),
                      mon('garchomp', '', 'Sand Veil', ['Protect'])].concat(FILL('weavile', 'incineroar'));

const PAD = { p1: [{ m: 'protect' }, { m: 'protect' }], p2: [{ m: 'protect' }, { m: 'protect' }] };
const pad = (n, last) => { const s = []; for (let i = 0; i < n; i++) s.push(PAD); s.push(last); return s; };
const PT_HIT = { p1: [{ m: 'closecombat', t: 0 }, { m: 'protect' }], p2: [{ m: 'waterfall', t: 1 }, { m: 'protect' }] };

const ARMS = [
  { id: 'poisontouch-behind-a-selfdrop', governed: true, A: PT_SIDE, B: PT_FOE,
    what: 'Sneasler clicks CLOSE COMBAT into Swampert. The move connects, the authority runs '
        + '`selfDrops` and burns `any|closecombat|p20|0` on a value it never reads, then raises '
        + '`DamagingHit` and reads Poison Touch\'s 30% off `|1`. This engine has only the ability '
        + 'coin and reads it off `|0`.',
    script: [PT_HIT] },
  { id: 'poisontouch-no-selfdrop  (CONTROL)', governed: false, A: PT_SIDE, B: PT_FOE,
    what: 'THE CONTROL. The same two bodies, the same ability, the same contact gate — SHADOW CLAW '
        + 'instead, which has no `self`. The authority takes no phantom draw, so the ability coin is '
        + '`nth 0` on both sides and always has been. A red here would mean the bucket change broke '
        + 'the ordinary road.',
    script: [{ p1: [{ m: 'shadowclaw', t: 0 }, { m: 'protect' }], p2: [{ m: 'waterfall', t: 1 }, { m: 'protect' }] }] },

  { id: 'flamebody-behind-a-selfdrop', governed: true, A: FB_SIDE, B: FB_FOE,
    what: 'Toxicroak clicks CLOSE COMBAT into a Flame Body Talonflame. Same two draws, this time '
        + 'with the ability on the DEFENDING side, so the address names the victim\'s slot.',
    script: [{ p1: [{ m: 'roost' }, { m: 'protect' }], p2: [{ m: 'closecombat', t: 0 }, { m: 'protect' }] }] },
  { id: 'flamebody-no-selfdrop  (CONTROL)', governed: false, A: FB_SIDE, B: FB_FOE,
    what: 'THE CONTROL. POISON JAB — contact, no `self`. Flame Body\'s coin is nth 0 on both sides.',
    script: [{ p1: [{ m: 'roost' }, { m: 'protect' }], p2: [{ m: 'poisonjab', t: 0 }, { m: 'protect' }] }] },

  { id: 'cursedbody-behind-a-selfdrop', governed: true, A: CB_SIDE, B: CB_FOE,
    what: 'Goodra clicks DRACO METEOR into a Cursed Body Gengar. Cursed Body has no contact gate, so '
        + 'this arm also shows the collision is about the ADDRESS and not about contact.',
    script: [{ p1: [{ m: 'nastyplot' }, { m: 'protect' }], p2: [{ m: 'dracometeor', t: 0 }, { m: 'protect' }] }] },
  { id: 'cursedbody-no-selfdrop  (CONTROL)', governed: false, A: CB_SIDE, B: CB_FOE,
    what: 'THE CONTROL. DRAGON PULSE — the same type, the same target, no `self`.',
    script: [{ p1: [{ m: 'nastyplot' }, { m: 'protect' }], p2: [{ m: 'dragonpulse', t: 0 }, { m: 'protect' }] }] },

  { id: 'poisontouch-that-parts-the-board-toward-showdown', governed: true, board: true, A: PT_SIDE, B: PT_FOE,
    what: 'THE BOARD CONSEQUENCE, ONE DIRECTION. Arm 1 with THREE padding turns in front, so the '
        + 'address carries turn 4 and the two engines draw a different pair of numbers. The '
        + 'authority poisons Swampert and we do not: `p2.party.swampert.status` "" against "psn".',
    script: pad(3, PT_HIT) },
  { id: 'poisontouch-that-parts-the-board-toward-medicham', governed: true, board: true, A: PT_SIDE, B: PT_FOE,
    what: 'THE BOARD CONSEQUENCE, THE OTHER DIRECTION, because a fix that only ever removes OUR '
        + 'status would look identical to one that simply stopped the ability firing. Four padding '
        + 'turns: WE poison Swampert and the authority does not — "psn" against "".',
    script: pad(4, PT_HIT) },
];

/* ==================================================================================================
 * 1. THE ADDRESSES, READ OFF THE DRIVER'S OWN LOGS, SYMMETRICALLY
 * ==================================================================================================
 * The asymmetric identity `shared / min(|sd|,|me|)` that the differential's void check uses reads
 * IDENTICAL on every arm below, before the fix as well as after — every address this engine names is
 * one the authority also named. That is exactly the reading `game_differential.js` warns about beside
 * `rate_over_larger`: *"a game can read `identical` while the authority is flipping a coin at an
 * address this engine never named — which is EXACTLY the Poison Touch shape"*. So the check here is
 * SYMMETRIC set equality, which is the only form that can see this at all.
 * ================================================================================================== */
const G = SB.harness();
console.log('\n1. THE `any` ADDRESSES EACH ENGINE DREW, AND WHETHER THEY ARE THE SAME EVENTS');
const isAny = x => /\|any\|/.test(String(x));
for (const arm of ARMS) {
  G.midResetAddresses();
  const a = G.buildPair(arm.A()), b = G.buildPair(arm.B());
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'selfdrop-' + arm.id, { script: arm.script,
    onBoundary: (snap, t) => { boards.push({ t, diffs: (snap.diffs || []).slice() });
                               snap.identical = true; snap.diffs = []; } });
  const ad = G.midAddresses();
  const sd = ad.sd.filter(isAny), me = ad.me.filter(isAny);
  const S = new Set(sd), M2 = new Set(me);
  const sdOnly = sd.filter(x => !M2.has(x)), meOnly = me.filter(x => !S.has(x));

  console.log('\n  [' + arm.id + ']' + (arm.governed && KNOB ? '   [expected RED: the knob is armed]' : ''));
  console.log('    ' + arm.what.replace(/(.{92}\s)/g, '$1\n    '));
  ok(!r.err && r.turns === arm.script.length,
     'the arm played its whole script',
     r.err ? r.err : (r.turns !== arm.script.length ? 'played ' + r.turns + ' of ' + arm.script.length : null));
  for (const x of sd) console.log('      sd  ' + (M2.has(x) ? '   ' : '>> ') + x);
  for (const x of me) console.log('      me  ' + (S.has(x) ? '   ' : '>> ') + x);
  ok(me.length > 0 && sd.length > 0,
     'both engines actually drew an `any` die on this board — the arm is not vacuous',
     'sd=' + sd.length + ' me=' + me.length + ' (a zero means the hit never landed and this arm '
     + 'proves nothing whichever way it goes)');
  ok(sdOnly.length === 0 && meOnly.length === 0,
     'the two `any` address sets are EQUAL — every event is priced off one shared coin',
     (sdOnly.length ? 'AUTHORITY ONLY:\n' + sdOnly.join('\n') : '')
     + (sdOnly.length && meOnly.length ? '\n' : '')
     + (meOnly.length ? 'THIS ENGINE ONLY:\n' + meOnly.join('\n') : ''));
  const parted = boards.filter(x => x.diffs.length);
  ok(parted.length === 0, 'the two boards never parted',
     parted.length ? parted.map(p => 'turn ' + p.t + '  ' + JSON.stringify(p.diffs.slice(0, 4))).join('\n') : null);
  if (arm.board && !parted.length && KNOB) {
    ok(false, 'this arm is the BOARD consequence and under the knob it must PART — it did not',
      'the padding no longer lands the two coins on opposite sides; re-tune the pad count rather '
      + 'than reading this as a fix');
  }
}

/* ==================================================================================================
 * 2. THE INSTRUMENT'S OWN RECEIPT — AND WHAT THE NEW BUCKET SWALLOWED
 * ==================================================================================================
 * A bucket that quietly widened would move draws the two engines DO share out of `any`, which is the
 * same defect in mirror. `selfDropSeen` is every draw taken while `selfDrops` was on the stack, keyed
 * `move|m..n`, so the population is PRINTED rather than assumed — the rule docs/LESSONS §4 exists for.
 * ================================================================================================== */
console.log('\n2. THE COUNTERS');
const W = G.midWrapState();
console.log('     selfDropEnters ' + W.selfDropEnters + '   selfDropDraws ' + W.selfDropDraws
  + '   selfDropShared ' + W.selfDropShared);
console.log('     what landed in the bucket: ' + JSON.stringify(W.selfDropSeen));
ok(W.selfDropEnters > 0,
   'the authority actually ran `selfDrops` on these boards — the wrapper had something to see',
   'selfDropEnters=' + W.selfDropEnters + ' — a zero means no self-drop move connected and every '
   + 'green above is vacuous');
ok(KNOB ? W.selfDropShared === true : W.selfDropShared === false,
   'the restore knob reports its own state', 'selfDropShared=' + W.selfDropShared);
ok(KNOB ? W.selfDropDraws === 0 : W.selfDropDraws > 0,
   KNOB ? 'under the knob NOTHING is moved out of `any` — that is what makes the arms above red'
        : 'the bucket actually took draws — it is load-bearing, not an inert rename',
   'selfDropDraws=' + W.selfDropDraws);
/* WHAT MAY BE IN THE BUCKET, AND THE FIRST CUT OF THIS CHECK WAS TOO STRICT — it demanded that every
 * shape be `random(100)`, passed on these six staged boards, and would have gone red on the pinned
 * pool, where `selfdrop_seen` also reads `outrage|random(2,4)` three times. That is Outrage's
 * `self: { volatileStatus: 'lockedmove' }` taking the ELSE branch of `selfDrops` into `moveHit`, and
 * the duration draw inside it. It is HARMLESS and the reason is the arm's own range rule: a
 * two-argument `random` outside `getDamage` is PINNED to `m` and consumes no shared address at all,
 * in `sdrop` exactly as in `any`. So the claim is two-clause, and the clause that matters is the
 * second: a ONE-ARGUMENT draw that is not the `random(100)` of battle-actions.ts:1325 would be a
 * nested die newly pulled out of the shared bucket, which is this defect in mirror. */
const SHAPES = Object.keys(W.selfDropSeen || {});
const RANGE = SHAPES.filter(k => /\|random\(\d+,\d+\)$/.test(k));
const STRAY = SHAPES.filter(k => !/\|random\(\d+,\d+\)$/.test(k) && !/\|random\(100\)$/.test(k));
if (RANGE.length) console.log('     range forms in the bucket (pinned, no address consumed): ' + RANGE.join(', '));
ok(KNOB || STRAY.length === 0,
   'every ADDRESS-CONSUMING draw in the bucket is the `random(100)` at battle-actions.ts:1325',
   STRAY.length ? 'THESE ARE NOT IT — the method scope is pulling a nested one-argument die out of '
     + '`any`:\n' + STRAY.join('\n') : null);

console.log('\n' + (bad ? 'FAILED ' + bad + ' check(s)' : 'all checks passed'));
process.exit(bad ? 1 : 0);
