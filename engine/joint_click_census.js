/* joint_click_census.js — WHAT A PAIR OF HUMAN CLICKS LOOKS LIKE, AND WHEN A HUMAN LEAVES.
 *
 * ROADMAP: the two gaps `engine/empirical_driver.js:56-64` declares out loud —
 *   - NO TARGET MODEL. `data/move-priors.json` is P(move | species) and nothing else.
 *   - NO SWITCH MODEL. The rate comes from `data/rollout-switch-census.json` as ONE global number
 *     and WHICH body to send is drawn uniformly over the legal bench.
 *
 * IT IS NOT QUARANTINED, for exactly the reason `engine/rollout_switch_census.js` is not: the store
 * is UPSTREAM of the simulator. Every number here is read off raw Showdown protocol that Showdown
 * itself produced. Nothing passes through medicham2-browser.js, board.js, a weight or a leaf.
 *
 * ================= WHY THE RAW LOGS AND NOT THE DURABLE STORE =====================================
 *
 * The durable store records THAT a move happened, not WHO IT WAS AIMED AT. The target is in the
 * protocol line and nowhere else:
 *
 *   |move|p1b: Sneasler|Gunk Shot|p2a: Victreebel      <- aimed at the foe in slot a
 *   |move|p1a: Dragonite|Dragon Pulse|p2b: Annihilape  <- ...and the partner aimed elsewhere: SPLIT
 *
 * Same argument as rollout_switch_census.js's: store raw, analyse on top.
 *
 * ================= WHAT IS MEASURED, AND THE FOUR THINGS THAT WOULD HAVE FAKED IT =================
 *
 * (A) THE JOINT TARGET DRAW. Of the turns where BOTH of a side's active bodies clicked a
 *     single-foe-targeted move, how often did they name the SAME foe?
 *
 *     Four confounds, each EXCLUDED and each COUNTED rather than assumed away, because every one of
 *     them manufactures agreement that no player chose:
 *
 *       1. REDIRECTION. Follow Me, Rage Powder, Storm Drain, Lightning Rod pull both attacks onto one
 *          body. The protocol prints the REDIRECTED target, so an unfiltered walk reads a redirect as
 *          a human focus-firing. Turns with a redirect activation on the DEFENDING side are excluded.
 *       2. SPREAD. `[spread]` moves hit both foes by rule; the protocol still prints one name. They
 *          are not a target choice at all and the dex-target filter plus the `[spread]` tag drop them.
 *       3. A MOVE NOBODY CLICKED. Sleep Talk, Dancer, Magic Bounce, Copycat and Instruct all emit a
 *          `|move|` line carrying `[from]`. Those are the ENGINE's choice, not a player's.
 *       4. RETARGETING ONTO A CORPSE. If the first attack KOs the named foe, Showdown re-aims the
 *          partner's move at the survivor and prints the NEW target — so a successful focus-fire
 *          reads as a split. Turns where a defending body fainted BETWEEN the two clicks are
 *          reported as AMBIGUOUS and bounded from both sides rather than being counted either way.
 *
 *     The denominator is conditioned on BOTH FOES ALIVE AT TURN START, because that is when the two
 *     choices were made — the choice is simultaneous, and a foe that was already a corpse offered no
 *     choice to make.
 *
 * (B) THE SWITCH RATE BY CONTEXT. `rollout_switch_census.js` measures ONE conditional rate
 *     (9.98% of decisions taken with a live bench). This asks which contexts that 9.98% is made of:
 *     HP band, turn index, bench size, whether the body only just came in, and whether it is statused.
 *     A voluntary switch is identified by the protocol's own ordering, byte-for-byte the rule in
 *     rollout_switch_census.js: switches resolve above every move priority, so a `|switch|` before
 *     the first `|move|` of its own turn was CHOSEN.
 *
 * (C) WHICH BODY GETS SENT. Only answerable when the whole bring is known, so it is restricted to
 *     games where the number of distinct bodies seen on a side equals its `|teamsize|`. Anything
 *     else is a bench with an unknown member in it and is counted as UNRESOLVED, never guessed.
 *
 * ================= NO SILENT CATCH ===============================================================
 *
 * Every skip is a counter and every counter is printed including its zero. A game that does not
 * parse, a move the dex does not carry, a target token that is not a slot — each has its own name.
 * There is no bucket for "something else happened".
 *
 *   node engine/joint_click_census.js [--limit N] [--write]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

require('./showdown_path.js');
const D = (...p) => path.join(__dirname, '..', ...p);

const FORMAT = (() => {
  const r = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
  const a = r.regulations[r.active] || {};
  if (!a.showdownFormat) {
    throw new Error('joint_click_census: data/regulations.json names no showdownFormat for the '
      + 'active regulation. The dex decides which moves are single-target, so guessing the format '
      + 'here would silently change the population.');
  }
  return a.showdownFormat;
})();

const { Dex } = require(path.join(process.env.SHOWDOWN_PATH, 'dist', 'sim'));
const dex = Dex.forFormat(FORMAT);
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* THE THREE TARGET TYPES THE DRIVER ACTUALLY CHOOSES A FOE SLOT FOR. Taken from the branch in
 * `engine/game_differential.js` chooseAction that this census exists to replace — not from a list of
 * what "looks like an attack". If that branch ever widens, this must widen with it, which is why the
 * set is named here beside the reason rather than inlined. */
