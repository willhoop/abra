/* solver/tests/test-tactics.js — the TACTICS COUNTERS (solver/arena/tactics.js) count speed control, mega and switches on a
 * staged game that does each thing, in both readers, and in the two places they are printed.
 *
 *   node solver/tests/test-tactics.js [--no-red]      exit 0 GREEN, 1 RED, 2 CANNOT ANSWER, 3 BLIND
 *   env TACTICS_TEST_RELEASE=<id>   the frozen release the ENGINE clause plays (default eaa5becc54eb, the Reg M-C gate release)
 *
 *   DERIVE   the speed-control set is derived from the format and holds Trick Room, Tailwind, a self boost, a foe drop and
 *            paralysis; the self-switch set holds a pivot move; the Tailwind and paralysis factors are read, not typed.
 *   LOG      a constructed battle log (fromLog): p1 sets Tailwind while a foe outspeeds an ally (mattered), switches into a
 *            resisted hit, megas on turn 3 from slot b, switches into a KO and replaces the fainted body; p2 megas on turn 1
 *            from slot a and replaces a fainted body. Every one of those counters must read exactly.
 *   ENGINE   a staged arena game on the frozen release (game(API)): A switches into an immune Fake Out, megas from slot b on
 *            turn 1 and uses a foe-drop move on turn 2; B sets Trick Room. Each counter must be non-zero / exact.
 *   REPORT   solver/rotom/report.js tacticsOfRun over a scratch run directory holding the LOG game reads it back, per arm.
 *   ROTOM    rotom.js writes `tactics` into the game record and the summary (a static check of the wiring; the LOG
 *            clause is the reader it calls).
 *
 * RED, unless --no-red: TACTICS_BREAK=blind (every counter left at zero) must fail LOG and ENGINE.
 */
'use strict';
process.env.ABRA_REGULATION = process.env.ABRA_REGULATION || 'regmc';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const REL = process.env.TACTICS_TEST_RELEASE || 'eaa5becc54eb';
const NO_RED = process.argv.includes('--no-red');
let fails = 0, checks = 0;
const failed = new Set();
const ok = (clause, c, msg) => { checks++; if (!c) { fails++; failed.add(clause); console.log('  FAIL [' + clause + '] ' + msg); } };
const cannot = msg => { console.log('CANNOT ANSWER: ' + msg); process.exit(2); };

require('../arena/env.js');
const TAC = require('../arena/tactics.js');

/* ---------------- DERIVE ---------------- */
{
  const d = TAC.derive();
  const cls = new Set(Object.values(d.moves));
  for (const c of ['trickroom', 'tailwind', 'self_boost', 'foe_drop', 'paralysis']) ok('DERIVE', cls.has(c), 'no legal move derived as ' + c);
  ok('DERIVE', d.moves.trickroom === 'trickroom' && d.moves.tailwind === 'tailwind' && d.moves.icywind === 'foe_drop', 'trickroom/tailwind/icywind classes: ' + [d.moves.trickroom, d.moves.tailwind, d.moves.icywind]);
  ok('DERIVE', d.selfSwitch.has('uturn') || d.selfSwitch.has('partingshot'), 'no self-switch move derived');
  ok('DERIVE', d.twF > 1 && d.parF > 0 && d.parF < 1, 'tailwind factor ' + d.twF + ', paralysis factor ' + d.parF);
  console.log('  DERIVE ' + Object.keys(d.moves).length + ' speed-control moves, ' + Object.keys(d.speedAbilities).length + ' speed abilities, ' + d.selfSwitch.size + ' self-switch moves');
}

