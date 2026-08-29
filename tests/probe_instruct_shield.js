/* probe_instruct_shield.js — INSTRUCT NEVER ASKS THE SHIELD, AND A SHIELD REFUSES IT. 2026-08-27.
 *
 *   SHOWDOWN_PATH=... node tests/probe_instruct_shield.js --release <id>
 *   SHOWDOWN_PATH=... node tests/probe_instruct_shield.js --release <id> --only instruct-foe-protect
 *
 * `--release` IS REQUIRED AND THIS FILE NEVER CUTS ONE. Every other probe in this directory cuts a
 * release at require time when the flag is absent; that writes into the real store, and this file was
 * written while another agent held `engine/medicham2-browser.js` — the live bytes moved 94 lines
 * under a scan taken forty minutes earlier. A diagnosis that cannot say WHICH engine it measured is
 * not a diagnosis.
 *
 * ================= WHAT THE AUTHORITY DOES, READ RATHER THAN RECALLED ===========================
 *
 * Instruct carries `flags: { protect: 1, bypasssub: 1, allyanim: 1, failinstruct: 1 }` and
 * `category: "Status"` (`data/moves.ts:9644-9677`; Champions overrides Instruct NOWHERE — the only
 * mention in `data/mods/champions/` is `learnsets.ts:12384`, `instruct: ["9M"]`). So
 * `checkMoveBypassesProtect` (`sim/battle.ts:1300-1302`) answers
 *
 *     if ((move.category !== 'Status' || blockStatus) && move.flags['protect'] &&
 *         this.runEvent('HitProtect', attacker, defender, move)) return false;
 *
 * with `blockStatus` at its default `true`, so `protect.condition.onTryHit` (`data/moves.ts:13987`)
 * does NOT return early: it writes `this.add('-activate', target, 'move: Protect')` and returns
 * `this.NOT_FAIL`. Instruct's `onHit` — which is where the second action is queued — is never
 * reached, because `hitStepTryHitEvent` filters the target out at step 1.
 *
 * STAGED, NOT ARGUED. Oranguru is the ONLY legal Instruct user in this regulation (derived below).
 * The authority, `gen9championsvgc2026regmb`, seed [1,2,3,4]:
 *
 *     |move|p2a: Oranguru|Instruct|p1a: Alakazam
 *     |-activate|p1a: Alakazam|move: Protect            <- a FOE'S shield
 *
 *     |move|p2a: Oranguru|Instruct|p2b: Garchomp
 *     |-activate|p2b: Garchomp|move: Protect            <- an ALLY'S shield, identically
 *
 * against the unshielded control, which is what the line looks like when it works:
 *
 *     |move|p2a: Oranguru|Instruct|p2b: Garchomp
 *     |-singleturn|p2b: Garchomp|move: Instruct|[of] p2a: Oranguru
 *     |move|p2b: Garchomp|Rock Slide|...               <- the SECOND action
 *
 * THERE IS NO ALLY EXCEPTION. `checkMoveBypassesProtect` never looks at sides, and the ally arm above
 * is the measurement of that rather than a reading of the source. It is the commoner board by far and
 * IT CANNOT BE STAGED HERE — the driver's script format resolves a `normal` move to `foes[t]` on both
 * sides (`engine/game_differential.js:4281` and `:5521`), so an ally-aimed `normal` move is
 * inexpressible. Every arm below therefore aims Instruct at a FOE, which the authority treats
 * identically, and the ally half is OWED.
 *
 * ================= WHAT THIS ENGINE DOES ========================================================
 *
 * The `instruct` branch checks Good as Gold, Instruct's own `refuses` list, `_charging` and
 * `_recharge`, and calls `shieldRefuses` NOWHERE. It is not a misplaced announcement like the seven
 * sites closed earlier today (ROADMAP #508) — it is a MISSING CALLER, and what comes out of it is an
 * EXTRA ACTION: `acts.splice(actIdx+1, 0, _entry)` puts a second click into a turn the authority
 * never gave one to. `MEDSEEN.instructRepeat` counts it, and every arm below reads that counter, so
 * "the streams parted" and "a second action happened" are two separate observations rather than one.
 *
 * ================= NOTHING HERE IS TYPED ========================================================
 *
 * No arm declares an expected line: both engines play the same script under the differential's own
 * pin and the pass is that the two protocol streams do not part. SHOWDOWN IS THE EXPECTATION. There
 * is no revert knob because there is no code to revert — a missing caller has no old shape — so a red
 * arm is one that PARTS on the clean load, and the controls are what stop that being read as
 * "Instruct is broken generally".
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) {
  console.log('NOT RUN — the official simulator is absent. This is not a pass.');
  process.exit(2);
}
/* ---- THE RELEASE, AND WHY THE OLD REFUSAL IS REPLACED RATHER THAN RELAXED. 2026-08-29 -----------
 *
 * This file used to exit 2 unless it was handed `--release <id>`, and the reason it gave was DATED:
 * "the tree it would freeze is being edited by another agent". That was true on 2026-08-27 and it is
 * not a property of the check. What it cost is that this probe had NO RUNNER — a `VERIFIED BY` marker
 * would have to name a literal release id, which strands the moment the id ages out (LESSONS §12), so
 * the three red arms below could only ever be DEBT in the register instead of evidence. `engine/
 * quarantine.js`'s open-defect clause counts a row whose instrument is RED; a row nothing runs holds
 * nothing shut, which is #527's problem in a second file.
 *
 * The hazard the refusal was about is real and is answered by the mechanism its SIBLING already uses
 * — `tests/probe_shield_refusal_line.js`, the other half of this same shield family. Preloading
 * `tests/_live_release.js` redirects `cut`/`open` to a throwaway store under the OS temp directory, so
 * a bare run freezes the LIVE tree and `data/releases/` and `data/engine-release.json` are never
 * written. It must be required BEFORE `engine_release.js` is, and it announces itself on stderr, so a
 * run that used it cannot be mistaken for one that did not. `--release <id>` still wins when given,
 * which is what a published measurement must use — a scratch id is not reproducible. */
