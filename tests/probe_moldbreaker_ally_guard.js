/* probe_moldbreaker_ally_guard.js — FRIEND GUARD IS `breakable` AND THE AUTHORITY SUPPRESSES IT ON THE
 * EFFECT HOLDER, NOT ON THE TARGET — SO A MOLD BREAKER PUNCHES THROUGH AN ALLY'S GUARD. 2026-09-05.
 *
 *   SHOWDOWN_PATH=... node tests/probe_moldbreaker_ally_guard.js
 *   SHOWDOWN_PATH=... node tests/probe_moldbreaker_ally_guard.js --only moldbreaker-vs-friendguard
 *
 * ================= WHAT THE AUTHORITY DOES, READ AND NOT RECALLED =================================
 *
 *     data/abilities.ts   friendguard: { onAnyModifyDamage(...) { ... chainModify(0.75) },
 *                                        flags: { breakable: 1 }, ... }
 *
 *     sim/battle.ts:836-841   (inside runEvent's handler loop)
 *       if (effect.effectType === 'Ability' && effect.flags['breakable'] &&
 *           this.suppressingAbility(effectHolder as Pokemon)) { ...; continue; }
 *
 *     sim/battle.ts:365-368
 *       suppressingAbility(target) {
 *         return this.activePokemon && this.activePokemon.isActive &&
 *                (this.activePokemon !== target || this.gen < 8) &&
 *                this.activeMove && this.activeMove.ignoreAbility && !target?.hasItem('Ability Shield');
 *       }
 *
 * THE LOAD-BEARING WORD IS `effectHolder`. The gate is asked about the body CARRYING the handler, and
 * for `onAnyModifyDamage` that is the ALLY standing beside the target — not the target. So a Mold
 * Breaker attacker suppresses a Friend Guard on the far side even though Friend Guard is nobody's
 * "defender ability". Champions overrides neither ability (checked at run time below).
 *
 * ================= WHAT THIS ENGINE DID ==========================================================
 *
 * `_hitCtx` read the partner's ability RAW:
 *
 *     const _fg = _pal && TAGS.param('ability', _pal.ability, 'reducesAllyDamage');
 *     if (_fg && _fg.mult) c.allyDamageMult = +_fg.mult;
 *
 * `suppressedAbility(att, def, category)` already exists in this file, already reads the `breakable`
 * tag, already honours Ability Shield and already honours Mycelium Might's `onlyCategory` — and this
 * one site never called it. Every other reader of a breakable ability does.
 *
 * ================= WHERE IT WAS FOUND ============================================================
 *
 * ROADMAP #542's seventh card, the one it filed as UNATTRIBUTED: release `8ad06030e129`, arm `middle`,
 * config `omit-spread`, `|-damage|p1a: Lucario|75/145` against `93/145` — Showdown deals 70 where this
 * engine deals 52, and 70 -> Friend Guard is `tr((70*3072 + 2048)/4096) = 52` exactly. The sheets in
 * `data/team-pool-frozen` name the two bodies: **Tinkaton with Mold Breaker** swinging Gigaton Hammer,
 * **Maushold-Four with Friend Guard** standing beside the Lucario. #542 called it "a STEEL move that no
 * aura can reach", which is right; the multiplier was never an aura.
 *
 * ================= NOTHING BELOW IS TYPED ========================================================
 *
 * No arm declares a damage number. Both engines play the identical one-turn script under the
 * differential's own `middle` pin, and the file asserts (a) that they agree on the damage line and the
 * board, (b) that `MEDI_ALLY_GUARD_UNBREAKABLE=1` parts the red arms and moves no control, and (c) the
 * cross-arm claim, read off SHOWDOWN alone: the Mold Breaker arm must take the SAME damage as the arm
 * with no Friend Guard on the board at all, and MORE than the arm whose attacker carries Own Tempo
 * instead. Without (c) every "the engines agree" could be a board where Friend Guard never mattered.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
const NL = '\n';
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
if (!process.argv.includes('--end-state')) process.argv.push('--end-state');
if (!process.argv.includes('--state')) process.argv.push('--state');

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) REL_ID = ER.cut('tests/probe_moldbreaker_ally_guard.js — freeze the tree under test').id;
if (!process.argv.includes('--release')) process.argv.push('--release', REL_ID);
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');
const KNOB = 'MEDI_ALLY_GUARD_UNBREAKABLE';

let _cur = null, _G = null;
function harness(knobOn) {
  const key = knobOn ? 'on' : 'off';
  if (_G && _cur === key) return _G;
  if (knobOn) process.env[KNOB] = '1'; else delete process.env[KNOB];
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  if (_G) console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  _cur = key;
  return _G;
}

/* ---- THE BOARD ---------------------------------------------------------------------------------
 * THE ATTACKER'S ABILITY IS THE KNOB AND IT IS THE SAME BODY IN BOTH ARMS. Tinkaton's slot 0 is Mold
 * Breaker and its slot 1 is Own Tempo — one legal body, two legal abilities, one of which ignores
 * abilities and one of which does nothing here at all. The FIRST version of this file used two
 * different attackers and would have been comparing two damage formulas rather than one gate.
 *
 * THE ALLY'S ABILITY IS THE SECOND KNOB, on the same rule: Maushold-Four's slot 0 is Friend Guard and
 * its hidden ability is Technician, which touches nothing on this board (no move here is 60 BP or
 * under from Maushold, and Maushold never attacks).
 *
 * GIGATON HAMMER IS THE CLICK BECAUSE IT IS THE POOL GAME'S CLICK. It carries no `contact` flag, so no
 * contact reaction can enter the comparison, and it is RESISTED by Lucario (Fighting/Steel), so nothing
 * faints on turn 1 and the damage line is the whole observable. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const BENCH = (...n) => n.map(x => ({ species: x, item: '', ability: '', moves: ['Protect'] }));

const TINK = ab => ['tinkaton', '', ab, ['Gigaton Hammer', 'Facade', 'Protect']];
const LUCA = ['lucario', '', 'Inner Focus', ['Swords Dance', 'Protect', 'Close Combat']];
const MAUS = ab => ['mausholdfour', '', ab, ['Protect', 'Super Fang']];
const LAX = ['snorlax', '', 'Immunity', ['Protect']];

const ATT = ab => stage([TINK(ab), LAX]).concat(BENCH('clefable', 'sylveon'));
const VIC = ab => stage([LUCA, MAUS(ab)]).concat(BENCH('garchomp', 'milotic'));

const GH = { m: 'gigatonhammer', t: 0 }, P = { m: 'protect' }, SD = { m: 'swordsdance' };
const SCRIPT = [{ p1: [GH, P], p2: [SD, P] }];
const SCRIPT_M = [{ p1: [SD, P], p2: [GH, P] }];

const CASES = [
  { id: 'moldbreaker-vs-friendguard', kind: 'red', mirror: false, att: 'Mold Breaker', ally: 'Friend Guard', broke: 1,
    what: 'THE POOL GAME\'S OWN BOARD. Tinkaton/Mold Breaker swings Gigaton Hammer at a Lucario whose '
        + 'partner is a Friend Guard Maushold-Four. `friendguard.flags.breakable` is set and '
        + '`sim/battle.ts:837` asks `suppressingAbility(effectHolder)` — the MAUSHOLD — so the '
        + 'authority never runs the handler and the hit lands at full price. This engine applied the '
        + '0.75 anyway, which is 70 damage against 52 on the pool board.' },

  { id: 'moldbreaker-vs-friendguard-mirror', kind: 'red', mirror: true, att: 'Mold Breaker', ally: 'Friend Guard', broke: 1,
    what: 'THE SAME DEFECT WITH THE SIDES EXCHANGED WHOLE — the `_hitCtx` partner lookup resolves the '
        + 'target\'s side from `actA`/`actB`, so a fix that reached one side only fails here.' },

  { id: 'owntempo-vs-friendguard', kind: 'control', mirror: false, att: 'Own Tempo', ally: 'Friend Guard', broke: 0,
    differsFrom: 'moldbreaker-vs-friendguard',
    what: 'THE BREAKER CLEARED EXPLICITLY, ON THE SAME BODY. Tinkaton carries Own Tempo — its other '
        + 'legal ability — so nothing is suppressed, Friend Guard runs on BOTH engines and the hit is '
        + 'reduced. Its AUTHORITY damage is asserted DIFFERENT from the red arm\'s, which is what '
        + 'stops every verdict in this file from being read off a board where Friend Guard did '
        + 'nothing. The knob must not move one byte of it.' },

  { id: 'moldbreaker-no-friendguard', kind: 'control', mirror: false, att: 'Mold Breaker', ally: 'Technician', broke: 0,
    sameAs: 'moldbreaker-vs-friendguard',
    what: 'THE GUARD CLEARED EXPLICITLY, ON THE SAME BODY. Maushold-Four carries Technician instead, so '
        + 'there is no Friend Guard on the field at all. Its AUTHORITY damage is asserted EQUAL to the '
        + 'red arm\'s: that equality IS the claim — a suppressed Friend Guard must price exactly like '
        + 'no Friend Guard, and a fix that merely changed the multiplier would fail it.' },

  { id: 'owntempo-no-friendguard', kind: 'control', mirror: false, att: 'Own Tempo', ally: 'Technician', broke: 0,
    sameAs: 'moldbreaker-vs-friendguard',
    what: 'BOTH KNOBS CLEARED AT ONCE — neither mechanism is on the board. Asserted EQUAL to the red '
        + 'arm as well, which pins the unreduced price from a third direction and catches a fix that '
        + 'started suppressing something else.' },
];

/* ---- LEGALITY AND THE MECHANISM, DERIVED AND REFUSED ------------------------------------------- */
const CS = require(D('engine', 'champions_sim.js'));
const dex = CS.sim().Dex.forFormat(CS.FORMAT);
const LS = dex.data.Learnsets;
const legal = x => x && x.exists && !x.isNonstandard && x.tier !== 'Illegal';
const learns = (sp, mv) => {
  let s = dex.species.get(sp); const id = dex.moves.get(mv).id;
  while (s && s.exists) {
    const e = LS[s.id];
    if (e && e.learnset && e.learnset[id]) return true;
    s = s.prevo ? dex.species.get(s.prevo)
      : (s.baseSpecies && s.baseSpecies !== s.name ? dex.species.get(s.baseSpecies) : null);
  }
  return false;
};
let illegal = 0;
const ALLROWS = ATT('Mold Breaker').concat(ATT('Own Tempo'), VIC('Friend Guard'), VIC('Technician'));
for (const row of ALLROWS) {
  const sp = dex.species.get(row.species);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row.species + ' is not in this format'); illegal++; continue; }
  if (row.ability && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row.ability).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row.ability); illegal++;
  }
  for (const mv of row.moves) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row.species, mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* THE POPULATIONS, ENUMERATED FROM THE FORMAT. If a second `onAnyModifyDamage` ability becomes legal,
 * or Friend Guard stops being `breakable`, or Champions starts overriding either one, this file says so
 * and exits rather than reporting a pass about a rule that changed. */
