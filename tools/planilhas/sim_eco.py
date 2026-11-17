import random, json, sys
N={'C':88,'R':24,'E':16,'L':8}
ORDER=['C','R','E','L']
def sim(p, pack=5, pity_e=0, pity_l=0, balcao=0, troca=0.0, maxp=5000, rng=random):
    have={k:set() for k in N}; dups={k:0 for k in N}
    se=sl=0; packs=0
    w=[p[k] for k in ORDER]
    def missing(k): return N[k]-len(have[k])
    while any(missing(k) for k in N):
        packs+=1; got=[rng.choices(ORDER,weights=w)[0] for _ in range(pack)]
        se+=1; sl+=1
        if pity_l and sl>=pity_l and 'L' not in got: got[-1]='L'
        if pity_e and se>=pity_e and not any(g in('E','L') for g in got): got[-2]='E'
        if 'L' in got: sl=0
        if any(g in('E','L') for g in got): se=0
        for r in got:
            i=rng.randrange(N[r])
            if i not in have[r]: have[r].add(i)
            else:
                if troca and missing(r) and rng.random()<troca:
                    # troca 1:1 por uma que falta da mesma raridade
                    have[r].add(next(j for j in range(N[r]) if j not in have[r]))
                else: dups[r]+=1
        if balcao:
            for r in N:
                while dups[r]>=balcao and missing(r):
                    dups[r]-=balcao; have[r].add(next(j for j in range(N[r]) if j not in have[r]))
        if packs>=maxp: break
    return packs
def stats(runs):
    runs=sorted(runs); n=len(runs); q=lambda x: runs[min(n-1,int(x*n))]
    return dict(p10=q(.1),mediana=q(.5),media=round(sum(runs)/n,1),p90=q(.9),
                ate60=round(sum(r<=60 for r in runs)/n,3),ate100=round(sum(r<=100 for r in runs)/n,3),ate150=round(sum(r<=150 for r in runs)/n,3))
A={'C':72,'R':21,'E':6,'L':1}; B={'C':65,'R':24,'E':9,'L':2}
C={'C':62,'R':25,'E':10,'L':3}
cen=[
 ("A. Esboço original, sozinho, sem ajuda", A, {}),
 ("B. Esboço + garantia mínima (pity 10/50)", A, dict(pity_e=10,pity_l=50)),
 ("C. Esboço + pity + balcão 5→1", A, dict(pity_e=10,pity_l=50,balcao=5)),
 ("D. Esboço + pity + balcão 5→1 + trocas", A, dict(pity_e=10,pity_l=50,balcao=5,troca=0.4)),
 ("E. Intermediário (65/24/9/2) + pity + balcão 4→1 + trocas", B, dict(pity_e=10,pity_l=50,balcao=4,troca=0.4)),
 ("F. RECOMENDADO, jogando sozinho", C, dict(pity_e=10,pity_l=30,balcao=4)),
 ("G. RECOMENDADO, com trocas", C, dict(pity_e=10,pity_l=30,balcao=4,troca=0.4)),
]
rng=random.Random(42); out=[]
for nome,p,kw in cen:
    st=stats([sim(p,rng=rng,**kw) for _ in range(2000)])
    out.append(dict(nome=nome,prob=p,params=kw,**st)); print(nome, st, flush=True)
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=1)
