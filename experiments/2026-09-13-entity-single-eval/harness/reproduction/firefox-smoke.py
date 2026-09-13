import socket,json,hashlib
from pathlib import Path
E=Path('/tmp/stax-entity-single-eval-evidence')
sock=socket.create_connection(('127.0.0.1',28479));sock.settimeout(120);sequence=0
def receive():
 prefix=b''
 while not prefix.endswith(b':'):prefix+=sock.recv(1)
 count=int(prefix[:-1]);body=b''
 while len(body)<count:body+=sock.recv(count-len(body))
 return json.loads(body)
def call(name,params):
 global sequence
 sequence+=1;data=json.dumps([0,sequence,name,params]).encode();sock.sendall(str(len(data)).encode()+b':'+data);reply=receive()
 if reply[2]:raise RuntimeError(reply[2])
 return reply[3]
receive();call('WebDriver:NewSession',{'capabilities':{'alwaysMatch':{}}});call('WebDriver:SetTimeouts',{'script':120000})
load_script="const done=arguments[arguments.length-1], variant=arguments[0]; (async()=>{window.ehelper=await import('http://127.0.0.1:28478/client');window.eapi=await import('http://127.0.0.1:28478/build/'+variant);const rows=await window.ehelper.correctness(window.eapi);const source=await(await fetch('/midsize')).text();done({rows,ordinary:window.ehelper.ordinary(window.eapi,source)});})().catch(e=>done({error:e.name,message:e.message,stack:e.stack}));"
memory_script="const done = arguments[arguments.length - 1]; const manager = Cc['@mozilla.org/memory-reporter-manager;1'].getService(Ci.nsIMemoryReporterManager); manager.minimizeMemoryUsage(() => { const rows=[]; manager.getReports((process,path,kind,units,amount,description) => { if (process.startsWith('webIsolated=http://127.0.0.1') && path.startsWith('explicit/')) rows.push({process,path,amount}); }, null, () => done(rows), null, false); });"
def heap():
 call('Marionette:SetContext',{'value':'chrome'});rows=call('WebDriver:ExecuteAsyncScript',{'script':memory_script,'args':[]})['value'];call('Marionette:SetContext',{'value':'content'});return rows
correct=[];retention=[]
for variant in ['R0','W0','A1','AT1']:
 call('WebDriver:Navigate',{'url':'http://127.0.0.1:28478/?variant='+variant})
 result=call('WebDriver:ExecuteAsyncScript',{'script':load_script,'args':[variant]})['value']
 assert 'error' not in result,result
 (E/'tests'/f'firefox-{variant}-replay.json').write_text(json.dumps(result,ensure_ascii=False))
 correct.append({'variant':variant,'scenarios':len(result['rows']),'traceSha256':hashlib.sha256(json.dumps(result['rows'],ensure_ascii=False).encode()).hexdigest(),'ordinary':result['ordinary']})
 for scenario in ['first','none']:
  for mode in ['normalized-result','positive-control']:
   call('WebDriver:ExecuteScript',{'script':'window.eRetained=null;return true;','args':[]});before=heap()
   call('WebDriver:ExecuteScript',{'script':'window.eRetained=window.ehelper.retain(window.eapi,arguments[0],arguments[1]);return true;','args':[mode,scenario]});after=heap()
   kept=call('WebDriver:ExecuteScript',{'script':'return {strings:window.eRetained.length,units:window.eRetained.reduce((n,v)=>n+v.length,0)};','args':[]})['value']
   retention.append({'variant':variant,'scenario':scenario,'mode':mode,'count':16,'beforeContentExplicitBytes':sum(x['amount'] for x in before),'afterContentExplicitBytes':sum(x['amount'] for x in after),'kept':kept,'beforeReports':before,'afterReports':after})
assert len({x['traceSha256'] for x in correct})==1
assert len({(x['ordinary']['count'],x['ordinary']['checksum']) for x in correct})==1
(E/'firefox-smoke-replay.json').write_text(json.dumps({'status':'PASS','correctness':correct,'retention':retention,'fullRetentionGate':'NOT RUN'},indent=2))
call('WebDriver:DeleteSession',{});sock.close();print('Firefox replay PASS')
