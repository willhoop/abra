/* miltank.js — MILTANK, the SEARCH player.  See docs/MILTANK.md.
 *
 * MAG (engine/magnemite.js) is a fitted linear policy trained to predict what a human CLICKS. It
 * imitates. MILTANK decides by PLAYING THE POSITION OUT and taking the line that wins most, so it
 * can prefer a move that appears nowhere in the corpus. Named for the classic Rollout user.
 *
 * WHY THIS FILE EXISTS AT ALL, WHICH IS THE POINT OF THE EXTRACTION
 * ----------------------------------------------------------------
 * MILTANK was born inside mag_bot.js, as ~550 lines of overrides installed on a websocket player.
 * That made it unreachable from anywhere else -- and specifically from engine/mew.js, which is the
 * ONLY harness that can run a controlled A/B. So R4, the SPRT that asks whether MILTANK actually
 * WINS MORE than MAG, was not merely unrun: it was unrunnable. Every claim about MILTANK to date is
 * about mechanism (R1 leaf accuracy, R2 cost, R3 divergence) and none is about winning.
 *
 * A player living in a socket handler cannot be measured. So it lives here, and both mag_bot.js and
 * the self-play harness install the same object.
 *
 * WHAT IT INSTALLS -- three decisions, all by the same method:
 *   chooseTeamPreview   which four to bring and which two to lead (90 brings, played out)
 *   chooseMove          both clicks, by successive halving over every legal pair
 *   chooseSwitch        the post-KO replacement, each candidate played out
 *
 * AND WHERE IT DEFERS. When the search cannot separate its options -- finalists inside one standard
 * error, or a position already decided -- it hands the turn back to MAG, because a fitted human
 * prior beats a coin flip over near-ties. Imitation is the floor; search is the ceiling.
 */
'use strict';
const CS = require('./champions_sim.js');
const B = require('./board.js');
const TAGSMOD = require('./tags.js');

/* Defaults match mag_bot's flags so a caller that passes nothing gets the shipped player. */
/* `defer` -- hand a turn back to MAG when the search cannot separate its options.
 *
 * ON by default, and that default is an ASSUMPTION rather than a measurement: an argmax over
 * indistinguishable options is a coin flip, and a prior fitted on humans should beat a coin flip.
 * Plausible, untested, and it decides 29% of turns in an R4 run -- so it is a flag now, and the A/B
 * is one run rather than an argument.
 *
 * There is one live reason to keep it while it is untested: MEDICHAM is missing sixteen confirmed
 * mechanics, so in a position the search cannot separate, MAG's prior was fitted on people playing
 * the REAL game and the search is reasoning about a broken one. That argument weakens with every
 * mechanic fixed, which is itself worth measuring. */
const DEFAULTS = { defer: true, budgetMs: 20000, n: 200, explore: 1.0, turns: 60, previewN: 40, previewMs: 15000,
                   why: false, trace: false };

/* Install MILTANK onto an already-constructed magnemite player.
 *
 * `bot` must be a live magnemite instance: the overrides close over its chooseMove, chooseSwitch and
 * chooseTeamPreview, so MAG is still there underneath and is what every fallback returns to. */
