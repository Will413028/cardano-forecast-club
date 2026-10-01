#!/usr/bin/env python3
"""Independent spec implementation: standard library only, no product imports."""
import argparse
import hashlib
import json
import sys
import urllib.request
from datetime import datetime


def canonical(value):
    def validate(v):
        if v is None or isinstance(v, (str, bool)):
            return
        if isinstance(v, int) and abs(v)<=9007199254740991:
            return
        if isinstance(v, list):
            for x in v: validate(x)
            return
        if isinstance(v, dict):
            assert all(isinstance(k,str) and k and k.isascii() and all(c.isalnum() or c=='_' for c in k) for k in v)
            for x in v.values(): validate(x)
            return
        raise ValueError('Canonical records require JSON and safe integers')
    validate(value)
    encoded=json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return ''.join('\\u%04x'%ord(c) if 0xD800<=ord(c)<=0xDFFF else c for c in encoded)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def root(records):
    if not records:
        return hashlib.sha256(bytes([2])).hexdigest()
    nodes = [hashlib.sha256(bytes([0])+canonical(x).encode()).digest() for x in records]
    while len(nodes)>1:
        nodes=[hashlib.sha256(bytes([1])+nodes[i]+nodes[min(i+1,len(nodes)-1)]).digest() for i in range(0,len(nodes),2)]
    return nodes[0].hex()


def instant(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def koios(endpoint, tx):
    req=urllib.request.Request('https://preprod.koios.rest/api/v1/'+endpoint, data=json.dumps({'_tx_hashes':[tx]}).encode(), headers={'Content-Type':'application/json','User-Agent':'forecast-reference-verifier'})
    with urllib.request.urlopen(req,timeout=30) as response:
        return json.load(response)


def compute_scores(questions,events):
    totals={}
    for q in questions:
        if q['status']!='resolved' or not q.get('resolution') or q['resolution']['outcome'] is None:
            continue
        latest={}
        for e in sorted((e for e in events if e['questionId']==q['record']['id']),key=lambda e:e['seq']):
            if instant(e['receivedAt'])<instant(q['record']['deadline']):latest[e['participantId']]=e
        for e in latest.values():
            t=totals.setdefault(e['participantId'],{'participantId':e['participantId'],'nickname':e['nickname'],'kind':e['kind'],'model':e['model'],'count':0,'totalSquaredError':0,'scorePPM':0})
            t['count']+=1;t['totalSquaredError']+=(e['probabilityPPM']-q['resolution']['outcome']*1000000)**2
            t['scorePPM']=t['totalSquaredError']//(t['count']*1000000)
    return sorted(totals.values(),key=lambda t:(t['scorePPM'],t['participantId']))


def verify(data, ledger=None):
    assert data['version']==1 and data['network'] in ('local','preprod'), 'Unsupported format/network'
    seen=set()
    all_events=[]
    for q in data['questions']:
        assert q['id']==q['record']['id'] and q['id'] not in seen, 'Question identity'
        seen.add(q['id'])
        events=[e for e in data['events'] if e['questionId']==q['id']]
        ids=set();seq=0;latest={}
        for e in events:
            assert isinstance(e['seq'],int) and e['seq']>seq and e['id'] not in ids, 'Event sequence/identity'
            ids.add(e['id']);seq=e['seq']
            assert isinstance(e['probabilityPPM'],int) and 0<=e['probabilityPPM']<=1000000, 'Probability'
            assert instant(e['receivedAt'])<instant(q['record']['deadline']), 'Late event'
            latest[e['participantId']]=e
        all_events.extend(events)
        anchors=[a for a in data['anchors'] if a['question_id']==q['id']]
        assert any(a['kind']=='rules' for a in anchors), 'Missing rules commitment'
        assert any(a['kind']=='close' and a['upto']==(events[-1]['seq'] if events else 0) for a in anchors), 'Incomplete close commitment'
        for a in anchors:
            if a['kind']=='rules': records=[q['record']]
            elif a['kind'] in ('forecasts','close'): records=[e for e in events if e['seq']<=a['upto']]
            elif a['kind']=='resolution': records=q['resolutions'][:a['upto']]
            elif a['kind']=='final': records=[q['finalization']]
            else: raise ValueError('Unknown anchor kind')
            expected={'v':1,'id':digest({'questionId':q['id'],'kind':a['kind'],'upto':a['upto']}),'root':root(records),'count':len(records),'kind':a['kind']}
            assert expected==a['metadata'] and a['id']==digest(expected), 'Commitment mismatch'
            if data['network']=='local':
                assert ledger and ledger['simulation'] is True and ledger['network']=='local', 'Local simulation ledger required'
                proof=next((p for p in ledger['entries'] if p['txId']==a['proof']['txId']),None)
            else:
                tx=a['proof']['txId'];info=koios('tx_info',tx);meta=koios('tx_metadata',tx)
                assert info and meta, 'Transaction not indexed'
                proof={'network':'preprod','txId':tx,'metadata':meta[0]['metadata']['674'],'confirmedAt':datetime.fromtimestamp(info[0]['tx_timestamp'],tz=instant('2026-01-01T00:00:00Z').tzinfo).isoformat(timespec='milliseconds').replace('+00:00','Z')}
            assert proof and proof['network']==data['network'] and proof['metadata']==a['metadata'] and proof==a['proof'], 'Chain proof mismatch'
            if a['kind']=='rules' and events: assert instant(proof['confirmedAt'])<=instant(events[0]['receivedAt']), 'Late rules commitment'
            if a['kind']=='final': assert instant(proof['confirmedAt'])>=instant(q['finalization']['finalizedAt']), 'Final commitment predates finalization'
        assert q['resolution']==(q['resolutions'][-1] if q['resolutions'] else None), 'Latest resolution mismatch'
        if q['status'] in ('resolved','void'):
            final=q.get('finalization');resolution=q['resolution']
            assert final and final['status']==q['status'] and final['resolutionId']==resolution['id'], 'Final state not committed'
            assert instant(final['finalizedAt'])>=instant(resolution['disputeUntil']), 'Premature finalization'
            assert any(a['kind']=='final' for a in anchors), 'Missing final commitment'
            assert any(a['kind']=='resolution' and a['upto']==len(q['resolutions']) for a in anchors), 'Missing resolution commitment'
    assert len(all_events)==len(data['events']), 'Unknown question in events'
    scores=compute_scores(data['questions'],data['events'])
    assert scores==data['scores'], 'Score mismatch'
    return {'verified':True,'network':data['network'],'simulation':data['network']=='local','scores':scores,'warning':'Operator receipt timestamps are not independently proven by a later batch commitment.'}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('export');parser.add_argument('--ledger');args=parser.parse_args()
    try:
        data=json.load(open(args.export));ledger=json.load(open(args.ledger)) if args.ledger else None
        print(json.dumps(verify(data,ledger),ensure_ascii=False,indent=2))
    except Exception as e:
        print('Verification failed: '+str(e),file=sys.stderr);return 1
    return 0


if __name__=='__main__':sys.exit(main())
