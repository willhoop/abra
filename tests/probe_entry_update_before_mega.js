/* probe_entry_update_before_mega.js — THE `Update` PASS THAT CLOSES A SWITCH ACTION RUNS *BEFORE*
 * THE MEGA ACTION, SO A WHITE HERB EATS FIRST. THIS ENGINE MEGA-EVOLVED FIRST.
 *
 *   SHOWDOWN_PATH=... node tests/probe_entry_update_before_mega.js
 *
 * WHERE THIS CAME FROM. The pinned whole-game differential, release `a35ef476d6db`
 * (`data/game-differential.json`, 961 games, census `census-pin-9446a684709d`, pool
 * `data/team-pool-frozen`), one board-material game with the `any`-bucket verdict SHARED COINS:
 *
 *   ordering :: |-enditem|p1b|whiteherb <> |detailschange|p2a|raichumegay,l50
 *
 *     showdown   |switch|p2b: Gyarados|…            (Intimidate drops both foes)
 *                |-unboost|p1a: Tinkaton|atk|1
 *                |-unboost|p1b: Sneasler|atk|1
 *                |-enditem|p1b: Sneasler|White Herb
 *                |-clearnegativeboost|p1b: Sneasler|[silent]
 *                |detailschange|p2a: Raichu|Raichu-Mega-Y, L50
 *                |-mega|p2a: Raichu|Raichu|Raichunite Y
 *     medicham2  …the same two `-unboost` lines, and then
 *                |detailschange|p2a: Raichu|raichu-mega-y, L50
 *                |-mega|…
 *                |-enditem|p1b: Sneasler|whiteherb
 *                |-clearnegativeboost|…
 *
 * THE RULE, READ OFF THE AUTHORITY. A mega is its own ACTION at queue order 104
 * (`switch` is 103, every move is 200), and `Battle#runAction` closes EVERY action — the switch
 * included — with
 *
 *     if (this.gen >= 5 && action.choice !== 'start') { this.eachEvent('Update'); … }
 *                                                                          sim/battle.ts:2857-2858
 *
 * White Herb is an `onUpdate`, so it is settled by the pass that ends the SWITCH action, one whole
 * action before the mega runs.
 *
 * WHY THIS ENGINE MISSED IT. medicham2 has no `megaEvo` action: it re-derives the mega order inside
 * the action loop and `_megaPhase` was triggered at the TOP of the loop iteration — i.e. INSIDE the
 * block that stands for the tail of the PREVIOUS action. That block runs, in order,
 * `midClearActiveMove` (:2828), the settles, the `sideWiped` break (:2832-2833) and then
 * `_updateAll()` (:2858), and the mega phase was sitting ABOVE all of it. Everything in that block
 * belongs to action k; the mega is action k+1 and belongs below it.
 *
 * THE FIXTURE. One turn. The defending side switches an entry-drop ability in, which lowers Attack on
 * both attackers; one of them holds the herb; and a body on the switching side mega-evolves on the
 * same turn. That is the whole shape and it needs no damage, no accuracy die and no KO.
 *
 * THE ARMS:
 *   REAL      herb + mega on the same turn. The herb line must come FIRST in both engines.
 *   CONTROL   the same board with `MEDI_MEGA_BEFORE_UPDATE=1`. It must PART; an identical result
 *             across a varied knob means the knob is unwired.
 *   SILENT    the same board with NO mega stone. The herb still eats, at the same place, and neither
 *             engine may move under the knob — that is what says the fix is the mega's POSITION and
 *             not a change to when the herb is spent.
 *
 * IT ASSERTS AND EXITS NON-ZERO ON A FAILURE.
 */
'use strict';
const path = require('path');
const D = (...p) => path.join(__dirname, '..', ...p);
require(D('engine', 'showdown_path.js'));
if (!process.env.SHOWDOWN_PATH) { console.log('NOT RUN — SHOWDOWN_PATH is unset. This is not a pass.'); process.exit(2); }

const CHILD = process.env.MEDI_MEGA_BEFORE_UPDATE === '1';
require(D('tests', '_live_release.js'));

process.argv.push('--state');
const G = require(D('engine', 'game_differential.js'));
const CS = require(D('engine', 'champions_sim.js'));
const { Dex } = CS.sim();
const dex = Dex.forFormat(CS.FORMAT);
const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const TAGS = require(D('data', 'tags.json'));