/* ---------------- LOG ---------------- */
const LOG = [
  '|player|p1|Alice|1|1500',
  '|player|p2|Bob|2|1500',
  '|showteam|p1|Whimsicott||FocusSash|Prankster|Tailwind,Moonblast,Encore,Protect|Timid||F|||50|]Farigiraf||SitrusBerry|ArmorTail|TrickRoom,Psychic,Protect,HelpingHand|Quiet||F|||50|]Charizard||CharizarditeY|Blaze|HeatWave,SolarBeam,Protect,ScorchingSands|Timid||M|||50|]Garchomp||SitrusBerry|RoughSkin|Earthquake,DragonClaw,Protect,RockSlide|Jolly||M|||50|',
  '|showteam|p2|Gengar||Gengarite|CursedBody|ShadowBall,SludgeBomb,Protect,IcyWind|Timid||F|||50|]Incineroar||ShucaBerry|Intimidate|FakeOut,FlareBlitz,PartingShot,Protect|Careful||M|||50|]Kingambit||BlackGlasses|Defiant|KowtowCleave,SuckerPunch,IronHead,Protect|Adamant||M|||50|]Gardevoir||ChestoBerry|Trace|Moonblast,Psychic,Protect,MysticalFire|Modest||F|||50|',
  '|start',
  '|switch|p1a: Whimsicott|Whimsicott, L50, F|100/100',
  '|switch|p1b: Farigiraf|Farigiraf, L50, F|100/100',
  '|switch|p2a: Gengar|Gengar, L50, F|100/100',
  '|switch|p2b: Incineroar|Incineroar, L50, M|100/100',
  '|turn|1',
  '|detailschange|p2a: Gengar|Gengar-Mega, L50, F',
  '|-mega|p2a: Gengar|Gengar|Gengarite',
  '|move|p2b: Incineroar|Fake Out|p1b: Farigiraf',
  '|-damage|p1b: Farigiraf|90/100',
  '|move|p1a: Whimsicott|Tailwind|p1a: Whimsicott',
  '|-sidestart|p1: Alice|move: Tailwind',
  '|move|p2a: Gengar|Sludge Bomb|p1a: Whimsicott',
  '|-supereffective|p1a: Whimsicott',
  '|-damage|p1a: Whimsicott|20/100',
  '|cant|p1b: Farigiraf|flinch',
  '|upkeep',
  '|turn|2',
  '|switch|p1b: Charizard|Charizard, L50, M|100/100',
  '|move|p1a: Whimsicott|Moonblast|p2b: Incineroar',
  '|-resisted|p2b: Incineroar',
  '|-damage|p2b: Incineroar|80/100',
  '|move|p2b: Incineroar|Flare Blitz|p1b: Charizard',
  '|-resisted|p1b: Charizard',
  '|-damage|p1b: Charizard|85/100',
  '|move|p2a: Gengar|Shadow Ball|p1a: Whimsicott',
  '|-damage|p1a: Whimsicott|0 fnt',
  '|faint|p1a: Whimsicott',
  '|upkeep',
  '|switch|p1a: Garchomp|Garchomp, L50, M|100/100',
  '|turn|3',
  '|detailschange|p1b: Charizard|Charizard-Mega-Y, L50, M',
  '|-mega|p1b: Charizard|Charizard|Charizardite Y',
  '|move|p1b: Charizard|Heat Wave|p2a: Gengar|[spread] p2a,p2b',
  '|-damage|p2a: Gengar|0 fnt',
  '|-resisted|p2b: Incineroar',
  '|-damage|p2b: Incineroar|60/100',
  '|faint|p2a: Gengar',
  '|move|p1a: Garchomp|Earthquake|p2b: Incineroar|[spread] p2b',
  '|-supereffective|p2b: Incineroar',
  '|-damage|p2b: Incineroar|10/100',
  '|upkeep',
  '|switch|p2a: Kingambit|Kingambit, L50, M|100/100',
  '|turn|4',
  '|switch|p1a: Farigiraf|Farigiraf, L50, F|90/100',
  '|move|p2a: Kingambit|Kowtow Cleave|p1a: Farigiraf',
  '|-supereffective|p1a: Farigiraf',
  '|-damage|p1a: Farigiraf|0 fnt',
  '|faint|p1a: Farigiraf',
  '|move|p1b: Charizard|Heat Wave|p2a: Kingambit|[spread] p2a,p2b',
  '|-supereffective|p2a: Kingambit',
  '|-damage|p2a: Kingambit|50/100',
  '|-damage|p2b: Incineroar|0 fnt',
  '|faint|p2b: Incineroar',
  '|upkeep',
  '|switch|p1a: Garchomp|Garchomp, L50, M|100/100',
  '|switch|p2b: Gardevoir|Gardevoir, L50, F|100/100',
  '|turn|5',
  '|-message|Bob forfeited.',
  '|win|Alice',
].join('\n');
let logResult = null;
{
  const r = TAC.fromLog(LOG, { me: 'p1' });
  logResult = r;
  const a = r.p1, b = r.p2;
  ok('LOG', r.winner === 'p1' && r.names.p1 === 'Alice' && r.ratings.p1 === 1500, 'winner/names/ratings: ' + JSON.stringify([r.winner, r.names, r.ratings]));
  ok('LOG', a.speed.used === 1 && a.speed.by_class.tailwind === 1 && a.speed.first_turn === 1, 'p1 speed control used ' + a.speed.used + ' ' + JSON.stringify(a.speed.by_class));
  ok('LOG', a.speed.mattered === 1, 'p1 Tailwind under a faster Gengar not judged mattered: ' + JSON.stringify(a.speed.uses));
  ok('LOG', a.speed.avail_turns >= 2, 'p1 speed control available on ' + a.speed.avail_turns + ' turns');
  ok('LOG', a.mega.megaed === 1 && a.mega.turn === 3 && a.mega.slot === 'b' && a.mega.capable_turn === 3, 'p1 mega ' + JSON.stringify(a.mega));
  ok('LOG', b.mega.megaed === 1 && b.mega.turn === 1 && b.mega.slot === 'a', 'p2 mega ' + JSON.stringify(b.mega));
  ok('LOG', a.switch.voluntary === 2 && a.switch.into_resist_or_immune === 1 && a.switch.into_ko === 1, 'p1 voluntary ' + a.switch.voluntary + ', into resist ' + a.switch.into_resist_or_immune + ', into KO ' + a.switch.into_ko);
  ok('LOG', a.switch.forced === 2 && b.switch.forced === 2, 'forced p1 ' + a.switch.forced + ' p2 ' + b.switch.forced);
  ok('LOG', b.speed.foe_tw_turns >= 1, 'p2 faced the Tailwind on ' + b.speed.foe_tw_turns + ' turns');
  ok('LOG', a.switch.preserved_scored === 0 && b.switch.voluntary === 0, 'p1 preserved ' + a.switch.preserved_scored + ', p2 voluntary ' + b.switch.voluntary);
  console.log('  LOG p1 ' + JSON.stringify({ speed: a.speed.used + '/' + a.speed.mattered, mega: [a.mega.turn, a.mega.slot], sw: [a.switch.voluntary, a.switch.forced, a.switch.into_ko, a.switch.into_resist_or_immune] }) + '  p2 mega ' + JSON.stringify([b.mega.turn, b.mega.slot]));
}

