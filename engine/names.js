/* names.js — THE ONE PLACE THAT ANSWERS "WHAT IS THIS THING CALLED".
 *
 *   const N = require('./names.js');
 *   N.mega('floette-eternal')            -> { stone:'floettite', forme:'floettemega' }  derived
 *   N.byTag('abilities','onSwitchInDrop') -> Set of ids          THROWS on an unknown tag name
 *   N.tagsOf('moves','quash')            -> ['reordersTurn','statusCategory']
 *   N.id('Floette-Eternal')              -> 'floetteeternal'     one normaliser, everywhere
 *
 * WHY THIS IS A SEPARATE FILE FROM engine/lookup.js, and the reason is embarrassing
 * --------------------------------------------------------------------------------
 * `lookup.js` already existed. It was written on 2026-08-02 for the shape `lookup(x) -> null`, where
 * null means both "not in the data" and "you asked the wrong question" — and it fixes that by making
 * a miss DECLARE itself (`{ mayMiss: '<why>' }`) or throw.
 *
 * On 2026-08-06 I wrote a second module with the same thesis, gave it the same filename, and
 * OVERWROTE the first — deleting `resolve()`, which `engine/mc_key.js:129` calls. That broke
 * `engine/status.js`'s fixture check and `engine/mew.js`, so self-play was down and
 * `tests/test-wiring.js` reported ten capabilities unwired. The ENGINE agent found it, not a gate.
 *
 * The irony is the useful part and is why it is written here rather than in a commit nobody re-reads:
 * lookup.js exists BECAUSE Will asked *"are we actually making progress or going in circles?"* after
 * seven guard-per-pathway fixes in one session. Writing a duplicate of it, four days later, without
 * checking whether it existed, is that circle closing.
 *
 * SO THE SPLIT IS DELIBERATE AND THE TWO ARE NOT THE SAME JOB:
 *   lookup.js   a miss must be DECLARED       — what to do when an answer is ABSENT
 *   names.js    a name must be DERIVED        — how to ask the question CORRECTLY in the first place
 * They compose: derive the key here, resolve the miss there.
 *
 * WHAT THIS ONE IS FOR. Seven lookups in one evening were TYPED where they should have been derived:
 *
 *   Excadrill's stone is EXCADRITE, not `Excadrillite` — typed from the pattern, matched nothing, and
 *     reported "Mega Excadrill is on 0.00% of teams". It is on 78.
 *   Floette-Eternal's mega is `floettemega`, NOT base+'mega' — a string-munge reported 0% mega
 *     evolution for a body that megas 96.1% of the time. That is WIRE 132's assumption, made again in
 *     a measurement one day later.
 *   Intimidate's tag is `onSwitchInDrop`, not `lowersOnEntry` — the derived set came back EMPTY and a
 *     swarm config silently accepted every team while reporting 100% coverage.
 *   Weather abilities are `weatherSetter`, not `setsWeather` — same failure, caught only because the
 *     first one had just forced a guard into existence.
 *   A case-sensitive scan for "Floette" against a store keyed `floettemega` returned 3, and a
 *     10.5%-of-sides mechanic was called "essentially zero exposure".
 *
 * EVERY ONE FAILED THE SAME WAY: a guessed name matched nothing, the empty result looked like a real
 * measurement of zero, and nothing complained. THE RULE HERE: A LOOKUP THAT MATCHES NOTHING IS AN
 * ERROR, NOT AN EMPTY SET.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const D = (...p) => path.join(ROOT, ...p);

/* ONE NORMALISER. The store, the dex and tags.json all key differently — `Floette-Eternal`,
 * `floetteeternal`, `Floette-Eternal`. Every comparison in this project should route through here so
 * a hyphen or a capital can never be the reason two things "differ". */
const id = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

let _T = null;
const tags = () => (_T = _T || JSON.parse(fs.readFileSync(D('data', 'tags.json'), 'utf8')));

/* Every tag name that actually exists, per section. A typo is caught HERE, at the call, instead of
 * becoming an empty set that reads as a measurement. */
let _KNOWN = null;
function knownTags(sec) {
  if (!_KNOWN) {
    _KNOWN = {};
    const T = tags();
    for (const s of ['moves', 'abilities', 'items']) {
      _KNOWN[s] = new Set();
      for (const o of Object.values(T[s] || {})) {
        for (const t of (o.tags || [])) _KNOWN[s].add(typeof t === 'string' ? t : t.tag);
      }
    }
  }
  return _KNOWN[sec] || new Set();
}

function tagsOf(sec, key) {
  const o = (tags()[sec] || {})[id(key)];
  return o ? (o.tags || []).map(t => (typeof t === 'string' ? t : t.tag)) : [];
}

/* THROWS on an unknown tag name. This is the guard that would have caught `lowersOnEntry` and
 * `setsWeather` at the moment they were written instead of after a run produced a confident zero. */
function byTag(sec, ...names) {
  const known = knownTags(sec);
  const bad = names.filter(n => !known.has(n));
  if (bad.length) {
    throw new Error(`names.byTag: no ${sec} tag named ${bad.map(b => `"${b}"`).join(', ')}. `
      + `Did you mean one of: ${[...known].filter(k => bad.some(b => k.toLowerCase().includes(b.toLowerCase().slice(0, 5)) || b.toLowerCase().includes(k.toLowerCase().slice(0, 5)))).slice(0, 6).join(', ') || '(no near match — see data/tags.json)'}`);
  }
  const want = new Set(names);
  return new Set(Object.entries(tags()[sec] || {})
    .filter(([, o]) => (o.tags || []).some(t => want.has(typeof t === 'string' ? t : t.tag)))
    .map(([k]) => k));
}