const FG = dex.abilities.get('friendguard');
const MB = dex.abilities.get('moldbreaker');
const ANYMOD = dex.abilities.all().filter(a => legal(a) && a.onAnyModifyDamage).map(a => a.name);
const BREAKERS = dex.abilities.all().filter(a => legal(a) && /ignoreAbility/.test(String(a.onModifyMove || ''))).map(a => a.name);
const fs = require('fs');
const CHAMP = fs.readFileSync(path.join(process.env.SHOWDOWN_PATH, 'data', 'mods', 'champions', 'abilities.ts'), 'utf8');
console.log(NL + '  THE AUTHORITY, RE-DERIVED THIS RUN:');
console.log('    legal onAnyModifyDamage abilities : ' + ANYMOD.join(', '));
console.log('    friendguard flags                 : ' + JSON.stringify(FG.flags));
console.log('    legal ability-ignorers            : ' + BREAKERS.join(', '));
console.log('    moldbreaker onModifyMove          : ' + String(MB.onModifyMove || '').replace(/\s+/g, ' ').slice(0, 90));
console.log('    champions overrides friendguard   : ' + /\bfriendguard\s*:/.test(CHAMP)
  + '   moldbreaker: ' + /\bmoldbreaker\s*:/.test(CHAMP));
if (ANYMOD.length !== 1 || ANYMOD[0] !== 'Friend Guard' || !(FG.flags && FG.flags.breakable)
    || !/ignoreAbility/.test(String(MB.onModifyMove || ''))
    || /\bfriendguard\s*:/.test(CHAMP) || /\bmoldbreaker\s*:/.test(CHAMP)) {
  console.log(NL + 'NOT RUN — the format no longer carries the rule this file is about. '
    + 'That is a finding, not a pass.');
  process.exit(2);
}

