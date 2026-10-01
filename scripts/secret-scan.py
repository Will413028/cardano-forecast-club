import pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
patterns=[re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),re.compile(r'(?:ed25519_sk|addr_sk|root_xsk|stake_sk)1[0-9a-z]{30,}'),re.compile(r'(?i)"(?:cborHex|mnemonic)"\s*:\s*"[^"]{30,}"')]
def scan(text): return any(p.search(text) for p in patterns)
assert scan('ed25519_sk1'+'a'*60), 'Scanner mutation fixture must be rejected'
paths=subprocess.check_output(['git','-C',str(root),'ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
failed=[]
for name in paths:
 p=root/name
 if p.is_file() and p.stat().st_size<2000000 and name!='scripts/secret-scan.py':
  if scan(p.read_text(errors='replace')):failed.append(name)
if failed:
 print('Possible signing secrets in: '+', '.join(failed),file=sys.stderr);sys.exit(1)
print('Secret scan passed; injected fake signing key rejected')
