/* THE STADIUM'S CABINET RACK MUST MATCH THE MODEL LEDGER.
 *
 * web/stadium.html hand-carries a model list. That is a DERIVED ARTIFACT with a SOURCE
 * (docs/MODELS.md), and CLAUDE.md's rule applies to it exactly as it applied to
 * data/engine-data.js against data/mega-dex-official.json: a generated file needs a check
 * that its source's values are actually in it, or it drifts silently and keeps working.
 *
 * The failure this prevents is specific and cheap to hit: someone adds a model to
 * docs/MODELS.md, the Stadium keeps rendering the old rack, and the page looks complete
 * while being wrong. A missing cabinet is invisible -- there is no gap on screen where a
 * model should have been.
 *
 * Per the same rule, a gap that is a JUDGEMENT is declared here with its reason rather
 * than being averaged away. Sections of MODELS.md that are not models do not get cabinets.
 */
/* AND TWO DIRECTIONS ARE NOT ENOUGH, WHICH IS WHAT GURU PROVED.
 *
 * The two checks above compare the page to the ledger and the ledger to the page. Between them they
 * catch a model that is in ONE of the two files. They are structurally blind to a model that is in
 * NEITHER -- and GURU was exactly that. `engine/guru.py` writes `data/guru-matchups.json`,
 * `build/build_guru_js.js` wraps it as `data/guru.js`, `web/index.html` renders it on the front
 * door, and GURU had no `## GURU` heading and no cabinet. Nothing on either side of the comparison
 * knew it existed, so both directions passed while the project's archetype matchup matrix was
 * undocumented. (PRIORITIES #41.)
 *
 * So there is a THIRD source of truth, and it is neither of the first two: the set of things that
 * actually GENERATE a `data/*` artifact. A generator is a fact about the code -- it is there whether
 * or not anybody wrote it down -- which is precisely the property the other two lack.
 *
 * IT IS READ FROM `engine/provenance.js --graph`, NOT RESCANNED HERE. That file already derives the
 * whole artifact graph from the source (84 artifacts, 57 counted off the game store, each attributed
 * to the generator that WRITES it, with three ranked write tests and named exclusions for the false
 * attributions it has already been caught making). A second scanner in this file would be a second
 * implementation of "who writes what", the two would disagree eventually, and the disagreement would
 * be invisible -- CLAUDE.md, FACTS ARE GLOBAL.
 *
 * Its report is parsed as text because that is the only interface it offers. The smallest change
 * that would remove the parsing is `--graph --json` (or exporting `deriveGraph`) in
 * engine/provenance.js; ENGINE owns that file, this division does not, and text is honest in the
 * meantime. The parse asserts a row count so it cannot silently read nothing.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const MD = fs.readFileSync(path.join(ROOT, 'docs', 'MODELS.md'), 'utf8');
const HTML = fs.readFileSync(path.join(ROOT, 'web', 'stadium.html'), 'utf8');

/* NOT MODELS. Each one is a section of the ledger that describes data, a companion tool,
 * a cross-cutting practice or a status note -- none of them is a thing that makes a
 * decision, so none of them gets a cabinet. Declared, with the reason, not filtered out
 * by a pattern that would also swallow a real model added later. */
const NOT_A_CABINET = {
  'The learning core':        'a pipeline (self-play -> retrain -> re-evaluate), not a model',
  'CHOMP / ORB':              'companion tools, and they live in a separate repository',
  'Evaluation & honesty':     'a cross-cutting practice, not a component',
  'Status of the "one thing that unblocks everything"': 'a status note',
  /* The version is part of the heading, so this entry goes stale on a MODELS.md version bump and
   * check 3 will demand it be re-stated. That is the check working, not a defect here. */
  'Measurement environment, 3.39.0': 'a read-before-quoting preamble about the conditions numbers were measured under, not a component',
  'ROLES':                    'a labelling of teams, consumed by models rather than deciding',
  /* Added 2026-08-13. It is the COMPOSITION of six models that each already have a cabinet — the
   * sentence saying which one runs when. It owns no artifact and decides nothing on its own, and
   * giving it a cabinet would put a seventh box on the Stadium for a thing that is the arrows
   * between the other six. The models it names are each still checked by this test individually. */
  'THE PER-TURN PIPELINE':    'the composition of models that each have their own cabinet, not a model itself',
  'WAR':                      'a statistic computed over the store',
  'NMF':                      'a decomposition that produces archetypes, consumed downstream',
  'COUNTERPLAY':              'a report over the field, not a decision-maker',
  'MEGA DEX':                 'a data artifact -- the formes the engine could not see',
  'ILLUSION':                 'a detection rule inside ingest',
  'CHAMPIONS_SIM':            'the official engine we play inside (ADR-001), not ours',
  'SMOGON PRIORS':            'an external population statistic we consume',
  /* Added 2026-08-04 with the eight ledger entries the third direction demanded. Each of these is a
   * CENSUS OR A PRIOR over the store -- it states what the format does and is then consumed by
   * something that decides -- which is the same reason ROLES, WAR, NMF and COUNTERPLAY above have no
   * cabinet. A cabinet is for a thing that makes a decision. None of these makes one. */
  'META-USAGE':               'a usage census over the store; the models that read it are the ones that decide',
  'MOVE PRIORS':              'a measured frequency table, sampled FROM by the rollout rather than deciding anything',
  'PORYGON2':                 'a value LOOKUP with no measured verdict and no live caller; NOT MEASURED, so there is nothing to exhibit',
  'SPECIES SETS':             'the observed set distribution — data the builders read, not a decision-maker',
  'COUNTERS':                 'a report over the field, like COUNTERPLAY; and its headline is a null',
  /* A DECLARATION WITH A KNOWN EXPIRY CARRIES ITS OWN TRIGGER, or it goes stale silently — which is
   * the failure every other entry in this table is written to prevent, arriving from the inside. */
  'BRING PRIORS':             'a prior the opponent model draws from, consumed rather than deciding. '
                            + 'The thing that would draw from it is GARY, and GARY\'s default foePolicy is the '
                            + 'coin (docs/SEARCH.md R11, tasks #32-#36) — so today nothing acts on p_lead or '
                            + 'p_bring at all. TRIGGER: this reason is FALSE the day GARY ships with a policy '
                            + 'that reads bring priors. At that point something DECIDES off this artifact and it '
                            + 'earns a cabinet. Re-check whenever #32 closes; do not let this entry outlive it',
  'CORES':                    'a matchup matrix at a grain the corpus cannot support; do not put a cell on a page',
  'DYNAMICS':                 'observed physics — evidence the engine is checked against, not a rule it follows',
};