/* ---- THE READERS -------------------------------------------------------------------------------- */
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const KEEP = /^\|(move|cant|-damage|-fail|-crit|-supereffective|-resisted|-immune|faint|-activate|-singleturn|-boost)\|/;
function shape(lines) {
  const out = [];
  for (const raw of lines.map(String)) {
    if (!KEEP.test(raw)) continue;
    const p = raw.split('|');
    const tag = p[1], who = norm(String(p[2] || '').split(':').slice(-1)[0]);
    const rest = p.slice(3).filter(x => !/^p[12][ab]:/.test(x))
      .map(x => norm(String(x).replace(/^\s*(move|ability|item):\s*/i, ''))).filter(Boolean);
    out.push(tag + '|' + who + '|' + rest.join('|'));
  }
  return out;
}
/* THE DAMAGE THE LUCARIO TOOK, read off each stream's own `-damage` line as `max - remaining`. Nothing
 * is recomputed: this is the number the engine printed. */
function lucarioDamage(lines) {
  for (const raw of lines.map(String)) {
    const m = /^\|-damage\|p[12][ab]: ?([^|]*)\|(\d+)\/(\d+)/.exec(raw);
    if (m && norm(m[1]) === 'lucario') return (+m[3]) - (+m[2]);
  }
  return null;
}

