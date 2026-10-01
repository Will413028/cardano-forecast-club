"""Synthetic scalability fixture; never describes real participants or outcomes."""
import json,platform,time,pathlib
from verify import digest,root,verify
out=pathlib.Path('var');out.mkdir(exist_ok=True)
data={'version':1,'network':'local','boundaries':'synthetic performance fixture','questions':[],'events':[],'anchors':[],'scores':[]};ledger={'network':'local','simulation':True,'entries':[]}
totals={};seq=0
for n in range(20):
 qid=f'question_{n:02}';record={'id':qid,'title':'Synthetic benchmark question','deadline':'2026-10-01T01:00:00.000Z','rule':'Synthetic fixture, no external outcome claim','source':{'type':'github_release','repository':'nodejs/node','publishedAfter':'2026-10-01T00:00:00.000Z','tagPattern':''}}
 resolution={'id':f'resolution_{n}','questionId':qid,'outcome':n%2,'reason':'Synthetic benchmark outcome','evidence':{'fixture':True},'recordedAt':'2026-10-01T01:01:00.000Z','disputeUntil':'2026-10-08T01:01:00.000Z'}
 final={'questionId':qid,'resolutionId':resolution['id'],'status':'resolved','finalizedAt':'2026-10-08T01:02:00.000Z','disputes':[]}
 q={'id':qid,'record':record,'status':'resolved','resolution':resolution,'resolutions':[resolution],'finalization':final};data['questions'].append(q);events=[]
 for p in range(500):
  seq+=1;pid=f'participant_{p:03}';prob=p*2000
  e={'id':f'event_{seq}','seq':seq,'questionId':qid,'participantId':pid,'nickname':pid,'kind':'human','model':None,'probabilityPPM':prob,'receivedAt':'2026-10-01T00:30:00.000Z'};events.append(e)
  t=totals.setdefault(pid,{'participantId':pid,'nickname':pid,'kind':'human','model':None,'count':0,'totalSquaredError':0,'scorePPM':0});t['count']+=1;t['totalSquaredError']+=(prob-resolution['outcome']*1000000)**2;t['scorePPM']=t['totalSquaredError']//(t['count']*1000000)
 data['events'].extend(events)
 for kind,records,upto,at in [('rules',[record],0,'2026-10-01T00:00:00.000Z'),('close',events,seq,'2026-10-01T01:00:00.000Z'),('resolution',[resolution],1,'2026-10-01T01:01:00.000Z'),('final',[final],0,'2026-10-08T01:02:00.000Z')]:
  m={'v':1,'id':digest({'questionId':qid,'kind':kind,'upto':upto}),'root':root(records),'count':len(records),'kind':kind};key=digest(m);proof={'txId':key,'network':'local','confirmedAt':at,'metadata':m};ledger['entries'].append(proof);data['anchors'].append({'id':key,'question_id':qid,'kind':kind,'upto':upto,'metadata':m,'proof':proof})
data['scores']=sorted(totals.values(),key=lambda t:(t['scorePPM'],t['participantId']))
(out/'benchmark.json').write_text(json.dumps(data));(out/'benchmark-ledger.json').write_text(json.dumps(ledger))
start=time.perf_counter();result=verify(data,ledger);elapsed=time.perf_counter()-start
assert result['scores']==data['scores'] and elapsed<=60
report={'participants':500,'questions':20,'events':10000,'seconds':round(elapsed,3),'machine':platform.platform(),'processor':platform.machine(),'passed':True};(out/'benchmark-result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
