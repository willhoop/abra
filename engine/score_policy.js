/* score_policy.js — the scoring bot. A player that looks at the other side of the field.
 *
 * WHAT IT IS
 * ----------
 * engine/prior_player.js samples the move a species usually clicks and lets RandomPlayerAI aim it.
 * This subclass keeps the same team-preview logic and the same behaviour clone, and replaces the
 * move decision with a scored one: it tracks the board from the protocol stream, scores every
 * (move, target) pair with the weights engine/fit_policy.js measured from human play, and samples.
 *
 * WHY IT SAMPLES INSTEAD OF TAKING THE BEST MOVE
 * ----------------------------------------------
 * Taking the argmax would be the obvious thing and it is wrong here, for the reason set out in
 * docs/DEFENSE.md section 2: a corpus is closest to reality in DISTRIBUTION when it is drawn from
 * the distribution, and the mode is the right answer only when the goal is to guess one instance.
 * A greedy bot also blows straight past the number it is supposed to reproduce — humans hit super
 * effectively on 23.4% of moves, not on all of them, because they also click Protect, set Tailwind
 * and hit a resisted button to break a Focus Sash. So the fitted distribution is sampled.
 *
 * THE TARGET IS THE HALF THAT WAS MISSING
 * ---------------------------------------
 * RandomPlayerAI picks which foe to aim at with `1 + this.prng.random(2)` and does so BEFORE
 * chooseMove is ever called — the choice string handed to the policy already has a coin-flip target
 * baked into it. So no amount of work on move selection could have fixed aiming, and in doubles
 * aiming is most of what "super effective" means. This class rebuilds the choice string with the
 * target it actually wants.
 *
 * WHAT IT STILL DOES NOT DO
 * -------------------------
 * It does not decide when to switch (inherited unchanged), it does not run a damage calculation —
 * `bp` and type effectiveness stand in for one — and it has no model of what the opponent will do,
 * so it cannot read a Protect or bait a switch. It is one ply, scored. Those are the next things,
 * not things this file quietly pretends to have.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const B = require('./board.js');
const { makePriorPlayer, norm } = require('./prior_player.js');

const WEIGHTS_FILE = path.join(__dirname, '..', 'data', 'policy-weights.json');

/* The weight file records the feature list it was fitted against, and a mismatch is fatal.
 *
 * This is the whole reason FEATURES is exported from board.js rather than written down twice. If a
 * feature were inserted in the middle of the list and the weights not refitted, every weight after
 * it would silently apply to the wrong quantity — the bot would still run, still produce games, and
 * be wrong in a way no test would notice. Refusing to load is the only safe behaviour. */
function loadWeights(file) {
  const j = JSON.parse(fs.readFileSync(file || WEIGHTS_FILE, 'utf8'));
  const got = (j.features || []).join(','), want = B.FEATURES.join(',');
  if (got !== want) {
    throw new Error(`policy-weights.json was fitted against a different feature set.\n` +
      `  file:  ${got}\n  code:  ${want}\n  Refit with: node engine/fit_policy.js`);
  }
  if (!Array.isArray(j.weights) || j.weights.length !== B.FEATURES.length) {
    throw new Error('policy-weights.json has no usable weight vector — refit with engine/fit_policy.js');
  }
  return j;
}

/* Protocol identifiers: "p1a: Nickname" -> side p1, position 0. */
const SLOT = /^(p[12])([a-c]): (.*)$/;
const posOf = letter => letter.charCodeAt(0) - 97;

