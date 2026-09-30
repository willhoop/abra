"""solver/porygon2/v2/net.py -- PORYGON2 v2: the tensor reader and the net, shared by train.py and gate_a.py.

DATA. A format's tensors are the shard directories solver/porygon2/v2/encode.js wrote (tensors/s<i>/), each read through
np.memmap; a position is addressed as (shard, row). A game's positions are contiguous inside its shard, so a game is
(shard, start, n). Every shard carries its own string vocabulary; `remap` sends it to the net's.

THE NET (solver/porygon2/v2/DESIGN.md §2.4, preregistration.json "architecture"). One value g(A, B) over 17 tokens:
  12 member tokens  numeric features (v1's 81 + v2's 9 reveal numbers) ++ embeddings of species, form, item (orig, now),
                    ability (base, now) and the mean of the four move slots; UNK and NONE are their own ids -> MLP -> d
  2 side tokens     side numbers ++ that side's v0 facts -> d          1 field token     field numbers -> d
  2 rating tokens   a 100-point bin embedding (UNRATED its own bin) + (r - 1300)/200 times a learned vector
  a type embedding per token kind (my member, their member, my side, their side, field, my rating, their rating)
  2 pre-LN blocks, 4 heads, FFN 96, and in EVERY block the rating context (both rating embeddings through a linear map)
  is added to the attention queries (Maia-2's injection). No positional encoding, so the six members of a side are a set.
The value is antisymmetric by construction: logit = g(p1, p2) - g(p2, p1).
Auxiliary heads read the same pooled vector (material 9-way, final HP difference, next faint side 4-way and delay 4-way,
turns left 5-way) and each member token (survival, final HP); both chair orders are supervised, labels flipped.
"""
import json, math, os
import numpy as np
import torch
import torch.nn as nn

KINDS = ['species', 'species', 'item', 'item', 'ability', 'ability', 'move', 'move', 'move', 'move']
VKINDS = ['species', 'item', 'ability', 'move']
SPECIAL = ['<pad>', '<oov>', '<UNK>', '<NONE>']
RATING_EDGES = [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000]
NBINS = len(RATING_EDGES) + 2
DIMS = dict(sp=16, it=8, ab=8, mv=12, t1=64, d=48, heads=4, ffn=96, blocks=2, head=64)


class Shard:
    def __init__(self, d):
        self.dir = d
        self.meta = json.load(open(os.path.join(d, 'meta.json'), encoding='utf8'))
        nm = self.meta['names']; N = self.meta['N']; self.N = N; self.nm = nm
        self.TN, self.SN, self.FN, self.KN, self.NI = len(nm['tok']), len(nm['side']), len(nm['field']), len(nm['facts']), len(nm['ids'])
        mm = lambda name, dt, shape: np.memmap(os.path.join(d, name), dtype=dt, mode='r', shape=shape)
        self.tok = mm('tok.f16', '<f2', (N, 2, 6, self.TN)); self.ids = mm('ids.i16', '<i2', (N, 2, 6, self.NI))
        self.side = mm('side.f32', '<f4', (N, 2, self.SN)); self.field = mm('field.f32', '<f4', (N, self.FN))
        self.facts = mm('facts.f32', '<f4', (N, 2, self.KN))
        # the small columns are read into memory
        self.base = np.array(mm('base.f32', '<f4', (N, 2))); self.rating = np.array(mm('rating.f32', '<f4', (N, 2)))
        self.M = np.array(mm('meta.i32', '<i4', (N, len(nm['meta'])))); self.col = {c: i for i, c in enumerate(nm['meta'])}
        self.z = np.array(mm('z.f32', '<f4', (N,)), dtype=np.float64)
        self.surv = np.array(mm('surv.i8', '<i1', (N, 2, 6))); self.hpend = np.array(mm('hpend.f16', '<f2', (N, 2, 6)), dtype=np.float32)
        self.mat = np.array(mm('mat.i8', '<i1', (N,))); self.hpd = np.array(mm('hpd.f32', '<f4', (N,)))
        self.nks = np.array(mm('nks.i8', '<i1', (N,))); self.nkd = np.array(mm('nkd.i8', '<i1', (N,))); self.tl = np.array(mm('tl.i8', '<i1', (N,)))

    def remap_to(self, VOC):
        self.remap = {}
        for kind in VKINDS:
            loc = self.meta['vocab'][kind]
            r = np.ones(len(loc), dtype=np.int64)                     # default <oov>
            for s, li in loc.items(): r[li] = VOC[kind].get(s, 1)
            self.remap[kind] = r