const SINGLE_FOE_TARGETS = new Set(['normal', 'any', 'adjacentFoe']);

/* ---- REDIRECTION, DERIVED FROM THE TAGS AND NOT TYPED -------------------------------------------
 *
 * MATCH ON TAG SHAPE, NEVER ON A NAME (CLAUDE.md). `data/tags.json` carries `redirects` on the moves
 * that take the turn's single-target attacks and `redirectsType` on the abilities that draw a type,
 * so a member added later is picked up with no edit here.
 *
 * AND THE PROTOCOL LINE IS `-singleturn`, NOT `-activate`. The first draft of this file watched for
 * `|-activate|slot|move: Follow Me` and reported `excluded_redirect: 0` over 600 games — a field that
 * does not exist, printing a clean all-clear. Showdown announces the volatile with
 * `this.add('-singleturn', target, 'move: Follow Me')` (data/moves.ts:6059) and the redirect ITSELF
 * is `this.debug(...)`, i.e. it is never in the log at all. So the volatile going up is the only
 * observable, which is the right one anyway: once it is up, every single-target attack into that side
 * is pulled and no pair on that side is a free choice.
 *
 * A REFUSAL, NOT AN EMPTY SET. An empty redirect list silently readmits every redirected turn as a
 * human focus-firing, which is the single largest way this number could be inflated. */
const REDIRECT = (() => {
  const t = JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8'));
  const pick = (kind, tag) => Object.entries(t[kind] || {})
    .filter(([, v]) => Array.isArray(v.tags) && v.tags.includes(tag)).map(([k]) => k);
  const moves = pick('moves', 'redirects');
  const abils = pick('abilities', 'redirectsType');
  if (!moves.length || !abils.length) {
    throw new Error('joint_click_census: data/tags.json yielded ' + moves.length + ' redirect moves '
      + 'and ' + abils.length + ' redirect abilities. An empty set would readmit every redirected '
      + 'turn as a human choosing to focus-fire, which is exactly the number this file reports.');
  }
  return { moves: new Set(moves), abilities: new Set(abils), names: { moves, abilities: abils } };
})();

const STORES = [
  { key: 'ladder', raw: D('data', 'games.ladder.raw-logs.jsonl'), note: 'bo1 ladder' },
  { key: 'bo3', raw: D('data', 'games.bo3.raw-logs.jsonl'), note: 'bo3 ladder — the open-sheet population' },
];

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const flag = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LIMIT = +flag('--limit', 0) || 0;
const WRITE = has('--write');

function hpPct(tok) {
  const s = String(tok || '');
  if (/^0 fnt/.test(s)) return 0;
  const m = s.match(/^(\d+)\/(\d+)/);
  if (!m) return null;
  const den = +m[2];
  if (!den) return null;
  return (+m[1] / den) * 100;
}
function hpBand(p) {
  if (p == null) return 'unknown';
  if (p >= 100) return 'full';
  if (p > 66) return 'hp_67_99';
  if (p > 33) return 'hp_34_66';
  return 'hp_1_33';
}
function turnBucket(t) { return t <= 1 ? 'turn_1' : t === 2 ? 'turn_2' : t === 3 ? 'turn_3' : 'turn_4plus'; }
/* TENURE — how many turn boundaries this body has already survived on the field. 0 is "it arrived
 * since the last decision", which includes both a turn-1 lead and a body that just replaced a corpse. */
function tenureBand(t) { return t == null ? 'tenure_unknown' : t <= 0 ? 'tenure_0' : t === 1 ? 'tenure_1' : 'tenure_2plus'; }

/* A counted table: bump(name, key, isSwitch) keeps { n, sw } per key so a rate is always printed
 * beside the sample it rests on. A rate with no denominator is the shape of every figure this
 * repository has had to withdraw. */
