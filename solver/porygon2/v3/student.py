"""solver/porygon2/v3/student.py -- PORYGON2 v3 step C: distil PORYGON2 v2 into a FAST student (solver/porygon2/v3/DESIGN.md §4).

    python solver/porygon2/v3/student.py teacher --data <v2 tensors root> --teacher <v2 B/model.pt> --out <dir>
    python solver/porygon2/v3/student.py train   --data <v2 tensors root> --teacher-cache <dir> --out <dir> [--epochs 12] [--threads 4]
    python solver/porygon2/v3/student.py export  --model <dir>/model.pt --out <json> --fixture <json> [--rows 24]

THE TEACHER. PORYGON2 v2 (K = 1, stage B; the file solver/porygon2/v2/model/porygon2-v2-k1.json was exported from it). Its
value logit and its pooled auxiliary distributions are computed ONCE, in eval mode, for every position of every TRAIN and
VAL game of v2's own tensors (encode.js, release eaa5becc54eb), and cached per shard. TEST rows are never read: the
evaluation set's bo1 games are v2's TEST games, so a student that saw them would be scored on its own training data.

THE STUDENT. The same input tensors as v2 (so the same encoder, features.js, serves both in Node) and a forward pass sized
to the gen5 net's cost: one shared member MLP (v2's embeddings and numbers -> 48 -> 32), mean and max pooling per side (the
six members are a set), side, field and rating codes, and a 64-unit head; antisymmetric by construction like v2:
logit = g(p1, p2) - g(p2, p1). No attention.

THE LOSS (Hinton, Vinyals and Dean 2015). Binary cross-entropy against the teacher's probability sigmoid(teacher logit)
(the soft target), plus 0.25 x the same against each pooled auxiliary head's teacher distribution (material, final HP
difference as MSE, next faint side and delay, turns left). The outcome z is NOT a target: the student is asked to be v2,
fast. Every position of a TRAIN game is used every epoch (the AlphaGo overfitting came from one shared OUTCOME per game;
here every position has its own teacher target). Selection: the epoch with the lowest VAL distillation loss. Reported per
epoch: student-teacher logit MSE and KL, and both nets' log-loss against the outcome on VAL. A checkpoint every epoch,
with resume. BELOW_NORMAL from inside the process.
"""
import argparse, base64, ctypes, hashlib, json, math, os, sys, time
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('cmd', choices=['teacher', 'train', 'export'])
ap.add_argument('--data', default='solver/out/p2v3/v2data')
ap.add_argument('--teacher', default='solver/out/p2v3/v2data/runs/k1/B/model.pt')
ap.add_argument('--teacher-cache', default='solver/out/p2v3/teacher')
ap.add_argument('--out', default='solver/out/p2v3/student')
ap.add_argument('--model', default='')
ap.add_argument('--fixture', default='')
ap.add_argument('--rows', type=int, default=24)
ap.add_argument('--epochs', type=int, default=12)
ap.add_argument('--lr', type=float, default=2e-3)
ap.add_argument('--wd', type=float, default=1e-4)
ap.add_argument('--bs', type=int, default=1024)
ap.add_argument('--aux', type=float, default=0.25)
ap.add_argument('--seed', type=int, default=1)
ap.add_argument('--threads', type=int, default=4)
ap.add_argument('--hidden', type=int, default=32)
ap.add_argument('--patience', type=int, default=3)
ap.add_argument('--max-rows', type=int, default=0, help='debug: cap train rows')
args = ap.parse_args()

if os.name == 'nt':
    try: ctypes.windll.kernel32.SetPriorityClass(ctypes.windll.kernel32.GetCurrentProcess(), 0x00004000)
    except Exception as e: print('could not lower priority:', e)

import torch
import torch.nn as nn
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'v2'))
import net as NT

torch.set_num_threads(args.threads); torch.set_num_interop_threads(1)
torch.manual_seed(args.seed); np.random.seed(args.seed)
T0 = time.time()
log = lambda *a: print(f'[{time.time() - T0:7.1f}s]', *a, flush=True)
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()
AUX = ['mat', 'nks', 'nkd', 'tl']          # categorical pooled heads (+ hpd, regression)


