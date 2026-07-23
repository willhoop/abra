"""JOLTEON — model sanity tests. python tests/test-jolteon.py"""
import json, numpy as np, os, sys
idn=lambda s:''.join(c for c in (s or '').lower() if c.isalnum())
M=json.load(open('data/jolteon-weights.json')); idx={s:i for i,s in enumerate(M['species'])}; w=np.array(M['w'])
def P(A,B):
    v=np.zeros(len(w))
    for s in A: 
        if idn(s) in idx: v[idx[idn(s)]]+=1
    for s in B:
        if idn(s) in idx: v[idx[idn(s)]]-=1
    return float(1/(1+np.exp(-(v@w))))
A=['garchomp','incineroar','pelipper','archaludon','amoonguss','gholdengo']
B=['kingambit','whimsicott','basculegion','sinistcha','farigiraf','sylveon']
pab,pba=P(A,B),P(B,A)
passed=0; failed=0
def chk(c,m):
    global passed,failed
    print(('pass  ' if c else 'FAIL  ')+m); passed+=c; failed+=(not c)
chk(abs((pab+pba)-1.0)<1e-6, f"antisymmetry: P(A,B)+P(B,A)=1  ({pab:.3f}+{pba:.3f})")
chk(abs(P(A,A)-0.5)<1e-6, "mirror match is exactly 50%")
chk(len(M['species'])>50, f"model covers the meta ({len(M['species'])} species)")
chk(0.0<pab<1.0, "probabilities are in range")
print(f"\n{passed} passed, {failed} failed"); sys.exit(1 if failed else 0)