function tally() { return new Map(); }
function bump(m, k, sw) {
  let r = m.get(k);
  if (!r) { r = { n: 0, sw: 0 }; m.set(k, r); }
  r.n++; if (sw) r.sw++;
}
function tableOut(m) {
  const o = {};
  for (const [k, v] of [...m.entries()].sort()) {
    o[k] = { decisions: v.n, voluntary_switches: v.sw, pct: v.n ? +((v.sw / v.n) * 100).toFixed(3) : null };
  }
  return o;
}

/* ---- ONE GAME ----------------------------------------------------------------------------------
 * Returns null for anything that is not a finished Champions battle — the same admission rule as
 * rollout_switch_census.js, so the two artifacts speak about the same population. */
function walk(log, acc) {
  const L = String(log || '').split('\n');
  let tier = '', ended = false, forfeit = false;
  let turn = 0, started = false, phase = 'pre', sawMove = false;
  let li = 0;

  const teamsize = { p1: 4, p2: 4 };
  const fainted = { p1: 0, p2: 0 };
  /* slot code ('p1a') -> the body standing there */
  const at = {};
  /* side -> nickname -> { seen, fainted, onField } */
  const bodies = { p1: new Map(), p2: new Map() };

  const events = [];          // voluntary switch-ins, scored after the last line (see (C) below)
  let clicks = [];            // this turn's single-foe clicks
  let faints = [];            // this turn's faints, with their line index
  const redirectOn = { p1: false, p2: false };
  const acted = new Set();    // slot codes that had a decision this turn
  const volSlots = new Set(); // ... of those, the ones that chose to leave
  let startHp = {}, startStatus = {}, startAlive = {}, startBench = { p1: 0, p2: 0 }, startEntered = {};

  const bodyOf = (side, nick) => {
    let b = bodies[side].get(nick);
    if (!b) { b = { seen: false, fainted: false, onField: false }; bodies[side].set(nick, b); }
    return b;
  };

  const snapTurn = () => {
    startHp = {}; startStatus = {}; startAlive = {}; startEntered = {};
    for (const s of ['p1a', 'p1b', 'p2a', 'p2b']) {
      const b = at[s];
      startHp[s] = b ? b.hp : null;
      startStatus[s] = b ? b.status : null;
      startAlive[s] = !!(b && !b.fainted);
      /* TENURE = HOW MANY DECISIONS THIS BODY HAS ALREADY MADE ON THE FIELD, and it is defined that
       * way so that it equals Showdown's own `pokemon.activeTurns - 1`, which is the only handle the
       * driver has. Getting this off by one would have been invisible: the table would still look
       * like a table and every cell would be somebody else's.
       *
       * Two drafts were wrong before this one. The first gave every lead a bucket of its own, so a
       * lead still standing on turn 9 shared a cell with a turn-1 lead. The second used
       * `turn - enteredTurn`, which is right for a lead and one too many for a body that switched in
       * during turn N — its FIRST decision is turn N+1, where it has made none. `firstDecisionTurn`
       * says it once: 1 for a lead, `turn + 1` for anything that arrives mid-game. */
      startEntered[s] = !b ? null : (turn - b.firstDecisionTurn);
    }
    for (const s of ['p1', 'p2']) startBench[s] = Math.max(0, teamsize[s] - fainted[s] - 2);
  };

  const closeTurn = () => {
    /* ---- (A) THE JOINT TARGET DRAW ------------------------------------------------------------ */
    for (const side of ['p1', 'p2']) {
      const foeSide = side === 'p1' ? 'p2' : 'p1';
      const mine = clicks.filter(c => c.side === side);
      if (mine.length < 2) { if (mine.length === 1) acc.joint.lone_click_turns++; continue; }
      if (mine.length > 2) { acc.joint.more_than_two_clicks++; continue; }   // cannot happen in doubles
      const [c1, c2] = mine.sort((a, b) => a.li - b.li);
      if (c1.slot === c2.slot) { acc.joint.same_slot_twice++; continue; }
      acc.joint.pairs_seen++;
      if (!startAlive[foeSide + 'a'] || !startAlive[foeSide + 'b']) { acc.joint.excluded_foe_dead_at_turn_start++; continue; }
      if (redirectOn[foeSide]) { acc.joint.excluded_redirect++; continue; }
      const koBetween = faints.some(f => f.side === foeSide && f.li > c1.li && f.li < c2.li);
      const same = c1.target === c2.target;
      if (koBetween) {
        acc.joint.ambiguous_ko_between++;
        if (same) acc.joint.ambiguous_read_same++; else acc.joint.ambiguous_read_split++;
        continue;
      }
      acc.joint.clean_pairs++;
      if (same) acc.joint.clean_same++; else acc.joint.clean_split++;
      /* WHICH foe, when they focused: slot a or slot b. The current driver always names the lowest
       * live index, so a slot bias in the humans is the thing that would make that defensible. */
      if (same) bump(acc.focusSlot, c1.target.slice(2), false);
    }
    /* the marginal, over every single-foe click including the lone ones */
    for (const c of clicks) bump(acc.marginalSlot, c.target.slice(2), false);

    /* ---- (B) THE SWITCH RATE BY CONTEXT -------------------------------------------------------- */
    for (const slot of acted) {
      const side = slot.slice(0, 2);
      if (startBench[side] <= 0) { acc.sw.decisions_without_a_bench++; continue; }
      const sw = volSlots.has(slot);
      acc.sw.decisions_with_a_bench++;
      if (sw) acc.sw.voluntary++;
      bump(acc.byHp, hpBand(startHp[slot]), sw);
      bump(acc.byTurn, turnBucket(turn), sw);
      bump(acc.byBench, 'bench_' + startBench[side], sw);
      const ten = tenureBand(startEntered[slot]);
      bump(acc.byEntered, ten, sw);
      bump(acc.byStatus, startStatus[slot] ? 'statused' : 'clean', sw);
      bump(acc.joint2, hpBand(startHp[slot]) + ' x ' + turnBucket(turn), sw);
      /* THE CELL THE DRIVER WILL ACTUALLY LOOK UP. Three axes, 24 cells, and every one of them is
       * computable inside game_differential.js from Showdown's own request — hp/maxhp, activeTurns,
       * and the length of the legal bench. A model keyed on something the driver cannot see is a
       * table that would silently fall back on every draw. */
      bump(acc.cell, hpBand(startHp[slot]) + '|' + ten + '|bench_' + Math.min(2, startBench[side]), sw);
    }
    clicks = []; faints = []; acted.clear(); volSlots.clear();
    redirectOn.p1 = false; redirectOn.p2 = false;
  };

  for (const line of L) {
    li++;
    if (!line.startsWith('|')) continue;
    const p = line.split('|');
    const cmd = p[1];
    if (cmd === 'tier') { tier = p[2] || ''; continue; }
    if (cmd === 'teamsize') { const s = p[2]; if (s === 'p1' || s === 'p2') teamsize[s] = parseInt(p[3], 10) || 4; continue; }
    if (cmd === 'turn') {
      if (started) closeTurn();
      started = true; phase = 'turn'; sawMove = false;
      turn = parseInt(p[2], 10) || turn + 1;
      snapTurn();
      continue;
    }
    if (cmd === 'upkeep') { phase = 'post'; continue; }
    if (cmd === 'win' || cmd === 'tie') { ended = true; continue; }
    if (cmd === '-message' && /forfeit/i.test(p[2] || '')) { forfeit = true; continue; }

    const slotOf = tok => { const m = String(tok || '').match(/^(p[12][ab]):/); return m ? m[1] : null; };

    if (cmd === 'switch' || cmd === 'drag' || cmd === 'replace') {
      const slot = slotOf(p[2]);
      if (!slot) { acc.skips.switch_no_slot++; continue; }
      const side = slot.slice(0, 2);
      const nick = String(p[2]).slice(String(p[2]).indexOf(': ') + 2);
      const prev = at[slot];
      if (prev && prev.nick !== nick) { const b = bodyOf(side, prev.nick); b.onField = false; }
      const b = bodyOf(side, nick);
      b.seen = true; b.onField = true;
      const hp = hpPct(p[4]);
      const st = (String(p[4] || '').split(' ')[1] || '') || null;
      const outgoingNick = prev && prev.nick !== nick ? prev.nick : null;
      at[slot] = { nick, hp, status: st, fainted: false, enteredTurn: started ? turn : null,
                   firstDecisionTurn: started ? turn + 1 : 1 };
      if (cmd === 'switch') {
        if (!started) { /* the leads */ }
        else if (phase === 'post') { /* a replacement after a KO — forced, not a decision */ }
        else if (sawMove) { /* mid-turn: a pivot move, an Eject Button. The MOVE was the action. */ }
        else {
          acted.add(slot); volSlots.add(slot);
          /* ---- (C) WHICH BODY GETS SENT — RESOLVED AT THE END OF THE GAME, NOT HERE -------------
           *
           * THE FIRST DRAFT ASKED THE QUESTION IN A WAY THAT COULD ONLY HAVE ONE ANSWER, and it
           * printed `pct_mixed_bench_chose_new: 100` over 18,936 events — uniformity across rows,
           * which is the tell. It gated on "every body of this bring has already been on the field",
           * and that gate can only open on the turn a FOURTH body debuts, because the incoming body
           * is itself what completes the set. So the chosen body was new by construction and every
           * bench alternative was old by construction. The measurement was a restatement of its own
           * admission rule.
           *
           * The bring is knowable — it is just not knowable YET. So the event records only what is
           * observable at the time (who was on the field, who was already a corpse, who had been out
           * before) and is scored after the last line of the game, when the bring is a fact. */
          acc.choice.voluntary_switch_ins++;
          const activesBefore = ['a', 'b'].map(x => at[side + x]).filter(Boolean)
            .map(x => x.nick).filter(n => n !== nick);
          if (outgoingNick && !activesBefore.includes(outgoingNick)) activesBefore.push(outgoingNick);
          events.push({ side, chosen: nick,
            unavailable: new Set(activesBefore),
            fainted: new Set([...bodies[side]].filter(([, bb]) => bb.fainted).map(([n]) => n)),
            veterans: new Set([...bodies[side]].filter(([, bb]) => bb.seenBefore).map(([n]) => n)) });
        }
      }
      b.seenBefore = true;
      continue;
    }
    if (cmd === 'faint') {
      const slot = slotOf(p[2]);
      if (!slot) { acc.skips.faint_no_slot++; continue; }
      const side = slot.slice(0, 2);
      fainted[side]++;
      if (at[slot]) { at[slot].fainted = true; at[slot].hp = 0; const b = bodyOf(side, at[slot].nick); b.fainted = true; b.onField = false; }
      faints.push({ side, li });
      continue;
    }
    if (cmd === '-damage' || cmd === '-heal' || cmd === '-sethp') {
      const slot = slotOf(p[2]);
      if (slot && at[slot]) {
        const h = hpPct(p[3]);
        if (h != null) at[slot].hp = h;
        const st = (String(p[3] || '').split(' ')[1] || '') || null;
        if (st && st !== 'fnt') at[slot].status = st;
      }
      continue;
    }
    if (cmd === '-status') { const s = slotOf(p[2]); if (s && at[s]) at[s].status = p[3] || null; continue; }
    if (cmd === '-curestatus') { const s = slotOf(p[2]); if (s && at[s]) at[s].status = null; continue; }
    if (cmd === '-singleturn' || cmd === '-activate') {
      const s = slotOf(p[2]);
      const what = toID(String(p[3] || '').replace(/^move:\s*/, ''));
      if (s && REDIRECT.moves.has(what)) redirectOn[s.slice(0, 2)] = true;
      continue;
    }
    if (cmd === '-ability') {
      const s = slotOf(p[2]);
      if (s && REDIRECT.abilities.has(toID(p[3]))) redirectOn[s.slice(0, 2)] = true;
      continue;
    }
    if (cmd === 'cant') {
      const slot = slotOf(p[2]);
      if (slot && phase === 'turn') { sawMove = true; acted.add(slot); }
      continue;
    }
    if (cmd === 'move') {
      const slot = slotOf(p[2]);
      if (!slot) { acc.skips.move_no_slot++; continue; }
      if (phase === 'turn') { sawMove = true; acted.add(slot); }
      acc.clicks.move_lines++;
      /* A `|move|` line that carries `[from]` was not clicked by a person — Sleep Talk, Dancer,
       * Magic Bounce, Copycat, Instruct. Counted apart, never folded in. */
      if (p.some(x => x.startsWith('[from]'))) { acc.clicks.from_tag++; continue; }
      if (p.some(x => x.startsWith('[spread]'))) { acc.clicks.spread++; continue; }
      const mv = dex.moves.get(toID(p[3]));
      if (!mv || !mv.exists) { acc.clicks.move_not_in_dex++; continue; }
      if (!SINGLE_FOE_TARGETS.has(mv.target)) { acc.clicks.not_single_target++; continue; }
      const tgt = slotOf(p[4]);
      if (!tgt) { acc.clicks.no_target_token++; continue; }
      if (tgt.slice(0, 2) === slot.slice(0, 2)) { acc.clicks.aimed_at_own_side++; continue; }
      acc.clicks.single_foe_clicks++;
      clicks.push({ side: slot.slice(0, 2), slot, target: tgt, li, move: mv.id });
      continue;
    }
  }
  if (started) closeTurn();
  if (!/champions/i.test(tier)) return null;
  if (!ended) return null;
  if (!turn) return null;

  /* ---- (C), SCORED. The bring is every body that was ever on the field for that side. A side whose
   * seen count does not equal its `|teamsize|` had a body that never appeared, so its bench had an
   * unknown member in it and every event on that side is UNRESOLVED — counted, never guessed. */
  for (const e of events) {
    const bring = [...bodies[e.side].keys()];
    if (bring.length !== teamsize[e.side]) { acc.choice.unresolved_bench_composition++; continue; }
    const options = bring.filter(n => !e.unavailable.has(n) && !e.fainted.has(n));
    if (!options.includes(e.chosen)) { acc.choice.chosen_not_in_reconstructed_bench++; continue; }
    acc.choice.resolved++;
    acc.choice.bench_options_sum += options.length; acc.choice.bench_options_n++;
    const newOnes = options.filter(n => !e.veterans.has(n));
    const oldOnes = options.filter(n => e.veterans.has(n));
    const chosenIsNew = !e.veterans.has(e.chosen);
    if (chosenIsNew) acc.choice.chose_a_body_never_yet_on_the_field++;
    else acc.choice.chose_a_returning_body++;
    /* THE ONLY CELL THAT CARRIES INFORMATION: a bench holding BOTH a debutant and a returning body,
     * where uniform would say 50/50 and the human's preference is measurable. */
    if (newOnes.length && oldOnes.length) {
      acc.choice.mixed_bench++;
      if (chosenIsNew) acc.choice.mixed_bench_chose_new++;
      acc.choice.mixed_bench_expected_new += newOnes.length / options.length;
    }
    bump(acc.byOptions, 'options_' + Math.min(3, options.length), false);
  }
  return { turns: turn, forfeit };
}