class Student(nn.Module):
    def __init__(self, VOC, TN, SN, FN, KN, D=NT.DIMS, h=32):
        super().__init__()
        self.h = h
        self.e_sp = nn.Embedding(len(VOC['species']), D['sp']); self.e_it = nn.Embedding(len(VOC['item']), D['it'])
        self.e_ab = nn.Embedding(len(VOC['ability']), D['ab']); self.e_mv = nn.Embedding(len(VOC['move']), D['mv'])
        for e in [self.e_sp, self.e_it, self.e_ab, self.e_mv]: nn.init.normal_(e.weight, std=0.1)
        tin = TN + 2 * D['sp'] + 2 * D['it'] + 2 * D['ab'] + D['mv']
        self.m1 = nn.Linear(tin, 48); self.m2 = nn.Linear(48, h)
        self.sp = nn.Linear(SN + KN, 16); self.fp = nn.Linear(FN, 16)
        self.e_rb = nn.Embedding(NT.NBINS, 8); nn.init.normal_(self.e_rb.weight, std=0.1)
        self.r_c = nn.Parameter(torch.randn(8) * 0.1)
        zin = 4 * h + 16 + 16 + 16 + 8 + 8 + 2
        self.h1 = nn.Linear(zin, 64); self.h2 = nn.Linear(64, 1)
        self.a_mat = nn.Linear(64, 9); self.a_hpd = nn.Linear(64, 1); self.a_nks = nn.Linear(64, 4); self.a_nkd = nn.Linear(64, 4); self.a_tl = nn.Linear(64, 5)

    def members(self, B):
        ti = B['ti']
        mv = self.e_mv(ti[..., 6:10]).mean(-2)
        x = torch.cat([B['tn'], self.e_sp(ti[..., 0]), self.e_sp(ti[..., 1]), self.e_it(ti[..., 2]), self.e_it(ti[..., 3]),
                       self.e_ab(ti[..., 4]), self.e_ab(ti[..., 5]), mv], -1)
        return torch.relu(self.m2(torch.relu(self.m1(x))))               # [B,2,6,h]

    def g(self, P, side, fd, B, a, b, bins, cont):
        ra = self.e_rb(bins[:, a]) + cont[:, a:a + 1] * self.r_c; rb = self.e_rb(bins[:, b]) + cont[:, b:b + 1] * self.r_c
        bs = B['bs'] if a == 0 else -B['bs']                      # v2's own base term, negated for the swapped chairs
        z = torch.cat([P[:, a], P[:, b], side[:, a], side[:, b], fd, ra, rb, bs], -1)
        hid = torch.relu(self.h1(z))
        return self.h2(hid).squeeze(-1), hid

    def forward(self, B, aux=False):
        H = self.members(B)
        P = torch.cat([H.mean(2), H.max(2).values], -1)                   # [B,2,2h]
        side = torch.relu(self.sp(torch.cat([B['sd'], B['fc']], -1)))     # [B,2,16]
        fd = torch.relu(self.fp(B['fd']))
        bins, cont = NT.rating_parts(B['rt'])
        v12, h12 = self.g(P, side, fd, B, 0, 1, bins, cont)
        v21, h21 = self.g(P, side, fd, B, 1, 0, bins, cont)
        logit = v12 - v21
        if not aux: return logit
        return logit, {t: dict(mat=self.a_mat(hh), hpd=self.a_hpd(hh).squeeze(-1), nks=self.a_nks(hh), nkd=self.a_nkd(hh), tl=self.a_tl(hh)) for t, hh in (('12', h12), ('21', h21))}


def load_data():
    D = {f: NT.Data(args.data, f) for f in ('bo1', 'bo3')}
    return D