/* ---------------- REPORT ---------------- */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tactics-run-'));
  try {
    fs.mkdirSync(path.join(dir, 'games', 'alice'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'games', 'alice', 'battle-x-1.log'), LOG + '\n');
    fs.writeFileSync(path.join(dir, 'games', 'alice', 'battle-x-2.log'), LOG.split('\n').slice(0, 20).join('\n') + '\n');   // unfinished
    fs.writeFileSync(path.join(dir, 'decisions-alice.jsonl'), JSON.stringify({ room: 'battle-x-1', arm: 'A', policy: 'miltank-gen5' }) + '\n');
    const t = require('../rotom/report.js').tacticsOfRun(dir);
    const A = t.by_arm.A;
    ok('REPORT', t.finished === 1 && t.unfinished === 1, 'finished ' + t.finished + ', unfinished ' + t.unfinished);
    ok('REPORT', A && A.ours.all.speed.used === 1 && A.ours.all.mega.megaed === 1 && A.ours.all.switch.voluntary === 2 && A.ours.won.games === 1, 'arm A tactics ' + JSON.stringify(A && A.ours.all.rates));
    const L = A ? TAC.lines(A.ours.all, 'x') : [];
    ok('REPORT', L.length === 4 && /speed control/.test(L[1]) && /mega/.test(L[2]) && /switches/.test(L[3]), 'printed lines ' + JSON.stringify(L));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

/* ---------------- ROTOM ---------------- */
{
  const src = fs.readFileSync(path.join(ROOT, 'solver', 'rotom', 'rotom.js'), 'utf8');
  ok('ROTOM', /TAC\.fromLog\(/.test(src) && /\n\s*tactics,\n/.test(src) && /tactics: ST\.tactics/.test(src), 'rotom.js does not call TAC.fromLog and write `tactics` into the record and the summary');
  const play = fs.readFileSync(path.join(ROOT, 'solver', 'mew', 'play.js'), 'utf8');
  ok('ROTOM', /tg\.before\(S/.test(play) && /tg\.after\(S\)/.test(play) && /tactics: r\.tactics \?/.test(play), 'mew/play.js does not run TAC.game on every step and write tactics.x / tactics.y on the match row');
}

/* ---------------- ENGINE ---------------- */
(async () => {
  if (!fs.existsSync(path.join(ROOT, 'data', 'releases', REL, 'release.json'))) cannot('release ' + REL + ' is not on disk');
  const E = require('../arena/engine.js').load(REL);
  const API = E.API, M = API.M;
  const T = require('../arena/teams.js');
  const row = (species, item, ability, moves, nature) => ({ species, item, ability, moves, nature });
  const G = { id: 'tactics-stage', sheets: {
    p1: [row('Whimsicott', 'Focus Sash', 'Prankster', ['Tailwind', 'Moonblast', 'Encore', 'Protect'], 'Timid'),
         row('Charizard', 'Charizardite Y', 'Blaze', ['Heat Wave', 'Solar Beam', 'Protect', 'Scorching Sands'], 'Timid'),
         row('Garchomp', 'Sitrus Berry', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Protect', 'Rock Slide'], 'Jolly'),
         row('Gengar', 'Black Sludge', 'Cursed Body', ['Shadow Ball', 'Sludge Bomb', 'Protect', 'Icy Wind'], 'Timid'),
         row('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Parting Shot', 'Protect'], 'Careful'),
         row('Kingambit', 'Black Glasses', 'Defiant', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect'], 'Adamant')],
    p2: [row('Farigiraf', 'Sitrus Berry', 'Armor Tail', ['Trick Room', 'Psychic', 'Protect', 'Helping Hand'], 'Quiet'),
         row('Incineroar', 'Sitrus Berry', 'Intimidate', ['Fake Out', 'Flare Blitz', 'Parting Shot', 'Protect'], 'Careful'),
         row('Garchomp', 'Sitrus Berry', 'Rough Skin', ['Earthquake', 'Dragon Claw', 'Protect', 'Rock Slide'], 'Jolly'),
         row('Kingambit', 'Black Glasses', 'Defiant', ['Kowtow Cleave', 'Sucker Punch', 'Iron Head', 'Protect'], 'Adamant'),
         row('Whimsicott', 'Focus Sash', 'Prankster', ['Tailwind', 'Moonblast', 'Encore', 'Protect'], 'Timid'),
         row('Charizard', 'Charizardite Y', 'Blaze', ['Heat Wave', 'Solar Beam', 'Protect', 'Scorching Sands'], 'Timid')] },
    brought: { p1: [0, 1, 2, 3], p2: [0, 1, 2, 3] } };
  const a = T.buildTeam(M, G, 'p1'), b = T.buildTeam(M, G, 'p2');
  if (!a || !b) cannot('the staged teams did not build');
  const rng = API.makeRng(7);
  const S = API.newBattle(a.team, b.team, { rng });
  const g = TAC.game(API);
  const pick = (side, slot, pred, what) => {
    const L = API.legalActions(S, side).slots[slot].options;
    const o = L.find(pred);
    if (!o) cannot('no legal option for ' + side + ' slot ' + slot + ': ' + what + ' among ' + L.map(x => x.choice).join(' | '));
    return o;
  };
  /* turn 1: A switches Whimsicott out for Gengar (Fake Out cannot touch a Ghost) and megas Charizard; B sets Trick Room and Fake Outs slot a */
  const jA1 = [pick('A', 0, o => o.kind === 'switch' && /gengar/.test(o.ident), 'switch gengar'), pick('A', 1, o => o.kind === 'move' && o.move === 'heatwave' && o.mega, 'heat wave mega')];
  const jB1 = [pick('B', 0, o => o.kind === 'move' && o.move === 'trickroom', 'trick room'), pick('B', 1, o => o.kind === 'move' && o.move === 'fakeout' && o.target === 1, 'fake out at slot a')];
  g.before(S, jA1, jB1); API.stepInPlace(S, jA1, jB1, rng); g.after(S);
  /* turn 2: A's Gengar uses Icy Wind (a foe drop); everyone else protects */
  const jA2 = [pick('A', 0, o => o.kind === 'move' && o.move === 'icywind', 'icy wind'), pick('A', 1, o => o.kind === 'move' && o.move === 'protect', 'protect')];
  const jB2 = [pick('B', 0, o => o.kind === 'move' && o.move === 'protect', 'protect'), pick('B', 1, o => o.kind === 'move' && o.move === 'protect', 'protect')];
  g.before(S, jA2, jB2); API.stepInPlace(S, jA2, jB2, rng); g.after(S);
  const out = g.out();
  const A = out.A, B = out.B;
  ok('ENGINE', A.mega.megaed === 1 && A.mega.turn === 1 && A.mega.slot === 'b', 'A mega ' + JSON.stringify(A.mega));
  ok('ENGINE', A.switch.voluntary === 1 && A.switch.into_resist_or_immune === 1, 'A switch ' + JSON.stringify(A.switch));
  ok('ENGINE', A.speed.used === 1 && A.speed.by_class.foe_drop === 1, 'A speed ' + JSON.stringify(A.speed.by_class) + ' used ' + A.speed.used);
  ok('ENGINE', B.speed.used >= 1 && B.speed.by_class.trickroom === 1, 'B speed ' + JSON.stringify(B.speed.by_class));
  ok('ENGINE', A.speed.avail_turns >= 1 && A.speed.foe_tr_turns >= 1, 'A avail ' + A.speed.avail_turns + ', faced Trick Room ' + A.speed.foe_tr_turns);
  console.log('  ENGINE A ' + JSON.stringify({ speed: A.speed.by_class, mega: [A.mega.turn, A.mega.slot], sw: [A.switch.voluntary, A.switch.into_resist_or_immune] }) + '  B ' + JSON.stringify(B.speed.by_class) + '  release ' + E.id);

  console.log('test-tactics: ' + (checks - fails) + '/' + checks + ' checks' + (TAC.BREAK ? '  [BREAK ' + TAC.BREAK + ']' : '') + '  failed clauses: ' + ([...failed].join(',') || 'none'));
  if (!NO_RED && !TAC.BREAK) {
    const res = cp.spawnSync(process.execPath, [__filename, '--no-red'], { env: Object.assign({}, process.env, { TACTICS_BREAK: 'blind' }), encoding: 'utf8' });
    const line = (res.stdout || '').split('\n').find(l => l.startsWith('test-tactics:')) || '';
    const seen = /failed clauses: .*\bLOG\b/.test(line) && /\bENGINE\b/.test(line) && res.status === 1;
    console.log('  RED TACTICS_BREAK=blind -> LOG and ENGINE: ' + (seen ? 'fail as required' : 'STAYED GREEN (blind)') + '   [' + line.trim() + ']');
    if (!seen) process.exit(3);
  }
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('CANNOT ANSWER: ' + (e && e.stack || e)); process.exit(2); });
