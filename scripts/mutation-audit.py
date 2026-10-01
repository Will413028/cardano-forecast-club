"""Run behavioral mutations in an isolated source copy; never edit the working tree."""
import pathlib,shutil,tempfile,subprocess,json,time,sys
root=pathlib.Path(__file__).resolve().parents[1]
core='packages/core/index.ts';service='apps/server/service.ts';http='apps/server/http.ts'
mutations=[
 ('merkle_omits_record',core,'records.map((r) =>','(records.length > 1 ? records.slice(0,-1) : records).map((r) =>','tests/vectors.test.ts','Independent golden vectors'),
 ('score_inverts_outcome',core,'q.resolution.outcome * 1_000_000','(1 - q.resolution.outcome) * 1_000_000','tests/core.test.ts','Last forecast'),
 ('score_absolute_error',core,'(e.probabilityPPM - q.resolution.outcome * 1_000_000) ** 2','Math.abs(e.probabilityPPM - q.resolution.outcome * 1_000_000)','tests/club.test.ts','Resolution, disputes'),
 ('void_counts',core,'q.status !== "resolved"','!["resolved", "void"].includes(q.status)','tests/core.test.ts','Last forecast'),
 ('late_submission',service,'q.status === "open" && acceptedAt < new Date(q.record.deadline)','q.status === "open"','tests/club.test.ts','HTTP privacy'),
 ('skip_rule_commitment',service,'await this.enqueue(id, "rules", [q.record], 0);','/* mutation: skip rule confirmation */','tests/club.test.ts','Rules confirmation'),
 ('public_before_deadline',service,'if (!canSee && !admin)','if (false)','tests/club.test.ts','HTTP privacy'),
 ('no_consent',service,'requireValue(person.consent_at, 403, "Public history consent required");','/* mutation: no consent */','tests/club.test.ts','HTTP privacy'),
 ('update_history',service,'INSERT INTO forecast_events(id,question_id,participant_id,client_id,body) VALUES($1,$2,$3,$4,$5) RETURNING seq','WITH existing AS (SELECT id FROM forecast_events WHERE question_id=$2 AND participant_id=$3 ORDER BY seq DESC LIMIT 1), updated AS (UPDATE forecast_events SET body=$5 WHERE id=(SELECT id FROM existing) RETURNING seq), inserted AS (INSERT INTO forecast_events(id,question_id,participant_id,client_id,body) SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM existing) RETURNING seq) SELECT seq FROM updated UNION ALL SELECT seq FROM inserted','tests/club.test.ts','HTTP privacy'),
 ('remove_append_only_guard','apps/server/schema.sql','CREATE TRIGGER forecast_immutable_guard BEFORE UPDATE OR DELETE ON forecast_events FOR EACH ROW EXECUTE FUNCTION forecast_immutable();','-- mutation: history is no longer append-only','tests/club.test.ts','HTTP privacy'),
 ('skip_chain_lookup',service,'proof = await read(prepared.txId);','throw new Error("mutation: skip chain lookup");','tests/club.test.ts','Prepared anchor'),
 ('reuse_login_session',http,'const sessionToken = secret(),','const sessionToken = req.headers.cookie?.split(";").map(x=>x.trim()).find(x=>x.startsWith("forecast_session="))?.slice(17) ?? secret(),','tests/club.test.ts','Rules confirmation'),
 ('agent_impersonation',service,'participantId,\n        nickname: person.nickname,','participantId: (input as any).participantId ?? participantId,\n        nickname: person.nickname,','tests/club.test.ts','Agent ownership'),
 ('remove_token_revocation',http,'DELETE FROM agent_tokens WHERE participant_id=$1 AND EXISTS(SELECT 1 FROM agent_owners WHERE owner_id=$2 AND agent_id=$1) RETURNING hash','SELECT hash FROM agent_tokens WHERE participant_id=$1 AND EXISTS(SELECT 1 FROM agent_owners WHERE owner_id=$2 AND agent_id=$1)','tests/club.test.ts','Agent ownership'),
 ('remove_boundary_copy','apps/web/main.tsx','{config.boundaries}','{/* mutation: remove boundary copy */}','tests/boundaries.test.ts','Boundary disclosures'),
]
logs=root/'var/mutations';logs.mkdir(parents=True,exist_ok=True)
results=[]
selected=set(sys.argv[1:])
with tempfile.TemporaryDirectory(prefix='forecast-mutations-') as temporary:
 copy=pathlib.Path(temporary)
 for name in ['apps','packages','tests','verifier-ref','docs']:
  shutil.copytree(root/name,copy/name,ignore=shutil.ignore_patterns('__pycache__'))
 shutil.copy2(root/'package.json',copy/'package.json');shutil.copy2(root/'tsconfig.json',copy/'tsconfig.json');(copy/'node_modules').symlink_to(root/'node_modules',target_is_directory=True)
 for name,path,before,after,test,pattern in mutations:
  if selected and name not in selected:continue
  target=copy/path;original=target.read_text();assert before in original,f'Mutation target missing: {name}'
  target.write_text(original.replace(before,after) if name=="remove_boundary_copy" else original.replace(before,after,1));start=time.monotonic()
  try:
   result=subprocess.run([str(root/'node_modules/.bin/tsx'),'--test','--test-name-pattern',pattern,test],cwd=copy,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=300)
   (logs/(name+'.log')).write_text(result.stdout)
   killed=result.returncode!=0 and ('AssertionError' in result.stdout or 'ERR_ASSERTION' in result.stdout)
   results.append({'mutation':name,'killed':killed,'seconds':round(time.monotonic()-start,2)})
   print(json.dumps(results[-1]),flush=True)
   if not killed:raise RuntimeError('Mutation survived or failed for non-behavioral reason: '+name)
  finally:target.write_text(original)
 # Real file injection exercises scanner discovery, not just the regular expression.
 subprocess.run(['git','init','-q',str(copy)],check=True)
 (copy/'scripts').mkdir(exist_ok=True);shutil.copy2(root/'scripts/secret-scan.py',copy/'scripts/secret-scan.py')
 (copy/'tests/fake-key.txt').write_text('ed25519_sk1'+'a'*60)
 result=subprocess.run(['python3',str(copy/'scripts/secret-scan.py')],text=True,capture_output=True,timeout=30)
 assert result.returncode!=0 and 'fake-key.txt' in result.stderr,'Fake key file was not rejected'
 results.append({'mutation':'fake_signing_key_file','killed':True});print(json.dumps(results[-1]),flush=True)
report=root/'var/mutation-results.json'
if selected and report.exists():
 old=json.loads(report.read_text());results=[x for x in old if x['mutation'] not in {r['mutation'] for r in results}]+results
report.write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({'passed':True,'killed':len(results)}))