class Data:
    """one format: its shards, its games (shard, start, n, split, ...) and batch assembly by (shard, row) pairs"""

    def __init__(self, root, fmt):
        tdir = os.path.join(root, fmt, 'tensors')
        self.fmt = fmt
        self.shards = [Shard(os.path.join(tdir, s)) for s in sorted(os.listdir(tdir)) if s.startswith('s') and os.path.exists(os.path.join(tdir, s, 'meta.json'))]
        if not self.shards: raise SystemExit('no tensors under ' + tdir)
        rel = {s.meta['engine_release'] for s in self.shards}
        if len(rel) != 1: raise SystemExit(f'{fmt}: shards from more than one engine release: {rel}')
        self.release = rel.pop()
        ins = {s.meta['input']['sha256'] for s in self.shards}
        if len(ins) != 1: raise SystemExit(f'{fmt}: shards from more than one input dataset: {ins}')
        self.input_sha256 = ins.pop()
        S0 = self.shards[0]
        for s in self.shards[1:]:
            if s.nm['tok'] != S0.nm['tok'] or s.nm['ids'] != S0.nm['ids']: raise SystemExit('feature layout differs between shards')
        self.nm = S0.nm; self.TN, self.SN, self.FN, self.KN, self.NI = S0.TN, S0.SN, S0.FN, S0.KN, S0.NI
        G = []
        for si, s in enumerate(self.shards):
            gcol = s.M[:, s.col['game']]
            starts = np.r_[0, np.nonzero(np.diff(gcol))[0] + 1]
            ends = np.r_[starts[1:], len(gcol)]
            for a, b in zip(starts, ends):
                gm = s.meta['games'][int(gcol[a])]
                G.append((si, int(a), int(b - a), gm))
        self.games = G
        self.g_shard = np.array([g[0] for g in G]); self.g_start = np.array([g[1] for g in G]); self.g_n = np.array([g[2] for g in G])
        self.g_split = np.array([{'train': 0, 'val': 1, 'test': 2}[g[3]['split']] for g in G])
        r = np.array([[np.nan if g[3]['rating']['p1'] is None else g[3]['rating']['p1'], np.nan if g[3]['rating']['p2'] is None else g[3]['rating']['p2']] for g in G], dtype=np.float64)
        self.g_unequal = (~np.isnan(r).any(1)) & (np.abs(r[:, 0] - r[:, 1]) >= 100)
        self.g_id = [g[3]['id'] for g in G]

    def rows_of(self, games, K, rng):
        """K fresh uniform positions per game (K = 0: every position), as (shard, row) arrays"""
        sh, rw = [], []
        for g in games:
            n = self.g_n[g]
            pick = np.arange(n) if K == 0 else rng.choice(n, size=min(K, n), replace=False)
            sh.append(np.full(len(pick), self.g_shard[g])); rw.append(self.g_start[g] + pick)
        if not sh: return np.zeros(0, dtype=np.int64), np.zeros(0, dtype=np.int64)
        return np.concatenate(sh), np.concatenate(rw)

    def batch(self, sh, rw, no_rating=False):
        """assemble a batch from (shard, row) pairs, in the order given"""
        n = len(sh)
        tn = np.empty((n, 2, 6, self.TN), np.float32); ti = np.empty((n, 2, 6, self.NI), np.int64)
        sd = np.empty((n, 2, self.SN), np.float32); fd = np.empty((n, self.FN), np.float32); fc = np.empty((n, 2, self.KN), np.float32)
        bs = np.empty((n, 2), np.float32); rt = np.empty((n, 2), np.float32)
        lab = {k: None for k in ['z', 'surv', 'hpend', 'mat', 'hpd', 'nks', 'nkd', 'tl', 'end', 'turn']}
        L = {k: [] for k in lab}; pos = []
        for si in np.unique(sh):
            m = np.nonzero(sh == si)[0]; r = rw[m]; o = np.argsort(r); m = m[o]; r = r[o]
            S = self.shards[si]
            tn[m] = S.tok[r]; raw = np.asarray(S.ids[r], dtype=np.int64)
            for j, kind in enumerate(KINDS): ti[m, ..., j] = S.remap[kind][raw[..., j]]
            sd[m] = S.side[r]; fd[m] = S.field[r]; fc[m] = S.facts[r]; bs[m] = S.base[r]; rt[m] = S.rating[r]
            pos.append(m)
            L['z'].append(S.z[r]); L['surv'].append(S.surv[r]); L['hpend'].append(S.hpend[r]); L['mat'].append(S.mat[r]); L['hpd'].append(S.hpd[r])
            L['nks'].append(S.nks[r]); L['nkd'].append(S.nkd[r]); L['tl'].append(S.tl[r]); L['end'].append(S.M[r, S.col['end']]); L['turn'].append(S.M[r, S.col['turn']])
        pos = np.concatenate(pos); inv = np.empty(n, np.int64); inv[pos] = np.arange(n)
        for k in L: lab[k] = np.concatenate(L[k])[inv]
        if no_rating: rt[:] = np.nan
        B = dict(tn=torch.from_numpy(tn), ti=torch.from_numpy(ti), sd=torch.from_numpy(sd), fd=torch.from_numpy(fd), fc=torch.from_numpy(fc),
                 bs=torch.from_numpy(bs), rt=torch.from_numpy(rt))
        return B, lab