if (!process.argv.includes('--release')) require(D('tests', '_live_release.js'));

const ARG = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = ARG('--only');
const NL = String.fromCharCode(10);

const ER = require(D('engine', 'engine_release.js'));
let REL_ID = ARG('--release');
if (!REL_ID) {
  REL_ID = ER.cut('tests/probe_instruct_shield.js — freeze the tree under test').id;
  process.argv.push('--release', REL_ID);
}
const REL = ER.open(REL_ID);
const MEDI_PATH = REL.path('engine/medicham2-browser.js');
const GD_PATH = D('engine', 'game_differential.js');

let _G = null;
function harness() {
  if (_G) return _G;
  delete require.cache[require.resolve(MEDI_PATH)];
  delete require.cache[require.resolve(GD_PATH)];
  const log = console.log;
  console.log = () => {};
  try { _G = require(GD_PATH); } finally { console.log = log; }
  return _G;
}

/* ---- SCENARIO SUGAR ---------------------------------------------------------------------------
 * ONE TURN. Every shield here is priority +4 and every filler slot clicks Protect, so `willAct()` is
 * true for all of them and the shields are standing before Instruct resolves at priority 0. */
const stage = rows => rows.map(r => ({ species: r[0], item: r[1] || '', ability: r[2] || '', moves: r[3] }));
const PROT = { m: 'protect' };
const CM = { m: 'calmmind' };
const WALL_A = [['milotic', '', 'Marvel Scale', ['Protect']], ['snorlax', '', 'Thick Fat', ['Protect']]];
const WALL_B = [['toxapex', '', 'Regenerator', ['Protect']], ['corviknight', '', 'Pressure', ['Protect']]];
/* THE MOVER IS THE SAME IN EVERY ARM. Oranguru is the only legal Instruct user in this regulation
 * (derived and printed below), and Inner Focus rather than Telepathy or Symbiosis so nothing on the
 * mover's side can absorb, redirect or re-target anything. */
const ORA = ['oranguru', '', 'Inner Focus', ['Instruct', 'Protect']];
const B_SIDE = [ORA, ['garchomp', '', 'Rough Skin', ['Protect']]].concat(WALL_B);
const AT = p1aClick => [{ p1: [p1aClick, PROT], p2: [{ m: 'instruct', t: 0 }, PROT] }];