function install(bot, o) {
  const opts = Object.assign({}, DEFAULTS, o || {});
  const ROLLOUT_N = opts.n, ROLLOUT_EXPLORE = opts.explore, ROLLOUT_TURNS = opts.turns;
  const PREVIEW_N = opts.previewN, PREVIEW_MS = opts.previewMs;
  const WHY = !!opts.why, TRACE = !!opts.trace;
  const DEFER = opts.defer !== false;

      const RL = require('./rollout_leaf.js');
      /* The real dex, not undefined. dmgMon uses it to resolve the EFFECTIVE ability — a mega's
       * own ability rather than the sheet's pre-mega one — and Huge Power doubles Attack. */
      const DEX = CS.sim().Dex.forFormat(CS.FORMAT);
      const base = bot.chooseMove.bind(bot);
      bot._rolloutPick = null;
      bot._rolloutReq = null;
      /* POST-KO REPLACEMENT, JUDGED BY THE SAME SEARCH THAT PLAYS THE REST OF THE GAME.
       *
       * Showdown routes a forced replacement to chooseSwitch and never through chooseMove, so this
       * decision was made by magnemite's one-step `_scoreForcedPick` while the rollout that plays
       * every other turn never saw it. Two players deciding alternate turns disagree, and Will
       * watched the disagreement: "IT SWAPPED IN FROSLASS AFTER A KO ONLY TO IMMEDIATELY SWITCH IT
       * OUT" -- the heuristic brought it in, the search sent it away.
       *
       * Falls back to magnemite on ANY doubt -- an unbuildable body, a species that cannot be read
       * off the request, or a set of candidates the rollout cannot separate. The heuristic is a
       * fitted one and is the right floor; it is being overridden only where there is evidence. */
      /* ONE MEGA PER REQUEST, ENFORCED HERE.
       *
       * magnemite's _withMega has no such guard and states it does not need one: a team holds
       * one stone, so only one slot ever carries canMegaEvo. That invariant is true and this
       * does not doubt it -- but the cost of it being wrong is a REJECTED CHOICE, which on a
       * live server is a battle that stalls until the timer kills it. A three-line guard against
       * a stalled game is worth more than the invariant is worth defending. */
      /* WHY A MEGA DID OR DID NOT HAPPEN, said out loud. Three separate mega bugs have now been
       * found by Will noticing it did not mega -- each time the failure was SILENT, because a
       * capability that is absent logs nothing. This prints the two facts that decide it. */
      const megaTrace = function (choice, active, where) {
        if (!TRACE) return choice;
        const can = !!(active && active.canMegaEvo);
        console.log(`    mega[${where}] canMegaEvo=${can} megaP=${this.megaP} choice="${choice}"`);
        return choice;
      };
      const megaOnce = function (choice) {
        if (!/ mega$/.test(String(choice))) return choice;
        if (this._megaReq === this._req) return String(choice).replace(/ mega$/, '');
        this._megaReq = this._req;
        return choice;
      };
      const baseTeamPreview = bot.chooseTeamPreview.bind(bot);
      /* WHICH FOUR TO BRING AND WHICH TWO TO LEAD -- decided by playing it out, not by imitation.
       *
       * magnemite never overrode chooseTeamPreview, so the live bot inherited RandomPlayerAI's
       * `return 'default'`: bring Pokemon 1-4 in packed order and lead the first two. Every game
       * ever played against this bot had its lead decided by where a Pokemon happened to sit in a
       * team string. The code's own comment calls preview "the single largest branch in the game".
       *
       * WINNING, NOT IMITATING, and the distinction decides the design. Will asked it directly:
       * "ARE WE TRYING TO IMITATE HUMANS OR WIN, OR IS THAT THE SAME". engine/prior_player.js has a
       * fitted bring sampler that reproduces what people lead, and it is the wrong tool here -- a
       * prior can only say "Whimsicott leads 53% of the time", which is a fact about the population
       * and not about this game. WITH OPEN TEAM SHEETS WE KNOW THEIR ENTIRE TEAM, which is
       * information no human-usage prior can encode. So the matchup is computed instead of guessed.
       *
       * Imitation still earns its place where the search cannot separate options -- that fallback is
       * already in the move picker -- but it is a floor, not a target.
       *
       * THEIR CHOICE IS MARGINALISED, NOT ASSUMED. We do not know which four they bring, so each
       * playout samples one of theirs at random. Fixing a guess for their side would optimise
       * against one opponent out of fifteen and call it a plan.
       */
      bot.chooseTeamPreview = function (team) {
        const t0 = Date.now();
        try {
          const side = this.me || 'p1';
          const foe = side === 'p1' ? 'p2' : 'p1';
          const sheets = (this.board && this.board.sheet) || {};
          const mine = sheets[side] || {}, theirs = sheets[foe] || {};
          const myNames = (team || []).map(m =>
            String((m && (m.details || m.speciesForme || m.species)) || '').split(',')[0].trim());
          const theirNames = Object.keys(theirs);
          /* NO SHEET, NO SEARCH. Without their team this is guessing dressed as computation, and the
           * inherited default is at least honest about being arbitrary. Reported, not silent. */
          if (myNames.length < 4 || theirNames.length < 2) {
            console.log('  preview: no open sheet for the opponent — falling back to default order');
            return baseTeamPreview(team);
          }
          const MEDI = require('./medicham2-browser.js');
          const bodyOf = (name, sheet) => {
            try {
              const st = sheet[name];
              const b = st ? MEDI.buildMonFromSet(Object.assign({ species: name }, st)) : MEDI.buildMon(name, {});
              return b || null;
            } catch (e) { return null; }
          };
          const myBodies = myNames.map(n => () => bodyOf(n, mine));
          const theirBodies = theirNames.map(n => () => bodyOf(n, theirs));
          if (myBodies.some(f => !f()) || theirBodies.every(f => !f())) {
            console.log('  preview: could not build every body — falling back to default order');
            return baseTeamPreview(team);
          }

          /* Every (lead pair, back pair) our six allows: 15 leads x 6 backs = 90 brings. */
          const combos = [];
          const idx = myNames.map((_, i) => i);
          for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
            const rest = idx.filter(i => i !== a && i !== b);
            for (let c = 0; c < rest.length; c++) for (let d = c + 1; d < rest.length; d++) {
              combos.push([a, b, rest[c], rest[d]]);
            }
          }
          const N = PREVIEW_N;
          const DEADLINE = t0 + PREVIEW_MS;
          let best = null, bestVal = -1, done = 0;
          for (const combo of combos) {
            if (Date.now() > DEADLINE) break;
            let w = 0, ran = 0;
            for (let i = 0; i < N; i++) {
              const rng = (s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; })(
                (combo[0] * 31 + combo[1] * 7 + combo[2] * 3 + combo[3]) * 7919 + i * 104729 + 13);
              const A = combo.map(i2 => myBodies[i2]()).filter(Boolean);
              /* Their bring, sampled fresh EVERY playout -- see the marginalisation note above. */
              const pool = theirBodies.slice();
              const B2 = [];
              while (B2.length < 4 && pool.length) {
                const j = Math.floor(rng() * pool.length) % pool.length;
                const b = pool.splice(j, 1)[0]();
                if (b) B2.push(b);
              }
              if (A.length < 2 || B2.length < 2) continue;
              const S = MEDI.battleInit(A, B2, { seeded: true });
              S.maxTurns = 60;
              while (!MEDI.battleOver(S)) MEDI.battleTurn(S, rng);
              w += MEDI.battleResult(S); ran++;
            }
            if (!ran) continue;
            done++;
            const v = w / ran;
            if (v > bestVal) { bestVal = v; best = combo; }
          }
          if (!best) return baseTeamPreview(team);
          const order = best.concat(idx.filter(i => best.indexOf(i) < 0));
          console.log(`  preview: lead ${myNames[best[0]]} + ${myNames[best[1]]}, back ` +
            `${myNames[best[2]]} + ${myNames[best[3]]}  win ${(100 * bestVal).toFixed(0)}%  ` +
            `(${done}/${combos.length} brings scored, ${Date.now() - t0}ms)`);
          return 'team ' + order.map(i => i + 1).join('');
        } catch (e) {
          console.error('  preview search threw, falling back to default: ' + e.message);
          return baseTeamPreview(team);
        }
      };

      const baseSwitch = bot.chooseSwitch.bind(bot);
      bot.chooseSwitch = function (active, switches) {
        try {
          /* `ROLLOUT` was mag_bot's own on/off flag and came through the extraction as a free
           * variable -- so chooseSwitch threw on every forced replacement and fell back to MAG,
           * silently, in the one harness where it had never been exercised. Inside this file the
           * guard is meaningless: if install() ran, MILTANK is on. */
          if (!this.board || !(switches || []).length) return baseSwitch(active, switches);
          if ((switches || []).length < 2) return baseSwitch(active, switches);
          const side = this.me || 'p1';
          const req = this._req;
          const reqMons = (req && req.side && req.side.pokemon) || [];
          const speciesOf = (slot) => {
            const m = reqMons[slot - 1];
            return m ? String(m.details || m.ident || '').split(',')[0].trim() : '';
          };
          const DEX2 = DEX;
          const field = {
            weather: this.board.weather || '', terrain: '',
            tr: this.board.hasField('trickroom') ? 5 : 0,
            twA: this.board.hasSide(side, 'tailwind') ? 4 : 0,
            twB: this.board.hasSide(side === 'p1' ? 'p2' : 'p1', 'tailwind') ? 4 : 0,
          };
          const scored = [];
          for (const sw of switches) {
            const sp = speciesOf(sw.slot);
            if (!sp) continue;
            const r = RL.rolloutWinProb(this.board, side, {
              n: ROLLOUT_N * 2, dex: DEX2, explore: ROLLOUT_EXPLORE, field,
              maxTurns: ROLLOUT_TURNS, seed: (Date.now() & 0xffff) * 6151 + sw.slot,
              bringIn: sp, protectTurns: this._protectTurns,
            });
            if (r && typeof r.p === 'number') scored.push([r.p, sw.slot, sp]);
          }
          if (scored.length < 2) return baseSwitch(active, switches);
          scored.sort((a, b) => b[0] - a[0]);
          /* The same noise-floor rule the move picker uses: an argmax over estimates that overlap is
           * a coin flip wearing a search's clothes, and magnemite's ranking is the better tiebreak. */
          const se = Math.sqrt(Math.max(scored[0][0] * (1 - scored[0][0]), 0.0025) / (ROLLOUT_N * 2));
          if (DEFER && scored[0][0] - scored[1][0] < 1.5 * se) {
            console.log(`  replacement: UNDECIDED — ${scored.map(s => s[2] + ' ' + (100 * s[0]).toFixed(0) + '%').join(', ')}` +
              `; within a ${(100 * se).toFixed(1)}pt error, deferring to MAG`);
            return baseSwitch(active, switches);
          }
          console.log(`  replacement: ${scored[0][2]} ${(100 * scored[0][0]).toFixed(0)}%` +
            `  (over ${scored.slice(1).map(s => s[2] + ' ' + (100 * s[0]).toFixed(0) + '%').join(', ')})`);
          if (this._claimReq !== this._req) { this._claimReq = this._req; this._claimed = new Set(); }
          /* The double-claim guard magnemite documents at :409 applies here too: both slots can be
           * asked for a replacement in the same request, and naming one body twice kills the battle. */
          for (const [, slot] of scored) {
            if (this._claimed.has(slot)) continue;
            this._claimed.add(slot);
            return slot;
          }
          return baseSwitch(active, switches);
        } catch (e) {
          console.error('  replacement search threw, falling back to MAG: ' + e.message);
          return baseSwitch(active, switches);
        }
      };

      bot.chooseMove = function (active, moves) {
        try {
          const req = this._req;
          const acts = (req && req.active) || [];
          const i = acts.indexOf(active);
          /* The partner's half, decided on the other slot's call. */
          if (this._rolloutReq === req && this._rolloutPick && this._rolloutPick[i] != null) {
            const pick = this._rolloutPick[i]; this._rolloutPick[i] = null;
            return megaOnce.call(this, megaTrace.call(this, this._withMega(pick, active), active, 'parked'));
          }
          /* Singles-shaped requests, forced switches and anything with one slot fall through to MAG:
           * the pair logic below assumes two live slots and would otherwise index undefined. */
          if (acts.length < 2 || i < 0 || (req && req.forceSwitch)) return base(active, moves);

          const side = this.me || 'p1';
          const board = this.board;
          /* THE BOARD DOES NOT KNOW THE TEAM IN LIVE PLAY, and nothing said so.
           *
           * `setParty` is called by fit_policy, joint_rows and the other OFFLINE walkers and by
           * nothing in magnemite, so `board.bench()` returns [] for the whole battle. MAG never
           * noticed because it builds switch candidates from the REQUEST instead — two candidate
           * builders, and only one of them is fed here.
           *
           * The seeder reads the board, so every rollout was judging a 2v2 with empty benches: a
           * switch had no body to bring in, the forced click was skipped, and the slot quietly fell
           * back to the playout policy. That is why every switch scored the same and the search
           * took one every turn. Diagnosed from the timing — 1,000 playouts in 10ms is not a fast
           * rollout, it is a battle that ended before turn 1.
           *
           * Filled from the request, which is authoritative about what this side actually brought. */
          const reqMons = (req.side && req.side.pokemon) || [];
          /* RE-SEEDED EVERY DECISION, not once per battle.
           *
           * The guard used to skip whenever a party was already set, so a party that went stale --
           * or that the tracker rebuilt empty -- stayed stale for the rest of the game. The rollout
           * resolves a switch against board.bench(), while the CANDIDATES come from the request, so
           * an empty bench makes every switch unresolvable while still being offered.
           *
           * Seen live and it is not subtle: `bravebird + fakeout win 94% (sw resolved 0/unres 800)`.
           * Eight hundred switch clicks that resolved to nothing, so every switch candidate collapsed
           * to the same fallback and the 94% was an argmax over a menu that did not exist. That turn
           * was in the game MAGABRA threw from 100%.
           *
           * The request is authoritative about what this side actually brought and it arrives every
           * turn, so there is no reason to prefer a remembered answer to the current one. */
          if (reqMons.length) {
            const species = reqMons
              .map(m => String(m.details || m.ident || '').split(',')[0].trim())
              .filter(Boolean);
            if (species.length) board.setParty(side, species);
          }
          /* THE OPPONENT'S SIDE TOO, or the rollout plays my four against their two and reports 100%
           * for every option — which is exactly what it did, and an argmax over ties is a coin flip
           * that looked like a decision to switch every turn.
           *
           * `showteam` already fills board.sheet with all SIX of their Pokemon (magnemite.js:509) and
           * never touches the party, so the information was there and unused. Capped at four, because
           * six would bias the other way just as hard: this is a bring-four format and a 4v6 rollout
           * is not the game either. Revealed bodies go first — those are known to be brought — and the
           * rest fills from the sheet, which is a GUESS about which four they chose and is stated as
           * one rather than presented as knowledge. */
          const foeS = side === 'p1' ? 'p2' : 'p1';
          /* THE OPPONENT'S FOUR, from the open sheet. Will is running OTS-only, so their team is
           * public — which is the whole reason this is answerable at all.
           *
           * Capping MY side to their revealed count was tried and was worse: it emptied my bench, so
           * every switch candidate had no body to resolve to and the search ranked options that could
           * not happen (480 unresolved clicks in one turn). Symmetric ignorance is not better than
           * asymmetric knowledge when the asymmetry is the thing being searched over.
           *
           * Revealed bodies first — those are known to have been brought — then filled from the sheet
           * to four. The fill is a GUESS about which four of six they chose and is one of the two
           * things most likely to be wrong about this bot's judgement. */
          if (!(board.party && (board.party[foeS] || []).length)) {
            const seen = ['a', 'b'].map(L => board.slot(foeS, L)).filter(Boolean).map(m => m.species);
            const sheetSp = Object.keys((board.sheet && board.sheet[foeS]) || {});
            const foeParty = [];
            for (const sp of seen.concat(sheetSp)) {
              if (sp && !foeParty.includes(sp) && foeParty.length < 4) foeParty.push(sp);
            }
            if (foeParty.length) board.setParty(foeS, foeParty);
          }
          /* `_movesForSlot` IS THE NORMALISER, and skipping it was the whole bug.
           *
           * `_candsFor` expects magnemite's own move shape, with a `.choice` string on each entry.
           * The RAW request array does not have that, so passing `a2.moves` produced a candidate list
           * of `{move: null, choice: undefined}` — four dead entries per slot — and the only survivors
           * were the switches. The search then picked a double switch every turn because THOSE WERE
           * THE ONLY TWO OPTIONS IT COULD SEE. Not a preference for switching: a menu with nothing
           * else on it.
           *
           * Diagnosed by printing the per-class means live and getting `SW+SW 6%(2)` — two pairs
           * evaluated out of thirty-six. The arithmetic gave it away before the dump did.
           *
           * magnemite's own _decidePair does exactly this at lines 909-912; copied rather than
           * re-derived, because the shape is its business and this file has now got it wrong once. */
          const built = ['a', 'b'].map((L, k) => {
            const a2 = acts[k];
            const user = board.slot(side, L);
            if (!user || user.fainted || !a2) return null;
            const mv2 = (k === i) ? moves : this._movesForSlot(a2, k);
            if (!mv2 || !mv2.length) return null;
            const b2 = this._candsFor(a2, mv2, k);
            return b2 && b2.cands && b2.cands.length ? b2 : null;
          });
          if (!built[0] || !built[1]) return base(active, moves);

          const field = {
            weather: board.weather || '',
            terrain: ['electric', 'grassy', 'misty', 'psychic'].find(t => board.hasField(t)) || '',
            tr: board.hasField('trickroom') ? 5 : 0,
            twA: board.hasSide(side, 'tailwind') ? 4 : 0,
            twB: board.hasSide(side === 'p1' ? 'p2' : 'p1', 'tailwind') ? 4 : 0,
          };
          /* THE CANDIDATE SHAPE HERE IS MAGNEMITE'S, NOT BOARD.JS'S, and I used the wrong one.
           *
           *   `targetLetter` does not exist on these — that is board.js's `candidates()` shape, used
           *   by rollout_r3. _candsFor carries `targetMon`, a board mon, so the slot is derived by
           *   asking which foe slot holds it. Reading the absent field silently aimed every move at
           *   the first live foe, which collapses "Fake Out the left one" and "Fake Out the right
           *   one" into one candidate.
           *
           *   `move` can be NULL without being a switch: magnemite.js:682 pushes a candidate with
           *   move:null for anything the dex does not recognise. Its own scorer guards this at line
           *   860 (`if (!c.move && !c.switchTo)`) and I did not, which threw on every single turn —
           *   the fallback then played the whole game as MAG while printing one line per decision. */
          const foeSide = side === 'p1' ? 'p2' : 'p1';
          const letterOf = (tm) => {
            if (!tm) return '';
            for (const L of ['a', 'b']) if (board.slot(foeSide, L) === tm) return L;
            return '';
          };
          const clickOf = (c) => {
            if (c.switchTo) return { switchTo: c.switchTo };
            if (!c.move) return null;
            return { move: c.move.id, targetLetter: letterOf(c.targetMon) };
          };
          /* EVERY CANDIDATE, NOT A TOP-K.
           *
           * The first version pruned to the best K per slot — except `_candsFor` returns no scores,
           * so it was taking the first three in array order and calling that the best three. That is
           * worse than not pruning at all: an arbitrary shortlist that LOOKS principled.
           *
           * Enumerating everything also deletes the ceiling engine/truncation_curve.js measured — at
           * K=3 the pair a human clicked falls outside the window 52% of the time, and a search
           * cannot recover value from a branch it never enumerated. The corpus median is 8 options a
           * slot, so ~64 pairs; at ROLLOUT_N=200 that is well inside a Showdown turn timer, and the
           * elapsed cost is printed every decision so it is visible if a board is unusually wide. */
          /* ONE-TIME SANITY LINE. A rollout that returns in microseconds has not played anything,
           * and the win rate it reports is about a battle that ended before turn 1. Printing what the
           * seeder actually built is the difference between "the search prefers switching" and "the
           * search is scoring an empty board". */
          if (!this._rolloutChecked) {
            this._rolloutChecked = true;
            const probe = RL.rolloutWinProb(board, side, { n: 3, dex: DEX, explore: 1.0, field, seed: 1 });
            console.log('  MILTANK seed check: ' + (probe
              ? `${probe.built} bodies built, dropped ${JSON.stringify(probe.dropped)}, p=${probe.p}`
              : 'NULL — a side could not be built at all'));
            console.log('  my bench: [' + board.bench(side).join(', ') + ']  foe bench: [' +
              board.bench(side === 'p1' ? 'p2' : 'p1').join(', ') + ']');
            /* THE ASYMMETRY IS REPORTED, NOT HIDDEN. I know my whole team from the request; the
             * opponent's bench is only what has been revealed. So the rollout is optimistic by
             * construction — it plays my four against however many of theirs are known — and that
             * bias favours anything that survives to a later turn, switching included. Stated here
             * because a bot that thinks it is ahead switches for the wrong reason. */
          }
          if (!this._candsDumped) {
            this._candsDumped = true;
            for (const k of [0, 1]) console.log("    slot " + k + " cands: " +
              built[k].cands.map(c => c.switchTo ? ("SW:" + c.switchTo)
                : (c.move ? c.move.id : "NULLMOVE(" + JSON.stringify(c.choice) + ")")).join(", "));
          }
          let bestVal = -1, bestPair = null, _res = 0, _unres = 0;
          const byKind = {};
          const t0 = Date.now();
          /* SUCCESSIVE HALVING, because an argmax over 60-odd noisy estimates picks the luckiest one
           * and not the best one.
           *
           * At n=120 a win rate near 0.7 carries a standard error around 4 points. Taking the max over
           * 63 such estimates inflates the winner by roughly two standard errors of pure dice, which
           * is larger than most real differences between two reasonable clicks. The visible symptom
           * was the bot clicking RECOVER AT FULL HP — a move MEDICHAM correctly heals 0 with, so it is
           * a wasted turn that simply drew good rollouts. The heal is clamped; the SEARCH was wrong.
           *
           * This is the project's own noise-floor law applied to the live picker: an effect smaller
           * than the spread is not an effect. Rather than arbitrate ties after the fact, spend the
           * budget where it decides anything — screen every pair cheaply, then re-test only the
           * survivors at high n with FRESH seeds, so a lucky first pass has to be lucky twice.
           *
           * Cheaper than the flat version it replaces: 63*40 + 8*240 beats 63*120. */
          /* A MOVE THIS ENGINE CANNOT EXPRESS IS NOT PUT ON THE MENU.
           *
           * rollout_leaf states the rule for switches -- "a candidate this engine cannot express is
           * SKIPPED, not approximated ... offering the search a cell it will silently resolve as
           * something else is worse than a smaller menu" -- and it was never applied to MOVES.
           *
           * MEDICHAM returns kind 'pass' for anything it has no model of: Psych Up, Haze, and the
           * rest of the 1.5% the coverage report counts. A 'pass' is not neutral, it is a turn spent
           * doing nothing -- so every such candidate scored identically, and an argmax over a menu
           * padded with identical do-nothings picks one whenever the real options are close. Will
           * watched it: "IT JUST PSYCH UP WITH NO BOOSTS TO COPY".
           *
           * Dropping them does not make the bot play those moves worse. It cannot play them at all;
           * this only stops it CHOOSING them blind. If every candidate for a slot is unexpressible
           * the whole decision falls back to MAG, which does have an opinion about them. */
          const MEDI = require('./medicham2-browser.js');
          const _body = (m) => { try { return m ? B.dmgMon(m, MEDI, DEX) : null; } catch (e) { return null; } };
          const _foeBody = (() => {
            for (const L of ['a', 'b']) { const f = board.slot(foeSide, L); if (f && !f.fainted) { const b = _body(f); if (b) return b; } }
            return null;
          })();
          const expressible = (c, k) => {
            if (!c || c.switchTo) return true;                 // switches are resolved by rollout_leaf
            if (!c.move) return false;
            const ub = _body(board.slot(side, k === 0 ? 'a' : 'b'));
            /* The candidate's OWN target, not just the first live foe: a status aimed at the left
             * Pokemon and one aimed at the right are different clicks and only one may be dead. */
            const tb = _body(c.targetMon) || _foeBody;
            if (!ub || !tb) return true;                       // cannot tell -- keep it rather than guess
            try {
              const a = MEDI.playerAction(ub, c.move.id, tb, field);
              if (!a || a.kind === 'pass') return false;
              /* A CLICK THAT CANNOT DO ITS ONE JOB IS ALSO NOT A CANDIDATE.
               *
               * Will-O-Wisp into a Fire type is expressible, resolves cleanly, and burns nothing --
               * so the previous filter kept it and the search picked it whenever the real options were
               * close. Will: "IT JUST WILLO WISPED INTO A FIRE TYPE THAT SHOULD BE A BANNED CLICK".
               *
               * Asked of the engine rather than asserted here: canTakeStatus already enforces the type
               * and ability immunities, so this covers Toxic into Steel, sleep into Insomnia and every
               * other dead status without naming one. Only dropped when EVERY effect the move has is
               * refused -- a move that also drops a stat or hits is still a real option. */
              /* READ FROM THE ARTIFACT, NOT FROM THE ACTION. Will-O-Wisp returns kind 'status' from
               * a branch that predates the generic one, so it never carries the spec on the action --
               * checking a.si silently skipped exactly the move that prompted this. The tag is on the
               * MOVE and is true whichever branch classified it. */
              const _sp = TAGSMOD.param('move', c.move.id, 'statusInflict');
              const si = _sp && _sp.effects;
              const _scp = TAGSMOD.param('move', c.move.id, 'statChange');
              if (si && si.length && !(_scp && _scp.target) && !c.move.basePower) {
                const anyLands = si.some(e => {
                  if (e.volatile) return true;                 // volatiles are not status immunities
                  if (!e.status) return true;
                  const who = e.to === 'user' ? ub : tb;
                  try { return MEDI.canTakeStatus(who, e.status); } catch (err) { return true; }
                });
                if (!anyLands) return false;
              }
              return true;
            } catch (e) { return true; }
          };
          for (const k of [0, 1]) {
            const keep = built[k].cands.filter((c) => expressible(c, k));
            const dropped = built[k].cands.length - keep.length;
            if (dropped && keep.length) {
              built[k] = Object.assign({}, built[k], { cands: keep });
              if (WHY) console.log(`    slot ${k}: dropped ${dropped} candidate(s) MEDICHAM plays as a no-op`);
            }
          }
          /* Built AFTER the filter above, or they would index a menu that no longer exists. */
          const oa = built[0].cands.map((c, idx) => idx);
          const ob = built[1].cands.map((c, idx) => idx);
          /* A HARD BUDGET. One live decision took 33,589ms -- 56 options at n=120 -- which is close
           * enough to Showdown's turn timer that a harder position could time out, and a loss on the
           * clock says nothing about the player. The finalist round stops when the budget is spent
           * and reports how many it managed, because a silent truncation reads as full coverage. */
          const BUDGET_MS = opts.budgetMs || 20000;
          const tStart = Date.now();
          const SCREEN_N = Math.max(12, Math.round(ROLLOUT_N / 3));
          const FINAL_K = 8;
          const evalPair = (ia, ib, n, salt) => {
            const ca2 = built[0].cands[ia], cb2 = built[1].cands[ib];
            if (ca2.switchTo && cb2.switchTo && ca2.choice === cb2.choice) return null;
            const ka = clickOf(ca2), kb = clickOf(cb2);
            if (!ka || !kb) return null;
            return RL.rolloutAfterActions(board, side, {
              n, dex: DEX, explore: ROLLOUT_EXPLORE, field, maxTurns: ROLLOUT_TURNS,
              seed: (Date.now() & 0xffff) * 7919 + ia * 31 + ib + salt,
              myClicks: [ka, kb], protectTurns: this._protectTurns,
              report: (r) => { if (r.unresolved) _unres += r.unresolved; else _res += r.resolved; },
            });
          };
          /* Round one: every pair, cheaply. These values decide who advances and nothing else — they
           * are never reported as the chosen action's worth, precisely because they are the biased ones. */
          const screened = [];
          for (const ia of oa) for (const ib of ob) {
            const v = evalPair(ia, ib, SCREEN_N, 0);
            if (v === null) continue;
            screened.push([v, ia, ib]);
          }
          if (!screened.length) return base(active, moves);
          screened.sort((a, b) => b[0] - a[0]);
          const finalists = screened.slice(0, FINAL_K);
          /* Round two: the survivors only, at the full budget and with a DIFFERENT seed salt, so a
           * pair that advanced on lucky dice has to roll them again. */
          let finalsDone = 0;
          for (const [, ia, ib] of finalists) {
            if (Date.now() - tStart > BUDGET_MS) break;
            finalsDone++;
            const v = evalPair(ia, ib, ROLLOUT_N * 2, 104729);
            if (v === null) continue;
            const ca2 = built[0].cands[ia], cb2 = built[1].cands[ib];
            const kind = (ca2.switchTo ? 'SW' : 'mv') + '+' + (cb2.switchTo ? 'SW' : 'mv');
            (byKind[kind] = byKind[kind] || []).push(v);
            if (v > bestVal) { bestVal = v; bestPair = [ia, ib]; }
          }
          if (!bestPair) return base(active, moves);
          /* WHEN THE SEARCH CANNOT TELL THE OPTIONS APART, IT MUST SAY SO RATHER THAN GUESS.
           *
           * Live log, a lost position: `protect + protect win 1%` with `by class: mv+mv 0%(35)` --
           * all thirty-five options scored zero, so the argmax ranked pure dice and dice chose double
           * Protect. Same shape produced `blizzard + flamethrower` at 1%. The search was not choosing
           * badly; it had NO SIGNAL and no way to report that, and an argmax always returns something.
           *
           * MAG is the better tiebreak there. It is a fitted policy over human games, so in a position
           * the rollout cannot separate it still plays something a person would play -- which is the
           * whole reason it is the shipped player. Deviating from it needs evidence, and no spread
           * between candidates is the absence of evidence.
           *
           * Two ways that happens, both handled: the finalists are statistically indistinguishable, or
           * the position is decided and every line loses anyway. */
          const fv = [];
          for (const k of Object.keys(byKind)) for (const v of byKind[k]) fv.push(v);
          const spread = Math.max(...fv) - Math.min(...fv);
          const se = Math.sqrt(Math.max(bestVal * (1 - bestVal), 0.0025) / (ROLLOUT_N * 2));
          if (DEFER && fv.length > 1 && spread < 1.5 * se) {
            console.log(`  MILTANK: UNDECIDED — ${fv.length} finalists span ${(100 * spread).toFixed(1)}pt` +
              ` against a ${(100 * se).toFixed(1)}pt standard error; deferring to MAG`);
            return base(active, moves);
          }
          /* NO LONGER DEFERS ON CONFIDENCE, and the reason is a game it threw.
           *
           * The rule used to hand the turn to MAG whenever the search read the position as already
           * won or already lost, on the argument that every line scores the same so the choice does
           * not matter. That argument holds ONLY IF THE EVALUATION IS RIGHT, and it is not:
           *
           *     94%  switch gholdengo + heatwave
           *     100% position already decided -- deferring to MAG
           *     100% position already decided -- deferring to MAG
           *     90%  closecombat + weatherball
           *          |win|willhoop
           *
           * So it stopped thinking precisely in the positions where its leaf was most wrong, and
           * coasted a 100% read into a loss. A miscalibrated evaluation plus a rule that trusts it
           * is worse than either alone.
           *
           * The noise-floor deferral above SURVIVES, because that one is about the SPREAD between
           * candidates rather than the absolute number -- it says "these options are within one
           * standard error of each other", which is true whether the leaf is calibrated or not. */
          const ms = Date.now() - t0;
          const chosen = [built[0].cands[bestPair[0]], built[1].cands[bestPair[1]]];
          console.log(`  MILTANK: ${chosen.map(c => c.switchTo ? 'switch ' + c.switchTo : c.move.id).join(' + ')}` +
            `  win ${(100 * bestVal).toFixed(0)}%  (${oa.length * ob.length} opts, ${ms}ms, ` +
            `finals ${finalsDone}/${finalists.length}, sw resolved ${_res}/unres ${_unres})`);
          const summary = Object.keys(byKind).sort().map(k =>
            k + ' ' + (100 * byKind[k].reduce((a, b) => a + b, 0) / byKind[k].length).toFixed(0) +
            '%(' + byKind[k].length + ')').join('  ');
          console.log('    by class: ' + summary);
          this._rolloutReq = req;
          this._rolloutPick = [];
          /* THROUGH _withMega, WHICH THE ROLLOUT PATH WAS BYPASSING ENTIRELY.
           *
           * magnemite appends ` mega` in _withMega and calls it at three sites -- all of them
           * inside ITS OWN decision paths. This override returns a choice built here and went
           * through none of them, so the rollout bot could not mega evolve in any game ever
           * played against it. Will found it live: 'IT DIDNT MEGA ITS KANGA'. Zero CHOOSING MEGA
           * lines across the whole session log, which is the same silence the mega bug produced
           * the first two times -- a capability that is absent rather than wrong logs nothing.
           *
           * Both halves of the pair go through it. Only one slot ever carries canMegaEvo, because
           * a team holds one stone, so the pair cannot both claim it; _withMega also leaves
           * switches alone, where a mega suffix is not legal to send. */
          this._rolloutPick[1 - i] = chosen[1 - i].choice;
          return megaOnce.call(this, megaTrace.call(this, this._withMega(chosen[i].choice, active), active, 'direct'));
        } catch (e) {
          /* NEVER FORFEIT A LIVE BATTLE OVER A SEARCH BUG. Falling back to MAG is a worse move, not a
           * lost game — and the reason is printed so it is fixable rather than mysterious. */
          /* The first stack frame too: 'Cannot read properties of null' names a symptom and not
           * a site, and the fallback means this can otherwise repeat silently every turn of
           * every game while the bot quietly plays as MAG. */
          const at = (String(e.stack || '').split('\n')[1] || '').trim();
          console.error('  rollout failed, falling back to MAG: ' + e.message + (at ? ' | ' + at : ''));
          return base(active, moves);
        }
      };
  return bot;
}

module.exports = { install, DEFAULTS };