def rating_parts(rt):
    """rt [B,2] float (NaN = unrated) -> bins [B,2] long, cont [B,2] float"""
    nan = torch.isnan(rt)
    r = torch.nan_to_num(rt, nan=0.0)
    bins = torch.ones_like(r, dtype=torch.long)
    for e in RATING_EDGES: bins = bins + (r > e).long()
    bins = torch.where(nan, torch.zeros_like(bins), bins)
    cont = torch.where(nan, torch.zeros_like(r), (r - 1300.0) / 200.0)
    return bins, cont


class Block(nn.Module):
    def __init__(self, d, heads, ffn, drop):
        super().__init__()
        self.H = heads; self.d = d
        self.ln1 = nn.LayerNorm(d); self.qkv = nn.Linear(d, 3 * d); self.rq = nn.Linear(2 * d, d); self.o = nn.Linear(d, d)
        self.ln2 = nn.LayerNorm(d); self.f1 = nn.Linear(d, ffn); self.f2 = nn.Linear(ffn, d); self.drop = nn.Dropout(drop)

    def forward(self, x, rc):
        Bn, T, d = x.shape; H = self.H; dh = d // H
        y = self.ln1(x)
        q, k, v = self.qkv(y).split(d, -1)
        q = q + self.rq(rc).unsqueeze(1)                                   # the rating context enters every query
        q = q.view(Bn, T, H, dh).transpose(1, 2); k = k.view(Bn, T, H, dh).transpose(1, 2); v = v.view(Bn, T, H, dh).transpose(1, 2)
        a = torch.softmax((q @ k.transpose(-1, -2)) / math.sqrt(dh), -1) @ v
        x = x + self.drop(self.o(a.transpose(1, 2).reshape(Bn, T, d)))
        return x + self.drop(self.f2(torch.relu(self.f1(self.ln2(x)))))


