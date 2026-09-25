/* ABRA-HEAP: 2048
 * solver/doduo/eval_gates.js — THE GATES ON HELD-OUT HUMAN DECISIONS: does the human's actual joint action survive
 * both gates, how much of the candidate space does each gate remove, and do the two gates remove different things?
 *
 *   node solver/doduo/eval_gates.js --release eaa5becc54eb --n 2000 --seed 1 --workers 3 --out solver/out/gates/<release>/eval-s1
 *   (a worker: the same with --shard i --shards n, reading the coordinator's selection file)
 *
 * THE DECISIONS. Reg M-C human games from the dataset (the MAIN checkout's solver/out/human/games.jsonl, read only),
 * the acting player in the TEST split of every solver net (sha256("abra-prior-v0:" + player) mod 100 >= 90 —
 * solver/mew/pairs.js), both brought fours complete, no custom rules. A decision is one side's turn whose JOINT
 * action is fully observed: every occupied slot a `move` with a certain target (or no target) or a `switch`. N of
 * them are drawn by a seeded stride over the eligible list, so they span the corpus's dates.
 *
 * THE POSITION. solver/rotom/world.js — the live client's world builder — from the public state before the turn, the
 * two open sheets, and a request for the acting side synthesised from that public state (HP as the public percentage
 * of the built body's HP; the replay shows percentages for both sides). The opponent's back line is its TRUE brought
 * four (the eval may use hindsight about the opponent: the question is whether the gate's logic ever cuts a click a
 * human made, not what the bot could know). What the world does not lay on (PP, sleep and toxic counters, most
 * volatiles, the opponent's Choice lock) is stated in world.js; each is a place the world can be more permissive
 * than the real game, and a gate cut that a world gap caused is reported as such, never silently.
 *
 * THE GATES, in full (no step budget): MAG v2's verdict for every option of both slots, and DODUO v2's pair verdict
 * for EVERY legal joint (so the pair gate's removals are measured on its own, not only on MAG's survivors).
 *
 * Output: <out>/decisions-<shard>.jsonl (one line per decision: counts, the human's option verdicts, any loss in
 * full) and <out>/summary.json (the coordinator's merge: survival with a Wilson interval, the removal fractions, the
 * ablation 2x2 of MAG-cut x pair-cut over joints, the per-kind cut tables, every loss, the release stamp, the
 * dataset digest and every flag).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');
const crypto = require('crypto');
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {}
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..', '..');
const REL_ID = flag('--release', null);
const OUT = path.resolve(ROOT, flag('--out', 'solver/out/gates/eval'));
const N = +flag('--n', 2000), SEED = +flag('--seed', 1), WORKERS = Math.min(3, +flag('--workers', 3));
const SHARD = flag('--shard', null), SHARDS = +flag('--shards', 1);
const HUMAN = flag('--human', path.join('C:', 'Users', 'willj', 'Projects', 'Pokemon', 'ABRA', 'solver', 'out', 'human', 'games.jsonl'));
const SALT = 'abra-prior-v0';
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const splitOf = pid => { const h = crypto.createHash('sha256').update(SALT + ':' + pid).digest().readUInt32BE(0) % 100; return h < 80 ? 'train' : h < 90 ? 'val' : 'test'; };
const wilson = (k, n, z = 1.96) => { if (!n) return [0, 1]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - h) / d, (c + h) / d]; };

/* ---------- selection (coordinator) ---------- */
function exactAction(x) {
  if (!x) return false;
  if (x.kind === 'switch') return true;
  if (x.kind !== 'move') return false;
  return x.target_certain !== false;
}
function select() {
  const txt = fs.readFileSync(HUMAN);
  const sha = crypto.createHash('sha256').update(txt).digest('hex');
  const lines = txt.toString('utf8').split('\n');
  const elig = [];
  const games = new Map();
  const counts = { games: 0, test_games: 0, eligible_games: 0, decisions_seen: 0, eligible: 0 };
  for (const line of lines) {
    if (!line) continue;
    counts.games++;
    const g = JSON.parse(line);
    const G = g.game;
    const sides = ['p1', 'p2'].filter(p => splitOf(toID(G.players[p].name)) === 'test');
    if (!sides.length) continue;
    counts.test_games++;
    if (G.custom_rules || !G.bring_complete || !G.bring_complete.p1 || !G.bring_complete.p2) continue;
    if ((G.sheets.p1 || []).length !== 6 || (G.sheets.p2 || []).length !== 6) continue;
    counts.eligible_games++;
    let used = false;
    g.turns.forEach((t, ti) => {
      for (const p of sides) {
        const act = (t.state.sides[p].active || []);
        const A = t.actions && t.actions[p];
        if (!A) continue;
        counts.decisions_seen++;
        const occ = [0, 1].filter(i => act[i] != null && !(t.state.sides[p].mons[act[i]] || {}).fnt);
        if (!occ.length) continue;
        if (!occ.every(i => exactAction(A[i === 0 ? 'a' : 'b']))) continue;
        elig.push({ id: G.id, ti, p });
        used = true;
      }
    });
    if (used) games.set(G.id, line);
  }
  counts.eligible = elig.length;
  /* a seeded stride over the eligible list (dates in file order) */
  const stride = Math.max(1, Math.floor(elig.length / N));
  const off = SEED % stride;
  const picks = [];
  for (let i = off; i < elig.length && picks.length < N; i += stride) picks.push(elig[i]);
  const need = new Set(picks.map(x => x.id));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'selection.jsonl'), picks.map(x => JSON.stringify(x)).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'games.jsonl'), [...need].map(id => games.get(id)).join('\n') + '\n');
  return { sha, counts, stride, picks: picks.length, games: need.size };
}

