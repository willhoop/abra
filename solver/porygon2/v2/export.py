"""solver/porygon2/v2/export.py -- a trained v2 checkpoint -> the JSON the Node forward pass reads, plus a parity fixture.

    python solver/porygon2/v2/export.py --model <B/model.pt> --out solver/porygon2/model/porygon2-v2.json
        --fixture solver/tests/fixtures/porygon2-v2-agreement.json [--rows 24]

The fixture holds raw encoded rows (numbers and STRING ids, the form features.js encode() returns) from bo3 VAL games and
the float64 logits of the EXPORTED float32 weights, so solver/tests/test-porygon2-v2.js can hold infer.js to <= 1e-9.
No TEST row is read.
"""
import argparse, base64, hashlib, json, os, sys, time
import numpy as np
ap = argparse.ArgumentParser()
ap.add_argument('--data', default='solver/out/porygon2-v2')
ap.add_argument('--model', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--fixture', required=True)
ap.add_argument('--rows', type=int, default=24)
ap.add_argument('--name', default='PORYGON2 v2')
args = ap.parse_args()
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import net as NT

ck = torch.load(args.model, map_location='cpu', weights_only=False)
m = NT.Net(ck['vocab'], ck['TN'], ck['SN'], ck['FN'], ck['KN'], drop=0.0); m.load_state_dict(ck['state']); m.eval()
b64 = lambda t: base64.b64encode(t.detach().cpu().float().numpy().astype('<f4').tobytes()).decode('ascii')
J = {'model': args.name, 'arch': 'v2-transformer', 'feature_version': 'porygon2-v2.0', 'dims': ck['dims'], 'release': ck['release'],
     'names': {k: ck['names'][k] for k in ('tok', 'ids', 'id_kinds', 'side', 'field', 'facts')}, 'vocab': ck['vocab'],
     'rating_edges': NT.RATING_EDGES, 'layernorm_eps': 1e-5, 'source_checkpoint': {'path': args.model.replace('\\', '/'), 'sha256': hashlib.sha256(open(args.model, 'rb').read()).hexdigest()},
     'flags': ck['flags'], 'exported': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'torch': torch.__version__,
     'weights': {k: {'shape': list(v.shape), 'f32_b64': b64(v)} for k, v in m.state_dict().items()}}
s = json.dumps(J, separators=(',', ':'))
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
open(args.out, 'w', encoding='utf8').write(s)
sha = hashlib.sha256(s.encode('utf8')).hexdigest()
print('wrote', args.out, len(s), 'bytes sha256', sha)

# float64 net from the EXPORTED weights
m64 = NT.Net(ck['vocab'], ck['TN'], ck['SN'], ck['FN'], ck['KN'], drop=0.0).double()
Jr = json.loads(s)
m64.load_state_dict({k: torch.from_numpy(np.frombuffer(base64.b64decode(w['f32_b64']), dtype='<f4').reshape(w['shape']).copy()).double() for k, w in Jr['weights'].items()})
m64.eval()
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
    if len(rows) % 3 == 1: rt[0, 1] = float('nan')            # exercise UNRATED
    B['rt'] = rt
    Bd = {k: (v.double() if v.dtype.is_floating_point else v) for k, v in B.items()}
    with torch.no_grad(): lg = float(m64(Bd)[0])
    inv = {k: {v: s2 for s2, v in S.meta['vocab'][k].items()} for k in S.meta['vocab']}
    ids = np.asarray(S.ids[r])
    kinds = S.meta['names']['id_kinds']
    x = {'tok': {sd: np.asarray(S.tok[r][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])},
         'ids': {sd: [[inv[kinds[j]][int(ids[k, t, j])] for j in range(len(kinds))] for t in range(6)] for k, sd in enumerate(['p1', 'p2'])},
         'side': {sd: np.asarray(S.side[r][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])},
         'field': np.asarray(S.field[r]).astype(float).tolist(),
         'facts': {sd: np.asarray(S.facts[r][k]).astype(float).tolist() for k, sd in enumerate(['p1', 'p2'])},
         'base': np.asarray(S.base[r]).astype(float).tolist(),
         'rating': [None if np.isnan(v) else float(v) for v in rt[0].numpy().tolist()]}
    rows.append({'shard': os.path.basename(S.dir), 'row': int(r), 'python_logit': lg, 'x': x})
os.makedirs(os.path.dirname(os.path.abspath(args.fixture)), exist_ok=True)
json.dump({'what': 'PORYGON2 v2 Node/Python agreement: raw encoded rows (bo3 VAL) and the float64 logits of the exported weights',
           'model': {'path': args.out.replace('\\', '/'), 'sha256': sha}, 'rows': rows}, open(args.fixture, 'w', encoding='utf8'))
print('fixture', args.fixture, len(rows), 'rows')
