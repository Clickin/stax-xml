from pathlib import Path
import subprocess,json,random,statistics,math,sys
base=Path(__file__).parent
variants=sys.argv[1].split(',')
blocks=int(sys.argv[2]) if len(sys.argv)>2 else 9
root=Path('/Users/senghyunjo/github/stax-xml')
node=subprocess.check_output(['which','node'],text=True).strip()
cases=[]
for fixture in ['midsize','large']:
 for access in ['type','name','full','lookup','event','converter']:
  for ns in ['true','false']:cases.append((str(root/f'packages/benchmark/assets/{fixture}.xml'),access,ns))
for fixture in ['attribute-heavy','mixed-utf8','catalog']:
 for access in (['converter','full','event'] if fixture=='catalog' else ['type','name','full','lookup','event']):
  for ns in ['true','false']:cases.append((str(base/f'fixtures/{fixture}.xml'),access,ns))
if '--series' in sys.argv:
 cases=[]
 for width in [0,1,2,4,8,15,16,17,24,32,64]:
  for dist in ['prefix','first','ends','cardinality','unicode']:
   for access in ['full','lookup','event']:cases.append((str(base/f'fixtures/{dist}-{width}.xml'),access,'true'))
rng=random.Random(20260913);rows=[]
output=base/('series-raw.json' if '--series' in sys.argv else 'primary-raw.json')
for block in range(blocks):
 order=cases.copy();rng.shuffle(order)
 for fixture,access,ns in order:
  vs=variants.copy();rng.shuffle(vs)
  for variant in vs:
   args=[node,str(base/'workload.mjs'),str(base/'builds'/variant),fixture,access,ns,'3','4']
   p=subprocess.run(args,text=True,capture_output=True)
   if p.returncode:raise RuntimeError((args,p.stderr))
   row=json.loads(p.stdout);row.update(block=block,variant=variant);rows.append(row)
  output.write_text(json.dumps({'seed':20260913,'blocks':blocks,'rows':rows}))
 print(f'completed block {block+1}/{blocks}',flush=True)
