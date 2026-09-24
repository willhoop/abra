/* solver/rotom/lock.js — the two-account lock and the credential reader.
 *
 * THE LOCK (SOLVER-PLAN §4, "Never two of Will's accounts at once"; §9 Q9: a lock file on this machine). A live
 * client takes a lock file before it connects and refuses to start if another ABRA client holds it:
 *
 *   - a PUBLIC server (anything that is not localhost / 127.x): ONE machine-wide lock, `abra-live-public.lock`,
 *     whatever the account. Two ABRA clients can never be on a public server at the same time.
 *   - a LOCAL server: one lock per (port, account), so a local ROTOM-vs-ROTOM test can run two different local
 *     accounts but never the same account twice.
 *
 * The lock is created with O_EXCL (`wx`) — atomic on NTFS — and holds { pid, name, server, started }. A lock
 * whose pid is no longer alive is STALE and is taken over, and the takeover is reported, never silent. The
 * directory is the OS temp dir (machine-wide for this user), or ROTOM_LOCK_DIR for tests.
 *
 * CREDENTIALS. Read only from the env var SHOWDOWN_PASS or the file data/.showdown-pass (gitignored), in that
 * order. Never from the command line, never printed, never logged: the function returns the value and a
 * `source` word, and every caller logs only the source. A local --no-security server needs none.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const isLocal = (url) => /^wss?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?\//i.test(String(url || ''));
const toID = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function lockDir() { return process.env.ROTOM_LOCK_DIR || os.tmpdir(); }
function lockPath(server, name) {
  if (!isLocal(server)) return path.join(lockDir(), 'abra-live-public.lock');
  const port = (/:(\d+)\//.exec(server) || [])[1] || '80';
  return path.join(lockDir(), 'abra-live-local-' + port + '-' + toID(name) + '.lock');
}
function alive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/* -> { path, release(), tookOverStale: null | {pid,...} }  or throws LockHeld */
function acquire(server, name, log) {
  const p = lockPath(server, name);
  const body = JSON.stringify({ pid: process.pid, name, server, started: new Date().toISOString(), client: 'ROTOM' });
  let stale = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(p, body, { flag: 'wx' });
      let released = false;
      const release = () => {
        if (released) return; released = true;
        try { const cur = JSON.parse(fs.readFileSync(p, 'utf8')); if (cur.pid === process.pid) fs.unlinkSync(p); } catch (e) { /* already gone */ }
      };
      process.on('exit', release);
      return { path: p, release, tookOverStale: stale };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let cur = null;
      try { cur = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e2) { cur = null; }
      if (cur && alive(cur.pid) && cur.pid !== process.pid) {
        const err = new Error('LOCK HELD: another ABRA client (pid ' + cur.pid + ', ' + cur.name + ' on ' + cur.server + ', since ' + cur.started + ') holds ' + p + ' — refusing to start');
        err.code = 'LOCK_HELD'; err.holder = cur;
        throw err;
      }
      stale = cur || { unreadable: true };
      if (log) log('stale lock ' + p + ' (holder ' + (cur ? 'pid ' + cur.pid + ' is not running' : 'unreadable') + ') — taking it over');
      try { fs.unlinkSync(p); } catch (e3) { /* raced: the next attempt decides */ }
    }
  }
  throw new Error('could not take the lock ' + p);
}

/* -> { pass, source: 'env' | 'file' | 'none' }. The VALUE is never logged by anything in ROTOM. */
function readPassword(root) {
  if (process.env.SHOWDOWN_PASS) return { pass: process.env.SHOWDOWN_PASS, source: 'env' };
  const ROOT = root || path.join(__dirname, '..', '..');
  const MAIN = ROOT.includes(path.sep + '.claude' + path.sep) ? ROOT.split(path.sep + '.claude' + path.sep)[0] : ROOT;
  for (const f of [path.join(ROOT, 'data', '.showdown-pass'), path.join(MAIN, 'data', '.showdown-pass')]) {
    try { const v = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').trim(); if (v) return { pass: v, source: 'file' }; }
    catch (e) { if (e.code !== 'ENOENT') return { pass: '', source: 'unreadable file (' + e.code + ')' }; }
  }
  return { pass: '', source: 'none' };
}

module.exports = { acquire, lockPath, readPassword, isLocal, alive };