function emptyAcc() {
  return {
    joint: { pairs_seen: 0, clean_pairs: 0, clean_same: 0, clean_split: 0,
             ambiguous_ko_between: 0, ambiguous_read_same: 0, ambiguous_read_split: 0,
             excluded_redirect: 0, excluded_foe_dead_at_turn_start: 0,
             lone_click_turns: 0, same_slot_twice: 0, more_than_two_clicks: 0 },
    sw: { decisions_with_a_bench: 0, decisions_without_a_bench: 0, voluntary: 0 },
    choice: { voluntary_switch_ins: 0, resolved: 0, unresolved_bench_composition: 0,
              chosen_not_in_reconstructed_bench: 0,
              chose_a_body_never_yet_on_the_field: 0, chose_a_returning_body: 0,
              mixed_bench: 0, mixed_bench_chose_new: 0, mixed_bench_expected_new: 0,
              bench_options_sum: 0, bench_options_n: 0 },
    clicks: { move_lines: 0, from_tag: 0, spread: 0, move_not_in_dex: 0, not_single_target: 0,
              no_target_token: 0, aimed_at_own_side: 0, single_foe_clicks: 0 },
    skips: { switch_no_slot: 0, faint_no_slot: 0, move_no_slot: 0 },
    byHp: tally(), byTurn: tally(), byBench: tally(), byEntered: tally(), byStatus: tally(),
    joint2: tally(), focusSlot: tally(), marginalSlot: tally(), cell: tally(), byOptions: tally(),
    games: 0, skipped: 0, forfeits: 0,
  };
}