# ------------------------------------------------------------------ teacher
def teacher():
    ck = torch.load(args.teacher, map_location='cpu', weights_only=False)
    T = NT.Net(ck['vocab'], ck['TN'], ck['SN'], ck['FN'], ck['KN'], drop=0.0); T.load_state_dict(ck['state']); T.eval()
    D = load_data()
    os.makedirs(args.teacher_cache, exist_ok=True)
    counts = {}
    for f, Df in D.items():
        for s in Df.shards: s.remap_to(ck['vocab'])
        for si, S in enumerate(Df.shards):
            split = S.M[:, S.col['split']]
            rows = np.nonzero(split != 2)[0]                              # TRAIN and VAL only; TEST is never read
            lg = np.full(S.N, np.nan, np.float32); aux = {k: np.full((S.N, n), np.nan, np.float32) for k, n in (('mat', 9), ('nks', 4), ('nkd', 4), ('tl', 5))}
            hpd = np.full(S.N, np.nan, np.float32)
            with torch.no_grad():
                for i in range(0, len(rows), 4096):
                    r = rows[i:i + 4096]
                    B, _ = Df.batch(np.full(len(r), si), r)
                    out, A = T(B, aux=True)
                    lg[r] = out.numpy()
                    a = A['12']
                    for k in ('mat', 'nks', 'nkd', 'tl'): aux[k][r] = torch.softmax(a[k], -1).numpy()
                    hpd[r] = a['hpd'].numpy()
            d = os.path.join(args.teacher_cache, f, os.path.basename(S.dir)); os.makedirs(d, exist_ok=True)
            np.save(os.path.join(d, 'logit.npy'), lg); np.save(os.path.join(d, 'hpd.npy'), hpd)
            for k, v in aux.items(): np.save(os.path.join(d, k + '.npy'), v)
            counts[f + '/' + os.path.basename(S.dir)] = {'rows': int(S.N), 'scored': int(len(rows)), 'test_rows_skipped': int((split == 2).sum())}
            log(f'teacher {f} {os.path.basename(S.dir)}: {len(rows)} rows (test skipped {(split == 2).sum()})')
    json.dump({'what': 'PORYGON2 v2 teacher outputs (solver/porygon2/v3/student.py teacher), TRAIN and VAL rows only',
               'teacher': {'path': args.teacher.replace('\\', '/'), 'sha256': sha(args.teacher)}, 'release': D['bo1'].release,
               'inputs': {f: D[f].input_sha256 for f in D}, 'counts': counts, 'seconds': round(time.time() - T0)},
              open(os.path.join(args.teacher_cache, 'manifest.json'), 'w'), indent=1)