/* ---------- worker ---------- */
function worker(shard, shards) {
  require('../arena/env.js');
  const ENGINE = require('../arena/engine.js').load(REL_ID);
  const API = ENGINE.API, M = API.M;
  const T = require('../arena/teams.js');
  const WB = require('../rotom/world.js').create(API);
  const PR = require('../mag/probe.js');
  const probe = PR.create(API);
  const MG = require('../mag/gate.js').create(API);
  const DG = require('../doduo/gate.js').create(API, { mag: MG });
  const games = new Map();
  for (const l of fs.readFileSync(path.join(OUT, 'games.jsonl'), 'utf8').split('\n')) if (l) { const g = JSON.parse(l); games.set(g.game.id, g); }
  const picks = fs.readFileSync(path.join(OUT, 'selection.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  /* --pick i,j,k: re-run only those selection rows (a loss being explained), into decisions-pick.jsonl */
  const PICK = flag('--pick', null) ? new Set(flag('--pick').split(',').map(Number)) : null;
  const outF = path.join(OUT, PICK ? 'decisions-pick.jsonl' : `decisions-${shard}.jsonl`);
  fs.writeFileSync(outF, '');
  const t0 = Date.now();
  let done = 0;
  for (let i = shard; i < picks.length; i += shards) {
    if (PICK && !PICK.has(i)) continue;
    const pk = picks[i];
    const g = games.get(pk.id);
    const rec = { i, id: pk.id, ti: pk.ti, p: pk.p };
    try { Object.assign(rec, decide(g, pk)); } catch (e) { rec.error = String(e && e.message || e).slice(0, 300); }
    fs.appendFileSync(outF, JSON.stringify(rec) + '\n');
    done++;
    if (done % 25 === 0) console.log(`  [shard ${shard}] ${done} decisions  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.writeFileSync(outF.replace(/\.jsonl$/, '.summary.json'), JSON.stringify({ shard, done, wall_s: (Date.now() - t0) / 1000, probe: probe.COUNTERS, mag: MG.COUNTERS, pair: DG.COUNTERS, world: WB.COUNTERS, release: ENGINE.stamp }, null, 1));

  function synthRequest(G, st, me) {
    const sheet = G.sheets[me];
    const side = st.sides[me];
    const brought = G.brought_seen[me];
    const act = side.active || [];
    const order = [];
    for (const i of act) if (i != null && !order.includes(i)) order.push(i);
    if (order.length < act.length) {           // an empty active slot keeps a fainted body so the slots stay aligned
      const f = brought.find(i => !order.includes(i) && side.mons[i] && side.mons[i].fnt);
      if (f == null) throw new Error('empty active slot with no fainted body to hold it');
      if (act[0] == null) order.unshift(f); else order.push(f);
    }
    for (const i of brought) if (!order.includes(i)) order.push(i);
    return { side: { pokemon: order.map(i => {
      const row = sheet[i], pub = side.mons[i] || {};
      const b = T.buildBody(M, row);
      if (!b) throw new Error('unbuildable ' + row.species);
      const max = b.st.hp;
      const cond = pub.seen ? (pub.fnt ? '0 fnt' : `${Math.max(1, Math.round((pub.hp / (pub.max || 100)) * max))}/${max}${pub.status ? ' ' + pub.status : ''}`) : `${max}/${max}`;
      const sp = pub.seen && pub.species ? pub.species : row.species;
      return { ident: me + 'a: ' + row.nick, details: sp + ', L50', condition: cond, item: pub.seen ? (pub.item || '') : row.item, ability: pub.seen ? pub.ability : row.ability };
    }) } };
  }
  function findOpt(la, k, x, S, side) {
    const sl = la.slots[k];
    if (!sl) return null;
    const team = (side === 'A' ? S.sfA : S.sfB).team;
    if (x.kind === 'switch') return sl.options.find(o => o.kind === 'switch' && team[o.to] && team[o.to]._solverSheet === x.to) || null;
    const id = toID(x.move);
    const tl = x.target_loc == null ? null : x.target_loc;
    return sl.options.find(o => o.kind === 'move' && o.move === id && !!o.mega === !!x.mega && (o.target == null ? null : o.target) === tl) || null;
  }
  function decide(g, pk) {
    const G = g.game, t = g.turns[pk.ti], me = pk.p, opp = me === 'p1' ? 'p2' : 'p1';
    const row = { game: G, turns: g.turns.slice(0, pk.ti + 1) };
    const req = synthRequest(G, t.state, me);
    const w = WB.build({ row, sheets: G.sheets, me, req, oppGuess: G.brought_seen[opp] });
    const ts = Date.now();
    const pos = probe.position(w.S, w.side, { salt: pk.ti });
    const C = w.S;       // the world; pos.la was computed on a copy of it with the same team order
    const A = t.actions[me];
    const human = [0, 1].map(k => { const x = A[k === 0 ? 'a' : 'b']; return x ? findOpt(pos.la, k, x, C, w.side) : null; });
    const occ = [0, 1].filter(k => A[k === 0 ? 'a' : 'b']);
    const r = { side: w.side, world_notes: w.notes, turn: t.n };
    if (occ.some(k => !human[k])) { r.unmatched = occ.filter(k => !human[k]).map(k => A[k === 0 ? 'a' : 'b']); r.menu = pos.la.slots.map(s => s && s.options.map(o => PR.optKey(o))); return r; }
    /* MAG, every option */
    const V = MG.slotVerdicts(pos);
    const vOf = (k, o) => (o ? V[k].get(PR.optKey(o)) : null);
    /* the slot guard: a slot whose every option is dead is not cut at all (nothing may be cut to zero) */
    const slotAllDead = [0, 1].map(k => { const sl = pos.la.slots[k]; return !!(sl && sl.options.length && sl.options.every(o => { const v = vOf(k, o); return v && v.v === 'dead'; })); });
    const magDead = (k, o) => { const v = vOf(k, o); return !!(v && v.v === 'dead' && !slotAllDead[k]); };
    const tally = { live: 0, soft: 0, dead: 0, untested: 0, na: 0 };
    for (let k = 0; k < 2; k++) for (const v of V[k].values()) tally[v.v]++;
    /* joints: the slot product, what legalActions refuses, what each gate cuts */
    const nProd = pos.la.slots.reduce((a, s) => a * (s ? s.options.length : 1), 1);
    const J = pos.la.joint;
    let magCut = 0, pairCut = 0, both = 0, survive = 0, bothOnDead = 0;
    const pairCuts = [], bothEx = [], pairClickMag = {};
    for (const j of J) {
      const mc = j.some((o, k) => magDead(k, o));
      const pv = DG.pairVerdict(pos, j);
      if (mc) magCut++;
      if (pv.cut) { pairCut++; if (pairCuts.length < 12) pairCuts.push(j.map(PR.optKey).join(' + ') + ' @' + pv.slot);
        const cv = vOf(pv.slot, j[pv.slot]); const key = cv ? cv.v : 'none'; pairClickMag[key] = (pairClickMag[key] || 0) + 1; }
      if (mc && pv.cut) { both++; const onDead = magDead(pv.slot, j[pv.slot]); if (onDead) bothOnDead++; if (bothEx.length < 6) bothEx.push(j.map(PR.optKey).join(' + ') + ' @' + pv.slot + (onDead ? ' ON-A-MAG-DEAD-CLICK' : '')); }
      if (!mc && !pv.cut) survive++;
    }
    const hj = pos.la.joint.find(j => j.every((o, k) => !human[k] || PR.optKey(o) === PR.optKey(human[k]))) || null;
    const hv = human.map((o, k) => (o ? (vOf(k, o) || {}).v : null));
    const hMag = human.some((o, k) => o && magDead(k, o));
    const hPair = hj ? DG.pairVerdict(pos, hj) : null;
    Object.assign(r, { ms: Date.now() - ts, steps: pos.steps, errors: pos.errors, options: tally, slot_all_dead: slotAllDead,
      product: nProd, joints: J.length, mag_cut: magCut, pair_cut: pairCut, both_cut: both, both_pair_on_dead: bothOnDead, both_examples: bothEx, pair_cut_click_mag_verdict: pairClickMag, survive,
      human: human.map(o => o && PR.optKey(o)), human_verdicts: hv, human_joint_found: !!hj,
      human_mag_cut: hMag, human_pair_cut: !!(hPair && hPair.cut), pair_cut_examples: pairCuts,
      soft: [0, 1].flatMap(k => [...V[k]].filter(([, v]) => v.v === 'soft').map(([key]) => k + ':' + key)),
      dead: [0, 1].flatMap(k => [...V[k]].filter(([, v]) => v.v === 'dead').map(([key]) => k + ':' + key)),
      actives: (w.side === 'A' ? C.actA : C.actB).map(m => m && m.name), foes: (w.side === 'A' ? C.actB : C.actA).map(m => m && m.name) });
    if (hMag || (hPair && hPair.cut)) r.loss = { human: r.human, verdicts: human.map((o, k) => o && vOf(k, o)), pair: hPair,
      actions: A, state: t.state, bench_opp: (w.side === 'A' ? C.benchB : C.benchA).map(m => m && m.name) };
    return r;
  }
}

/* ---------- coordinator ---------- */
async function coordinator() {
  if (!REL_ID) throw new Error('--release is required');
  const t0 = Date.now();
  const sel = select();
  console.log('selection', JSON.stringify(sel));
  const kids = [];
  for (let i = 0; i < WORKERS; i++) {
    const ch = cp.fork(__filename, ['--release', REL_ID, '--out', OUT, '--shard', String(i), '--shards', String(WORKERS)], { execArgv: ['--max-old-space-size=2048'] });
    console.log('eval_gates: shard ' + i + ' pid ' + ch.pid);
    kids.push(new Promise(res => ch.on('exit', c => res(c))));
  }
  const exits = await Promise.all(kids);
  const recs = [];
  for (let i = 0; i < WORKERS; i++) for (const l of fs.readFileSync(path.join(OUT, `decisions-${i}.jsonl`), 'utf8').split('\n')) if (l) recs.push(JSON.parse(l));
  const shardSums = Array.from({ length: WORKERS }, (_, i) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, `decisions-${i}.summary.json`), 'utf8')); } catch (e) { return null; } });
  const ok = recs.filter(r => !r.error && !r.unmatched);
  const S = { decisions: recs.length, errors: recs.filter(r => r.error).length, unmatched: recs.filter(r => r.unmatched).length, evaluated: ok.length };
  const lossM = ok.filter(r => r.human_mag_cut), lossP = ok.filter(r => r.human_pair_cut), lossAny = ok.filter(r => r.human_mag_cut || r.human_pair_cut);
  const sum = f => ok.reduce((a, r) => a + f(r), 0);
  const opts = ['live', 'soft', 'dead', 'untested', 'na'].reduce((o, k) => (o[k] = sum(r => r.options[k]), o), {});
  const judged = opts.live + opts.soft + opts.dead + opts.untested;
  const result = {
    what: 'MAG v2 + DODUO v2 dead-click gates on held-out human Reg M-C decisions (solver/doduo/eval_gates.js)',
    engine_release: REL_ID, flags: { n: N, seed: SEED, workers: WORKERS, human: HUMAN }, dataset_sha256: sel.sha, selection: sel,
    counts: S,
    survival: { survived: ok.length - lossAny.length, n: ok.length, rate: (ok.length - lossAny.length) / ok.length, ci95: wilson(ok.length - lossAny.length, ok.length),
      lost_to_mag: lossM.length, lost_to_pair: lossP.length, target: 0.999 },
    options: Object.assign({ judged }, opts, { dead_share_of_judged: opts.dead / judged, soft_share_of_judged: opts.soft / judged }),
    joints: { product: sum(r => r.product), legal: sum(r => r.joints), engine_refused: sum(r => r.product - r.joints),
      mag_cut: sum(r => r.mag_cut), pair_cut: sum(r => r.pair_cut), both_cut: sum(r => r.both_cut), survive: sum(r => r.survive),
      share: { engine_refused_of_product: sum(r => r.product - r.joints) / sum(r => r.product), mag_of_legal: sum(r => r.mag_cut) / sum(r => r.joints),
        pair_of_legal: sum(r => r.pair_cut) / sum(r => r.joints), pair_of_mag_survivors: sum(r => r.pair_cut - r.both_cut) / sum(r => r.joints - r.mag_cut),
        either_of_legal: sum(r => r.joints - r.survive) / sum(r => r.joints) } },
    ablation_2x2_joints: { mag_only: sum(r => r.mag_cut - r.both_cut), pair_only: sum(r => r.pair_cut - r.both_cut), both: sum(r => r.both_cut), neither: sum(r => r.survive),
      both_where_the_pair_gate_cut_on_a_mag_dead_click: sum(r => r.both_pair_on_dead || 0),
      caption: 'both = the joint has one click MAG cut AND the pair gate cut it for the OTHER click (two independent faults in one joint). A pair cut ON a MAG-dead click would be the two gates claiming the same removal; it is counted separately and should be 0.' },
    pair_cut_click_mag_verdict: ['live', 'soft', 'dead', 'untested', 'na', 'none'].reduce((o, k) => (o[k] = sum(r => (r.pair_cut_click_mag_verdict || {})[k] || 0), o), {}),
    decisions_with: { any_mag_dead: ok.filter(r => r.options.dead > 0).length, any_soft: ok.filter(r => r.options.soft > 0).length, any_pair_cut: ok.filter(r => r.pair_cut > 0).length },
    human_soft: ok.filter(r => r.human_verdicts.includes('soft')).length,
    cost: { ms_mean: sum(r => r.ms) / ok.length, ms_p50: ok.map(r => r.ms).sort((a, b) => a - b)[ok.length >> 1], ms_max: Math.max(...ok.map(r => r.ms)), steps_mean: sum(r => r.steps) / ok.length, step_errors: sum(r => r.errors) },
    losses: lossAny.map(r => ({ id: r.id, turn: r.turn, p: r.p, human: r.human, human_verdicts: r.human_verdicts, mag: r.human_mag_cut, pair: r.human_pair_cut, actives: r.actives, foes: r.foes, loss: r.loss })),
    unmatched_examples: recs.filter(r => r.unmatched).slice(0, 20).map(r => ({ id: r.id, ti: r.ti, p: r.p, unmatched: r.unmatched, menu: r.menu })),
    error_examples: recs.filter(r => r.error).slice(0, 20).map(r => ({ id: r.id, ti: r.ti, error: r.error })),
    shard_counters: shardSums, worker_exits: exits, release_stamp: shardSums[0] && shardSums[0].release, wall_s: (Date.now() - t0) / 1000,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ counts: S, survival: result.survival, options: result.options, joints: result.joints, ablation: result.ablation_2x2_joints, cost: result.cost }, null, 1));
}

if (SHARD != null) worker(+SHARD, SHARDS);
else coordinator().catch(e => { console.error(e); process.exit(1); });