const CASES = [
  { id: 'instruct-foe-protect', kind: 'red',
    A: [['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']]].concat([['clefable', '', 'Unaware', ['Protect']]]).concat(WALL_A),
    script: AT(PROT), shield: 'protect',
    what: 'THE MOVE, THE SHIELD EVERYBODY CLICKS. Alakazam Inner Focus: not Gholdengo (Good as Gold '
        + 'is the one refusal the branch DOES ask), and its last move is Protect, which carries no '
        + '`failinstruct` — so Instruct has exactly one reason to be refused and it is the shield.' },

  { id: 'instruct-foe-spikyshield', kind: 'red',
    A: [['chesnaught', '', 'Bulletproof', ['Spiky Shield', 'Iron Defense']], ['clefable', '', 'Unaware', ['Protect']]].concat(WALL_A),
    script: AT({ m: 'spikyshield' }), shield: 'spikyshield',
    what: 'THE SAME RULE THROUGH A SECOND MEMBER OF THE SHIELD FAMILY, so the arm above cannot be '
        + 'read as being about the move `protect`. `shieldsUser.blocksStatus` is true for Spiky '
        + 'Shield (printed below, off the artifact) and Spiky Shield carries no `failinstruct`.' },

  { id: 'instruct-foe-banefulbunker', kind: 'red',
    A: [['toxapex', '', 'Regenerator', ['Baneful Bunker', 'Recover']], ['clefable', '', 'Unaware', ['Protect']]].concat(WALL_A),
    script: AT({ m: 'banefulbunker' }), shield: 'banefulbunker',
    what: 'A THIRD MEMBER, and the one whose own effect (poison on contact) cannot fire against a '
        + 'Status move — so if this arm parts it is the refusal and not the bunker\'s payload.' },

  /* ---- THE CONTROLS ---------------------------------------------------------------------------- */
  { id: 'instruct-foe-kingsshield', kind: 'control',
    A: [['aegislash', '', 'Stance Change', ["King's Shield", 'Iron Defense']], ['clefable', '', 'Unaware', ['Protect']]].concat(WALL_A),
    script: AT({ m: 'kingsshield' }), shield: 'kingsshield',
    expectReasons: ['instruct:lastMoveRefused'],
    what: 'THE OVER-FIRE CONTROL, AND IT IS A SHIELD THAT IS UP. King\'s Shield is the ONE member of '
        + 'the family with `shieldsUser.blocksStatus === false` (derived, printed below), so '
        + '`checkMoveBypassesProtect` returns TRUE for a Status move and `protect.condition.onTryHit` '
        + 'returns early — the shield does not refuse Instruct at all. Instruct then fails for its '
        + 'OWN reason, because King\'s Shield is the one shield carrying `failinstruct` '
        + '(`data/moves.ts` kingsshield.flags), and the authority writes `|-fail|<the MOVER>`. A fix '
        + 'that announced `|-activate|move: Protect` whenever `t.protect` was true would pass all '
        + 'three red arms and BREAK THIS ONE — which is exactly the shape of the defect still sitting '
        + 'in the `status` branch, and the derived reason the patch must read `shieldRefuses` rather '
        + 'than `t.protect`.' },

  { id: 'instruct-foe-noshield', kind: 'control',
    A: [['alakazam', '', 'Inner Focus', ['Protect', 'Calm Mind']], ['clefable', '', 'Unaware', ['Protect']]].concat(WALL_A),
    script: AT(CM), shield: null, wantRepeat: 1,
    what: 'THE SHIELD CLEARED EXPLICITLY — the identical board and the identical Instruct with Calm '
        + 'Mind clicked instead of Protect. Alakazam outspeeds Oranguru, so it really has a last '
        + 'move and the second Calm Mind really resolves in both engines. THIS IS THE ARM THAT MAKES '
        + 'THE OTHERS MEAN ANYTHING: without it, "Instruct ignores the shield" and "Instruct is dead '
        + 'in this engine" produce the same three red arms. It asserts `instructRepeat >= 1`, so a '
        + 'patch that fixed the shield by refusing every Instruct would fail here.' },
];