const LEGAL = s => s.exists && !s.isNonstandard && s.tier !== 'Illegal';
const POOL = dex.species.all().filter(s => LEGAL(s) && !/mega/i.test(s.forme || ''))
  .sort((a, b) => a.name.localeCompare(b.name));
const LS = s => { const l = dex.species.getLearnsetData(s.id); return (l && l.learnset) || {}; };
const LEARNS = (s, mv) => !!LS(s)[mv];

let bad = 0;
console.log('\n  === THE FIXTURE, DERIVED THIS RUN ===');

/* ---- THE ITEM IS THE TAG'S. */
const HERBS = Object.entries(TAGS.items || {})
  .filter(([, v]) => (v.tags || []).includes('restoresStats'))
  .map(([k, v]) => ({ id: k, uses: v.uses || 0 }))
  .filter(x => dex.items.get(x.id).exists && !dex.items.get(x.id).isNonstandard)
  .sort((a, b) => b.uses - a.uses);
console.log('  items tagged `restoresStats`       : ' + (HERBS.map(h => h.id + ' (' + h.uses + ')').join(', ') || 'NONE'));
if (!HERBS.length) { console.log('  NO STAT-RESTORING ITEM — a claim about the artifact.'); process.exit(2); }
const HERB = dex.items.get(HERBS[0].id);

/* ---- THE ENTRY DROP IS THE TAG'S TOO. It has to actually LOWER a stat, and it has to be able to
 * fire more than once per battle so a re-entry is never the reason an arm goes quiet. */
const DROPS = Object.entries(TAGS.abilities || {})
  .filter(([, v]) => (v.tags || []).includes('onSwitchInDrop'))
  .map(([k, v]) => ({ id: k, p: v.params.onSwitchInDrop, uses: v.uses || 0 }));
console.log('  abilities tagged `onSwitchInDrop`  :');
for (const d of DROPS) console.log('      ' + d.id.padEnd(16) + JSON.stringify(d.p.boosts)
  + '  oncePerBattle=' + JSON.stringify(d.p.oncePerBattle) + '  (' + d.uses + ' sheets)');
const DROP = DROPS.filter(d => d.p && d.p.boosts && Object.values(d.p.boosts).some(v => v < 0) && !d.p.oncePerBattle)
  .sort((a, b) => b.uses - a.uses)[0];
if (!DROP) { console.log('  NO REPEATABLE ENTRY DROP — a claim about the format.'); process.exit(2); }

/* ---- THE MEGA. Derived off the dex: a legal base species whose item unlocks a legal mega forme, and
 * the STONE is read off the item rather than assembled from the name. */
/* THE CHAMPIONS SHAPE IS NOT MAINLINE'S AND THE FIRST DRAFT READ MAINLINE'S. Here `item.megaStone` is
 * an OBJECT — `{ Raichu: 'Raichu-Mega-Y' }` — and `item.megaEvolves` is `undefined`, so requiring
 * `megaEvolves` found ZERO stones in a format that has 93 and reported it as a fact about the format.
 * The base species is the object's own key. */
const STONES = dex.items.all().filter(i => i.exists && !i.isNonstandard
  && i.megaStone && typeof i.megaStone === 'object' && Object.keys(i.megaStone).length);
console.log('  legal mega stones in this format   : ' + STONES.length
  + (STONES.length ? '   e.g. ' + STONES.slice(0, 3).map(i => i.id + ' ' + JSON.stringify(i.megaStone)).join(', ') : ''));
if (!STONES.length) { console.log('  NO LEGAL MEGA STONE — a claim about the format.'); process.exit(2); }

const SELF_HOLD = (s) => {
  const bad2 = new Set(['rest', 'sleeptalk', 'substitute', 'endure', 'wish', 'charge', 'doubleteam']);
  const ls = LS(s);
  return Object.keys(ls).find(k => {
    if (bad2.has(k)) return false;
    const m = dex.moves.get(k);
    return m.exists && !m.isNonstandard && m.category === 'Status' && m.target === 'self'
      && !m.stallingMove && !m.selfSwitch && !m.flags.charge;
  }) || null;
};
const abilityTags = ab => ((TAGS.abilities[norm(ab)] || {}).tags || []);
/* the herb holder must not REFUSE the drop, or there would be nothing to restore */
const REFUSE_H = new Set(['preventsStatDrop', 'invertsBoosts', 'boostsWhenLowered', 'amplifiesBoosts']);
const pickAbility = (sp, refuse) => Object.values(sp.abilities)
  .find(ab => !abilityTags(ab).some(t => refuse.has(t))) || null;