function makeScoringPlayer(opts = {}) {
  const PriorPlayerAI = makePriorPlayer();
  const CS = require('./champions_sim.js');
  const { Dex } = CS.sim();
  const dex = Dex.forFormat(CS.FORMAT);

  class ScoringPlayerAI extends PriorPlayerAI {
    constructor(playerStream, options = {}, debug = false) {
      super(playerStream, options, debug);
      const W = options.weights || loadWeights(options.weightsFile);
      this.w = W.weights;
      this.board = new B.Board();
      this.me = null;                 // 'p1' | 'p2', learned from the first request
      /* Same accounting discipline as the parent: a policy that silently degrades to its fallback
       * is the failure mode this whole family of classes exists to make visible. */
      this.stats.scored = 0;
      this.stats.scoreFellBack = 0;
      this.stats.aimed = 0;
      /* Priors as a map per species, so scoring a candidate is a lookup rather than a scan. */
      this.priorMap = {};
      for (const [sp, rows] of Object.entries(this.priors || {})) {
        const r = {}; for (const [id, p] of rows) r[id] = p;
        this.priorMap[sp] = r;
      }
    }

    priorFor(species, moveId) {
      const r = this.priorMap[norm(species)] || this.priorMap[B.baseSpecies(species)];
      return r ? (r[norm(moveId)] || 0) : 0;
    }

    /* ---- BOARD TRACKING ----------------------------------------------------------------------
     * Every line the simulator emits passes through here on its way to the parent. The state kept
     * is exactly the state engine/board.js features read, and no more. */
    receiveLine(line) {
      try { this.track(line); } catch (e) { /* tracking must never break the battle */ }
      return super.receiveLine(line);
    }

    track(line) {
      if (!line.startsWith('|')) return;
      const p = line.slice(1).split('|');
      const cmd = p[0];
      const who = (s) => { const m = SLOT.exec(s || ''); return m ? { side: m[1], letter: m[2] } : null; };
      const monAt = (s) => { const w = who(s); return w ? this.board.slot(w.side, w.letter) : null; };

      if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
        const w = who(p[1]); if (!w) return;
        const species = String(p[2] || '').split(',')[0];
        this.board.switchIn(w.side, w.letter, species);
        const m = this.board.slot(w.side, w.letter);
        if (m) m.hp = hpFrac(p[3], 1);
      } else if (cmd === 'detailschange' || cmd === '-formechange') {
        const m = monAt(p[1]); if (m) m.species = norm(String(p[2] || '').split(',')[0]);
      } else if (cmd === '-damage' || cmd === '-sethp') {
        const m = monAt(p[1]); if (m) m.hp = hpFrac(p[2], m.hp);
      } else if (cmd === '-heal') {
        const m = monAt(p[1]); if (m) m.hp = hpFrac(p[2], m.hp);
      } else if (cmd === 'faint') {
        const w = who(p[1]); if (w) this.board.faint(w.side, w.letter);
      } else if (cmd === '-status') {
        const m = monAt(p[1]); if (m) m.status = norm(p[2]);
      } else if (cmd === '-curestatus') {
        const m = monAt(p[1]); if (m) m.status = '';
      } else if (cmd === 'move') {
        /* Record what was used so `stalledLastTurn` and lastMove are right next turn. The setter
         * effects themselves arrive as their own -sidestart / -fieldstart / -weather lines below,
         * which are ground truth, so noteMove is told not to apply them a second time. */
        const w = who(p[1]); if (!w) return;
        const m = this.board.slot(w.side, w.letter);
        const mv = dex.moves.get(p[2] || '');
        if (m && mv && mv.exists) B.noteMove(this.board, w.side, m, mv, false);
      } else if (cmd === '-weather') {
        const wx = String(p[1] || '');
        if (/^none$/i.test(wx)) this.board.setWeather('');
        else if (!line.includes('[upkeep]')) this.board.setWeather(wx);
      } else if (cmd === '-fieldstart') {
        const mv = dex.moves.get(String(p[1] || '').replace(/^move:\s*/, ''));
        const k = mv && mv.exists ? B.fieldKey(mv) : norm(p[1]);
        if (k) this.board.startField(k, 1e9);
      } else if (cmd === '-fieldend') {
        const mv = dex.moves.get(String(p[1] || '').replace(/^move:\s*/, ''));
        const k = mv && mv.exists ? B.fieldKey(mv) : norm(p[1]);
        if (k) this.board.pseudoWeather.delete(k);
      } else if (cmd === '-sidestart' || cmd === '-sideend') {
        /* Side conditions arrive as events here, where the fit had to derive them from the setter
         * move and its dex duration (stored games do not carry -sidestart). Both answer the same
         * question — "is it up" — and the event form is exact, so the live player uses it. */
        const side = String(p[1] || '').slice(0, 2);
        const mv = dex.moves.get(String(p[2] || '').replace(/^move:\s*/, ''));
        const k = mv && mv.exists && mv.sideCondition ? norm(mv.sideCondition) : norm(p[2]);
        if (!k || !this.board.sides[side]) return;
        if (cmd === '-sidestart') this.board.sides[side].sideConditions.set(k, 1e9);
        else this.board.sides[side].sideConditions.delete(k);
      } else if (cmd === 'turn') {
        this.board.endTurn();
      }
    }

    receiveRequest(request) {
      if (!this.me && request && request.side && request.side.id) this.me = request.side.id;
      return super.receiveRequest(request);
    }

    /* ---- THE DECISION ------------------------------------------------------------------------ */
    chooseMove(active, moves) {
      const species = this.speciesFor(active);
      /* The species under test keeps its uniform pilot — build_lab needs equal airtime per arm and
       * that requirement is unchanged by this class. See prior_player.js for why. */
      if (this.uniformFor.size && this.uniformFor.has(species)) return super.chooseMove(active, moves);

      const me = this.me || 'p1';
      const foeSide = me === 'p1' ? 'p2' : 'p1';
      const i = this._req && this._req.active ? this._req.active.indexOf(active) : 0;
      const user = this.board.slot(me, String.fromCharCode(97 + Math.max(0, i)));
      if (!user) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }

      const foes = this.board.field().filter(f => f.side === foeSide);
      const allies = this.board.field().filter(f => f.side === me && f.mon !== user);
      const doubles = !!(this._req && this._req.active && this._req.active.length > 1);

      /* Candidates come from the REQUEST, which is authoritative about legality — PP, disabled,
       * Choice lock, Fake Out already used. The board supplies the targets. */
      const cands = [];
      for (const m of moves) {
        const info = m.move || {};
        const mv = dex.moves.get(info.move || '');
        if (!mv || !mv.exists) { cands.push({ raw: m, move: null, choice: m.choice }); continue; }
        /* THE TARGET TYPE COMES FROM THE REQUEST, AND ITS ABSENCE IS MEANINGFUL.
         *
         * When a Pokemon is locked into a two-turn move the request lists the move with NO target
         * field, and appending one is rejected outright: "[Invalid choice] Can't move: You can't
         * choose a target for Electro Shot". An earlier version defaulted the missing field to
         * 'normal' and killed the battle on the first charge move.
         *
         * So the rule is the base class's rule: rebuild the choice string ONLY for a target type the
         * request actually declares as aimable, and otherwise pass its string through untouched.
         * The move is still scored either way — it just is not re-aimed. */
        const tgt = info.target;
        if (!tgt || !doubles) { cands.push({ raw: m, move: mv, targetMon: foes.length ? foes[0].mon : null, choice: m.choice }); continue; }

        if (B.SELF_TARGETS.has(tgt) && tgt !== 'adjacentAlly') {
          cands.push({ raw: m, move: mv, targetMon: null, choice: m.choice });
        } else if (tgt === 'allAdjacentFoes' || tgt === 'allAdjacent') {
          cands.push({ raw: m, move: mv, targetMon: null, spread: foes.map(f => f.mon), choice: m.choice });
        } else if (tgt === 'adjacentAlly' || tgt === 'adjacentAllyOrSelf') {
          cands.push({ raw: m, move: mv, targetMon: allies.length ? allies[0].mon : null, choice: m.choice });
        } else if (['normal', 'any', 'adjacentFoe'].includes(tgt)) {
          /* THE AIM. targetLoc is 1-based over the foe side's active slots and is NOT mirrored in
           * this generation — pokemon.js getAtLoc returns side.active[targetLoc - 1] — so p2a is 1
           * and p2b is 2. Verified against the simulator rather than assumed, because aiming at the
           * wrong foe would look exactly like aiming at random and would undo the entire file. */
          if (!foes.length) { cands.push({ raw: m, move: mv, targetMon: null, choice: m.choice }); continue; }
          for (const f of foes) {
            cands.push({ raw: m, move: mv, targetMon: f.mon, choice: `move ${info.slot} ${posOf(f.letter) + 1}` });
          }
        } else {
          cands.push({ raw: m, move: mv, targetMon: null, choice: m.choice });
        }
      }
      if (!cands.length) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }

      const scores = cands.map(c => {
        if (!c.move) return -Infinity;
        const x = B.featuresFor(c, user, this.board, me, dex, this.priorFor(user.species, c.move.id));
        let s = 0; for (let k = 0; k < this.w.length; k++) s += this.w[k] * x[k];
        return s;
      });

      let max = -Infinity;
      for (const s of scores) if (s > max) max = s;
      if (!isFinite(max)) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }
      const exp = scores.map(s => (isFinite(s) ? Math.exp(s - max) : 0));
      const total = exp.reduce((a, b) => a + b, 0);
      if (!(total > 0)) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }

      /* this.prng, never Math.random(): the parent seeds it from the battle seed, and a move
       * decision drawn outside that seed makes the whole game unreplayable. */
      let r = this.prng.random() * total, j = 0;
      while (j < exp.length - 1 && (r -= exp[j]) > 0) j++;
      this.stats.scored++;
      if (cands[j].targetMon && doubles) this.stats.aimed++;
      return cands[j].choice;
    }
  }

  return ScoringPlayerAI;
}

/* "142/226" or "50/100 par" or "0 fnt" -> fraction. Returns the previous value on anything it does
 * not understand, so a parse miss holds state rather than inventing a full-health target. */
function hpFrac(s, prev) {
  const t = String(s || '');
  if (/^0 fnt/.test(t)) return 0;
  const m = /^(\d+)\/(\d+)/.exec(t);
  if (!m) return prev;
  return +m[2] ? Math.max(0, Math.min(1, +m[1] / +m[2])) : prev;
}

module.exports = { makeScoringPlayer, loadWeights, hpFrac };