/* ---- LEGALITY, DERIVED ------------------------------------------------------------------------- */
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
for (const c of CASES) for (const row of c.A.concat(B_SIDE)) {
  const sp = dex.species.get(row[0]);
  if (!legal(sp)) { console.log('ILLEGAL FIXTURE  ' + row[0] + ' is not in this format'); illegal++; continue; }
  if (row[1] && !legal(dex.items.get(row[1]))) {
    console.log('ILLEGAL FIXTURE  ' + row[1] + ' is not in this format'); illegal++;
  }
  if (row[2] && !Object.values(sp.abilities).map(a => dex.abilities.get(a).id)
    .includes(dex.abilities.get(row[2]).id)) {
    console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not have ' + row[2]); illegal++;
  }
  for (const mv of row[3]) {
    const m = dex.moves.get(mv);
    if (!legal(m)) { console.log('ILLEGAL FIXTURE  ' + mv + ' is not in this format'); illegal++; continue; }
    if (!learns(row[0], mv)) { console.log('ILLEGAL FIXTURE  ' + sp.name + ' does not learn ' + m.name); illegal++; }
  }
}
if (illegal) { console.log(NL + 'NOT RUN — ' + illegal + ' illegal fixture(s). This is not a pass.'); process.exit(2); }

/* ---- THE POPULATION, DERIVED ON EVERY RUN ------------------------------------------------------ */
const TAGS = require(REL.path('data/tags.json'));
const users = dex.species.all().filter(legal)
  .filter(s => { const e = LS[s.id]; return e && e.learnset && e.learnset.instruct; }).map(s => s.name);
console.log('LEGAL INSTRUCT USERS IN ' + CS.FORMAT + ': ' + (users.join(', ') || '(NONE)'));
if (!users.length) { console.log('NOT RUN — nothing in this format learns Instruct.'); process.exit(2); }
const IM = dex.moves.get('instruct');
console.log('instruct.flags = ' + JSON.stringify(IM.flags) + '   category = ' + IM.category
  + '   -> a shield can refuse it? ' + !!IM.flags['protect']
  + '   corpus uses (SHEET SLOTS, not clicks) = ' + ((TAGS.moves.instruct || {}).uses || 0));
if (!IM.flags['protect']) {
  console.log('NOT RUN — Instruct does not carry the protect flag in this format, so this file '
    + 'proves nothing.'); process.exit(2);
}
console.log(NL + 'THE SHIELD FAMILY, off `shieldsUser` in this release\'s data/tags.json:');
for (const m of dex.moves.all().filter(legal).filter(m => m.stallingMove)) {
  const p = (TAGS.moves[m.id] || {}).params && TAGS.moves[m.id].params.shieldsUser;
  console.log('  ' + m.id.padEnd(15) + (p ? 'blocksStatus=' + p.blocksStatus : 'NO shieldsUser param — not a shield here')
    + '   failinstruct=' + !!m.flags['failinstruct'] + '   uses=' + ((TAGS.moves[m.id] || {}).uses || 0));
}

/* HOW MANY REASONS IS INSTRUCT REFUSED FOR, NOT COUNTING THE SHIELD? A fixture that qualifies twice
 * proves nothing about either. Derived from the artifact's own `instructsTarget` params and from the
 * abilities tag table, never from a list of names. */
const IP = ((TAGS.moves.instruct || {}).params || {}).instructsTarget || {};
function refusalReasons(c) {
  const [tSp, , tAb] = c.A[0];
  const tA = dex.abilities.get(tAb);
  const out = [];
  const abRow = TAGS.abilities && TAGS.abilities[tA.id];
  if (abRow && (abRow.tags || []).includes('refusesStatusMoves')) out.push('ability:refusesStatusMoves');
  /* the target's last move at the instant Instruct resolves IS its shield click — every shield here
   * is priority +4 — so the one that matters is Instruct's own refused-move list. */
  const last = c.shield || 'calmmind';
  if ((IP.refuses || []).includes(last)) out.push('instruct:lastMoveRefused');
  if (dex.moves.get(last).flags['charge'] || dex.moves.get(last).flags['recharge']) out.push('instruct:chargeOrRecharge');
  return out;
}