/* ================================================================================================
 * WHAT COUNTS AS A MODEL, AND WHAT IS ONLY A PIPELINE STEP
 * ================================================================================================
 * 57 store-derived generators against 12 cabinets is a large gap and MOST OF IT IS LEGITIMATE. A
 * build script is not a model. But the exception list is the dangerous half of this check, not the
 * scan: a filter broad enough to drop every `build/*` will drop the next real model that happens to
 * live there, and a check that excuses things by shape stops checking. So every exception is a NAME
 * and a REASON, like NOT_A_CABINET above, and the rule that decides which list a generator lands in
 * is written here so a reader can apply it to a file this table has never heard of.
 *
 *   A generator is a MODEL when its artifact states something about CHAMPIONS -- the game, its
 *   players, or the metagame -- that anything or anyone is meant to ACT on.
 *
 *   It is a PIPELINE STEP when its artifact states something about ABRA instead -- our own code's
 *   cost, coverage, calibration, conformance or corpus -- or when it only RE-ENCODES a statement
 *   that already has a home somewhere else.
 *
 * The question that settles it: IF THIS NUMBER IS WRONG, WHO IS MISLED?
 *   - a player, the bot, or a visitor reading a page   -> MODEL. It needs a docs/MODELS.md entry.
 *   - only us, while deciding what to build next      -> a measurement of our own code. Its home is
 *                                                        the division ledger, not the model ledger.
 *   - nobody, because the number came from elsewhere
 *     and this only reshaped it                       -> a re-encoding. engine/artifact_audit.js and
 *                                                        tests/test-artifact-keys.js check those
 *                                                        against their source; that is their guard.
 *
 * Three corollaries, each of which caught a wrong first answer while this table was being written:
 *
 *   READING THE GAME STORE DOES NOT MAKE YOU A MODEL. `build/build_ability_blocks.js` walks real
 *   battles to learn which ability nullifies which move. That is a CENSUS OF A RULE: run it on twice
 *   the games and coverage rises, the answer does not move. An estimate moves.
 *
 *   NOT READING THE GAME STORE DOES NOT SAVE YOU FROM BEING ONE. `engine/slowking_preview.py` opens
 *   no game file and is unambiguously a model -- it solves a matrix and publishes an equilibrium
 *   that can be wrong.
 *
 *   NOTHING CONSUMING IT DOES NOT SAVE YOU EITHER, and this one is load-bearing. It is tempting to
 *   exempt any artifact no other file reads, and it would shrink this table by a dozen entries. It
 *   is also exactly the failure CLAUDE.md records: "PORYGON2 and DODUO were fitted, saved, quoted in
 *   documents, and never once in a live decision." An unwired model is still a model. Consumption is
 *   evidence about IMPORTANCE, never about whether something needs writing down.
 * ============================================================================================== */