function digestOf(f) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16); }
  catch (e) {
    console.error('  NO DIGEST — ' + f + ' (' + String((e && e.message) || e).split('\n')[0]
      + '); stamped null, which is NOT "unchanged"');
    return null;
  }
}

async function censusOne(store) {
  if (!fs.existsSync(store.raw)) return { key: store.key, error: 'missing: ' + store.raw };
  const acc = emptyAcc();
  const rl = readline.createInterface({ input: fs.createReadStream(store.raw), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); }
    catch (e) { acc.skipped++; continue; }
    const r = walk(o.log, acc);
    if (!r) { acc.skipped++; continue; }
    acc.games++;
    if (r.forfeit) acc.forfeits++;
    if (LIMIT && acc.games >= LIMIT) break;
  }
  return finish(store, acc);
}

function finish(store, a) {
  const j = a.joint;
  const cleanPct = j.clean_pairs ? +((j.clean_same / j.clean_pairs) * 100).toFixed(3) : null;
  const lo = (j.clean_pairs + j.ambiguous_ko_between)
    ? +((j.clean_same / (j.clean_pairs + j.ambiguous_ko_between)) * 100).toFixed(3) : null;
  const hi = (j.clean_pairs + j.ambiguous_ko_between)
    ? +(((j.clean_same + j.ambiguous_ko_between) / (j.clean_pairs + j.ambiguous_ko_between)) * 100).toFixed(3) : null;
  return {
    key: store.key, note: store.note, file: path.basename(store.raw), digest: digestOf(store.raw),
    games: a.games, skipped: a.skipped, forfeits: a.forfeits,
    joint_target: Object.assign({}, j, {
      pct_same_foe_clean: cleanPct,
      pct_same_foe_lower_bound: lo,
      pct_same_foe_upper_bound: hi,
      bound_note: 'the bounds carry the AMBIGUOUS pairs — a defending body fainted between the two '
        + 'clicks, so Showdown re-aimed the second move and the chosen target is unobservable. The '
        + 'lower bound counts every one of them as a split, the upper as a focus.',
    }),
    focus_target_slot: tableOut(a.focusSlot),
    marginal_target_slot: tableOut(a.marginalSlot),
    click_filter: a.clicks,
    parse_skips: a.skips,
    switch: Object.assign({}, a.sw, {
      pct_decisions_with_a_bench_that_are_a_voluntary_switch:
        a.sw.decisions_with_a_bench ? +((a.sw.voluntary / a.sw.decisions_with_a_bench) * 100).toFixed(3) : null,
      by_hp_at_turn_start: tableOut(a.byHp),
      by_turn: tableOut(a.byTurn),
      by_bench_size: tableOut(a.byBench),
      by_time_on_field: tableOut(a.byEntered),
      by_status: tableOut(a.byStatus),
      by_hp_x_turn: tableOut(a.joint2),
      by_cell: tableOut(a.cell),
    }),
    switch_in_choice: Object.assign({}, a.choice, {
      bench_option_count: tableOut(a.byOptions),
      mean_bench_options: a.choice.bench_options_n
        ? +(a.choice.bench_options_sum / a.choice.bench_options_n).toFixed(3) : null,
      pct_chose_never_seen: a.choice.resolved
        ? +((a.choice.chose_a_body_never_yet_on_the_field / a.choice.resolved) * 100).toFixed(3) : null,
      pct_mixed_bench_chose_new: a.choice.mixed_bench
        ? +((a.choice.mixed_bench_chose_new / a.choice.mixed_bench) * 100).toFixed(3) : null,
      pct_mixed_bench_uniform_would_give: a.choice.mixed_bench
        ? +((a.choice.mixed_bench_expected_new / a.choice.mixed_bench) * 100).toFixed(3) : null,
    }),
    _acc: a,
  };
}

