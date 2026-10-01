/* solver/tournaments/http.js — the ONE network door of the tournament ingest. Polite by construction.
 *
 *   const H = require('./http.js').create({ cacheDir, offline, delayMs, log })
 *   await H.get(url)            -> { status, text }   (throws on anything but 200, after its retries)
 *   await H.json(url)           -> parsed JSON
 *   H.stats()                   -> { requests, cache_hits, robots, by_host }
 *
 * THE RULES IT ENFORCES, so no caller has to remember them:
 *   - ONE request at a time, and at least `delayMs` (default 1500 ms) between two requests to the same host, raised to a
 *     host's robots.txt Crawl-delay when that is larger (vrpastes.com asks for 1 s).
 *   - robots.txt is read once per host before the first request to it, and a Disallowed path is REFUSED (an Error naming
 *     the rule), never fetched. A host whose robots.txt is missing (404) is treated as allowing everything, which is what
 *     the robots convention says; a robots fetch that fails any other way refuses the host.
 *   - An honest User-Agent naming the project and the cadence. No browser impersonation.
 *   - A 429 or a 5xx is retried twice with backoff (10 s, 30 s); anything else that is not 200 throws. A failure is LOUD:
 *     the ingest exits non-zero and the workflow fails, rather than committing a partial event.
 *   - An on-disk cache (cacheDir; solver/out/tournaments/http-cache by default, gitignored) so a re-run of the same
 *     event while developing costs no requests. `offline: true` serves ONLY the cache and throws on a miss — the tests
 *     and the dry-run fixtures use it, so a test can never touch the network.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UA = 'ABRA-tournament-ingest/1.0 (Pokemon Champions VGC research; one request at a time, weekly)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseRobots(text) {
  /* the groups that apply to us: `User-agent: *` (we claim no named agent). Returns { disallow: [pattern], allow: [], delay } */
  const out = { disallow: [], allow: [], delay: 0 };
  let applies = false, lastWasAgent = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { applies = lastWasAgent ? (applies || v === '*') : v === '*'; lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (!applies) continue;
    if (k === 'disallow' && v) out.disallow.push(v);
    else if (k === 'allow' && v) out.allow.push(v);
    else if (k === 'crawl-delay' && +v > 0) out.delay = Math.max(out.delay, +v * 1000);
  }
  return out;
}
const toRe = p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
function robotsAllows(rules, pathAndQuery) {
  /* longest match wins; Allow beats Disallow on a tie (Google's documented rule) */
  let best = null;
  for (const [kind, list] of [['allow', rules.allow], ['disallow', rules.disallow]]) {
    for (const p of list) if (toRe(p).test(pathAndQuery) && (!best || p.length > best.len || (p.length === best.len && kind === 'allow'))) best = { kind, len: p.length, p };
  }
  return !best || best.kind === 'allow' ? { ok: true } : { ok: false, rule: 'Disallow: ' + best.p };
}

function create(o) {
  const given = {}; for (const [k, v] of Object.entries(o || {})) if (v !== undefined) given[k] = v;   // an undefined option keeps the default
  o = Object.assign({ delayMs: 1500, cacheDir: path.join(__dirname, '..', 'out', 'tournaments', 'http-cache'), offline: false, log: () => {} }, given);
  const robots = new Map(), last = new Map();
  const st = { requests: 0, cache_hits: 0, robots: {}, by_host: {} };
  const keyOf = url => crypto.createHash('sha256').update(url).digest('hex').slice(0, 32);
  const cachePath = url => o.cacheDir && path.join(o.cacheDir, keyOf(url) + '.json');

  async function raw(url) {
    const u = new URL(url);
    const host = u.host;
    const wait = Math.max(o.delayMs, (robots.get(host) && robots.get(host).delay) || 0) - (Date.now() - (last.get(host) || 0));
    if (wait > 0) await sleep(wait);
    for (let attempt = 0; ; attempt++) {
      last.set(host, Date.now());
      st.requests++; st.by_host[host] = (st.by_host[host] || 0) + 1;
      let res;
      try { res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' }, redirect: 'follow' }); }
      catch (e) { if (attempt < 2) { await sleep(attempt ? 30000 : 10000); continue; } throw new Error('fetch failed: ' + url + ': ' + e.message); }
      const text = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < 2) { o.log('  ' + res.status + ' on ' + url + ', retrying'); await sleep(attempt ? 30000 : 10000); continue; }
      return { status: res.status, text };
    }
  }
  async function ensureRobots(u) {
    if (robots.has(u.host)) return robots.get(u.host);
    const r = await raw(u.protocol + '//' + u.host + '/robots.txt');
    let rules;
    if (r.status === 200 && !/^\s*</.test(r.text)) rules = parseRobots(r.text);
    else if (r.status === 404 || (r.status === 200 && /^\s*</.test(r.text))) rules = { disallow: [], allow: [], delay: 0, none: true };
    else throw new Error('robots.txt for ' + u.host + ' answered ' + r.status + ': refusing the host');
    robots.set(u.host, rules);
    st.robots[u.host] = rules.none ? 'none (404): everything allowed' : { disallow: rules.disallow, allow: rules.allow, crawl_delay_ms: rules.delay };
    return rules;
  }
  async function get(url) {
    const cp = cachePath(url);
    if (cp && fs.existsSync(cp)) { st.cache_hits++; return JSON.parse(fs.readFileSync(cp, 'utf8')); }
    if (o.offline) throw new Error('offline: no cached copy of ' + url);
    const u = new URL(url);
    const rules = await ensureRobots(u);
    const a = robotsAllows(rules, u.pathname + u.search);
    if (!a.ok) throw new Error('robots.txt of ' + u.host + ' disallows ' + u.pathname + ' (' + a.rule + '): not fetched');
    const r = await raw(url);
    if (r.status !== 200) throw new Error('HTTP ' + r.status + ' for ' + url);
    const rec = { url, status: r.status, fetched: new Date().toISOString(), text: r.text };
    if (cp) { fs.mkdirSync(path.dirname(cp), { recursive: true }); fs.writeFileSync(cp, JSON.stringify(rec)); }
    return rec;
  }
  async function json(url) { const r = await get(url); try { return JSON.parse(r.text); } catch (e) { throw new Error('not JSON: ' + url); } }
  return { get, json, stats: () => JSON.parse(JSON.stringify(st)), UA };
}

/* seed a cache directory with a page, in the exact record format get() reads (the tests build offline fixtures with it) */
function cacheWrite(cacheDir, url, text, fetched) {
  const f = path.join(cacheDir, crypto.createHash('sha256').update(url).digest('hex').slice(0, 32) + '.json');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ url, status: 200, fetched: fetched || '2026-10-01T00:00:00.000Z', text }));
  return f;
}

module.exports = { create, parseRobots, robotsAllows, cacheWrite, UA };