/* the mega body, its stone, and a move it can click while it evolves */
let MEGA = null;
for (const st of STONES) {
  const baseName = Object.keys(st.megaStone)[0];
  const base = POOL.find(s => norm(s.name) === norm(baseName) && !G.CLOSET_SPECIES.has(norm(s.id)));
  if (!base) continue;
  const hold = SELF_HOLD(base);
  if (!hold) continue;
  MEGA = { base, stone: st, hold };
  break;
}
if (!MEGA) { console.log('  NO LEGAL MEGA BASE WITH A SAFE SELF-MOVE — a claim about the format.'); process.exit(2); }

const DROPPERS = POOL.filter(s => Object.values(s.abilities).some(a => norm(a) === DROP.id)
  && s.name !== MEGA.base.name && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s));
if (!DROPPERS.length) { console.log('  NO CARRIER OF ' + DROP.id + ' — a claim about the format.'); process.exit(2); }
const DROPPER = DROPPERS[0];
const DROP_AB = Object.values(DROPPER.abilities).find(a => norm(a) === DROP.id);

const HOLDERS = POOL.filter(s => ![MEGA.base.name, DROPPER.name].includes(s.name)
  && !G.CLOSET_SPECIES.has(norm(s.id)) && SELF_HOLD(s) && pickAbility(s, REFUSE_H));
if (HOLDERS.length < 5) { console.log('  NOT ENOUGH FILLER — a claim about the fixture.'); process.exit(2); }
const HOLD = HOLDERS[0], FILL = HOLDERS.slice(1, 6);

const mon = (species, moves, item, ability) => ({ species, item: item || '', ability: ability || '', moves });
/* p1 stands still and holds the herb. p2 megas from slot a while slot b switches the dropper in. */
const sides = (withStone) => ([
  [mon(HOLD.name, [SELF_HOLD(HOLD)], HERB.name, pickAbility(HOLD, REFUSE_H)),
   mon(FILL[0].name, [SELF_HOLD(FILL[0])], '', pickAbility(FILL[0], REFUSE_H)),
   mon(FILL[1].name, [SELF_HOLD(FILL[1])], '', pickAbility(FILL[1], REFUSE_H)),
   mon(FILL[2].name, [SELF_HOLD(FILL[2])], '', pickAbility(FILL[2], REFUSE_H))],
  [mon(MEGA.base.name, [MEGA.hold], withStone ? MEGA.stone.name : ''),
   mon(FILL[3].name, [SELF_HOLD(FILL[3])], '', pickAbility(FILL[3], REFUSE_H)),
   mon(DROPPER.name, [SELF_HOLD(DROPPER)], '', DROP_AB),
   mon(FILL[4].name, [SELF_HOLD(FILL[4])], '', pickAbility(FILL[4], REFUSE_H))],
]);
const SCRIPT = (withStone) => [
  { p1: [{ m: norm(SELF_HOLD(HOLD)) }, { m: norm(SELF_HOLD(FILL[0])) }],
    p2: [{ m: norm(MEGA.hold), mega: !!withStone }, { sw: norm(DROPPER.name) }] },
];

/* THE OUTCOME IS THE ORDER OF TWO LINES IN ONE STREAM, which is exactly what the artifact reported.
 * The authority's raw log carries every `|split|` line twice; the second copy is dropped so an index
 * is an index. */
const dedupeSplit = (lines) => {
  const drop = new Set();
  lines.forEach((l, i) => { if (/^\|split\|/.test(String(l))) drop.add(i + 2); });
  return lines.filter((l, i) => !drop.has(i) && !/^\|split\|/.test(String(l)));
};
const idxOf = (lines, re) => dedupeSplit(lines).findIndex(l => re.test(String(l)));