function pooledOf(stores) {
  const live = stores.filter(s => !s.error);
  const sum = (f) => live.reduce((n, s) => n + f(s), 0);
  const j = k => sum(s => s.joint_target[k]);
  const clean = j('clean_pairs'), same = j('clean_same'), amb = j('ambiguous_ko_between');
  const merge = (path) => {
    const out = new Map();
    for (const s of live) for (const [k, v] of Object.entries(path(s))) {
      let r = out.get(k); if (!r) { r = { decisions: 0, voluntary_switches: 0 }; out.set(k, r); }
      r.decisions += v.decisions; r.voluntary_switches += v.voluntary_switches;
    }
    const o = {};
    for (const [k, v] of [...out.entries()].sort()) o[k] = Object.assign({}, v,
      { pct: v.decisions ? +((v.voluntary_switches / v.decisions) * 100).toFixed(3) : null });
    return o;
  };
  const decB = sum(s => s.switch.decisions_with_a_bench), vol = sum(s => s.switch.voluntary);
  const res = sum(s => s.switch_in_choice.resolved);
  return {
    games: sum(s => s.games),
    joint_target: {
      clean_pairs: clean, clean_same: same, clean_split: j('clean_split'),
      ambiguous_ko_between: amb,
      excluded_redirect: j('excluded_redirect'),
      excluded_foe_dead_at_turn_start: j('excluded_foe_dead_at_turn_start'),
      lone_click_turns: j('lone_click_turns'),
      pct_same_foe_clean: clean ? +((same / clean) * 100).toFixed(3) : null,
      pct_same_foe_lower_bound: (clean + amb) ? +((same / (clean + amb)) * 100).toFixed(3) : null,
      pct_same_foe_upper_bound: (clean + amb) ? +(((same + amb) / (clean + amb)) * 100).toFixed(3) : null,
    },
    marginal_target_slot: merge(s => s.marginal_target_slot),
    focus_target_slot: merge(s => s.focus_target_slot),
    switch: {
      decisions_with_a_bench: decB, voluntary: vol,
      pct_decisions_with_a_bench_that_are_a_voluntary_switch: decB ? +((vol / decB) * 100).toFixed(3) : null,
      by_hp_at_turn_start: merge(s => s.switch.by_hp_at_turn_start),
      by_turn: merge(s => s.switch.by_turn),
      by_bench_size: merge(s => s.switch.by_bench_size),
      by_time_on_field: merge(s => s.switch.by_time_on_field),
      by_status: merge(s => s.switch.by_status),
      by_hp_x_turn: merge(s => s.switch.by_hp_x_turn),
      by_cell: merge(s => s.switch.by_cell),
    },
    switch_in_choice: {
      resolved: res,
      unresolved_bench_composition: sum(s => s.switch_in_choice.unresolved_bench_composition),
      chosen_not_in_reconstructed_bench: sum(s => s.switch_in_choice.chosen_not_in_reconstructed_bench),
      chose_a_body_never_yet_on_the_field: sum(s => s.switch_in_choice.chose_a_body_never_yet_on_the_field),
      chose_a_returning_body: sum(s => s.switch_in_choice.chose_a_returning_body),
      mixed_bench: sum(s => s.switch_in_choice.mixed_bench),
      mixed_bench_chose_new: sum(s => s.switch_in_choice.mixed_bench_chose_new),
      mean_bench_options: sum(s => s.switch_in_choice.bench_options_n)
        ? +(sum(s => s.switch_in_choice.bench_options_sum) / sum(s => s.switch_in_choice.bench_options_n)).toFixed(3) : null,
      pct_chose_never_seen: res ? +((sum(s => s.switch_in_choice.chose_a_body_never_yet_on_the_field) / res) * 100).toFixed(3) : null,
      pct_mixed_bench_chose_new: sum(s => s.switch_in_choice.mixed_bench)
        ? +((sum(s => s.switch_in_choice.mixed_bench_chose_new) / sum(s => s.switch_in_choice.mixed_bench)) * 100).toFixed(3) : null,
      pct_mixed_bench_uniform_would_give: sum(s => s.switch_in_choice.mixed_bench)
        ? +((sum(s => s.switch_in_choice.mixed_bench_expected_new) / sum(s => s.switch_in_choice.mixed_bench)) * 100).toFixed(3) : null,
    },
  };
}

