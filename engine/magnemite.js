/* magnemite.js — the scoring bot. A player that looks at the other side of the field.
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
const V = require('./variance.js');
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

/* How long a per-mon volatile lasts, from the dex condition of the move that creates it. */
let _volDur = null;
function volatileDuration(name) {
  if (!_volDur) {
    _volDur = {};
    try {
      for (const m of dex.moves.all()) {
        if (!m || !m.exists) continue;
        const v = B.norm(m.volatileStatus || '');
        const d = m.condition && m.condition.duration;
        if (v && d) _volDur[v] = d;
        const byName = B.norm(m.name);
        if (d && !_volDur[byName]) _volDur[byName] = d;
      }
    } catch (e) { /* default below */ }
  }
  return _volDur[B.norm(name)] || 3;
}

/* HOW LONG DOES IT LAST — read from the dex, not assumed infinite.
 *
 * The board has tracked expiry correctly since it was written: startSide and startField store
 * `turn + duration` and hasSide compares against the current turn. The PLAYER passed 1e9. So in
 * every game MAG has ever played, Trick Room, Tailwind and the screens were PERMANENT -- they never
 * expired, deadField reported them as already up forever, and the speed doubling never stopped.
 *
 * Same shape as every other bug found on 2026-07-28: the machinery exists and the caller does not
 * use it. Durations are plain dex data -- Tailwind 4, everything else 5 -- so this is a lookup, and
 * Light Clay extends the three screens to 8, which is why the holder is checked.
 *
 * Falls back to 5 for anything unrecognised, which is the generic field duration and is finite. */