# ------------------------------------------------------------------ train
def train():
    ck = torch.load(args.teacher, map_location='cpu', weights_only=False)
    VOC = ck['vocab']
    D = load_data()
    TC = {}
    for f, Df in D.items():
        for s in Df.shards: s.remap_to(VOC)
        TC[f] = []
        for S in Df.shards:
            d = os.path.join(args.teacher_cache, f, os.path.basename(S.dir))
            TC[f].append({k: np.load(os.path.join(d, k + '.npy')) for k in ('logit', 'hpd', 'mat', 'nks', 'nkd', 'tl')})
    TN, SN, FN, KN = D['bo1'].TN, D['bo1'].SN, D['bo1'].FN, D['bo1'].KN
    model = Student(VOC, TN, SN, FN, KN, h=args.hidden)
    nparams = sum(p.numel() for p in model.parameters())
    # every position of every TRAIN game, both formats; VAL rows fixed for selection
    def rows(split):
        out = []
        for f, Df in D.items():
            for si, S in enumerate(Df.shards):
                r = np.nonzero(S.M[:, S.col['split']] == split)[0]
                out += [(f, si, r)]
        return out
    TR, VA = rows(0), rows(1)
    for f, si, r in TR + VA:
        assert not (D[f].shards[si].M[r, D[f].shards[si].col['split']] == 2).any(), 'a TEST row reached the student'
        assert np.isfinite(TC[f][si]['logit'][r]).all(), 'a row without a teacher target'
    tr_list = [(f, si, int(x)) for f, si, r in TR for x in r]
    if args.max_rows: tr_list = tr_list[:args.max_rows]
    rng = np.random.default_rng(args.seed)
    va_rng = np.random.default_rng(1234)
    va_list = [(f, si, int(x)) for f, si, r in VA for x in va_rng.choice(r, size=min(len(r), 6000), replace=False)]
    log(f'student params {nparams}; train rows {len(tr_list)}; val rows {len(va_list)}; release {D["bo1"].release}')
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.wd)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=max(1, args.epochs))
    os.makedirs(args.out, exist_ok=True)

    def assemble(items):
        by = {}
        for k, (f, si, r) in enumerate(items): by.setdefault((f, si), []).append((k, r))
        Bs, Ts, order, Z = [], [], [], []
        for (f, si), lst in by.items():
            idx = np.array([x[0] for x in lst]); rr = np.array([x[1] for x in lst])
            B, lab = D[f].batch(np.full(len(rr), si), rr)
            Bs.append(B); order.append(idx); Z.append(lab['z'])
            T = TC[f][si]; Ts.append({k: T[k][rr] for k in T})
        idx = np.concatenate(order); inv = np.empty(len(idx), np.int64); inv[idx] = np.arange(len(idx))
        B = {k: torch.cat([b[k] for b in Bs])[inv] for k in Bs[0]}
        T = {k: torch.from_numpy(np.concatenate([t[k] for t in Ts])[inv]) for k in Ts[0]}
        return B, T, np.concatenate(Z)[inv]

    bce = nn.BCEWithLogitsLoss()
    def loss_of(B, T, aux=True):
        logit, A = model(B, aux=True)
        main = bce(logit, torch.sigmoid(T['logit']))
        if not aux or args.aux <= 0: return main, main, logit
        a = A['12']; la = 0.0
        for k in ('mat', 'nks', 'nkd', 'tl'): la = la - (T[k] * torch.log_softmax(a[k], -1)).sum(-1).mean()
        la = la + ((a['hpd'] - T['hpd']) ** 2).mean()
        return main + args.aux * la, main, logit

    def evaluate(lst):
        model.eval(); L, S, Tt, Z = [], [], [], []
        with torch.no_grad():
            for i in range(0, len(lst), 4096):
                B, T, z = assemble(lst[i:i + 4096])
                _, main, lg = loss_of(B, T, aux=False)
                L.append(float(main) * len(z)); S.append(lg.double().numpy()); Tt.append(T['logit'].double().numpy()); Z.append(z)
        s = np.concatenate(S); t = np.concatenate(Tt); z = np.concatenate(Z)
        p, q = 1 / (1 + np.exp(-t)), 1 / (1 + np.exp(-s))
        kl = float(np.mean(p * (np.log(p + 1e-12) - np.log(q + 1e-12)) + (1 - p) * (np.log(1 - p + 1e-12) - np.log(1 - q + 1e-12))))
        return {'distill_bce': sum(L) / len(z), 'kl': kl, 'logit_mse': float(np.mean((s - t) ** 2)), 'll_student': float(NT.ll(s, z).mean()), 'll_teacher': float(NT.ll(t, z).mean()), 'n': int(len(z))}

    history, best, start = [], (1e9, None, -1), 0
    CK = os.path.join(args.out, 'ckpt.pt')
    if os.path.exists(CK):
        C = torch.load(CK, map_location='cpu', weights_only=False)
        model.load_state_dict(C['model']); opt.load_state_dict(C['opt']); sched.load_state_dict(C['sched'])
        rng.bit_generator.state = C['rng']; history = C['history']; best = C['best']; start = C['epoch'] + 1
        log(f'RESUMED after epoch {C["epoch"]}')
    for ep in range(start, args.epochs):
        t = time.time(); model.train(); perm = rng.permutation(len(tr_list)); tot = 0.0; nb = 0
        for s in range(0, len(perm), args.bs):
            B, T, _ = assemble([tr_list[j] for j in perm[s:s + args.bs]])
            opt.zero_grad(); loss, main, _ = loss_of(B, T); loss.backward(); opt.step(); tot += float(main); nb += 1
        sched.step()
        ev = evaluate(va_list)
        rec = dict(epoch=ep, train_distill=tot / max(1, nb), seconds=round(time.time() - t, 1), **ev); history.append(rec)
        log(f'epoch {ep}: train {rec["train_distill"]:.5f} val distill {ev["distill_bce"]:.5f} kl {ev["kl"]:.5f} logit-mse {ev["logit_mse"]:.4f} | ll student {ev["ll_student"]:.5f} teacher {ev["ll_teacher"]:.5f} ({rec["seconds"]}s)')
        if ev['distill_bce'] < best[0]: best = (ev['distill_bce'], {k: v.clone() for k, v in model.state_dict().items()}, ep)
        C = {'epoch': ep, 'model': model.state_dict(), 'opt': opt.state_dict(), 'sched': sched.state_dict(), 'rng': rng.bit_generator.state, 'history': history, 'best': best}
        torch.save(C, CK + '.tmp'); os.replace(CK + '.tmp', CK)
        if args.patience and ep - best[2] >= args.patience: log('no val improvement: stop'); break
    model.load_state_dict(best[1])
    out = {'state': model.state_dict(), 'vocab': VOC, 'TN': TN, 'SN': SN, 'FN': FN, 'KN': KN, 'hidden': args.hidden, 'names': D['bo1'].nm, 'release': D['bo1'].release, 'flags': vars(args)}
    mp = os.path.join(args.out, 'model.pt'); torch.save(out, mp)
    json.dump({'what': 'PORYGON2 v3 student (distilled from v2)', 'flags': vars(args), 'params': nparams, 'release': D['bo1'].release,
               'teacher': {'path': args.teacher.replace('\\', '/'), 'sha256': sha(args.teacher)}, 'teacher_cache': json.load(open(os.path.join(args.teacher_cache, 'manifest.json'))),
               'train_rows': len(tr_list), 'val_rows': len(va_list), 'selected_epoch': best[2], 'history': history,
               'model': {'path': mp.replace('\\', '/'), 'sha256': sha(mp)}, 'seconds': round(time.time() - T0), 'torch': torch.__version__},
              open(os.path.join(args.out, 'metrics.json'), 'w'), indent=1)
    log('selected epoch', best[2], 'wrote', mp)