const run = (withStone, tag) => {
  const [SA, SB] = sides(withStone);
  const a = G.buildPair(SA), b = G.buildPair(SB);
  if (!a || !b) return { staged: false, why: 'buildPair returned null' };
  G.resetScriptCounters();
  const r = G.playGame(a, b, 'directed', 'entryupdatemega/' + tag,
    { arm: G.ARM_BY_ID.get('middle'), script: SCRIPT(withStone) });
  const SC = G.scriptCounters();
  if (r.err) return { staged: false, why: 'THREW: ' + r.err };
  if (SC.moveNotOnRequest) return { staged: false, why: SC.moveNotOnRequest + ' scripted click(s) not on the request: ' + SC.firstMissing };
  const sd = G.lastSdLog(), me = r.mediTrace || [];
  const HERB_RE = new RegExp('^\\|-enditem\\|[^|]*\\|\\s*' + HERB.name.replace(/[^A-Za-z]/g, '\\s*') + '\\s*$', 'i');
  const herbAny = /^\|-enditem\|[^|]*\|\s*white\s*herb/i;
  const megaRe = /^\|detailschange\|/;
  return { staged: true, r,
           sdHerb: idxOf(sd, herbAny), sdMega: idxOf(sd, megaRe),
           meHerb: idxOf(me, herbAny), meMega: idxOf(me, megaRe),
           megaSd: r.megaSd, megaMedi: r.megaMedi,
           div: r.div ? { sd: r.div.sdRaw, me: r.div.meRaw } : null,
           _unusedRe: HERB_RE };
};

console.log('\n  chosen  : ' + DROPPER.name + ' [' + DROP_AB + '] switches in and drops '
  + JSON.stringify(DROP.p.boosts) + ' on ' + HOLD.name + ', which holds ' + HERB.name);
console.log('            ' + MEGA.base.name + ' mega-evolves on the same turn with ' + MEGA.stone.name);
console.log('            THE AUTHORITY closes the SWITCH action with eachEvent(\'Update\') at '
  + 'sim/battle.ts:2858, and the mega is a separate action at order 104 — so the herb eats FIRST.');

console.log('\n  === THE REAL ARM — herb and mega on the same turn ===');
const REAL = run(true, CHILD ? 'control' : 'real');
if (!REAL.staged) { console.log('  NOT STAGED — ' + REAL.why); process.exit(1); }
console.log('  megas that resolved      : showdown ' + REAL.megaSd + '   medicham2 ' + REAL.megaMedi);
console.log('  line index of the herb   : showdown ' + REAL.sdHerb + '   medicham2 ' + REAL.meHerb);
console.log('  line index of the mega   : showdown ' + REAL.sdMega + '   medicham2 ' + REAL.meMega);
console.log('  first protocol divergence: ' + (REAL.div ? JSON.stringify(REAL.div) : 'none — the streams agree'));

console.log('\n  === THE SILENT CONTROL — the same board with NO stone ===');
const SIL = run(false, CHILD ? 'silent-control' : 'silent');
if (!SIL.staged) { console.log('  NOT STAGED — ' + SIL.why); process.exit(1); }
console.log('  megas that resolved      : showdown ' + SIL.megaSd + '   medicham2 ' + SIL.megaMedi);
console.log('  line index of the herb   : showdown ' + SIL.sdHerb + '   medicham2 ' + SIL.meHerb);

if (CHILD) {
  console.log('\n  CONTROL ARM (MEDI_MEGA_BEFORE_UPDATE=1) — asserts nothing about the fix.');
  console.log('__CONTROL__' + JSON.stringify({
    meHerb: REAL.meHerb, meMega: REAL.meMega, div: !!REAL.div, divLine: REAL.div && REAL.div.me,
    silHerb: SIL.meHerb, silMega: SIL.meMega,
  }));
  console.log('\ngreen — the control arm ran');
  process.exit(0);
}

console.log('\n  === THE VERDICT ===');
const need = (what, got, want) => {
  const ok = got === want;
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + JSON.stringify(got)
    + (ok ? '' : '   (wanted ' + JSON.stringify(want) + ')'));
  if (!ok) bad++;
  return ok;
};
const cmp = (what, ok, detail) => {
  console.log('  ' + (ok ? 'green' : 'RED  ') + '  ' + what + ' — ' + detail);
  if (!ok) bad++;
  return ok;
};
/* THE FIXTURE FIRST: both halves have to have happened at all. */
need('the mega really resolved in the authority (the fixture)', REAL.megaSd, 1);
need('...and in medicham2 (the fixture)', REAL.megaMedi, 1);
cmp('the herb really was spent in the authority (the fixture)', REAL.sdHerb >= 0, 'index ' + REAL.sdHerb);
cmp('...and in medicham2 (the fixture)', REAL.meHerb >= 0, 'index ' + REAL.meHerb);
/* THE AUTHORITY SECOND, as a control on the derivation. */
cmp('showdown puts the herb BEFORE the mega (the authority)', REAL.sdHerb >= 0 && REAL.sdMega >= 0
  && REAL.sdHerb < REAL.sdMega, 'herb ' + REAL.sdHerb + ' vs mega ' + REAL.sdMega);
