/* test-stage-planner.js — does engine/stage_planner.js construct a proper fixture for every mechanic?
 *
 *   node tests/test-stage-planner.js            full population + every red demonstration (~1 min)
 *   node tests/test-stage-planner.js --quick    the known cases + the red demonstrations only
 *
 * PLAYS NO GAMES. It asks Showdown's TeamValidator about every team the planner emits — validating is
 * not playing — and re-derives every invariant from the RENDERED teams and scripts, never from the
 * planner's own verdict fields. A planner that stopped checking itself would still be caught here,
 * which is exactly what the red demonstrations prove: each clause is run against a deliberately
 * broken planner (STAGE_PLANNER break modes) and MUST go red, and against the same subset unbroken and
 * MUST stay green. A clause that cannot be shown red is asking nothing (docs/LESSONS.md §5).
 *
 * THE CLAUSES
 *   1 VALIDATE    every emitted team — fixture and control, every side and slot, and every fixture
 *                 held back for a missing capability — passes a FRESH TeamValidator for the format.
 *   2 ONE-LEAF    every control differs from its fixture in exactly one leaf (a click, move and aim, is
 *                 one leaf), recomputed here from the rendered teams and scripts.
 *   3 ONE-REASON  every fixture meets all its trigger conditions and is masked for zero reasons; every
 *                 control fails exactly one condition-or-mask. Conditions are evaluated here; masks
 *                 come from stage_planner.masksFor, the one implementation of "why a click cannot land".
 *   4 COVERAGE    every legal move, ability and item — the population derived HERE from Dex.forFormat
 *                 under CLAUDE.md's filter — has a fixture or a machine-readable refusal; no row is
 *                 missing, no refusal is a crash, and every NO-LEGAL-CARRIER records the conferral check.
 *   5 HALVES      a tag named for two halves (`...And...`) gets a fixture per half its params declare.
 *   6 SIDES       every fixture is emitted near and far; a mechanic with an Ally/Foe/Any handler also
 *                 at slot b, both sides.
 *   7 ARM         every arm is one the driver defines (read from engine/game_differential.js), and a
 *                 row whose only effect is an accuracy or crit threshold is staged at the top corner.
 *   K1..K6        the known-hard cases from docs/_reports/2026-09-11-plan-{never-fired,boards}.md. */
'use strict';
const path = require('path');
const fs = require('fs');
require(path.join(__dirname, '..', 'engine', 'showdown_path.js'));
const CS = require(path.join(__dirname, '..', 'engine', 'champions_sim.js'));
const SP = require(path.join(__dirname, '..', 'engine', 'stage_planner.js'));
const LS = require(path.join(__dirname, '..', 'engine', 'legal_scope.js'));
const COV = require(path.join(__dirname, '..', 'engine', 'coverage.js'));
const { Dex, Teams, TeamValidator } = CS.sim();
const D = Dex.forFormat(SP.FORMAT);
const id = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const legal = x => !!(x && x.exists && !x.isNonstandard && x.tier !== 'Illegal');
const QUICK = process.argv.includes('--quick');