function play(G, c) {
  const M = REL.require('engine/medicham2-browser.js');
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters(); G.resetChoiceCounters();
  const arm = G.ARM_BY_ID.get('middle');
  if (!arm) { console.log('NOT RUN — the driver has no arm named middle'); process.exit(2); }
  const A = c.mirror ? VIC(c.ally) : ATT(c.att), B = c.mirror ? ATT(c.att) : VIC(c.ally);
  const a = G.buildPair(A), b = G.buildPair(B);
  if (!a || !b) return { notStaged: true };
  const boards = [];
  const r = G.playGame(a, b, 'directed', 'probe_moldbreaker_ally_guard :: ' + c.id, {
    script: c.mirror ? SCRIPT_M : SCRIPT, arm,
    onBoundary: (snap, t) => boards.push({ t, identical: !!snap.identical,
                                           diffs: snap.identical ? [] : (snap.diffs || []).slice(0, 6) }),
  });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  const sdAll = G.sdStream(G.lastSdLog()).map(String);
  const meAll = (r.mediTrace || []).map(String);
  return { r, delta, boards, sd: shape(sdAll), me: shape(meAll),
           sdDmg: lucarioDamage(sdAll), meDmg: lucarioDamage(meAll),
           sc: G.scriptCounters(), cc: G.choiceCounters(),
           restored: (globalThis.MEDFAILS || {}).allyGuardUnbreakableRestored || 0 };
}

const eq = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
const boardEq = rows => rows.every(r => r.identical);
const boardStr = rows => rows.map(r => 'b' + r.t + ':' + (r.identical ? 'ok' : 'PART')).join(' ');

