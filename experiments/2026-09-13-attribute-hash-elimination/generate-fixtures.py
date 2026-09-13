from pathlib import Path
fixtures=Path(__file__).parent/'fixtures';fixtures.mkdir(exist_ok=True)
for width in [0,1,2,4,8,15,16,17,24,32,64]:
 for dist in ['prefix','first','ends','cardinality','unicode']:
  rows=[]
  for r in range(700):
   names=[(f'common_attribute_{i}' if dist=='prefix' else f'{chr(65+i%26)}name{i}' if dist=='first' else f'a{i}z' if dist=='ends' else f'row{r}_attribute{i}' if dist=='cardinality' else f'속성{i}名前') for i in range(width)]
   rows.append('<row '+ ' '.join(f'{n}="{r+i}"' for i,n in enumerate(names))+'/>' )
  (fixtures/f'{dist}-{width}.xml').write_text('<root>'+''.join(rows)+'</root>')
  if width>0:
   first=rows[0].split('<row ',1)[1].split('=',1)[0]
   (fixtures/f'duplicate-{dist}-{width}.xml').write_text('<root>'+rows[0][:-2]+f' {first}="duplicate"/></root>')
(fixtures/'attribute-heavy.xml').write_text('<root>'+ ('<row '+ ' '.join(f'common_attribute_{i}="value{i}"' for i in range(8))+'/>')*20000+'</root>')
(fixtures/'mixed-utf8.xml').write_text('<root>'+('<항목 식별자="안녕😀" 名前="東京" donnée="café">한국어😀 &amp; 日本語</항목>')*30000+'</root>')
(fixtures/'catalog.xml').write_text('<catalog>'+''.join(f'<book id="{i}" category="science" language="en" edition="2"><title>Book {i}</title><price>12.50</price></book>' for i in range(20000))+'</catalog>')