/* ---- the test's OWN readers, so no clause trusts a planner verdict ---- */
const V = new TeamValidator(SP.FORMAT);
const VC = new Map();
function problemsOf(team) {
  const k = JSON.stringify(team);
  if (!VC.has(k)) { let p; try { p = V.validateTeam(Teams.unpack(Teams.pack(team))) || []; } catch (e) { p = ['VALIDATOR THREW: ' + e.message]; } VC.set(k, p); }
  return VC.get(k);
}
function leaves(v) {
  const out = {};
  const walk = (o, pre) => { if (o === null || typeof o !== 'object') { out[pre] = o; return; } const ks = Object.keys(o); if (!ks.length) out[pre] = '{}'; for (const k of ks) walk(o[k], pre ? pre + '.' + k : k); };
  walk({ teams: v.teams, script: v.script }, '');
  return out;
}
function leafDiff(a, b) {
  const fa = leaves(a), fb = leaves(b);
  const unit = k => { const m = /^(script\.\d+\.p[12]\.\d)\b/.exec(k); return m ? m[1] : k; };
  return [...new Set([...new Set(Object.keys(fa).concat(Object.keys(fb)))].filter(k => fa[k] !== fb[k]).map(unit))];
}
function holds(c, v) {
  if (c.kind === 'field') { const p = v.roles[c.role]; return !!p && id(v.teams[p.side][p.index][c.field]) === id(c.value); }
  const at = (v.roleAt[c.turn - 1] || {})[c.role]; if (!at) return false;
  const e = ((v.script[c.turn - 1] || {})[at.side] || [])[at.slot] || {};
  if (c.kind === 'click' && c.sw) return !!v.roles[c.sw] && e.sw === id(v.roles[c.sw].species);
  if (c.kind === 'click') return id(e.m) === id(c.move);
  if (c.kind === 'mega') return !!e.mega;
  return false;
}
/* shields, derived from the authority: a move that stalls */
const SHIELDS = new Set(D.moves.all().filter(m => m.exists && m.stallingMove).map(m => m.id));
function masks(f, m, v) {
  const out = [];
  const selfAbility = m.kind === 'ability' ? m.id : null;
  for (const c of f.triggerClicks) {
    if (!c.at) continue;
    const at = (v.roleAt[c.turn - 1] || {})[c.role];
    const e = at ? ((v.script[c.turn - 1] || {})[at.side] || [])[at.slot] || {} : {};
    if (id(e.m) !== id(c.move)) continue;
    const u = v.roles[c.role], t = v.roles[c.at];
    const tAt = (v.roleAt[c.turn - 1] || {})[c.at];
    const tE = tAt ? ((v.script[c.turn - 1] || {})[tAt.side] || [])[tAt.slot] || {} : {};
    const body = r => ({ species: r.species, field: r.field, ability: v.teams[r.side][r.index].ability });
    out.push(...SP.masksFor(c.move, body(u), body(t), Object.assign({}, c.ctx, { arm: f.arm, selfAbility,
      targetGuards: c.at !== c.role && SHIELDS.has(id(tE.m)) ? tE.m : null })));
  }
  return out;
}

/* ================= THE CLAUSES — each returns a list of failures ================================== */
const C = {};
C.validate = P => {
  const bad = [];
  for (const m of P.mechanics) for (const f of m.fixtures.concat(m.wouldBe || [])) for (const v of f.variants)
    for (const [side, team] of Object.entries(v.teams).concat(v.control ? Object.entries(v.control.teams).map(([s, t]) => ['control.' + s, t]) : [])) {
      const p = problemsOf(team);
      if (p.length) bad.push(m.key + ' [' + f.branch + ' ' + v.layout + ' ' + side + '] ' + p[0]);
    }
  return bad;
};
C.oneLeaf = P => {
  const bad = [];
  for (const m of P.mechanics) for (const f of m.fixtures) if (f.control) for (const v of f.variants) {
    const d = leafDiff(v, v.control);
    if (d.length !== 1) bad.push(m.key + ' [' + f.branch + ' ' + v.layout + '] ' + d.length + ' leaves: ' + d.slice(0, 3).join(', '));
  }
  return bad;
};
C.oneReason = P => {
  const bad = [];
  for (const m of P.mechanics) for (const f of m.fixtures) for (const v of f.variants) {
    const miss = f.conditions.filter(c => !holds(c, v));
    const mk = masks(f, m, v);
    if (miss.length || mk.length) bad.push(m.key + ' [' + f.branch + ' ' + v.layout + '] fixture: ' + miss.length + ' unmet, ' + mk.length + ' masks ' + mk.slice(0, 2).join('; '));
    if (f.control) {
      const cv = v.control;
      const n = f.conditions.filter(c => !holds(c, cv)).length + masks(f, m, cv).length;
      if (n !== 1) bad.push(m.key + ' [' + f.branch + ' ' + v.layout + '] control inert for ' + n + ' reasons');
    } else if (!f.controlRefusal || !f.controlRefusal.code) bad.push(m.key + ' [' + f.branch + '] no control and no control refusal');
  }
  return bad;
};
const CODES = new Set(['NO-LEGAL-CARRIER', 'NO-LEGAL-READER', 'NEEDS-ENGINE-CAPABILITY', 'NO-TRIGGER-SUPPLIER', 'NEEDS-SECOND-BODY-TYPE',
                       'VALIDATOR-REFUSED', 'HALF-UNSTAGEABLE', 'PLANNER-CANNOT-CONSTRUCT']);
