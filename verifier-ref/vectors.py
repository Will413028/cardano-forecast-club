import json
from verify import canonical,digest,root,compute_scores
vectors=json.load(open('docs/golden-vectors.json'))
for v in vectors['canonical']:
    assert canonical(v['value'])==v['canonical']
    assert digest(v['value'])==v['sha256']
for v in vectors['merkle']: assert root(v['records'])==v['root']
for v in vectors['scoring']: assert compute_scores(v['questions'],v['events'])==v['scores']
for value in [{'nested':[1.5]},9007199254740992]:
    try: canonical(value)
    except (ValueError,AssertionError): pass
    else: raise AssertionError('Invalid canonical value accepted')
print('Independent golden vectors passed')