class Net(nn.Module):
    def __init__(self, VOC, TN, SN, FN, KN, D=DIMS, drop=0.1):
        super().__init__()
        self.D = D; d = D['d']
        self.e_sp = nn.Embedding(len(VOC['species']), D['sp']); self.e_it = nn.Embedding(len(VOC['item']), D['it'])
        self.e_ab = nn.Embedding(len(VOC['ability']), D['ab']); self.e_mv = nn.Embedding(len(VOC['move']), D['mv'])
        for e in [self.e_sp, self.e_it, self.e_ab, self.e_mv]: nn.init.normal_(e.weight, std=0.1)
        tin = TN + 2 * D['sp'] + 2 * D['it'] + 2 * D['ab'] + D['mv']
        self.t1 = nn.Linear(tin, D['t1']); self.t2 = nn.Linear(D['t1'], d)
        self.sp = nn.Linear(SN + KN, d); self.fp = nn.Linear(FN, d)
        self.e_rb = nn.Embedding(NBINS, d); nn.init.normal_(self.e_rb.weight, std=0.1)
        self.r_c = nn.Parameter(torch.randn(d) * 0.1)
        self.typ = nn.Parameter(torch.randn(7, d) * 0.1)
        self.blocks = nn.ModuleList([Block(d, D['heads'], D['ffn'], drop) for _ in range(D['blocks'])])
        self.lnf = nn.LayerNorm(d)
        zin = 7 * d + 2
        self.h1 = nn.Linear(zin, D['head']); self.h2 = nn.Linear(D['head'], 1)
        self.a_mat = nn.Linear(zin, 9); self.a_hpd = nn.Linear(zin, 1); self.a_nks = nn.Linear(zin, 4); self.a_nkd = nn.Linear(zin, 4); self.a_tl = nn.Linear(zin, 5)
        self.a_mon = nn.Linear(d, 2)
        self.drop = nn.Dropout(drop)

    def members(self, B):
        ti = B['ti']
        mv = self.e_mv(ti[..., 6:10]).mean(-2)
        x = torch.cat([B['tn'], self.e_sp(ti[..., 0]), self.e_sp(ti[..., 1]), self.e_it(ti[..., 2]), self.e_it(ti[..., 3]),
                       self.e_ab(ti[..., 4]), self.e_ab(ti[..., 5]), mv], -1)
        return self.t2(torch.relu(self.t1(x)))                              # [B,2,6,d]

    def g(self, h, B, a, b, bins, cont):
        """one chair order: a = 'me' side index, b = 'them' side index. Returns (value logit, pooled z, member codes)"""
        Bn = h.shape[0]; T = self.typ
        side = self.sp(torch.cat([B['sd'], B['fc']], -1))                  # [B,2,d]
        rme = self.e_rb(bins[:, a]) + cont[:, a:a + 1] * self.r_c; rop = self.e_rb(bins[:, b]) + cont[:, b:b + 1] * self.r_c
        x = torch.cat([h[:, a] + T[0], h[:, b] + T[1], (side[:, a] + T[2]).unsqueeze(1), (side[:, b] + T[3]).unsqueeze(1),
                       (self.fp(B['fd']) + T[4]).unsqueeze(1), (rme + T[5]).unsqueeze(1), (rop + T[6]).unsqueeze(1)], 1)   # [B,17,d]
        rc = torch.cat([rme, rop], -1)
        for blk in self.blocks: x = blk(x, rc)
        x = self.lnf(x)
        bs = B['bs'] if a == 0 else -B['bs']
        z = torch.cat([x[:, 0:6].mean(1), x[:, 6:12].mean(1), x[:, 12], x[:, 13], x[:, 14], x[:, 15], x[:, 16], bs], -1)
        v = self.h2(self.drop(torch.relu(self.h1(z)))).squeeze(-1)
        return v, z, x[:, 0:12]

    def forward(self, B, aux=False):
        h = self.members(B)
        bins, cont = rating_parts(B['rt'])
        v12, z12, m12 = self.g(h, B, 0, 1, bins, cont)
        v21, z21, m21 = self.g(h, B, 1, 0, bins, cont)
        logit = v12 - v21
        if not aux: return logit
        A = {}
        for tag, z, m in (('12', z12, m12), ('21', z21, m21)):
            A[tag] = dict(mat=self.a_mat(z), hpd=self.a_hpd(z).squeeze(-1), nks=self.a_nks(z), nkd=self.a_nkd(z), tl=self.a_tl(z), mon=self.a_mon(m))
        return logit, A