function population(only) {
  const out = [];
  for (const [kind, all] of [['move', D.moves.all()], ['ability', D.abilities.all()], ['item', D.items.all()]])
    for (const e of all) if (legal(e)) out.push(kind + ':' + e.id);
  return only ? out.filter(k => only.includes(k)) : out;
}
C.coverage = (P, only) => {
  const bad = [];
  const rows = new Map(P.mechanics.map(m => [m.key, m]));
  for (const k of population(only)) {
    const m = rows.get(k);
    if (!m) { bad.push(k + ': NO ROW — silently omitted'); continue; }
    if (m.fixtures.length && !m.refusal) continue;
    if (!m.refusal) { bad.push(k + ': no fixture and no refusal'); continue; }
    if (!CODES.has(m.refusal.code)) bad.push(k + ': refusal code ' + m.refusal.code + ' is not machine-readable (a crash is not a refusal)');
    if (m.refusal.code === 'NO-LEGAL-CARRIER' && m.kind === 'ability' && m.refusal.conferralChecked !== true) bad.push(k + ': NO-LEGAL-CARRIER without the conferral check');
    if (m.refusal.code === 'NEEDS-ENGINE-CAPABILITY' && !(m.refusal.capability && m.refusal.blockedAt && (m.wouldBe || []).length)) bad.push(k + ': capability refusal must name the capability, where it is blocked, and carry the would-be fixture');
  }
  if (!only && P.mechanics.length !== population().length) bad.push('rows ' + P.mechanics.length + ' != population ' + population().length);
  return bad;
};
C.halves = P => {
  const bad = [];
  const T = SP.universe().T;
  for (const m of P.mechanics.filter(x => x.kind === 'ability')) {
    const row = T.abilities[m.id]; if (!row) continue;
    for (const t of row.tags.filter(t => /[a-z](And|Or)[A-Z]/.test(t))) {
      const halves = Object.keys(row.params[t] || {}).filter(k => row.params[t][k] === true);
      if (halves.length < 2 || m.refusal) continue;
      for (const h of halves) if (!m.fixtures.some(f => f.branch === 'half:' + h)) bad.push(m.key + ': tag ' + t + ' has no fixture for its half ' + h);
    }
  }
  return bad;
};
C.sides = P => {
  const bad = [];
  const kindOf = { move: 'moves', ability: 'abilities', item: 'items' };
  for (const m of P.mechanics) {
    const e = D[kindOf[m.kind]].get(m.id);
    const sided = Object.keys(e).some(k => /^on(Ally|Foe|Any)[A-Z]/.test(k) && typeof e[k] === 'function');
    for (const f of m.fixtures) {
      const L = new Set(f.variants.map(v => v.layout));
      for (const need of ['near-a', 'far-a'].concat(sided ? ['near-b', 'far-b'] : [])) if (!L.has(need)) bad.push(m.key + ' [' + f.branch + '] no ' + need + ' variant');
    }
  }
  return bad;
};
C.arm = P => {
  const bad = [];
  const ids = new Set([...fs.readFileSync(path.join(__dirname, '..', 'engine', 'game_differential.js'), 'utf8').matchAll(/makeArm\(\{\s*id:\s*'([a-z-]+)'/g)].map(x => x[1]));
  for (const m of P.mechanics) for (const f of m.fixtures) {
    if (!ids.has(f.arm)) bad.push(m.key + ': arm ' + f.arm + ' is not one the driver defines');
    if (m.triggers.some(t => t.kind === 'board' && /^(accuracy|crit)-roll$/.test(t.state)) && f.arm !== 'top-tie-first') bad.push(m.key + ': a threshold-only row staged at ' + f.arm);
  }
  return bad;
};
/* 8 ONE-SCOPE — which mechanics exist in the regulation is ONE fact with ONE implementation,
 * engine/legal_scope.js. On 2026-09-11 the planner's own carrier list and legal_scope's validator-checked
 * scope met and said 847 and 845, and they disagreed on three rows that the two totals only partly showed.
 * So: the rows the planner refuses as OUT OF SCOPE (a scope code, refused before any staging attempt) are
 * exactly the rows legal_scope puts out, with the same code; the planner stages nothing legal_scope puts out;
 * the planner prints legal_scope's count; and coverage.js, the other entrypoint, which prints the
 * denominator, returns the identical in-scope set. Out of scope is read off the planner's BEHAVIOUR (code and
 * no attempt), not off a flag it sets, so a planner that grew its own scope again would be caught. */
const SCOPE_CODES = new Set(['NO-LEGAL-CARRIER', 'VALIDATOR-REFUSED', 'NO-LEGAL-READER']);
C.oneScope = (P, only) => {
  const bad = [];
  const S = LS.derive();
  if (typeof S.verdict !== 'function') bad.push('engine/legal_scope.js exposes no verdict(kind, id) — there is no one answer to import');
  const cov = COV.legalScope();
  if (!cov.S) return bad.concat(['engine/coverage.js could not derive a scope: ' + cov.why]);
  for (const kind of ['move', 'ability', 'item']) {
    const a = new Set(S.inScopeIds(kind)), b = new Set(cov.S.inScopeIds(kind));
    for (const x of a) if (!b.has(x)) bad.push(kind + ':' + x + ': in scope for legal_scope, out for coverage.js');
    for (const x of b) if (!a.has(x)) bad.push(kind + ':' + x + ': in scope for coverage.js, out for legal_scope');
  }
  const keys = new Set(population(only));
  for (const m of P.mechanics) {
    if (!keys.has(m.key)) continue;
    const plannerOut = !!(m.refusal && SCOPE_CODES.has(m.refusal.code) && !(m.attempts || []).length && !m.fixtures.length);
    const lsIn = S.inScope(m.kind, m.id);
    if (plannerOut === lsIn) bad.push(m.key + ': planner ' + (plannerOut ? 'OUT (' + m.refusal.code + ')' : 'IN' + (m.refusal ? ' (' + m.refusal.code + ' after staging)' : ''))
      + ', legal_scope ' + (lsIn ? 'IN' : 'OUT (' + S.why(m.kind, m.id) + ')'));
    else if (plannerOut && typeof S.verdict === 'function' && S.verdict(m.kind, m.id).code !== m.refusal.code)
      bad.push(m.key + ': both OUT, codes differ — planner ' + m.refusal.code + ', legal_scope ' + S.verdict(m.kind, m.id).code);
    if ((m.fixtures.length || (m.wouldBe || []).length) && !lsIn) bad.push(m.key + ': the planner built a fixture for a mechanic legal_scope puts out');
  }
  if (!only) {
    const n = ['move', 'ability', 'item'].reduce((s, k) => s + S.inScopeCount[k], 0);
    if (P.summary.inScope !== n) bad.push('the planner prints ' + P.summary.inScope + ' in scope, legal_scope ' + n);
  }
  return bad;
};
/* ---- the known-hard cases ---- */
const statSpe = b => {
  const sp = D.species.get(b.field || b.species);
  const ctx = { trunc: D.trunc.bind(D), ruleTable: Dex.formats.getRuleTable(Dex.formats.get(SP.FORMAT)), dex: D };
  return D.data.Scripts.statModify.call(ctx, sp.baseStats, { evs: { spe: 0 }, level: 50, nature: 'Hardy' }, 'spe');
};
const row = (P, k) => P.mechanics.find(m => m.key === k);
C.k1Hospitality = P => {
  const m = row(P, 'ability:hospitality'); if (!m) return [];
  const f = m.fixtures[0]; if (!f) return ['no Hospitality fixture: ' + (m.refusal || {}).reason];
  const bad = [];
  if (!f.live.includes('CA')) bad.push('the partner is a pad');
  f.turns.forEach((t, i) => { if (t.CA && SHIELDS.has(id(t.CA.m))) bad.push('the partner clicks ' + t.CA.m + ' on turn ' + (i + 1)); });
  const hurt = f.turns.findIndex(t => Object.entries(t).some(([r, c]) => r !== 'CA' && c && c.at === 'CA' && D.moves.get(c.m).category !== 'Status'));
  const enter = f.turns.findIndex(t => Object.values(t).some(c => c && c.sw === 'C'));
  if (hurt < 0 || enter < 0 || hurt >= enter) bad.push('the partner is not hit before the carrier enters (hit T' + (hurt + 1) + ', entry T' + (enter + 1) + ')');
  if (f.variants[0].roles.C.index < 2) bad.push('the carrier leads, so onStart fires before anything is damaged');
  return bad;
};
C.k2Prankster = P => {
  const m = row(P, 'ability:prankster'); if (!m) return [];
  const f = m.fixtures[0]; if (!f) return ['no Prankster fixture'];
  const c = f.conditions.find(x => x.kind === 'click' && x.role === 'C');
  const bad = [];
  if (!c || D.moves.get(c.move).category !== 'Status') bad.push('the carrier\'s trigger click is not a Status move');
  if (!(statSpe(f.bodies.C) < statSpe(f.bodies.R))) bad.push('the carrier (' + statSpe(f.bodies.C) + ') is not slower than the receiver (' + statSpe(f.bodies.R) + '), so priority cannot show');
  return bad;
};
C.k3Rocks = (P, only) => {
  const bad = [];
  const T = SP.universe().T;
  for (const [iid, r] of Object.entries(T.items)) {
    const dx = (r.params || {}).extendsDuration; if (!dx) continue;
    if (only && !only.includes('item:' + iid)) continue;
    const m = row(P, 'item:' + iid); const f = m && m.fixtures[0];
    if (!f) { bad.push(iid + ': no fixture'); continue; }
    const ext = dx.extends.map(id);
    const t1 = f.turns[0] && f.turns[0].C;
    if (!t1 || !ext.includes(id(t1.m))) bad.push(iid + ': the holder does not click a setter it extends on turn 1 (' + (t1 && t1.m) + ')');
    if (id(f.bodies.C.item) !== iid) bad.push(iid + ': the setter is not the holder');
    if (!(f.turns.length > dx.insteadOf)) bad.push(iid + ': the game ends before the short clock (' + dx.insteadOf + ') runs out');
  }
  return bad;
};
C.k4Receiver = P => {
  const bad = [];
  for (const k of ['ability:lightningrod', 'ability:voltabsorb']) {
    const m = row(P, k); if (!m) continue;
    const f = m.fixtures[0]; if (!f) { bad.push(k + ': no fixture (' + (m.refusal || {}).code + ')'); continue; }
    if (id(f.bodies.R.species) === 'feraligatr') bad.push(k + ': the receiver is the harness default, whose pool has no Electric move');
    const c = f.conditions.find(x => x.kind === 'click' && x.role === 'R');
    const mv = c && D.moves.get(c.move);
    if (!mv || mv.type !== 'Electric' || mv.category === 'Status') bad.push(k + ': the receiver\'s trigger click is not an Electric hit');
  }
  return bad;
};
C.k5Megas = (P, only) => {
  const bad = [];
  for (const it of D.items.all().filter(i => legal(i) && i.megaStone)) {
    const k = 'item:' + it.id; if (only && !only.includes(k)) continue;
    const bases = Object.entries(it.megaStone).filter(([b, mg]) => legal(D.species.get(b)) && legal(D.species.get(mg)));
    if (!bases.length) continue;
    const m = row(P, k); const f = m && m.fixtures.find(x => x.conditions.some(c => c.kind === 'mega' && c.turn === 1));
    if (!f) { bad.push(k + ': no fixture with a turn-1 mega click (' + ((m && m.refusal) || {}).code + ')'); continue; }
    if (!bases.some(([b]) => id(b) === id(f.bodies.C.species)) || id(f.bodies.C.item) !== it.id) bad.push(k + ': the base forme does not hold its own stone');
  }
  const roster = D.species.all().filter(legal);
  for (const a of D.abilities.all().filter(legal)) {
    const k = 'ability:' + a.id; if (only && !only.includes(k)) continue;
    const car = roster.filter(s => Object.values(s.abilities || {}).map(id).includes(a.id));
    if (!car.length || !car.every(s => s.isMega)) continue;
    const m = row(P, k);
    if (!m || !m.fixtures.some(f => f.bearer && f.bearer.via === 'mega')) bad.push(k + ': a mega-only ability has no fixture through its mega (' + ((m && m.refusal) || {}).code + ')');
  }
  return bad;
};
C.k6Simple = P => {
  const m = row(P, 'ability:simple'); if (!m) return [];
  const f = m.fixtures.find(x => x.branch === 'conferred');
  if (!f) return ['Simple has no conferred fixture (' + ((m.refusal || {}).code) + ')'];
  const beams = new Set(D.moves.all().filter(x => legal(x) && Object.values(x).some(v => typeof v === 'function' && /setAbility\(\s*["']simple["']/.test(String(v)))).map(x => x.id));
  return f.turns.some(t => Object.values(t).some(c => c && beams.has(id(c.m)) && c.at === 'C')) ? [] : ['no turn beams Simple onto the subject'];
};

/* ================= RUN ================================================================================ */
let fails = 0;
const say = (ok, name, detail) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  ' + detail : '')); if (!ok) fails++; };
const t0 = Date.now();
const KNOWN = ['ability:hospitality', 'ability:prankster', 'item:damprock', 'item:lightclay', 'item:heatrock', 'item:smoothrock', 'item:icyrock',
  'ability:lightningrod', 'ability:voltabsorb', 'item:charizarditey', 'item:floettite', 'ability:fairyaura', 'ability:simple', 'ability:infiltrator',
  'ability:battlebond', 'ability:gluttony', 'move:struggle', 'move:spore'];
const P = SP.plan(QUICK ? { only: KNOWN, brk: null } : { brk: null });
const only = QUICK ? KNOWN : null;
console.log('test-stage-planner — ' + (QUICK ? 'known cases' : 'full population') + ', planner ' + P.meta.ms + ' ms, tags ' + P.meta.tags);
const S = P.summary;
console.log('  ' + S.withFixture + ' of ' + S.mechanics + ' mechanics carry a fixture; refused: ' + Object.entries(S.refused).map(([c, n]) => c + ' ' + n).join(', '));
for (const [name, fn] of Object.entries(C)) {
  const bad = fn(P, only);
  say(!bad.length, name, bad.length ? bad.length + ' — ' + bad.slice(0, 3).join(' | ') : '');
}
const receivers = new Set(P.mechanics.flatMap(m => m.fixtures.map(f => f.bodies.R && f.bodies.R.species)).filter(Boolean));
console.log('  distinct receivers across all fixtures: ' + receivers.size + ' (the harness today uses one)');

/* ---- RED: each clause must go red on the break aimed at it, and stay green on the same subset unbroken ---- */
const RED = [
  ['illegal-team', 'validate', ['ability:hospitality']],
  ['control-two-vars', 'oneLeaf', ['ability:voltabsorb', 'item:damprock']],
  ['control-two-reasons', 'oneReason', ['ability:voltabsorb', 'ability:lightningrod']],
  ['omit-mechanic', 'coverage', ['ability:voltabsorb', 'item:damprock']],
  ['one-half', 'halves', ['ability:infiltrator']],
  ['no-mirror', 'sides', ['ability:voltabsorb']],
  ['protect-ally', 'k1Hospitality', ['ability:hospitality']],
  ['prankster-fast', 'k2Prankster', ['ability:prankster']],
  ['no-setter', 'k3Rocks', ['item:damprock', 'item:lightclay']],
  ['feraligatr-only', 'k4Receiver', ['ability:lightningrod', 'ability:voltabsorb']],
  ['no-mega', 'k5Megas', ['item:charizarditey', 'item:floettite', 'ability:fairyaura']],
  ['no-conferral', 'k6Simple', ['ability:simple']],
  ['second-scope', 'oneScope', ['ability:battlebond', 'ability:gluttony', 'ability:simple', 'move:struggle', 'move:spore', 'item:charizarditey']],
];
console.log('  red demonstrations — each broken planner must fail its clause; the same subset unbroken must pass it');
const covered = new Set();
for (const [brk, clause, subset] of RED) {
  if (!SP.BREAKS[brk]) { say(false, 'red ' + brk, 'the planner does not define this break'); continue; }
  const clean = C[clause](SP.plan({ only: subset, brk: null }), subset);
  const broken = C[clause](SP.plan({ only: subset, brk }), subset);
  covered.add(clause);
  say(!clean.length && broken.length > 0, 'red ' + brk.padEnd(20) + ' -> ' + clause,
      'clean ' + clean.length + ' / broken ' + broken.length + (broken.length ? ' (' + broken[0].slice(0, 90) + ')' : ' — THE CLAUSE COULD NOT SEE THE BREAK'));
}
const unshown = Object.keys(C).filter(k => !covered.has(k) && k !== 'arm');
/* the ARM clause's red is a planted wrong arm on a copy — no planner break can be aimed at it without
 * also breaking the plan it reads, so it is shown red on the rendered plan directly */
{
  const P2 = SP.plan({ only: ['item:widelens'], brk: null });
  const clean = C.arm(P2);
  for (const f of P2.mechanics[0].fixtures) f.arm = 'bottom-tie-first';
  const broken = C.arm(P2);
  say(!clean.length && broken.length > 0, 'red planted-arm            -> arm', 'clean ' + clean.length + ' / broken ' + broken.length);
}
say(!unshown.length, 'every clause has a red demonstration', unshown.join(', '));
console.log('  ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log(fails ? '\nRED — ' + fails + ' clause(s) failed' : '\nGREEN');
process.exit(fails ? 1 : 0);