(async () => {
  const t0 = Date.now();
  const out = [];
  for (const s of STORES) {
    process.stderr.write('  reading ' + path.basename(s.raw) + ' ...\n');
    out.push(await censusOne(s));
  }
  for (const s of out) delete s._acc;
  const pooled = pooledOf(out);
  const art = {
    generated: new Date().toISOString(),
    node: process.version,
    what: 'the joint TARGET draw and the CONTEXT of a voluntary switch, over real human protocol',
    quarantined: false,
    why_not_quarantined: 'the store is upstream of the simulator — every figure is read off raw '
      + 'Showdown protocol and nothing passes through medicham2-browser.js, board.js or a leaf',
    format: FORMAT,
    redirect_members_derived_from_tags: REDIRECT.names,
    tags_digest: digestOf(D('data', 'tags.json')),
    method: {
      joint_target: 'both active bodies of one side clicked a single-foe-targeted move (dex target '
        + 'in {normal, any, adjacentFoe}); both foes alive at TURN START, because the two choices are '
        + 'simultaneous; no redirect activation on the defending side; no `[from]` and no `[spread]`. '
        + 'A defending faint BETWEEN the two clicks makes the pair AMBIGUOUS — Showdown re-aims onto '
        + 'the survivor and prints the new target — and those are bounded, never counted.',
      switch: 'a |switch| emitted before the first |move| of its own turn was CHOSEN (switches resolve '
        + 'above every move priority in this format). Byte-for-byte the identification rule in '
        + 'engine/rollout_switch_census.js.',
      switch_in_choice: 'restricted to sides where the number of distinct bodies seen equals |teamsize|, '
        + 'so the bench roster is a fact rather than a reconstruction.',
    },
    limit: LIMIT || null,
    elapsed_s: +((Date.now() - t0) / 1000).toFixed(1),
    stores: out,
    pooled,
  };
  const dest = D('data', 'joint-click-census.json');
  if (WRITE) { fs.writeFileSync(dest, JSON.stringify(art, null, 1)); console.log('wrote ' + dest); }
  else console.log(JSON.stringify(pooled, null, 1));
  console.error('  ' + pooled.games + ' games, ' + art.elapsed_s + 's'
    + (WRITE ? '' : '  (dry run — pass --write to publish)'));
})();
