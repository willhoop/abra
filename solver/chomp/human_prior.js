/* solver/chomp/human_prior.js — the HUMAN-PRIOR preview: what a human brings and leads with this six, from the store.
 * CHOMP's baseline (solver/PLAN.md §2: "uniform, human-modal bring, greedy argmax"), and the (a) comparison.
 *
 *   const HP = require('./solver/chomp/human_prior.js').fit(games[, { alpha, a }])   games = data.js headers, TRAIN sides only
 *   HP.probs(sheet)  -> Float64Array(90)   P(option | my six), solver/chomp/options.js order
 *   HP.modal(sheet)  -> option index        the human-modal bring and lead
 *   HP.meta          what it was fitted on
 *
 * STORE-ONLY. No simulator is read, so it does not wait for any gate. It is fitted on the TRAIN players of the
 * MAG/DODUO/PORYGON2 split (solver/chomp/data.js splitOf) — never on a side it is evaluated on.
 *
 * THE MODEL, three counts and one memory, all smoothed toward a neutral prior:
 *   b[s]  = P(brought | on the sheet)         (brought + a·4/6) / (sheets + a)        bring-complete sides
 *   l[s]  = P(led | brought)                  (led + a·2/4) / (brought + a)           bring-complete sides
 *   P_base(four F, leads L) ∝ Π_{m∈F} b/(1−b) · Π_{m∈L} l/(1−l)       (a conditional logit: exactly four, exactly two)
 *   TEAM MEMORY: the same six (species@item, order-free) seen before on a TRAIN side:
 *   P(option) = (count(option) + alpha · P_base(option)) / (n + alpha)
 * s is the sheet's species. Bring-complete sides over-represent long games (the four are all seen only when the
 * game runs long enough); that bias is declared here, not corrected.
 */
'use strict';
const O = require('./options.js');
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const spOf = r => toID(r.species_id || r.species);
const sig = sheet => sheet.map(r => spOf(r) + '@' + toID(r.item)).sort().join(',');

function fit(games, o) {
  o = Object.assign({ alpha: 4, a: 3 }, o || {});
  const S = new Map(), B = new Map(), L = new Map();
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const team = new Map();
  let sides = 0;
  for (const G of games) {
    for (const sd of ['p1', 'p2']) {
      if (G.split[sd] !== 'train' || G.option[sd] < 0) continue;
      sides++;
      const sh = G.sheets[sd], op = O.OPTIONS[G.option[sd]];
      sh.forEach((r, i) => {
        const s = spOf(r); inc(S, s);
        if (op.order.includes(i)) { inc(B, s); if (op.leads.includes(i)) inc(L, s); }
      });
      const k = sig(sh);
      let t = team.get(k); if (!t) { t = { n: 0, c: new Map() }; team.set(k, t); }
      t.n++;
      /* the sheet row order of this side maps the option onto species; store it by species@item so another
       * side's row order reads the same team */
      const key = op.leads.map(i => spOf(sh[i]) + '@' + toID(sh[i].item)).sort().join('+') + '/' + op.back.map(i => spOf(sh[i]) + '@' + toID(sh[i].item)).sort().join('+');
      t.c.set(key, (t.c.get(key) || 0) + 1);
    }
  }
  const rate = (num, den, p) => (num + o.a * p) / (den + o.a);
  const bR = s => rate(B.get(s) || 0, S.get(s) || 0, 4 / 6);
  const lR = s => rate(L.get(s) || 0, B.get(s) || 0, 2 / 4);
  const lo = p => Math.log(p / (1 - p));
  function probs(sheet) {
    const sb = sheet.map(r => lo(bR(spOf(r)))), sl = sheet.map(r => lo(lR(spOf(r))));
    const sc = O.OPTIONS.map(op => op.order.reduce((s, i) => s + sb[i], 0) + op.leads.reduce((s, i) => s + sl[i], 0));
    let mx = -Infinity; for (const v of sc) if (v > mx) mx = v;
    const base = sc.map(v => Math.exp(v - mx)); const Z = base.reduce((s, v) => s + v, 0);
    for (let i = 0; i < base.length; i++) base[i] /= Z;
    const t = team.get(sig(sheet));
    if (!t) return Float64Array.from(base);
    const tag = i => spOf(sheet[i]) + '@' + toID(sheet[i].item);
    const out = new Float64Array(O.N);
    for (let i = 0; i < O.N; i++) {
      const op = O.OPTIONS[i];
      const key = op.leads.map(tag).sort().join('+') + '/' + op.back.map(tag).sort().join('+');
      out[i] = ((t.c.get(key) || 0) + o.alpha * base[i]) / (t.n + o.alpha);
    }
    return out;
  }
  function modal(sheet) { const p = probs(sheet); let b = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[b]) b = i; return b; }
  return { probs, modal, meta: { train_sides: sides, species: S.size, teams: team.size, alpha: o.alpha, a: o.a } };
}

module.exports = { fit, sig };
