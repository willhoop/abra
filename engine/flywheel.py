#!/usr/bin/env python3
"""ABRA · flywheel.py — the "learn and grow over time" loop, in one command.

This is the self-improvement cycle made real. Each run:
  1. (optional) generates fresh SELF-PLAY games on the open engine  [needs Node]
  2. merges them with the ladder store into a training union
  3. RETRAINS the learned components (value net; JOLTEON) on the union
  4. RE-EVALUATES on a held-out split with proper scoring
  5. reports the BEFORE -> AFTER delta, so you can SEE it get better (or not)

The more it runs, the more data, the better the value net — that's the flywheel.
Because self-play is unbiased and unlimited, this is the path past the ~2k
selection-biased human games.

  python engine/flywheel.py                 # retrain + re-eval on current data
  python engine/flywheel.py --selfplay 500  # generate 500 self-play games first, then learn
"""
import os, sys, subprocess, json, shutil, time
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LADDER = os.path.join(ROOT, 'data/games.ladder.jsonl')
SELF = os.path.join(ROOT, 'data/games.selfplay.jsonl')
UNION = os.path.join(ROOT, 'data/games.union.jsonl')
VNET = os.path.join(ROOT, 'data/value-net.json')

def run(cmd, cwd=None):
    print(f"  $ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

def read_json(p):
    try: return json.load(open(p))
    except Exception: return None

def main():
    n_sp = 0
    if '--selfplay' in sys.argv:
        try: n_sp = int(sys.argv[sys.argv.index('--selfplay') + 1])
        except Exception: n_sp = 500

    print("=== ABRA flywheel ===")
    # snapshot BEFORE
    before = read_json(VNET) or {}
    before_ll = before.get('test_logloss')

    # 1. self-play (optional; needs Node + pokemon-showdown)
    if n_sp:
        print(f"\n[1] generating {n_sp} self-play games...")
        r = run(['node', 'generate-dataset.js', str(n_sp)], cwd=os.path.join(ROOT, 'sim'))
        sys.stdout.write(r.stdout[-400:] if r.stdout else '')
        if r.returncode != 0:
            print("  (self-play step failed — is pokemon-showdown installed in sim/? continuing with existing data)")
            print('  ' + (r.stderr or '')[-300:])
    else:
        print("\n[1] skipping self-play (pass --selfplay N to generate games)")

    # 2. build the training union (dedup by id)
    print("\n[2] building training union (ladder + self-play)...")
    seen, n = set(), 0
    with open(UNION, 'w', encoding='utf-8') as out:
        for src in (LADDER, SELF):
            if not os.path.exists(src): continue
            for line in open(src, encoding='utf-8'):
                if not line.strip(): continue
                try: gid = json.loads(line).get('id')
                except Exception: continue
                if gid in seen: continue
                seen.add(gid); out.write(line); n += 1
    print(f"  union: {n} games -> {os.path.relpath(UNION, ROOT)}")

    # 3. retrain the value net on the union
    print("\n[3] retraining the learned value net on the union...")
    r = run([sys.executable, 'train_value.py', UNION], cwd=HERE)
    tail = (r.stdout or '').strip().splitlines()
    for l in tail[:8]: print('  ' + l)

    # 4. re-evaluate JOLTEON honestly (harness runs its own refit + baselines)
    print("\n[4] re-evaluating (held-out, proper scoring)...")
    r = run([sys.executable, 'eval_harness.py', UNION], cwd=HERE)
    for l in (r.stdout or '').strip().splitlines():
        if any(k in l for k in ('JOLTEON', 'coin', 'Elo', 'VERDICT', '->')): print('  ' + l)

    # 5. delta report
    after = read_json(VNET) or {}
    after_ll = after.get('test_logloss')
    print("\n=== flywheel result ===")
    if before_ll is not None and after_ll is not None:
        d = before_ll - after_ll
        arrow = 'better' if d > 0 else ('same' if abs(d) < 1e-4 else 'worse')
        print(f"  value-net held-out log-loss: {before_ll:.4f} -> {after_ll:.4f}  ({arrow}, Δ={d:+.4f})")
    else:
        print(f"  value-net held-out log-loss: {after_ll}")
    print("  Run again with more self-play to keep the wheel turning; the value net is the thing that grows.")

if __name__ == '__main__':
    main()