const NOT_A_MODEL = {
  /* --- SIX INSTRUMENTS DECLARED 2026-08-13. None of them decides anything: each reads the format,
   *     the store or the register and reports. A model chooses; these describe. --- */
  'engine/divergence_report.js':
    'a diagnostic RANKING of the whole-game differential\'s own causes by corpus usage — it reads '
    + 'data/game-differential.json and orders it, and every number in it belongs to that artifact',
  'engine/million_run.js':
    'the rate RUNNER — an instrument that measures how often a mechanic fires, which is a property of '
    + 'the simulator rather than a model of the game (ROADMAP #196, #28)',
  'engine/mod_audit.js':
    'answers "did the Champions mod change this entity?" for every legal entity — a derivation off '
    + 'the format, and the reason NO POKEMON VALUE MAY BE TYPED FROM MEMORY is enforceable',
  'engine/open_work.js':
    'prints every unclosed register row and every defect a live instrument measures — a REPORT, and '
    + 'the whole point of it is that it is printed rather than typed (CLAUDE.md, START HERE)',
  'engine/residual_order.js':
    'derives the AUTHORITY\'s end-of-turn resolution order from the format — one shared FACT the '
    + 'engine reads, in the sense of FEATURES ARE PER-MODEL, FACTS ARE GLOBAL. Incomplete by its own '
    + 'admission: it enumerates effects owning an onResidual handler and misses the duration-only '
    + 'ones (ROADMAP #242), which is a defect in the instrument and not a reason to call it a model',
  'engine/speed_vs_pokeenv.js':
    'a BENCHMARK — how fast this engine steps a battle against the reference implementation. A '
    + 'property of the code, not a claim about Pokemon (ROADMAP #192)',
  /* --- RE-ENCODINGS. The site is buildless and cannot require(), so every artifact a page reads
   *     exists twice. The second copy makes no claim of its own; the claim belongs to the file it
   *     was built from, and that file is the one that owes a ledger entry. --- */
  /* build/build_guru_js.js was here for one evening and is deliberately NOT any more: MEASURE's
   * GURU entry names it, so arm (a) accounts for it and check 7 fires on the leftover excuse.
   * Keeping it would have read as "the project decided this is not a model", beside a ledger
   * entry saying the opposite. */
  /* --- AUDITORS. Neither makes a claim ABOUT the game; each makes a claim about our own artifacts,
   *     which is why no model owns them and why neither belongs on the Stadium. --- */
  'engine/rerun_list.js':         'an auditor, not a model: it reads every artifact\'s own engine_release stamp and reports which published numbers were measured on an engine since corrected. It asserts nothing about Pokemon and fits nothing — ROADMAP #57',
  /* --- THE SPRINT INSTRUMENTS, DECLARED 2026-08-10. Ten generators landed across the MEDICHAM gate
   *     sprint and none was declared, so this gate went red on all ten at once. They divide three
   *     ways and the division is the point: an INSTRUMENT measures our engine against the authority,
   *     a CENSUS states a fact about the stored corpus, and a PROBE is a receipt that a capability
   *     fires. None of the three predicts anything about a game, which is what a model does. Each
   *     reason is read from the file's own header and each carries the TRIGGER that would make it
   *     false, because a stale declaration stops this gate asking permanently. --- */
  'engine/million_targets.js': 'a WORK LIST, not a model: it enumerates every mechanic a single staged board cannot settle — a rate, a distribution, a random choice — with the rate each must show and the DENOMINATOR it must be measured over. It runs no games and asserts nothing about Pokemon; it says what the million-game run has to go and measure. Will: "START A LIST OF ALL THE THINGS WE WANT TO TEST IN THE MILLION GAMES RUN." TRIGGER: this entry is false the day it starts REPORTING observed rates instead of listing the ones owed — a file that holds both the target and the result is a model and owes docs/MODELS.md an entry',
  'engine/all_mechanics_fire.js': 'an INSTRUMENT, not a model: it builds teams so every mechanic fires inside a real Showdown game and compares turn by turn, then reports which rows diverged. Its output is a defect list about MEDICHAM, not a claim about play. TRIGGER: false the day anything READS its rows to choose a click rather than to fix the engine',
  'engine/replay_differential.js': 'an INSTRUMENT measuring our engine against the record, and the one that cannot answer the question people want: it replays STORED games through both engines and counts disagreements, so it can show the engine contradicts reality but never that it is exact — Champions sheets carry evs: null and 0 of 22,313 turn-1 damage comparisons resolve to a single roll. A defect finder, not a fit. TRIGGER: false if its divergence rate is ever used AS a quality score rather than as a list to work through',
  'engine/click_counts.js': 'a CENSUS of the corpus: how many times each move RESOLVED across both human stores. It states what players clicked and predicts nothing. It is deliberately NOT a model even though the MEDICHAM gate\'s usage shelf reads it — the shelf is the thing that DECIDES, and the shelf lives in engine/quarantine.js with its own bar. TRIGGER: this entry is false the day a fitted model takes these counts as a feature rather than as a threshold',
  'engine/sheet_usage.js': 'a CENSUS of declared team sheets — which abilities and items are BROUGHT, per team. It exists because click_counts.js states in its own header that no honest ability usage exists, which was true against the bo1 ladder alone and false once games.bo3.jsonl was read. Same standing as click_counts.js and the same trigger, plus one of its own: it must stay listed here only while its not_countable set keeps mega-only abilities OUT of the counts, because merging "invisible to this instrument" with "nobody brings it" would make it a claim rather than a census',
  'engine/mega_census.js': 'a CENSUS that had to be corrected within the hour it was written, which is why it is declared with the correction attached: the store\'s t:"mega" event is EVERY forme change — Disguise, Stance Change, Zero to Hero, Forecast — not mega evolution, so the first version counted a Mimikyu breaking as a mega. It now filters against the format\'s -Mega species set. It states what was brought and decides nothing. TRIGGER: false if any ranking or bring policy reads it directly instead of through a model that owns the claim',
  'engine/format_audit.js': 'an AUDITOR of our own data, not of the game: it sweeps every constant we hold against Dex.forFormat(gen9championsvgc2026regmb) and reports the disagreements. It found 21, all equal to mainline gen 9, root-caused to a build script fetching play.pokemonshowdown.com/data/moves.json. It makes a claim about US being wrong, never about what is true. TRIGGER: false if it ever starts REPAIRING rather than reporting — a repairer owns the values and owes a ledger entry',
  'engine/scenario_catalogue.js': 'a TEST PLAN, not a model: one test SHAPE per tag, so 217 shapes cover 920 entities and an entity added tomorrow inherits its shape for free. It describes how a mechanic could be exercised and never runs anything or asserts an outcome. TRIGGER: false the day it starts emitting verdicts instead of shapes',
  'engine/pp_board_probe.js': 'a PROBE, and its artifact is a RECEIPT rather than a measurement — it demonstrates that a board position can represent spent PP, before and after the fix. Its numbers are counts of Protects in a rollout, which are properties of the instrument, not leaf values. TRIGGER: false if any figure from it is ever quoted as a leaf value or a strength comparison',
  'engine/rollout_switch_probe.js': 'a PROBE that a capability FIRES — the rollout could not switch at all, so this exists to prove the switch path is reached and counted rather than merely present. It is the pattern CLAUDE.md demands after five capabilities were found absent while everything reported success. It asserts nothing about whether switching is GOOD. TRIGGER: false the day it starts scoring the switch instead of counting it',
  'engine/argmax_paired.js': 'a PAIRED MEASUREMENT of one change, not a model: it scores the SAME decision points under two frozen commits of engine/board.js and engine/rollout_leaf.js under common random numbers and reports how often the argmax moved. It fits nothing and it plays nobody — every arm is a build that already exists, and the models being compared (MAG for the menu, the rollout leaf for the value) each own their own claim and their own ledger entry. TRIGGER: this entry is false the day it reports a WIN RATE rather than a flip rate — a run that says which arm is better is an SPRT and owes docs/MODELS.md an entry',
  'engine/rollout_switch_census.js': 'a CENSUS of the stored corpus answering two questions the rollout was getting wrong by construction: how often a real game contains a switch, and how long real games actually run against a 60-turn rollout cap. Store-derived and upstream of the simulator, so it is not quarantined. It reports the population and chooses nothing. TRIGGER: false if the cap it informs is ever set from anything other than this measured distribution',
  /* --- THE THREE DECLARED 2026-08-08, each read out of the file's OWN header rather than inferred
   *     from its name. The check warns that a wrong declaration stops it asking permanently and
   *     silently, so the evidence is quoted here and the reader can check it in one command. --- */
  'engine/diff_swarm.js':         'a pipeline step, not a model: its own header is "TEAM SELECTION FOR THE WHOLE-GAME DIFFERENTIAL" (ROADMAP #68). It picks which team CONFIGURATIONS the differential plays and fits nothing; its RAW-STORE-OK note says outright that the teams are test inputs and not evidence about play. The claim belongs to the differential it feeds',
  'engine/leaf_engine_contrast.js': 'a measurement, not a model: its own header asks "DOES A MORE CORRECT ENGINE MAKE BETTER PREDICTIONS?" It scores two ALREADY-FITTED leaves against each other over paired positions and returns a difference with a noise floor. Nothing is fitted here — the models it contrasts each owe their own ledger entry, and this file owes the answer',
  'engine/mega_decision_census.js': 'a feasibility census, not a model: its own header asks "IS \'WHEN DO I MEGA\' A DECISION, AND IS IT FITTABLE?" It exists BEFORE any mega feature is written, to count whether the decision is real and separable — Will, 2026-08-06, "WHAT IF WE ADD MEGA EVOLUTION TO THE MAG WEIGHTS". If a mega model is later fitted, THAT owes docs/MODELS.md an entry and this file stays a census — ROADMAP #31',
  'engine/validate_store.js':     'an auditor, not a model: it hands every stored set to Showdown\'s own TeamValidator and reports which games contain something the format refuses. The judgement is Showdown\'s; this file only classifies the errors it gets back, separating illegality from a partial closed-sheet reveal',
  'build/build_mag_data.js':      'wraps MAGNEMITE\'s weights and priors as data/mag.js; the claim is MAG\'s',
  'build/build_meta_js.js':       'the Tower\'s threat list, ranked out of data/meta-usage.json; the claim is the usage model\'s',
  'build/build_mew_bundle.js':    'a handful of self-play games trimmed to what the MEW viewer draws',
  'build/build_scoreboard.js':    'precomputed MAG traces for web/scoreboard.html; the claim is MAG\'s',
  'build/build_tags_js.js':       'window.ABRA_TAGS, a wrapper of data/tags.json and nothing else',
  'build/build_board_browser.js': 'the data engine/board.js needs as a browser global; a repackaging of the engine\'s own tables',
  'build/build_browser_data.js':  'browser copies of CHOMP\'s canonical dex files (formes, move effects)',
  'engine/build_roles_js.py':     'a browser-weight trim of ROLES\' three artifacts; ROLES has its own ledger entry',
  'engine/build-status.js':       'reads every model\'s shipped report and emits status badges; it restates other models\' verdicts and originates none',

  /* --- FACTS AND FORMAT, not estimates. Deterministic properties of the game, the dex or the
   *     protocol. More games raise coverage; they do not move the answer. --- */
  'build/build_ability_blocks.js':      'a census of a game RULE — which ability nullifies which move — measured rather than typed',
  'engine/build_species_abilities.js':  'which ability a species CAN have; declares RAW-STORE-OK for exactly this reason — a fact about the game, not about who plays it',
  /* engine/tag_dex.js WAS declared here as a fact-about-the-dex rather than a model. The declaration
     was removed 2026-08-10 because docs/MODELS.md now documents it: an exception is a judgement about
     something nobody has filed, and once the ledger files it the exception is not a judgement any
     more, it is a contradiction. The test says so itself, and this is it being obeyed rather than
     argued with. */
  'engine/game-spec.js':                'a sample of the (state, observation, action, reward) ENCODING — a property of the protocol, and declared RAW-STORE-OK as such',

  /* --- SITE AND CORPUS PLUMBING. Counts of our own store, not claims about Champions. --- */
  'engine/refresh-site-data.NOARCH.py': 'the site refresh — corpus counts and a replay bundle for the coach. If it is wrong it misreports how much data WE hold, not how Champions is played. (Sandbox variant of engine/refresh-site-data.py, which the ledger does name; the duplicate is an OPS finding, not a model.)',

  /* --- MEASUREMENTS OF OUR OWN CODE. Each publishes a verdict ABOUT a model, a feature set or an
   *     affordability question. Its home is the division ledger — docs/MEASURE.md and docs/SEARCH.md
   *     carry these — and MODELS.md already declares "Evaluation & honesty" a cross-cutting practice
   *     rather than a component. An evaluation of a model is not itself a model. --- */
  'engine/collinearity_audit.js':    'fits every MAG feature alone against its weight in the full model — a diagnosis of MAG',
  'engine/collinearity_fix.js':      'can the kill block be repaired, and does repairing it help — a diagnosis of MAG',
  'engine/feature_audit.js':         'does every feature in board.js actually do anything — a diagnosis of the feature set',
  'engine/weight_multiplicity.js':   'which fitted weights survive a multiplicity correction — a statement about MAG\'s fit, not about Champions',
  'engine/opponent_recall.js':       'can MAG narrow the OPPONENT\'s turn — MAG\'s score, reported for MAG',
  'engine/opponent_calibration.js':  'is MAG a usable SAMPLER even though it is a poor ranker — MAG\'s score',
  'engine/recall_at_k.js':           'is MAG good enough to PRUNE — the number the search layer needs about MAG',
  'engine/conformance.js':           'does every file obey the standards the project set itself — a statement about this repository',
  'engine/double_protect.js':        'how often both slots Protect, our bot against humans — a realism diagnostic of our own player',
  'engine/nmf_rank.py':              'chooses NMF\'s rank by a criterion instead of by eye; a hyper-parameter selection for NMF, which has its own ledger entry',
  'engine/pory_nn.py':               'would a neural network beat counting Pokemon — a negative-result experiment; nothing reads data/pory-nn.json but a human',
  'engine/lookahead_bound.py':       'GATE — is there anything for a search to find; an oracle upper bound on OUR search',
  'engine/lookahead_clock_control.py':'GATE — is the oracle gain information or is it just the clock; the control for the bound above',
  'engine/lookahead_cost.js':        'GATE — can we afford to look one turn ahead; a cost measurement of our own code',
  'engine/rollout_fallen_prevalence.js': 'ROADMAP #244 — how often a rollout is seeded from a position with a dead ally AND a fallen-count carrier; a CEILING on the reach of a fix to our own seed, counted off the store and data/tags.json with no game played. It makes no claim about Champions',
  'engine/rollout_seed_prevalence.js': 'ROADMAP #247/#248/#249/#250 — how often the rollout SEED handed MEDICHAM a position that differs from the real one (a benched body on the dataset\'s moveset, a benched body reported whole, a Fake Out the game refuses, a deleted hazard or screen, a zeroed Supreme Overlord snapshot); a CEILING on the reach of a fix to our own seed, counted off the store and data/tags.json with no game played. It makes no claim about Champions',
  'engine/rollout_item_prevalence.js': 'ROADMAP #271 — how often a body on OUR board is priced holding an item the game removed (a Knock Off, a Trick, a Thief), counted off the store and data/tags.json with no game played and no Dex opened. A FLOOR on the reach of a fix to our own reader, not a claim about Champions: the store records no item CONSUMPTION at all, so every spent Focus Sash and eaten berry is missing from it by construction',
  'engine/rollout_clock_prevalence.js': 'ROADMAP #267/#268/#269/#270 — how often the real position is running a COUNTER the seed handed over as zero (a weather with turns left, a permanent hazard and its layers, a Taunt/Encore/Disable, a body some turns into sleep or the toxic ramp), counted off the store and data/tags.json with no game played and no Dex opened. A CEILING on the reach of a fix to our own seed, not a claim about Champions — and its volatile half is additionally a FLOOR, because the store records no |-start| at all',
  'engine/rollout_r2.js':            'GATE R2 — what a rollout LEAF costs; a cost measurement of our own search',
  'engine/rollout_r3.js':            'GATE R3 — does the search PICK A DIFFERENT MOVE; a behaviour diagnostic of our own search',
  'engine/rollout_explore_sweep.js': 'should --rollout-explore default to 1.0 — a knob sweep over our own search',
  /* --- Added 2026-08-05 (docs/MEASURE.md §15). It fits nothing and predicts nothing new: it scores
   *     ONE existing leaf (rollout_leaf.rolloutWinProb) five ways to find out why two of OUR OWN
   *     artifacts — winrate-backtest.json and rollout-r1-explore-sweep.json — disagree about it.
   *     Apply the settling question: if its number is wrong, the people misled are US, while deciding
   *     whether PORYZ is aimed at the right target. Same class as the two gates above; its home is
   *     docs/MEASURE.md. */
  'engine/leaf_position_contrast.js': 'why do winrate-backtest.json and rollout-r1-explore-sweep.json disagree about the same leaf — a 2x2 over POSITION and SHEET on one frozen release; measures our own measurements, fits nothing',
  'engine/exploit_step_probe.js':    'GATE R9 (docs/SEARCH.md) — can the exploitability hill-climb in exploit.js move at 58 dimensions; drives exploit.js\'s own createClimber() against a SYNTHETIC planted optimum, plays no games and says nothing about MAG — a diagnosis of our own search tooling, not a model',
  'engine/rollout_r1_join.py':       'phase 2 of GATE R1 — scores PORYGON2 on the positions the rollout scored; an evaluation, and PORYGON2 is the model it evaluates',
  /* --- Added 2026-08-05. Both are Stages of docs/CLICK-CENSORING-FIX.md and both answer the same
   *     question — "is the corpus we FIT ON telling us what the human actually chose?" That is a
   *     statement about ABRA's own corpus and ABRA's own fitting procedure. Apply the rule's
   *     settling question: if either number is wrong, the people misled are US, while deciding
   *     whether the fit needs repairing. No player, no bot and no visitor reads either file, and
   *     neither says anything about Champions. They are the same class as collinearity_audit.js and
   *     feature_audit.js above, and their home is docs/MEASURE.md, not docs/MODELS.md.
   *
   *     THE FIVE THAT WERE RED HERE ON 2026-08-04 WERE NOT THIS CLASS and are deliberately absent:
   *     analyze.js, porygon2.py, state_encoder.py, derive_sets.js and counters.py all publish
   *     statements ABOUT CHAMPIONS, so none of them could be given a truthful entry in this table.
   *     MEASURE closed them the right way, with ledger entries (META-USAGE, PORYGON2, MOVE PRIORS,
   *     SPECIES SETS, COUNTERS), and arm (a) accounts for them now. --- */
  'engine/click_census.js':          'labels every human action in OUR fit corpus CLEAN / PARTIAL / COERCED / ERASED (docs/CLICK-CENSORING-FIX.md Stage A). A census of what our own data can and cannot see; more games raise its coverage and do not move any claim about the game',
  'engine/em_validation.js':         'plants a known weight vector, censors it the way the real corpus is censored, and asks whether EM recovers it (Stage C). A validation of OUR fitting procedure against a synthetic truth — its own `reading` field says neither number is a win rate or a held-out accuracy',
  /* --- Added 2026-08-05 (docs/MEASURE.md §17). It asks whether two BUILDS OF OUR OWN CODE are the
   *     same function on our own corpus, which is the question that decides whether an artifact
   *     computed through an older engine may still be quoted. It fits nothing, predicts nothing and
   *     names no Champions fact: every figure it emits is a hash of our feature columns or a count of
   *     our own call sites. Settling question — if it is wrong, the people misled are US, while
   *     deciding whether to spend a refit. Same class as feature_audit.js and leaf_position_contrast.js
   *     above; its home is docs/MEASURE.md. --- */
  'engine/feature_engine_contrast.js': 'did an engine change move the FEATURE FUNCTION or only the simulator — hashes all 58 board.js columns under two or more frozen engine bundles over the whole fit corpus, with a positive control that makes it refuse to report agreement it could not have seen. A statement about our own builds, not about Champions',

  /* --- Added 2026-08-06. THREE GATES THAT LANDED IN ONE DAY, each declared with ITS OWN reason.
   *     Writing one reason and reusing it three times would be the pattern this table forbids: a
   *     shape-based excuse stops checking, and the third of these is genuinely borderline. --- */
  'engine/dusk_size_gate.js':        'GATE #40 (docs/SEARCH.md) — would an offline-solved endgame tablebase FIT. Its threshold block was written to disk before a single count was run, and its verdict, TOO BIG, is a statement about a DESIGN WE MIGHT BUILD: how many entries OUR lookup table would hold, against a GitHub per-file limit and a V8 heap budget. Neither ceiling is a fact about Champions, and no player or bot reads the artifact. Settling question — if the entry count is wrong, the people misled are US, while deciding whether to spend a month on DUSK. The reach and coverage rates it measures over the store are INPUTS to that decision, not claims anyone plays on. DUSK itself IS a model, has a docs/MODELS.md entry and now has a cabinet; this file sizes it',
  'engine/porygon2_separation_gate.py': 'GATE #23 (docs/MEASURE.md §18) — can PORYGON2\'s position vector tell two boards apart, tell SAME-GAME boards apart more sharply than unrelated ones, and point the right way. Thresholds declared before the run, judged against this project\'s own 0.43-point split-half noise floor, and its verdict (PASS) answers whether the MILTANK leaf redesign is BUILDABLE — a property of our own value function and our own search plan. The artifact refuses the model-shaped reading itself: its `what_this_gate_does_not_say` field states it does NOT show the 17 features earn their keep. PORYGON2 is the model and already carries a ledger entry; an evaluation of a model is not itself a model',
  'build/strong_player_baseline.js': 'GATE for #46 (docs/MEASURE.md §19) — AND THE BORDERLINE ONE, declared with the reasoning visible so the next reader can REVERSE this call rather than re-derive it. Its headline is that OUR OWN per-turn realism metric cannot separate the rating bands it was built to separate: the whole between-band spread on failed moves sits inside the spread from cutting a single band eight ways, and the design was only powered for a 31% relative change, so §1.3\'s "flat in rating" is NOT MEASURED rather than confirmed. That is a statement about the POWER OF OUR INSTRUMENT, which is why it belongs here. THE CAVEAT, stated rather than buried: it ALSO publishes Champions-facing material — species usage at four Smogon cutoffs, and the ability/item/spread/move gradient within a species — and that material is real. Its home is docs/MEASURE.md §19a-d, because nothing DECIDES off it. If something is ever built that does, this entry is wrong and owes docs/MODELS.md a ledger entry instead',

  'engine/bring_bias.js':            'does require_full_bring\'s length-conditioning move any bring rate — a diagnosis of OUR OWN corpus rule, and its answer is no (84 species tested, 12 clear a raw z, 0 survive BH against 4.2 expected). Its sibling engine/bring_priors.js is the model; this measures the filter, and nothing but itself reads data/bring-bias.json',

  /* --- Added 2026-08-08 by WEB, while closing the five withheld figures the status board was still
   *     publishing. This is the ONE of the four undeclared generators that can be settled without
   *     another division's judgement; the other three (engine/diff_swarm.js,
   *     engine/leaf_engine_contrast.js, engine/mega_decision_census.js) are ENGINE's and MEASURE's
   *     and are REPORTED rather than declared here. A wrong declaration is worse than a red row: it
   *     stops the check asking, permanently and silently. --- */
  'engine/quarantine.js':            'GATE (CLAUDE.md, "EVERYTHING DOWNSTREAM OF MEDICHAM IS QUARANTINED UNTIL MEDICHAM IS CORRECT") — data/quarantine-stamp.json records which of OUR artifacts are downstream of OUR simulator, whether OUR gate is open, and where a withheld figure is still cited. Every field in it is about ABRA\'s own bookkeeping; not one is about Champions, its players or the metagame, and no player, bot or team-builder reads it. Settling question — if the stamp is wrong, the people misled are US, about what we may quote. It is the sibling of engine/provenance.js, which this table has never had to consider only because provenance writes no data/* artifact of its own',
};