let _durCache = null;
function fieldDuration(cond, side, board) {
  if (!_durCache) {
    _durCache = {};
    try {
      for (const m of dex.moves.all()) {
        if (!m || !m.exists) continue;
        const key = B.norm(m.sideCondition || m.pseudoWeather || '');
        const d = m.condition && m.condition.duration;
        if (key && d) _durCache[key] = d;
      }
    } catch (e) { /* fall through to the default */ }
  }
  const base = _durCache[B.norm(cond)] || 5;
  /* Light Clay: 8 turns instead of 5, and only for the three screens. Checked against the SHEET,
   * which now actually reaches the player. */
  if (side && board && /^(reflect|lightscreen|auroraveil)$/.test(B.norm(cond))) {
    for (const f of board.field()) {
      if (f.side !== side) continue;
      const it = board.sheetItem(side, f.mon.species);
      if (it && B.norm(it) === 'lightclay') return 8;
    }
  }
  return base;
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
      /* Opt-in: the viewer wants it, a training run does not. */
      this.keepThoughts = !!(options && options.keepThoughts);
      this.allowSwitch = !!(options && options.switching);
      /* FORCED REPLACEMENTS ARE A SEPARATE LEVER FROM VOLUNTARY SWITCHING, and they have to be,
       * because they are not the same decision. `switching` asks "is leaving worth a turn?" and
       * measured as a ten-point LOSS. A forced replacement asks only "which one comes in?" — the
       * turn is already gone with the Pokemon that fainted, and passing is not a legal choice. So
       * the 81.9% bar does not apply here and this lever cannot reintroduce that loss.
       *
       * Off by default anyway, because the weights it scores with are the SAME ones the switching
       * verdict called noise (switchSurvives1 +0.055, switchFaster -0.112, switchSurvives2's
       * interval containing zero). Ordering two replacements by noisy weights may be no better than
       * the die it replaces. Measure before defaulting it on. */
      this.scoreForced = !!(options && options.forcedSwitch);
      this.stats.forcedScored = 0;
      this.stats.forcedFellBack = 0;
      this.greedy = !!(options && options.greedy);
      /* THE JOINT LAYER, OPT-IN. data/policy-weights-joint.json holds FEATURES.length single weights
       * followed by JOINT_FEATURES.length pair weights, fitted by engine/fit_joint.js on the choice
       * of a PAIR. Loaded only when asked for, and refused outright if its feature list disagrees
       * with board.js -- a stale pair vector would score the wrong columns and the bot would look
       * merely worse rather than broken. */
      /* MEGA EVOLUTION, TAKEN OVER FROM THE BASE CLASS BECAUSE THE BASE CLASS GETS IT WRONG.
       *
       * random-player-ai.ts accumulates the flag ACROSS SLOTS:
       *     canMegaEvo = canMegaEvo && active.canMegaEvo
       * inside a map over request.active, and only then computes
       *     change = (canMegaEvo || ...) && this.prng.random() < this.mega
       *
       * In doubles that means one Pokemon without a mega stone permanently kills the flag for the
       * WHOLE SIDE. A team carries one stone, so whether the bot can mega at all comes down to
       * whether the stone happens to be in the LEFT slot. Confirmed live from a real battle:
       * `slot0:canMegaEvo=undefined slot1:canMegaEvo=true` and not one choice carrying a mega
       * suffix. It also explains why self-play megaed 2,174 times across 1,934 games -- roughly
       * half, which is how often the mega body leads on the left -- while Will saw it fail on
       * Swampert, Starmie and Pyroar in a row.
       *
       * So the roll is made HERE, per slot, against that slot's own flag. `this.mega` is forced to
       * 0 on the parent so it can never also append a suffix and produce "move 1 1 mega mega". */
      /* THE PROBABILITY IS A PLACEHOLDER AND IT IS THE WRONG SHAPE.
       *
       * 0.85 was inherited from Showdown's RandomPlayerAI, where a coin flip exists so a RANDOM bot
       * sometimes megas. Nothing about it is a decision, and Will's objection is the right one:
       * declining a mega should have a REASON. His two are weather -- mega evolution changes the
       * ability, so whether to take it depends on what weather is up and who set it -- and setup,
       * where you delay so the stat change lands on the turn it matters. Both are properties of the
       * BOARD, and a fixed probability cannot express either.
       *
       * Defaulted to 1 until mega is a scored candidate rather than a roll, because in this format
       * declining is almost never right and 0.85 was throwing away one mega in seven for nothing. */
      this.megaP = options && options.mega != null
        ? Math.max(0, Math.min(1, +options.mega || 0)) : 0;
      this.mega = 0;
      this.ignoreSheet = !!(options && options.ignoreSheet);
      this.joint = false; this.wj = null;
      this.jointZero = !!(options && options.jointZero);
      this.jointK = +(options && options.jointK) || 6;
      if (options && (options.joint || options.jointZero)) {
        try {
          const JW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'policy-weights-joint.json'), 'utf8'));
          const okS = (JW.features || []).join(',') === B.FEATURES.join(',');
          const okJ = (JW.jointFeatures || []).join(',') === B.JOINT_FEATURES.join(',');
          if (!okS || !okJ) throw new Error('joint weights do not match board.js — refit engine/fit_joint.js');
          if ((JW.weights || []).length !== B.FEATURES.length + B.JOINT_FEATURES.length) throw new Error('joint weight vector is the wrong length');
          this.wj = JW.weights; this.joint = true;
        } catch (e) {
          /* Loud. Asking for the joint layer and silently not getting it is the failure this project
           * has already been bitten by twice. */
          throw new Error(`magnemite: joint layer requested but unavailable — ${e.message}`);
        }
      }
      /* RISK PREFERENCE, and it must be asked for. `{ skillGap, strength }` -- skillGap is what you
       * believe about the opponent in win-probability points, strength is how hard to tilt. Absent or
       * zero makes engine/variance.js an exact no-op, which is the right default: applying a variance
       * preference without a stated belief about the opponent is strictly worse than not applying one. */
      this.risk = (options && options.risk) || null;
      this.stats.thoughts = [];
      /* Priors as a map per species, so scoring a candidate is a lookup rather than a scan. */
      this.priorMap = {};
      for (const [sp, rows] of Object.entries(this.priors || {})) {
        const r = {}; for (const [id, p] of rows) r[id] = p;
        this.priorMap[sp] = r;
      }
    }

    /* A REJECTED CHOICE MUST NOT KILL THE BATTLE, BUT IT MUST NOT BE SILENT EITHER.
     *
     * Two slots choosing simultaneously can both name the same benched Pokemon, and the simulator
     * refuses the second. The claim tracking below prevents the cases found so far; this catches
     * whatever is left, because a run of 20,000 games dying on game 50 loses everything and a
     * quietly-swallowed error loses the evidence.
     *
     * `default` is Showdown's own "pick something legal" instruction, so the battle continues with a
     * valid move. The COUNT is what matters: it is reported at the end of every run, so a recovery
     * that starts happening often is visible as a number rather than as a slowly worse bot. */
    receiveError(error) {
      const msg = String((error && error.message) || error);
      /* ANY server complaint, not only a rejected choice. A room-level message -- "you cannot agree
       * to open team sheets after Team Preview" -- was fatal, and killed a bot mid-session over
       * something that did not concern the battle at all. Counted, never silent, never fatal. */
      if (!/\[Invalid choice\]/.test(msg)) {
        this.stats.serverComplaints = (this.stats.serverComplaints || 0) + 1;
        this.stats.lastComplaint = msg;
        return;
      }
      if (/\[Invalid choice\]/.test(msg)) {
        this.stats.rejectedChoices = (this.stats.rejectedChoices || 0) + 1;
        this.stats.lastRejection = msg;
        this.choose('default');
        return;
      }
      return super.receiveError(error);
    }

    /* FORCED REPLACEMENTS COLLIDE TOO. When both Pokemon faint in one turn the simulator asks for two
     * replacements and the inherited chooseSwitch picks each independently -- so both slots can name
     * the same benched Pokemon and the battle dies on "can only switch in once". The claim tracking
     * on chooseMove does not help: this path never goes through chooseMove at all. Same bug, second
     * entrance, and it only appeared once switching was enabled anywhere. */
    chooseSwitch(active, switches) {
      if (this._claimReq !== this._req) { this._claimReq = this._req; this._claimed = new Set(); }
      const free = (switches || []).filter(sw => !this._claimed.has(sw.slot));
      const pool = free.length ? free : (switches || []);
      const scored = this._scoreForcedPick(pool);
      const pick = scored == null ? super.chooseSwitch(active, pool) : scored;
      this._claimed.add(pick);
      return pick;
    }

    /* WHICH POKEMON COMES IN AFTER A KO — the decision this class never made.
     *
     * `_candsFor` builds switch candidates only when `!this._req.forceSwitch`, and Showdown's
     * receiveRequest routes a forced replacement straight to chooseSwitch without ever calling
     * chooseMove. So every post-KO replacement MAG has ever made came from the inherited
     *     protected chooseSwitch(...) { return this.prng.sample(switches).slot; }
     * which is a uniform die. Measured on 6,000 self-play games: 3.55 forced replacements per game
     * across both sides, of which 1.91 had two live options to choose between and 1.63 had exactly
     * one (bring 4, two active, so the bench is at most two deep). About one real decision per side
     * per game, decided by coin flip, and it decides what stands on the field for the rest of it.
     *
     * The features are the ones switchFeatures already computes — how much of the incoming mon the
     * hardest enemy attack takes, whether it takes half of it, and whether it outruns the fastest
     * thing across from it. Nothing new is asserted here and no refit is needed, for a reason worth
     * stating: post-KO EVERY candidate is a switch, so the flat `isSwitch` intercept that carries
     * the average cost of a turn is identical across the choice set and cancels out of the argmax
     * exactly as it cancels out of a softmax. The turn-cost bias baked into that weight cannot
     * distort a decision in which there is nothing to compare a switch against.
     *
     * Returns null — deliberately, not a slot — whenever it cannot honestly claim to have decided:
     * lever off, no weights, fewer than two live options, or a species that would not resolve. The
     * caller then falls back to the inherited die, and stats.forcedFellBack says how often. */
    _scoreForcedPick(pool) {
      if (!this.scoreForced || !this.w || !this.board) return null;
      if (!Array.isArray(pool) || pool.length < 2) return null;
      const me = this.me || 'p1';
      let bestSlot = null, bestScore = -Infinity, n = 0;
      for (const sw of pool) {
        const p = sw && sw.pokemon;
        if (!p) continue;
        const sp = B.norm(String(p.details || p.ident || '').split(',')[0].replace(/^p[12][a-z]?:\s*/, ''));
        if (!sp) continue;
        /* `user` is null on purpose. switchFeatures passes it to incomingThreat, which reads it ONLY
         * to key the cache; the damage it computes is the enemy actives' best hit on the mon coming
         * IN. The Pokemon that just fainted is not part of that question. */
        /* `forced: true` is what tells switchFeatures there is no entry hit to survive -- the slot
         * is empty because something fainted out of it. Omitting it would price every post-KO
         * replacement as though it were walking into a free hit that nobody throws. */
        const x = B.featuresFor({ raw: null, move: null, targetMon: null, switchTo: sp, forced: true },
          null, this.board, me, dex, B.PRIOR_FLOOR);
        if (!x) continue;
        let s = 0;
        for (let k = 0; k < this.w.length; k++) s += this.w[k] * x[k];
        n++;
        if (s > bestScore) { bestScore = s; bestSlot = sw.slot; }
      }
      if (bestSlot == null || n < 2) { this.stats.forcedFellBack++; return null; }
      this.stats.forcedScored++;
      return bestSlot;
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

      /* OPEN TEAM SHEETS, READ BY THE PLAYER FOR THE FIRST TIME.
       *
       * board.js has had setSheet() since it was written, and six files called it -- fit_policy,
       * fit_joint, branch_recall, feature_coverage, ko_calibration, surprise. Every one of them is
       * an OFFLINE script replaying stored games. The PLAYER never called it once.
       *
       * So the weights were FITTED with the sheet visible and the bot PLAYED without it: nature
       * never narrowed the spread distribution, the item was never known, and megaFormeOf could not
       * resolve a mega forme it had no stone for. In a format built on open sheets the bot was
       * reading population priors off a screen that was showing it the answer.
       *
       * In Champions specifically the sheet publishes the NATURE (sim/battle.ts:3192 special-cases
       * `format.mod.startsWith('champions')`), which is the single most useful field here: it does
       * not give the EV spread, but it tells you the direction of the investment, and speed order is
       * what most of MAG's damage and kill features hang off. IVs are not a variable in this format.
       *
       * Field order matches engine/durable-ingest.js exactly, deliberately -- two parsers for one
       * protocol line is how they drift. */
      if (line.startsWith('|showteam|')) {
        /* ignoreSheet is the CONTROL ARM for "is the open team sheet worth anything".
         * Same weights, same open-sheet game, one player reads the sheet and the other refuses to.
         * That isolates the value of the information itself, which comparing an open-sheet run
         * against a closed-sheet run cannot do -- those are different populations of games and
         * their win rates are not comparable. */
        if (this.ignoreSheet) return;
        const m = /^\|showteam\|(p[12])\|(.*)$/.exec(line);
        if (m && this.board) {
          for (const entry of m[2].split(']')) {
            const f = entry.split('|');
            const sp = B.norm(f[0] || '');
            if (!sp) continue;
            this.board.setSheet(m[1], sp, {
              nature: (f[5] || '') || '',
              item: (f[2] || '') || '',
              ability: (f[3] || '') || '',
              moves: (f[4] || '').split(',').filter(Boolean),
            });
            this.stats.sheetEntries = (this.stats.sheetEntries || 0) + 1;
          }
        }
        return;
      }

      /* VOLATILES WITH A TIMER. |-start|p1a: Toxapex|Encore and |-end|p1a: Toxapex|Encore.
       *
       * Durations come from the dex condition of the move that shares the volatile's name, so Taunt
       * 3, Encore 3, Disable 5, Throat Chop 2, Yawn 2, Heal Block 5 are looked up rather than typed.
       * Perish Song is special-cased ONLY in that the protocol ships its own counter in the name --
       * perish3, perish2, perish1 -- so the number is read straight off the wire. */
      if (line.startsWith('|-start|') || line.startsWith('|-end|')) {
        const st = line.startsWith('|-start|');
        const q = line.slice(st ? 8 : 6).split('|');
        const who = /^(p[12])([a-c]): /.exec(q[0] || '');
        if (who && this.board) {
          const raw = String(q[1] || '').replace(/^move:\s*/i, '').trim();
          const perish = /^perish(\d)$/i.exec(B.norm(raw));
          if (st) {
            this.board.startVolatile(who[1], who[2], perish ? 'perishsong' : raw,
              perish ? +perish[1] : volatileDuration(raw));
          } else {
            this.board.endVolatile(who[1], who[2], perish ? 'perishsong' : raw);
          }
          this.stats.volatileEvents = (this.stats.volatileEvents || 0) + 1;
        }
        return;
      }

      /* ITEM CHANGES, so the sheet stops being believed once it is out of date.
       *
       *   |-item|p2a: Whimsicott|Focus Sash        gained -- Trick, Switcheroo, a Symbiosis pass
       *   |-enditem|p2a: Whimsicott|Focus Sash     lost or CONSUMED -- Knock Off, a used Sash, a
       *                                            berry eaten
       *
       * Knock Off alone is 1,640 uses. Without this the Sash drag would be certain of an item a
       * good opponent had deliberately removed, which is worse than the population prior it
       * replaced -- the prior at least hedged. */
      if (line.startsWith('|-item|') || line.startsWith('|-enditem|')) {
        const gained = line.startsWith('|-item|');
        const q = line.slice(gained ? 7 : 10).split('|');
        const m2 = /^(p[12])([a-c]): (.*)$/.exec(q[0] || '');
        if (m2 && this.board) {
          const mon = this.board.slot(m2[1], m2[2]);
          const sp = mon ? mon.species : m2[3];
          this.board.noteItem(m2[1], sp, gained ? (q[1] || '') : '');
          this.stats.itemEvents = (this.stats.itemEvents || 0) + 1;
        }
        return;
      }

      /* DID THE MOVE FAIL — tracked from the protocol, for Stomping Tantrum (2,122 uses, computed
       * at 75 every time when it doubles to 150 after a failure).
       *
       * The events do NOT name the attacker. |-immune|p2b: Tinkaton names the Pokemon that was
       * immune, and |-fail|p2a: Sableye|tox names the one the status could not land on -- in both
       * cases the move that FAILED belongs to whoever moved. So the source of the preceding |move|
       * line is remembered and the failure is attributed to it. */
      {
        const mv = /^\|move\|(p[12])([a-c]): /.exec(line);
        if (mv) this._lastMover = { side: mv[1], letter: mv[2] };
        else if (/^\|(-fail|-miss|-immune|-notarget|-block)\|/.test(line) && this._lastMover && this.board) {
          const src = this.board.slot(this._lastMover.side, this._lastMover.letter);
          if (src) { src.moveFailedThisTurn = true; this.stats.moveFails = (this.stats.moveFails || 0) + 1; }
        }
      }

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
        if (k) this.board.startField(k, fieldDuration(k));
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
        if (cmd === '-sidestart') this.board.startSide(side, k, fieldDuration(k, side, this.board));
        else this.board.sides[side].sideConditions.delete(k);
      } else if (cmd === 'turn') {
        this.board.endTurn();
      }
    }

    receiveRequest(request) {
      if (!this.me && request && request.side && request.side.id) this.me = request.side.id;
      return super.receiveRequest(request);
    }

    /* ---- CANDIDATES FOR ONE SLOT --------------------------------------------------------------
     *
     * Split out of chooseMove so the JOINT layer can build the PARTNER's list too. Deciding a pair
     * requires both slots' options at once, and this logic previously existed only inside the
     * per-slot decision, which is a large part of why the pair model was never wired in: there was
     * no way to ask "what can my partner do" without duplicating a hundred lines of legality
     * handling. Returns null when the slot cannot be scored, and every caller falls back. */
    _candsFor(active, moves, i) {
      const me = this.me || 'p1';
      const foeSide = me === 'p1' ? 'p2' : 'p1';
      const user = this.board.slot(me, String.fromCharCode(97 + Math.max(0, i)));
      if (!user) return null;

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
      /* SWITCHING WAS ADDED TO THE FITTER AND NEVER TO THE PLAYER.
       *
       * engine/board.js grew switch candidates and engine/fit_policy.js learned weights for them --
       * switchSurvives1, switchSurvives2, switchFaster -- and this list contains only MOVES, so the
       * bot never once scored a switch. The weights existed and were unreachable, which is the same
       * class of defect as a feature that computes to zero: everything runs, nothing objects, and
       * the capability simply is not there.
       *
       * The request is authoritative about which switches are legal (trapped, already active,
       * fainted), so the party is read from it rather than from the tracked board. `switch N` is
       * 1-based over the side's full party. */
      const party = (this._req && this._req.side && this._req.side.pokemon) || [];
      const canSwitch = !(active && active.trapped) && !(active && active.maybeTrapped);
      /* TWO SLOTS CANNOT CLAIM THE SAME BENCHED POKEMON, and this class decides them one at a time.
       * Both slots independently picked the best switch-in and the simulator refused the second:
       * "The Pokémon in slot 3 can only switch in once". That is the joint-decision problem in
       * miniature -- the same one the pair model exists to solve -- surfacing as a hard error rather
       * than as a bad move, only because the rules happen to forbid this particular collision.
       *
       * Tracked per REQUEST: both slots of a turn share one request object, so a set keyed on it
       * clears exactly when a new turn arrives, with no bookkeeping to get wrong. */
      if (this._claimReq !== this._req) { this._claimReq = this._req; this._claimed = new Set(); }
      /* SWITCHING IS OFF BY DEFAULT, AND THAT IS A MEASUREMENT, NOT TIMIDITY.
       *
       * A 2x2 against a random opponent, 10,000 paired games per cell, forced open sheets:
       *
       *   MAG cannot switch, monkey cannot   81.9% of decisive pairs
       *   MAG CAN switch,    monkey can      71.6%
       *   MAG CAN switch,    monkey cannot   71.6%   <- identical, so the monkey is not the cause
       *
       * The last two cells matching is what settles it: enabling MAG's own switching costs TEN
       * POINTS and the opponent's switching costs nothing. Which is exactly what the fit said and
       * what I under-weighted -- switchSurvives1 +0.055, switchFaster -0.112, switchSurvives2 with
       * an interval containing zero. Weights fitted out of noise, acted on 4.43 times a game.
       *
       * The capability is needed for ALAKAZAM and the plumbing is now correct, so it stays and is
       * reachable with `switching: true`. It is default-off until a switch policy beats not
       * switching, and the number to beat is 81.9%. */
      if (this.allowSwitch && canSwitch && !this._req.forceSwitch) {
        party.forEach((p, idx) => {
          if (!p || p.active) return;
          /* ONE-BASED, to match chooseSwitch. The two claim sites used different bases -- this one
           * stored the 0-based party index and chooseSwitch stored Showdown's 1-based slot -- so
           * neither could see the other's claim and the collision came straight back. `switch N` is
           * 1-based, so that is the convention both now use. */
          if (this._claimed.has(idx + 1)) return;                  // my partner is already taking it
          if (String(p.condition || '').includes('fnt')) return;   // dead, not a legal switch
          const sp = B.norm((p.details || p.ident || '').split(',')[0].replace(/^p[12][a-z]?:\s*/, ''));
          if (!sp) return;
          cands.push({ raw: null, move: null, switchTo: sp, targetMon: null, choice: `switch ${idx + 1}` });
        });
      }

      return cands.length ? { cands, user, doubles } : null;
    }

    /* Score one slot's candidate list. Returns the raw feature vectors alongside the scores, because
     * the joint layer needs the vectors -- jointFeaturesFor reads the kill and threat terms out of
     * them rather than calling the damage engine a second time. */
    _scoreCands(cands, user, me, wv) {
      /* THE WEIGHT VECTOR IS AN ARGUMENT, and that is not a refactor for tidiness.
       *
       * fit_joint.js fits its single-move block and its pair block TOGETHER, so the pair weights are
       * calibrated against ITS singles, not against the shipped ones. The two disagree badly --
       * 23 of 48 features carry opposite signs, and stallIntoEncore is +4.231 in the joint fit
       * against -1.993 shipped. Scoring the singles with one vector and adding the other's pair
       * terms sums two blocks on different scales, which is not a coordination model; it is noise
       * with a coordination-shaped correction bolted on. The first head-to-head did exactly that and
       * lost 31.2% on decisive pairs, and I would have reported that as "coordination does not
       * win". */
      const w = wv || this.w;
      const riskOn = this.risk && (this.risk.skillGap || this.risk.strength);
      const pWin = riskOn ? V.winProb(this.board, me) : 0.5;
      const xs = [], ss = [];
      for (const c of cands) {
        if (!c.move && !c.switchTo) { xs.push(null); ss.push(-Infinity); continue; }
        const x = B.featuresFor(c, user, this.board, me, dex,
          c.switchTo ? B.PRIOR_FLOOR : this.priorFor(user.species, c.move.id));
        let sc = 0; for (let k = 0; k < w.length; k++) sc += w[k] * x[k];
        xs.push(x); ss.push(riskOn ? V.adjust(sc, x, pWin, this.risk) : sc);
      }
      return { xs, ss };
    }

    /* THE PARTNER'S MOVE LIST, IN THE SHAPE chooseMove IS GIVEN.
     *
     * These are not the same object. The base class hands chooseMove a RESHAPED list --
     * `{ choice, move: { slot, move, target, zMove } }` -- built in random-player-ai.ts, while
     * `request.active[j].moves` is the raw request entry, `{ move: 'Protect', id, pp, target,
     * disabled }`. Passing the raw one to _candsFor made `info.move` undefined for every option, so
     * dex.moves.get('') failed, every candidate came back unscoreable, and the pair path fell back
     * to independent choice on all 99 eligible turns of the smoke test while reporting nothing
     * wrong. The joint counters are what caught it -- a win rate alone would have read as "the pair
     * model does not help", which would have been a false negative on Will's argument.
     *
     * Mirrors the base class: drop disabled moves, keep the 1-based slot, and build a choice string
     * that is already legal, since _candsFor only re-aims the foe-targeting cases. */
    _movesForSlot(act, i) {
      const raw = (act && act.moves) || [];
      const hasAlly = !!(this._req && this._req.side && (this._req.side.pokemon || [])[i ^ 1]
        && !String((this._req.side.pokemon[i ^ 1] || {}).condition || '').endsWith(' fnt'));
      const out = [];
      raw.forEach((m, k) => {
        if (!m || m.disabled) return;
        const tgt = m.target;
        if (tgt === 'adjacentAlly' && !hasAlly) return;
        let choice = `move ${k + 1}`;
        if (this._req.active.length > 1) {
          if (['normal', 'any', 'adjacentFoe'].includes(tgt)) choice += ' 1';
          else if (tgt === 'adjacentAlly') choice += ` -${(i ^ 1) + 1}`;
          else if (tgt === 'adjacentAllyOrSelf') choice += ` -${(hasAlly ? (i ^ 1) : i) + 1}`;
        }
        out.push({ choice, move: { slot: k + 1, move: m.move, target: tgt, zMove: false } });
      });
      return out;
    }

    /* Decide BOTH slots at once. Returns this slot's choice string and parks the partner's, or null
     * to fall through to the independent path -- which it does whenever the partner's options cannot
     * be built, so a failure here is a silent degradation to the old behaviour rather than an error.
     * That degradation is COUNTED (stats.jointFellBack), because an unmeasured fallback is how a
     * feature ends up "wired in" and never actually running. */
    _decidePair(active, moves, i, candsA, userA, me) {
      const other = 1 - i;
      const actB = this._req.active[other];
      const movesB = actB ? this._movesForSlot(actB, other) : [];
      if (!movesB.length) { this.stats.jointFellBack = (this.stats.jointFellBack || 0) + 1; return null; }
      const builtB = this._candsFor(actB, movesB, other);
      if (!builtB) { this.stats.jointFellBack = (this.stats.jointFellBack || 0) + 1; return null; }

      /* The joint file's OWN single block, so both halves of the pair score come from one fit. */
      const wS = this.wj.slice(0, B.FEATURES.length);
      const A = this._scoreCands(candsA, userA, me, wS);
      const Bc = this._scoreCands(builtB.cands, builtB.user, me, wS);

      /* Cap each slot at TOPK by single-move score, exactly as fit_joint.js did. */
      const topIdx = (ss, k) => ss.map((v, q) => [v, q]).filter(([v]) => isFinite(v))
        .sort((a, b) => b[0] - a[0]).slice(0, k).map(([, q]) => q);
      const ia = topIdx(A.ss, this.jointK), ib = topIdx(Bc.ss, this.jointK);
      if (!ia.length || !ib.length) { this.stats.jointFellBack = (this.stats.jointFellBack || 0) + 1; return null; }

      const NF = B.FEATURES.length;
      const pairs = [], ps = [];
      for (const a of ia) for (const b of ib) {
        /* Two slots cannot switch to the same body -- the collision the independent path handles
         * with _claimed. Here it is a property of the PAIR, so it is simply not a legal pair. */
        if (candsA[a].switchTo && builtB.cands[b].switchTo
            && candsA[a].choice === builtB.cands[b].choice) continue;
        const jf = B.jointFeaturesFor(candsA[a], builtB.cands[b], A.xs[a], Bc.xs[b]);
        let sc = A.ss[a] + Bc.ss[b];
        /* jointZero is THE CONTROL ARM, and it has to run this whole path rather than skip it.
         * Choosing over PAIRS is a different distribution from choosing per SLOT even when the pair
         * terms are all zero -- the top-K cap and the softmax over pairs both change behaviour on
         * their own. Comparing pair-terms-on against the independent player would confound
         * coordination with the mechanics of pair sampling; comparing it against pair-terms-ZEROED
         * isolates the 18 coordination weights and nothing else. */
        if (!this.jointZero) for (let k = 0; k < jf.length; k++) sc += this.wj[NF + k] * jf[k];
        pairs.push([a, b]); ps.push(sc);
      }
      if (!pairs.length) { this.stats.jointFellBack = (this.stats.jointFellBack || 0) + 1; return null; }

      let max = -Infinity; for (const v of ps) if (v > max) max = v;
      if (!isFinite(max)) { this.stats.jointFellBack = (this.stats.jointFellBack || 0) + 1; return null; }
      const exp = ps.map(v => Math.exp(v - max));
      const total = exp.reduce((x, y) => x + y, 0);
      if (!(total > 0)) { this.stats.jointFellBack = (this.stats.jointFellBack || 0) + 1; return null; }

      let q = 0;
      if (this.greedy) { let best = -Infinity; for (let z = 0; z < ps.length; z++) if (ps[z] > best) { best = ps[z]; q = z; } }
      else { let r = this.prng.random() * total; while (q < exp.length - 1 && (r -= exp[q]) > 0) q++; }

      const [pa, pb] = pairs[q];
      this.stats.scored += 2;
      this.stats.jointDecided = (this.stats.jointDecided || 0) + 1;
      this._jointReq = this._req;
      this._jointPick = [];
      this._jointPick[other] = builtB.cands[pb].choice;
      /* Both halves of the pair are claimed here, or the partner's parked switch would collide with
       * whatever the independent path picks if it ever runs for that slot. */
      for (const c of [candsA[pa], builtB.cands[pb]]) {
        if (!c.switchTo) continue;
        const n = parseInt(String(c.choice).split(' ')[1], 10);
        if (n > 0) this._claimed.add(n);
      }
      if (candsA[pa].targetMon) this.stats.aimed++;
      return candsA[pa].choice;
    }

    /* Append ` mega` when THIS slot can mega and the roll passes. Switches are left alone: a mega
     * suffix on a switch choice is not a legal thing to send. */
    _withMega(choice, active) {
      if (!this.megaP || !active || !active.canMegaEvo) return choice;
      const c = String(choice);
      if (!/^move /.test(c) || / (mega|terastallize|dynamax|zmove|ultra)$/.test(c)) return choice;
      if (this.prng.random() >= this.megaP) return choice;
      this.stats.megaChosen = (this.stats.megaChosen || 0) + 1;
      return c + ' mega';
    }

    /* ---- THE DECISION ------------------------------------------------------------------------ */
    chooseMove(active, moves) {
      const species = this.speciesFor(active);
      /* The species under test keeps its uniform pilot — build_lab needs equal airtime per arm and
       * that requirement is unchanged by this class. See prior_player.js for why. */
      if (this.uniformFor.size && this.uniformFor.has(species)) return super.chooseMove(active, moves);

      const me = this.me || 'p1';
      const i = this._req && this._req.active ? this._req.active.indexOf(active) : 0;

      /* THE PAIR DECIDED ON MY PARTNER'S TURN THROUGH THIS FUNCTION. Showdown calls chooseMove once
       * per active slot; the joint path below decides BOTH at once on the first call and parks the
       * partner's choice here for the second. */
      if (this._jointReq === this._req && this._jointPick && this._jointPick[i] != null) {
        const pick = this._jointPick[i]; this._jointPick[i] = null;
        this.stats.jointUsed = (this.stats.jointUsed || 0) + 1;
        return pick;
      }

      const built = this._candsFor(active, moves, i);
      if (!built) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }
      const { cands, user, doubles } = built;

      /* ---- THE JOINT LAYER ----------------------------------------------------------------------
       *
       * Will's argument, and the reason the earlier retirement was reversed: a bot that picks each
       * slot independently can be set positions that REQUIRE coordination and will fail them every
       * time. That is a repeatable hole rather than variance.
       *
       * Scored as sum-of-singles PLUS the fitted pair terms, which is the same form fit_joint.js
       * fitted, so the weights mean here what they meant there. The pair list is capped at TOPK by
       * single-move score per slot for the same reason the fit capped it -- every pair is ~10x10 and
       * the vast majority are two bad moves.
       *
       * OFF BY DEFAULT until it beats the single-move player head to head. It has never been
       * measured, and enabling it on the strength of the argument alone is exactly the mistake this
       * project keeps correcting. */
      if (this.joint && this.wj && doubles && this._req && this._req.active && this._req.active.length > 1
          && !this._req.forceSwitch) {
        const pair = this._decidePair(active, moves, i, cands, user, me);
        if (pair) return pair;
      }

      if (!cands.length) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }

      /* THE RISK LEVER, OFF BY DEFAULT. Computed once per decision rather than per candidate: the
       * win probability is a property of the BOARD, so recomputing it inside the map would multiply
       * the work by the size of the choice set for an answer that cannot change -- the same reason
       * incomingThreat is cached in board.js. */
      const riskOn = this.risk && (this.risk.skillGap || this.risk.strength);
      const pWin = riskOn ? V.winProb(this.board, me) : 0.5;

      const scores = cands.map(c => {
        /* A switch has no move, and that is not the same thing as an unparseable move -- the first
         * version returned -Infinity for both and made every switch unpickable. */
        if (!c.move && !c.switchTo) return -Infinity;
        const x = B.featuresFor(c, user, this.board, me, dex,
          c.switchTo ? B.PRIOR_FLOOR : this.priorFor(user.species, c.move.id));
        let s = 0; for (let k = 0; k < this.w.length; k++) s += this.w[k] * x[k];
        /* An underdog should take the swingy line and a favourite should decline it. This is a
         * CORRECTION, not a free improvement -- see the header of engine/variance.js. It is exactly
         * a no-op unless a skill gap is asserted, so the default behaviour is unchanged. */
        return riskOn ? V.adjust(s, x, pWin, this.risk) : s;
      });

      let max = -Infinity;
      for (const s of scores) if (s > max) max = s;
      if (!isFinite(max)) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }
      const exp = scores.map(s => (isFinite(s) ? Math.exp(s - max) : 0));
      const total = exp.reduce((a, b) => a + b, 0);
      if (!(total > 0)) { this.stats.scoreFellBack++; return super.chooseMove(active, moves); }

      /* this.prng, never Math.random(): the parent seeds it from the battle seed, and a move
       * decision drawn outside that seed makes the whole game unreplayable. */
      /* GREEDY IS A FLAG, NOT A DEFAULT, AND THE REASON IS THAT NOBODY HAS MEASURED IT.
       *
       * This class SAMPLES because it is built to reproduce a human distribution -- see the header.
       * That is right for generating a realistic corpus and it is not obviously right for WINNING: a
       * sampler deliberately clicks its worse option some of the time, and against an opponent with
       * nothing to exploit that is pure loss.
       *
       * But the argmax of an IMITATION model is not the same thing as a good move. These weights
       * were fitted to predict clicks, and the ones greedy would lock onto include isStatus +0.50,
       * protectThreatened +0.49 and accuracy -1.51 -- a greedy bot on that vector may Protect nearly
       * every turn. Sampling currently smooths that out. Which effect wins is a measurement. */
      let j = 0;
      if (this.greedy) {
        let best = -Infinity;
        for (let q = 0; q < scores.length; q++) if (scores[q] > best) { best = scores[q]; j = q; }
      } else {
        let r = this.prng.random() * total;
        while (j < exp.length - 1 && (r -= exp[j]) > 0) j++;
      }
      this.stats.scored++;
      /* Claim the switch so this turn's other slot cannot pick the same body. */
      if (cands[j].switchTo) {
        const n = parseInt(String(cands[j].choice).split(' ')[1], 10);
        if (n > 0) this._claimed.add(n);                          // 1-based, as chooseSwitch stores it
      }

      /* WHAT IT WAS THINKING, KEPT. The scores exist for a microsecond inside this function and were
       * thrown away, so a replay could show what MAG did and never why -- and "why did it click
       * that" is the only question worth asking of a scoring model. Recorded per decision: every
       * option, its score, and the probability that score implies after the softmax.
       *
       * Costs one small object per decision and is dropped entirely unless a caller asks for it, so
       * a million-game run does not pay for a feature only the viewer uses. */
      if (this.keepThoughts) {
        const pct = exp.map(e => e / total);
        const opts = cands.map((c, i) => ({
          mv: c.move ? c.move.name : (c.switchTo ? 'switch: ' + c.switchTo : '?'),
          tgt: c.targetMon ? c.targetMon.species : null,
          s: Math.round(scores[i] * 1000) / 1000,
          p: Math.round(pct[i] * 1000) / 1000,
        })).sort((a, b) => b.s - a.s);
        this.stats.thoughts.push({
          /* `info` belongs to the per-move loop above and is long out of scope here -- the slot we
           * want is this active position, which `i` already identifies. */
          turn: this.board.turn, side: me, slot: String.fromCharCode(97 + Math.max(0, i)),
          mon: user.species, chose: j, opts: opts.slice(0, 8),
        });
      }
      if (cands[j].targetMon && doubles) this.stats.aimed++;
      return this._withMega(cands[j].choice, active);
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