let bad = 0, ran = 0;
const seen = new Map();
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  console.log(NL + '================================================================');
  console.log('  ' + c.id + '   [' + c.kind + ']   attacker ' + c.att + '   ally ' + c.ally);
  console.log('  ' + c.what);

  const clean = play(harness(false), c);
  if (clean.notStaged) { console.log('  NOT-STAGED — buildPair refused a sheet'); bad++; continue; }
  if (clean.r.err) { console.log('  THREW — ' + clean.r.err); bad++; continue; }
  const brk = play(harness(true), c);
  harness(false);
  ran++;

  console.log('    Lucario lost   showdown ' + clean.sdDmg + '   medicham ' + clean.meDmg
    + '   |   knob medicham ' + brk.meDmg);
  console.log('    board          ' + boardStr(clean.boards) + '   |   knob ' + boardStr(brk.boards));
  if (!boardEq(clean.boards)) for (const b of clean.boards) if (!b.identical) console.log('      b' + b.t + ' diffs ' + JSON.stringify(b.diffs));
  console.log('    counters  friendGuardChain ' + (clean.delta.friendGuardChain || 0)
    + '  allyGuardBrokenByBreaker ' + (clean.delta.allyGuardBrokenByBreaker || 0)
    + '   |   knob friendGuardChain ' + ((brk.delta || {}).friendGuardChain || 0)
    + '   |   expected broke ' + c.broke);
  console.log('    MEDFAILS stamp  clean ' + clean.restored + '  knob ' + brk.restored
    + '   |   clicks not on request ' + clean.sc.moveNotOnRequest
    + (clean.sc.firstMissing ? ' (' + clean.sc.firstMissing + ')' : '')
    + '   |   choices refused ' + clean.cc.refused);

  if (clean.sc.moveNotOnRequest || brk.sc.moveNotOnRequest) {
    console.log('    >> FIXTURE FAILED — a scripted click was not on the request.'); bad++; continue; }
  if (clean.cc.refused || brk.cc.refused) {
    console.log('    >> FIXTURE FAILED — the authority refused a choice.'); bad++; continue; }
  if (!(clean.sdDmg > 0)) {
    console.log('    >> FIXTURE FAILED — the authority dealt no damage to the Lucario, so this arm '
      + 'measures nothing.'); bad++; continue; }
  if (!(clean.restored === 0 && brk.restored === 1)) {
    console.log('    >> KNOB DID NOT BIND — the load-time stamp is not absent-clean/present-on-knob.');
    bad++; continue; }
  /* THE BRANCH COUNTER, EXACT. `allyGuardBrokenByBreaker` is the suppression actually firing; a red arm
   * at 0 would be agreeing for some other reason entirely. */
  if ((clean.delta.allyGuardBrokenByBreaker || 0) !== c.broke) {
    console.log('    >> THE BRANCH DID NOT RUN AS CLAIMED.'); bad++; }

  seen.set(c.id, { sdDmg: clean.sdDmg, sd: clean.sd });

  const agree = eq(clean.sd, clean.me) && boardEq(clean.boards) && clean.sdDmg === clean.meDmg;
  if (!agree) { console.log('    >> DEFECT — the engines part on the damage line or on the board.'); bad++; }
  else console.log('    >> the two engines agree on the damage AND on the board.');

  const knobAgree = eq(clean.sd, brk.me) && boardEq(brk.boards) && clean.sdDmg === brk.meDmg;
  if (c.kind === 'red') {
    if (knobAgree) { console.log('    >> THE KNOB DID NOT MOVE THE OUTCOME — this arm proves nothing.'); bad++; }
    else console.log('    >> and the knob puts them back apart, which is what makes this a red arm.');
  } else {
    if (!knobAgree) { console.log('    >> OVER-FIRE — a control moved under the knob, so the change is not confined.'); bad++; }
  }
}

/* ---- THE CROSS-ARM CLAIM, READ OFF SHOWDOWN ALONE ----------------------------------------------
 * `differsFrom` — Friend Guard must actually change the authority's number somewhere, or nothing here
 * is about Friend Guard. `sameAs` — a SUPPRESSED Friend Guard must price identically to no Friend
 * Guard at all, which is the whole content of the rule and cannot be read off a single arm. */
for (const c of CASES) {
  const a = seen.get(c.id);
  if (!a) continue;
  if (c.differsFrom) {
    const b = seen.get(c.differsFrom);
    if (b) {
      const moved = a.sdDmg !== b.sdDmg;
      console.log(NL + '  INSTRUMENT CONTROL — showdown deals ' + a.sdDmg + ' on `' + c.id + '` against '
        + b.sdDmg + ' on `' + c.differsFrom + '`: ' + (moved ? 'DIFFERENT' : 'THE SAME'));
      if (!moved) { console.log('    >> FRIEND GUARD DID NOTHING IN THE AUTHORITY EITHER — nothing here measures anything.'); bad++; }
    }
  }
  if (c.sameAs) {
    const b = seen.get(c.sameAs);
    if (b) {
      const same = a.sdDmg === b.sdDmg;
      console.log(NL + '  THE RULE — showdown deals ' + a.sdDmg + ' on `' + c.id + '` against '
        + b.sdDmg + ' on `' + c.sameAs + '`: ' + (same ? 'EQUAL' : 'DIFFERENT'));
      if (!same) { console.log('    >> A SUPPRESSED FRIEND GUARD DID NOT PRICE LIKE NO FRIEND GUARD.'); bad++; }
    }
  }
}

console.log(NL + (bad ? bad + ' failure(s) across ' + ran + ' arm(s)' : 'all ' + ran + ' arms clear'));
process.exit(bad ? 1 : 0);
