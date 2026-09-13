from pathlib import Path
import json,sys,statistics,math,random,csv
p=Path(sys.argv[1]);raw=json.loads(p.read_text());rows=raw['rows'];groups={}
for r in rows:groups.setdefault((r['fixture'],r['access'],r['namespaceAware']),{}).setdefault(r['variant'],{})[r['block']]=r
rng=random.Random(20260913);out=[]
for key,variants in groups.items():
 for name,blocks in variants.items():
  if name=='R1':continue
  baseline=variants['R1'];shared=sorted(set(blocks)&set(baseline))
  for b in shared:
   assert blocks[b]['checksum']==baseline[b]['checksum'],(key,b,'checksum mismatch')
  a=[statistics.median(baseline[b]['samples']) for b in shared];c=[statistics.median(blocks[b]['samples']) for b in shared]
  logs=[math.log(y/x) for x,y in zip(a,c)];ratio=math.exp(statistics.mean(logs))
  boot=sorted(math.exp(statistics.mean(rng.choices(logs,k=len(logs)))) for _ in range(10000));lo,hi=boot[249],boot[9749]
  out.append(dict(fixture=Path(key[0]).name,access=key[1],namespaceAware=key[2],variant=name,blocks=len(shared),R1ms=statistics.geometric_mean(a),candidateMs=statistics.geometric_mean(c),ratio=ratio,lo=lo,hi=hi,gate='PASS' if hi<=1.02 else 'FAIL' if lo>1.02 else 'INCONCLUSIVE'))
q=p.with_name(p.stem+'-analysis.json');q.write_text(json.dumps(out,indent=2))
with q.with_suffix('.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(out[0]));w.writeheader();w.writerows(out)
for r in out:print(f"{r['fixture']:25} {r['access']:10} ns={str(r['namespaceAware']):5} {r['variant']} {r['ratio']:.4f} [{r['lo']:.4f},{r['hi']:.4f}] {r['gate']}")