/* MODELS.md headings look like "## NAME — long description (added ...)". Take the part
 * before the em dash, then drop a trailing parenthetical qualifier.
 *
 * The qualifier has to go or the check compares spellings instead of identities: the
 * ledger says "MAGNEMITE (MAG)" and "XATU (belief state)", and both are the same model as
 * the cabinet named MAGNEMITE and XATU. This is CLAUDE.md's own warning about the mega
 * merge -- ask whether two keys NORMALISE alike, not whether two files spell them alike. */
const norm = s => s.replace(/\s*\([^)]*\)\s*$/, '').trim();
const headings = [...new Set((MD.match(/^## .+$/gm) || []).map(h =>
  norm(h.replace(/^##\s+/, '').split(/\s+—\s+/)[0])))];

/* The Stadium's own list, read out of the file rather than duplicated here -- duplicating
 * it would make this test agree with itself instead of with the page. */
const cabinets = [...HTML.matchAll(/\bmon:\s*"([^"]+)"/g)].map(m => m[1]);

let failures = 0;
const fail = msg => { failures++; console.log('  FAIL  ' + msg); };
const pass = msg => console.log('  ok    ' + msg);

console.log('STADIUM ROSTER — web/stadium.html against docs/MODELS.md\n');

/* 1. No phantom cabinets: everything on screen must exist in the ledger. */
const missingFromLedger = cabinets.filter(c => !headings.includes(c));
if (missingFromLedger.length) {
  fail('cabinets with no entry in docs/MODELS.md: ' + missingFromLedger.join(', '));
} else {
  pass(cabinets.length + ' cabinets, every one of them a heading in the ledger');
}

/* 2. No missing cabinets: every model in the ledger must be on screen, unless it is
 *    declared above as not being a model at all. */
const undeclared = headings.filter(h => !cabinets.includes(h) && !(h in NOT_A_CABINET));
if (undeclared.length) {
  fail('models in docs/MODELS.md with NO cabinet and NO declared reason:\n' +
       undeclared.map(u => '          - ' + u).join('\n') +
       '\n        Add a cabinet to web/stadium.html, or add the name to NOT_A_CABINET here\n' +
       '        WITH the reason it is not a model. Do not delete this test to make it pass.');
} else {
  pass('every model heading has a cabinet or a declared reason for not having one');
}

/* 3. The declared exceptions must still be real. A stale exception is how a check stops
 *    checking: if a section is renamed, its entry here silently starts excusing nothing. */
const staleExceptions = Object.keys(NOT_A_CABINET).filter(k => !headings.includes(k));
if (staleExceptions.length) {
  fail('NOT_A_CABINET names that no longer appear in docs/MODELS.md (rename or remove them): ' +
       staleExceptions.join(', '));
} else {
  pass(Object.keys(NOT_A_CABINET).length + ' declared non-models all still present in the ledger');
}

/* 4. No duplicate cabinets -- two entries for one model would render twice and each would
 *    look correct on its own. */
const dupes = cabinets.filter((c, i) => cabinets.indexOf(c) !== i);
if (dupes.length) fail('duplicate cabinets: ' + [...new Set(dupes)].join(', '));
else pass('no duplicate cabinets');

/* ================================================================================================
 * 5-7. THE THIRD DIRECTION: every generator of a data/* artifact is accounted for.
 * ============================================================================================== */
let graph = '';
try {
  graph = execFileSync(process.execPath, [path.join(ROOT, 'engine', 'provenance.js'), '--graph'],
                       { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 24 });
} catch (e) {
  fail('could not run engine/provenance.js --graph: ' + (e && e.message));
}

/* One row per artifact. The columns are space-padded rather than delimited, and a name longer than
 * its column runs straight into the next one (`refresh-site-data.NOARCH.pyladder`), so the corpus
 * word anchors the end of the path instead of whitespace doing it. */
const GRAPH_ROW = /^ {2}([a-z0-9][^\s]*\.(?:json|js))\s\s+((?:engine|build)\/\S+?\.(?:js|py))\s*(?:ladder|opensheet)\s+(yes|no)\b/;
const artifacts = [];
for (const ln of graph.split(/\r?\n/)) {
  const m = GRAPH_ROW.exec(ln);
  if (m) artifacts.push({ file: m[1], by: m[2], store: m[3] === 'yes' });
}

/* A SCANNER THAT READS NOTHING REPORTS A CLEAN SITE. CLAUDE.md's one failure mode: "a capability was
 * absent, and everything reported success." If the report format ever moves, this must go red rather
 * than quietly excusing every generator in the project. The bound is well under the 84 rows the
 * graph holds today, so ordinary growth or pruning does not trip it. */
if (artifacts.length < 50) {
  fail('parsed only ' + artifacts.length + ' rows out of engine/provenance.js --graph (expected 50+). '
     + 'The report format moved and this check is reading nothing — fix the parse, do not delete it.');
} else {
  pass(artifacts.length + ' artifacts read from engine/provenance.js --graph, '
     + artifacts.filter(a => a.store).length + ' of them counted off the game store');
}

const generators = [...new Set(artifacts.map(a => a.by))].sort();
const writes = g => artifacts.filter(a => a.by === g).map(a => a.file);

/* IS THIS GENERATOR ACCOUNTED FOR? Two derived arms, then the declared table.
 *
 * (a) THE LEDGER NAMES THE FILE, in either language. A model ported from Python to JS is the same
 *     model: engine/ditto.js is described in the ledger as "DITTO (Node port)" of engine/ditto.py,
 *     and only the .js spelling appears there. Comparing spellings instead of identities is the
 *     mistake the mega merge made and the `norm()` above already guards against.
 *
 * (b) THE GENERATOR IS PLAINLY THAT MODEL'S. `engine/xatu.py` writes the belief distribution itself
 *     and the ledger's two XATU headings name only engine/xatu_belief.py and engine/xatu_context.py,
 *     which are its EVALUATIONS. XATU is documented and has a cabinet; the ledger simply cites a
 *     sibling file. Requiring the exact path there would have produced an exception entry whose
 *     reason was "XATU is documented", which is not a reason, it is the check failing.
 *
 * Cabinets are unioned in so this arm says literally what the rule says -- the ledger OR the site.
 * Check 1 already forbids a cabinet that is not a heading, so today it adds nothing; if that ever
 * relaxes, this keeps meaning what its comment says. */
/* AND `MD.includes(base)` IS A SUBSTRING TEST, WHICH EXCUSED A REAL MODEL. Measured 2026-08-04:
 * `engine/policy.js` — the behaviour clone that writes data/move-priors.json, which nine files read —
 * was accounted for by the string `fit_policy.js` appearing in the ledger. A different file, a
 * different model, and the check said "the ledger names policy.js". It is the same fault
 * engine/provenance.js was carrying in the other direction on the same day, where `ladder.json`
 * matched inside `games.ladder.jsonl` and credited the store reader with generating MACHAMP's
 * hill-climb artifact.
 *
 * A filename must be bounded on BOTH sides here, unlike in provenance.js where a leading `data/` or
 * `games.` is a legitimate spelling of the same file. `fit_policy.js` and `policy.js` are never the
 * same file. Swept across all generators, this was the only one being excused by a substring — so it
 * is one entry's worth of drift, and it was the entry that mattered. */
const nameBounded = (hay, needle) => {
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = hay[i - 1] || '', after = hay[i + needle.length] || '';
    if (!/[A-Za-z0-9_]/.test(after) && !/[A-Za-z0-9_]/.test(before)) return true;
  }
  return false;
};
const documented = new Set([...headings, ...cabinets]);
function accountedFor(g) {
  const base = g.split('/').pop();
  const alt = base.endsWith('.js') ? base.slice(0, -3) + '.py' : base.slice(0, -3) + '.js';
  if (nameBounded(MD, base) || nameBounded(MD, alt)) return 'the ledger names ' + base;
  const stem = base.replace(/\.(js|py)$/, '').toUpperCase();
  if (documented.has(stem)) return 'it is ' + stem + "'s generator";
  if (g in NOT_A_MODEL) return 'declared not a model: ' + NOT_A_MODEL[g];
  return null;
}

/* 5. Nothing writes an artifact from outside both files without a declared reason. */
const undocumented = generators.filter(g => accountedFor(g) === null);
if (undocumented.length) {
  fail('generators of data/* artifacts that appear in NEITHER docs/MODELS.md NOR the Stadium,\n' +
       '        and have NO declared reason for being neither:\n' +
       undocumented.map(g => '          - ' + g.padEnd(34) + '-> data/' + writes(g).join(', data/')).join('\n') +
       '\n        This is the GURU hole. Each one is either a MODEL that owes docs/MODELS.md an entry\n' +
       '        (MEASURE owns that file), or a pipeline step that owes NOT_A_MODEL here a NAME AND A\n' +
       '        REASON. Read the rule above before choosing. Do not add a pattern, and do not delete\n' +
       '        this check to make it pass.');
} else {
  pass(generators.length + ' generators, every one of them named in the ledger or declared not a model');
}

/* 6. A stale exception is how a check stops checking -- the same failure the NOT_A_CABINET staleness
 *    test above exists for. If a script is renamed or deleted, its entry here silently excuses
 *    nothing while still looking like diligence. */
const staleNotAModel = Object.keys(NOT_A_MODEL).filter(g => !generators.includes(g));
if (staleNotAModel.length) {
  fail('NOT_A_MODEL entries that no longer generate any data/* artifact (rename or remove them): ' +
       staleNotAModel.join(', '));
} else {
  pass(Object.keys(NOT_A_MODEL).length + ' declared non-models all still generate an artifact');
}

/* 7. And an exception that has been overtaken is dead weight that reads as a judgement. If the
 *    ledger has since taken a generator on, the excuse for it not being there must go, or the next
 *    reader believes the project decided it was not a model. */
const redundant = Object.keys(NOT_A_MODEL).filter(g => {
  const base = g.split('/').pop();
  const alt = base.endsWith('.js') ? base.slice(0, -3) + '.py' : base.slice(0, -3) + '.js';
  return nameBounded(MD, base) || nameBounded(MD, alt);   // same boundary rule as check 5, one predicate
});
if (redundant.length) {
  fail('NOT_A_MODEL entries that docs/MODELS.md now documents — delete the exception, it is no longer ' +
       'a judgement, it is a contradiction: ' + redundant.join(', '));
} else {
  pass('no declared non-model is also carried by the ledger');
}

/* 8. AND THE CHECK ABOVE MUST ACTUALLY BITE.
 *
 * Check 5 can only fail on something undeclared, so the day the project is fully documented it goes
 * green and stays green -- and from then on nothing distinguishes "everything is accounted for" from
 * "the accounting broke". That is the failure shape CLAUDE.md opens with: a capability was absent and
 * everything reported success. So a synthetic generator that is in no file and no table is pushed
 * through the same accounting the real ones go through, and check 5 has to reject it.
 *
 * It covers the classification, not the scan -- the parse guard above covers the scan. Between them
 * the two halves of "would GURU be caught today" are both asserted on every run. */
const PROBE = 'engine/__roster_guard_selftest__.js';
if (accountedFor(PROBE) !== null) {
  fail('the accounting accepted ' + PROBE + ', which is in no ledger, on no cabinet and in no ' +
       'exception table. Check 5 cannot fail, so it is no longer checking anything.');
} else {
  pass('a generator in neither file and no exception table is rejected — check 5 still bites');
}

console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'ALL PASS') +
            '   (' + cabinets.length + ' cabinets, ' + headings.length + ' ledger headings, ' +
            generators.length + ' artifact generators)');
process.exit(failures ? 1 : 0);