/* ---- THE RUN ----------------------------------------------------------------------------------- */
function play(G, c) {
  const arm = G.ARM_BY_ID.get('top-tie-first');
  if (!arm) { console.log('NOT RUN — the driver has no arm named top-tie-first'); process.exit(2); }
  const before = Object.assign({}, globalThis.MEDSEEN || {});
  G.resetScriptCounters();
  const a = G.buildPair(stage(c.A)), b = G.buildPair(stage(B_SIDE));
  if (!a || !b) return { notStaged: true };
  const r = G.playGame(a, b, 'directed', 'probe_instruct_shield :: ' + c.id, { script: c.script, arm });
  const after = globalThis.MEDSEEN || {};
  const delta = {};
  for (const k of Object.keys(after)) if (typeof after[k] === 'number') delta[k] = after[k] - (before[k] || 0);
  return { r, delta, sc: G.scriptCounters() };
}

let bad = 0, ran = 0;
const results = [];
for (const c of CASES) {
  if (ONLY && c.id !== ONLY) continue;
  const res = play(harness(), c);
  if (res.notStaged) { console.log('NOT-STAGED  ' + c.id); bad++; continue; }
  if (res.r.err) { console.log('THREW       ' + c.id + '   ' + res.r.err); bad++; continue; }
  ran++;

  const short = res.r.turns < c.script.length && !res.r.div;
  const refused = res.sc.moveNotOnRequest;
  const reasons = refusalReasons(c);
  const wantR = (c.expectReasons || []).slice().sort().join(',');
  const gotR = reasons.slice().sort().join(',');
  const rep = res.delta.instructRepeat || 0;
  const repOk = c.wantRepeat == null ? true : rep >= c.wantRepeat;

  results.push({ c, res, short, refused, reasons, reasonsOk: wantR === gotR, rep, repOk });

  if (short || refused) { bad++; continue; }
  if (wantR !== gotR) bad++;                       // an undeclared second reason proves nothing
  if (!repOk) bad++;
  /* EVERY ARM MUST AGREE WITH THE AUTHORITY. There is no revert knob here — a missing caller has no
   * old shape to restore — so "red" names the arms that are EXPECTED to part today, and a parting arm
   * is a FAILURE rather than a proof. The controls are what keep that from being satisfiable by
   * refusing every Instruct. */
  if (res.r.div) bad++;
}

for (const R of results) {
  const { c, res, short, refused, reasons, reasonsOk, rep, repOk } = R;
  const verdict = short ? 'SHORT       ' : refused ? 'CLICK REFUSED'
    : c.kind === "red" ? (res.r.div ? "RED — PARTS  " : "RED ARM AGREES (defect gone?)")
                       : (res.r.div ? 'CONTROL PARTS' : 'CONTROL HELD');
  console.log(NL + verdict + '  ' + c.id + '   ' + res.r.turns + '/' + c.script.length + ' turns');
  console.log('    ' + c.what);
  console.log('    refusal reasons for the target against Instruct, NOT counting the shield: '
    + (reasons.length ? reasons.join(', ') : '(none)')
    + '   [declared: ' + ((c.expectReasons || []).join(', ') || 'none') + ']'
    + (reasonsOk ? '' : '   <-- FAIL, an undeclared reason proves nothing about either'));
  if (res.r.div) {
    console.log('    PARTED at reduced line ' + res.r.div.index);
    console.log('      showdown  ' + res.r.div.sdRaw);
    console.log('      medicham  ' + res.r.div.meRaw);
    console.log('      showdown next  ' + JSON.stringify(res.r.div.sdAfterRaw.slice(0, 4)));
    console.log('      medicham next  ' + JSON.stringify(res.r.div.meAfterRaw.slice(0, 4)));
  }
  console.log('    THE EXTRA ACTION: MEDSEEN.instructRepeat = ' + rep
    + (c.wantRepeat != null ? '   (must be >= ' + c.wantRepeat + ')' + (repOk ? '' : '  <-- FAIL') : '')
    + (c.kind === 'red' && rep > 0
      ? '   <-- a second click this engine ran and the authority did not' : ''));
  if (refused) console.log('    FIXTURE BROKEN — ' + refused + ' scripted click(s) were not on the '
    + "authority's request and became a silent `pass` on both engines. First: " + res.sc.firstMissing);
}

console.log(NL + ran + ' arms staged, ' + bad + ' failing   [release ' + REL_ID + ']');
console.log(bad ? 'FAIL' : 'PASS — a shield refuses Instruct and the engine says so; the King\'s '
  + 'Shield arm (blocksStatus false) still fails on Instruct\'s own `failinstruct` and the cleared '
  + 'shield still gives the target a second action');
process.exit(bad ? 1 : 0);