/* MEGA EVOLUTION, DERIVED FROM THE DEX. `item.megaStone` maps BASE NAME -> MEGA NAME directly, so
 * neither the stone's name nor the forme's name is ever constructed by string arithmetic.
 * base+'-mega' is WRONG for Floette-Eternal -> Floette-Mega, and that exact assumption was WIRE 132. */
let _MEGA = null;
function megaTable() {
  if (_MEGA) return _MEGA;
  require('./showdown_path.js');
  const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
  const REGS = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
  const active = (REGS.regulations || {})[REGS.active];
  const dex = Dex.forFormat(active && active.showdownFormat);
  _MEGA = {};
  for (const it of dex.items.all()) {
    if (it.isNonstandard || !it.megaStone) continue;
    for (const [base, forme] of Object.entries(it.megaStone)) {
      _MEGA[id(base)] = { stone: id(it.name), forme: id(forme), stoneName: it.name, formeName: forme };
    }
  }
  return _MEGA;
}
function mega(species) {
  const m = megaTable()[id(species)];
  if (!m) throw new Error(`names.mega: "${species}" has no mega stone in this format. `
    + `Check the species is spelled as the dex has it, or use lookup.canMega() to test first.`);
  return m;
}
const canMega = species => !!megaTable()[id(species)];

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)
    && process.argv.includes('--selftest')) {
  /* Every case here is a mistake that was actually made on 2026-08-06. */
  let bad = 0;
  /* THE ASSERTION HELPER PRINTS WHY IT FAILED. A selftest that swallows the exception tells you a
   * case failed and not what went wrong, which is the same silent-failure shape this repo ratchets on
   * — and it would be an unusually bad place for it, since several of these cases EXPECT a throw. */
  const t = (label, fn) => {
    let ok = false, err = null;
    try { ok = fn(); } catch (e) { ok = false; err = (e && e.message) || String(e); }
    if (!ok) bad++;
    console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + label);
    if (!ok && err) console.log('         threw: ' + String(err).split('\n')[0].slice(0, 120));
  };
  /* Cases that EXPECT a throw use this, so an unexpected message still surfaces. */
  /* KEEPS THE MESSAGE. A case that expects a throw still cares WHICH throw — a TypeError from a bug
   * would satisfy a bare `catch { return true }` and pass while proving nothing, which is the same
   * false-agreement this whole module exists to remove. The message is recorded and printed. */
  const thrown = [];
  const throws = (fn) => {
    try { fn(); return false; }
    catch (e) { thrown.push(String((e && e.message) || e).split('\n')[0].slice(0, 90)); return true; }
  };

  t('id() makes Floette-Eternal and floetteeternal the same key', () => id('Floette-Eternal') === id('floetteeternal'));
  t("mega('floette-eternal').forme is NOT base+'mega'", () => { const m = mega('floette-eternal'); return m.forme === 'floettemega' && m.forme !== 'floetteeternalmega'; });
  t("mega('excadrill').stone is excadrite, not excadrillite", () => mega('excadrill').stone === 'excadrite');
  /* THE FIXTURE IS DERIVED TOO, and the first draft was not. It asserted `mega('garchomp')` throws —
   * on the assumption Garchomp has no mega. IT DOES in Champions, so the test failed and the module
   * was right. That is the same mistake this file exists to prevent, made inside the file's own
   * selftest, which is exactly why the no-mega species is now READ from the table rather than named. */
  const noMega = (() => {
    require('./showdown_path.js');
    const { Dex } = require(process.env.SHOWDOWN_PATH + '/dist/sim');
    const REGS = JSON.parse(fs.readFileSync(D('data', 'regulations.json'), 'utf8'));
    const dex = Dex.forFormat(((REGS.regulations || {})[REGS.active] || {}).showdownFormat);
    const tbl = megaTable();
    for (const s of dex.species.all()) if (!s.isNonstandard && !tbl[id(s.name)]) return s.name;
    return null;
  })();
  t(`mega() THROWS on a species with no stone (derived: ${noMega})`, () => throws(() => mega(noMega)));
  t('canMega() answers without throwing, both ways', () => canMega('charizard') === true && canMega(noMega) === false);
  t("byTag THROWS on 'lowersOnEntry' (the real tag is onSwitchInDrop)", () => throws(() => byTag('abilities', 'lowersOnEntry')));
  t("byTag THROWS on 'setsWeather' for abilities (the real tag is weatherSetter)", () => throws(() => byTag('abilities', 'setsWeather')));
  t('byTag returns a NON-EMPTY set for a real tag', () => byTag('abilities', 'onSwitchInDrop').size > 0);
  t('byTag returns a NON-EMPTY set for weatherSetter', () => byTag('abilities', 'weatherSetter').size > 0);
  t('tagsOf normalises its key', () => tagsOf('moves', 'Trick Room').includes('reversesSpeed'));
  /* THE POINT OF THE WHOLE FILE: a wrong name must never come back as a quiet empty answer. */
  t('no lookup here can return an empty result for a wrong name — it throws instead', () => {
    return [() => byTag('moves', 'notATag'), () => byTag('items', 'alsoNot'), () => mega('notAMon')]
      .every(f => throws(f));
  });
  console.log(`\nNAMES SELFTEST: ${11 - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

module.exports = { id, tagsOf, byTag, knownTags, mega, canMega, megaTable };
