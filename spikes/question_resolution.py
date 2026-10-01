"""Disposable retrospective release-resolution spike; public API, no credentials."""
import csv
import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPOS = ['nodejs/node', 'microsoft/TypeScript', 'golang/go', 'rust-lang/rust',
         'python/cpython', 'denoland/deno', 'oven-sh/bun', 'astral-sh/uv',
         'cli/cli', 'fastapi/fastapi']
START = datetime(2026, 8, 6, tzinfo=timezone.utc)
FIELDS = ['id', 'question', 'rule', 'source_url', 'horizon_days', 'method',
          'outcome', 'ambiguous', 'notes']


def resolve(releases, opened, deadline):
    return [r for r in releases if not r['draft'] and not r['prerelease']
            and opened <= datetime.fromisoformat(r['published_at'].replace('Z', '+00:00')) < deadline]


def fetch():
    evidence = {}
    requests = 0
    for repo in REPOS:
        records = []
        # Pagination must cover the beginning of the historical window.
        for page in range(1, 5):
            if requests >= 40:
                raise RuntimeError('Stop: request budget exhausted; do not obtain a token')
            url = f'https://api.github.com/repos/{repo}/releases?per_page=100&page={page}'
            req = urllib.request.Request(url, headers={'User-Agent': 'forecast-club-resolution-spike', 'Accept': 'application/vnd.github+json'})
            with urllib.request.urlopen(req, timeout=30) as response:
                items = json.load(response)
                remaining = int(response.headers['X-RateLimit-Remaining'])
            requests += 1
            records.extend(items)
            print(repo, page, len(items), 'remaining', remaining, flush=True)
            if remaining < 5:
                raise RuntimeError('Stop: shared unauthenticated quota nearly exhausted')
            dates = [datetime.fromisoformat(r['published_at'].replace('Z', '+00:00')) for r in items if r.get('published_at')]
            if len(items) < 100 or (dates and min(dates) < START):
                break
        else:
            raise RuntimeError(f'Incomplete pagination for {repo}')
        keys = ['id', 'tag_name', 'published_at', 'draft', 'prerelease', 'html_url']
        evidence[repo] = {'releases': [{k: r[k] for k in keys} for r in records], 'pages': page}
    (HERE / 'question-resolution-evidence.json').write_text(json.dumps({'retrieved_at': datetime.now(timezone.utc).isoformat(), 'requests': requests, 'repos': evidence}, indent=2))


def build():
    evidence = json.loads((HERE / 'question-resolution-evidence.json').read_text())
    rows = []
    for repo, data in evidence['repos'].items():
        # Four fixed fortnight windows: no selection based on release outcomes.
        for window in range(4):
            opened = START + timedelta(days=14 * window)
            deadline = opened + timedelta(days=14)
            hits = resolve(data['releases'], opened, deadline)
            rule = f'GitHub Releases only: draft=false and prerelease=false; published_at >= {opened.isoformat()} and < {deadline.isoformat()}; at least one record. Tags and vendor announcements alone do not count.'
            rows.append(dict(id=f'Q{len(rows)+1:02}', question=f'Will {repo} publish a non-prerelease GitHub Release between {opened.date()} and {deadline.date()} UTC?', rule=rule, source_url=f'https://api.github.com/repos/{repo}/releases?per_page=100', horizon_days='14', method='auto', outcome='1' if hits else '0', ambiguous='no', notes=json.dumps({'pages': data['pages'], 'matches': [r['tag_name'] for r in hits]}, ensure_ascii=False)))
    manual = json.loads((HERE / 'question-resolution-manual.json').read_text())
    for row in rows:
        repo = next((r for r in manual if r in row['question']), None)
        if repo:
            window = (int(row['id'][1:]) - 1) % 4
            opened = START + timedelta(days=14 * window)
            deadline = opened + timedelta(days=14)
            source = manual[repo]
            hits = [r['version'] for r in source['records'] if opened.date().isoformat() <= r['date'] < deadline.date().isoformat()]
            row.update(question=f'Will {repo} have a stable release dated between {opened.date()} and {deadline.date()} in its official release history?', rule=f'Official source only; displayed release date >= {opened.date()} and < {deadline.date()}; stable numeric versions only, alpha/beta/RC excluded; source calendar dates govern, not an inferred UTC publication instant.', source_url=source['url'], method='manual', outcome='1' if hits else '0', notes=json.dumps({'pages': 0, 'matches': hits, 'reviewed_at': '2026-10-01', 'github_releases_empty': True}))
    with (HERE / 'question-resolution.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, lineterminator="\n"); writer.writeheader(); writer.writerows(rows)
    print(json.dumps({'questions': len(rows), 'auto': sum(r['method']=='auto' for r in rows), 'ambiguous': sum(r['ambiguous']=='yes' for r in rows), 'yes': sum(r['outcome']=='1' for r in rows), 'no': sum(r['outcome']=='0' for r in rows), 'discovery_requests': evidence['requests'], 'requests_per_question_with_cache': evidence['requests']/len(rows), 'automatic_standalone_pages_per_question': sum(json.loads(r['notes'])['pages'] for r in rows if r['method']=='auto')/sum(r['method']=='auto' for r in rows)}))


if __name__ == '__main__':
    if '--fetch' in sys.argv:
        fetch()
    build()