def aux_loss(A, lab):
    """the auxiliary losses, both chair orders; labels are in the p1 frame and are flipped for the 21 order. Masks: survival,
    final HP and material only for games that ended normally (not a forfeit / inactivity board); survival and final HP only
    for members that were seen; next-faint delay only when a faint follows."""
    ce = nn.functional.cross_entropy
    normal = torch.from_numpy(lab['end'] == 0)
    surv = torch.from_numpy(lab['surv'].astype(np.int64)); hpe = torch.from_numpy(np.nan_to_num(lab['hpend'], nan=0.0))
    tot = 0.0; parts = {}
    for tag in ('12', '21'):
        a = A[tag]
        sv = surv if tag == '12' else surv.flip(1)
        he = hpe if tag == '12' else hpe.flip(1)
        seen = (sv >= 0) & normal[:, None, None]
        mon = a['mon'].view(-1, 2, 6, 2)
        if seen.any():
            l_s = nn.functional.binary_cross_entropy_with_logits(mon[..., 0][seen], sv[seen].float())
            l_h = ((torch.sigmoid(mon[..., 1][seen]) - he[seen]) ** 2).mean() * 4
        else: l_s = l_h = torch.zeros(())
        mat = torch.from_numpy(lab['mat'].astype(np.int64)); hpd = torch.from_numpy(lab['hpd'].astype(np.float32))
        if tag == '21': mat = 8 - mat; hpd = -hpd
        if normal.any():
            l_m = ce(a['mat'][normal], mat[normal]); l_d = ((a['hpd'][normal] - hpd[normal]) ** 2).mean()
        else: l_m = l_d = torch.zeros(())
        nks = torch.from_numpy(lab['nks'].astype(np.int64))
        if tag == '21': nks = torch.where(nks == 0, torch.ones_like(nks), torch.where(nks == 1, torch.zeros_like(nks), nks))
        l_k = ce(a['nks'], nks)
        nkd = torch.from_numpy(lab['nkd'].astype(np.int64)); has = nkd >= 0
        l_kd = ce(a['nkd'][has], nkd[has]) if has.any() else torch.zeros(())
        l_t = ce(a['tl'], torch.from_numpy(lab['tl'].astype(np.int64)))
        for k, v in (('surv', l_s), ('hp', l_h), ('mat', l_m), ('hpd', l_d), ('nks', l_k), ('nkd', l_kd), ('tl', l_t)):
            parts[k] = parts.get(k, 0.0) + float(v.detach()) / 2
            tot = tot + v / 2
    return tot, parts


def build_vocab(datas, min_count=3):
    """an id seen >= min_count times in TRAIN rows of any format gets a row; SPECIAL ids always first"""
    VOC = {}
    for kind in VKINDS:
        cnt = {}
        for D in datas:
            for s in D.shards:
                for k, n in s.meta['train_count'][kind].items(): cnt[k] = cnt.get(k, 0) + n
        keep = SPECIAL + sorted(k for k, n in cnt.items() if k not in SPECIAL and n >= min_count)
        VOC[kind] = {k: i for i, k in enumerate(keep)}
    return VOC


def ll(logit, y):
    return np.logaddexp(0, logit) - y * logit