/* THEN THE ENGINE. */
cmp('medicham2 puts the herb before the mega too', REAL.meHerb >= 0 && REAL.meMega >= 0
  && REAL.meHerb < REAL.meMega, 'herb ' + REAL.meHerb + ' vs mega ' + REAL.meMega);
need('the game does not part at all', REAL.div, null);
/* AND THE SILENT CONTROL: with no stone nothing megas and the herb is spent at the same index. */
need('SILENT CONTROL: no mega in the authority', SIL.megaSd, 0);
need('SILENT CONTROL: none in medicham2 either', SIL.megaMedi, 0);
/* NOT AN INDEX EQUALITY ACROSS THE TWO ENGINES — that was the first draft and it is meaningless:
 * showdown's raw log carries a `|player|`/`|teamsize|`/`|gen|` preamble medicham2's trace has no
 * equivalent of, so the herb sat at 40 in one and 10 in the other with nothing wrong. Every ORDER
 * claim in this probe is made WITHIN one stream; across streams only "did it happen at all" is. */
cmp('SILENT CONTROL: the herb is still spent in the authority', SIL.sdHerb >= 0, 'index ' + SIL.sdHerb);
cmp('SILENT CONTROL: and in medicham2', SIL.meHerb >= 0, 'index ' + SIL.meHerb);
need('SILENT CONTROL: and that game does not part', SIL.div, null);

{
  const { spawnSync } = require('child_process');
  console.log('\n  --- re-running under MEDI_MEGA_BEFORE_UPDATE=1 (the control), in a child ---');
  const c = spawnSync(process.execPath, [...(process.execArgv || []), __filename],
    { env: { ...process.env, MEDI_MEGA_BEFORE_UPDATE: '1' }, encoding: 'utf8' });
  const out = String(c.stdout || '');
  process.stdout.write(out.split('\n').map(l => '  |' + l).join('\n') + '\n');
  if (c.stderr) process.stderr.write(String(c.stderr));
  const mark = /__CONTROL__(\{.*\})/.exec(out);
  if (c.status === null) { console.log('\n  RED — the child did not run at all.'); bad++; }
  else if (!mark) { console.log('\n  RED — the control child printed no verdict line (exit ' + c.status + ').'); bad++; }
  else {
    const ctl = JSON.parse(mark[1]);
    const moved = ctl.meHerb !== REAL.meHerb || ctl.meMega !== REAL.meMega;
    console.log('  ' + (moved ? 'green' : 'RED  ') + '  the knob CHANGES the order: default herb '
      + REAL.meHerb + '/mega ' + REAL.meMega + '  vs control herb ' + ctl.meHerb + '/mega ' + ctl.meMega);
    if (!moved) { console.log('         An identical result across a varied knob means the knob is UNWIRED.'); bad++; }
    if (!(ctl.meMega >= 0 && ctl.meHerb > ctl.meMega)) {
      console.log('  RED    the control arm did not put the mega FIRST, so it is not the old behaviour.'); bad++;
    }
    if (!ctl.div) { console.log('  RED    the control arm produced no protocol divergence either.'); bad++; }
    else console.log('  green  the control arm parts on its own line: ' + ctl.divLine);
    if (ctl.silHerb !== SIL.meHerb) {
      console.log('  RED    THE SILENT CONTROL MOVED under the knob (' + SIL.meHerb + ' -> ' + ctl.silHerb
        + '). The knob reaches further than the mega\'s position.'); bad++;
    } else console.log('  green  the silent control did NOT move under the knob (herb at ' + ctl.silHerb + ')');
  }
}

console.log('\n' + (bad ? 'RED — ' + bad + ' assertion(s) failed' : 'green — every assertion held'));
process.exit(bad ? 1 : 0);