# ------------------------------------------------------------------ export
def export():
    ck = torch.load(args.model, map_location='cpu', weights_only=False)
    m = Student(ck['vocab'], ck['TN'], ck['SN'], ck['FN'], ck['KN'], h=ck['hidden']); m.load_state_dict(ck['state']); m.eval()
    b64 = lambda t: base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode('ascii')
    J = {'model': 'PORYGON2 v3 student (distilled from v2 k1)', 'arch': 'v3-student', 'feature_version': 'porygon2-v2.0', 'hidden': ck['hidden'],
         'release': ck['release'], 'names': {k: ck['names'][k] for k in ('tok', 'ids', 'id_kinds', 'side', 'field', 'facts')}, 'vocab': ck['vocab'],
         'rating_edges': NT.RATING_EDGES, 'source_checkpoint': {'path': args.model.replace('\\', '/'), 'sha256': sha(args.model)}, 'flags': ck['flags'],
         'exported': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'torch': torch.__version__,
         'weights': {k: {'shape': list(v.shape), 'f32_b64': b64(v)} for k, v in m.state_dict().items() if not k.startswith('a_')}}
    s = json.dumps(J, separators=(',', ':'))
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    open(args.out, 'w', encoding='utf8').write(s)
    digest = hashlib.sha256(s.encode('utf8')).hexdigest()
    print('wrote', args.out, len(s), 'bytes sha256', digest)
    if not args.fixture: return
    m64 = Student(ck['vocab'], ck['TN'], ck['SN'], ck['FN'], ck['KN'], h=ck['hidden']).double()
    Jr = json.loads(s)
    sd = m64.state_dict()
    for k, w in Jr['weights'].items(): sd[k] = torch.from_numpy(np.frombuffer(base64.b64decode(w['f32_b64']), dtype='<f4').reshape(w['shape']).copy()).double()
    m64.load_state_dict(sd); m64.eval()
    D = NT.Data(args.data, 'bo3')
    for sh in D.shards: sh.remap_to(ck['vocab'])
    rng = np.random.default_rng(7)
    val = np.nonzero(D.g_split == 1)[0]
    games = rng.choice(val, size=args.rows, replace=False)
    shs, rws = D.rows_of(games, 1, rng)
    rows = []
    for si, r in zip(shs, rws):
        S = D.shards[si]
        B, _ = D.batch(np.array([si]), np.array([r]))
        rt = B['rt'].clone()
        if len(rows) % 3 == 1: rt[0, 1] = float('nan')
        B['rt'] = rt
        Bd = {k: (v.double() if v.dtype.is_floating_point else v) for k, v in B.items()}
        with torch.no_grad(): lg = float(m64(Bd)[0])
        inv = {k: {v: s2 for s2, v in S.meta['vocab'][k].items()} for k in S.meta['vocab']}
        ids = np.asarray(S.ids[r]); kinds = S.meta['names']['id_kinds']
        x = {'tok': {sd_: np.asarray(S.tok[r][k]).astype(float).tolist() for k, sd_ in enumerate(['p1', 'p2'])},
             'ids': {sd_: [[inv[kinds[j]][int(ids[k, t, j])] for j in range(len(kinds))] for t in range(6)] for k, sd_ in enumerate(['p1', 'p2'])},
             'side': {sd_: np.asarray(S.side[r][k]).astype(float).tolist() for k, sd_ in enumerate(['p1', 'p2'])},
             'field': np.asarray(S.field[r]).astype(float).tolist(),
             'facts': {sd_: np.asarray(S.facts[r][k]).astype(float).tolist() for k, sd_ in enumerate(['p1', 'p2'])},
             'base': np.asarray(S.base[r]).astype(float).tolist(),
             'rating': [None if np.isnan(v) else float(v) for v in rt[0].numpy().tolist()]}
        rows.append({'shard': os.path.basename(S.dir), 'row': int(r), 'python_logit': lg, 'x': x})
    os.makedirs(os.path.dirname(os.path.abspath(args.fixture)), exist_ok=True)
    json.dump({'what': 'PORYGON2 v3 student Node/Python agreement: raw encoded rows (bo3 VAL) and the float64 logits of the exported weights',
               'model': {'path': args.out.replace('\\', '/'), 'sha256': digest}, 'rows': rows}, open(args.fixture, 'w', encoding='utf8'))
    print('fixture', args.fixture, len(rows), 'rows')


{'teacher': teacher, 'train': train, 'export': export}[args.cmd]()
