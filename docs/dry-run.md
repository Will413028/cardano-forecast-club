# Local internal round

This is a synthetic local simulation. It does not claim actual model predictions, real external outcomes, Cardano transactions, or user validation.

## Reproduction

Run `make e2e`, followed by `make verify-clean`. The script uses an isolated PostgreSQL schema and removes it afterward. Artifacts are `var/round.json` and `var/ledger.json`.

The round covers rule publication and confirmation, explicit public-history consent, three human fixtures and three external Agent fixtures, two forecasts each (12 forecast versions), hidden other forecasts before the deadline, immediate closing commitment, provisional evidence, a seven-day window, finalization, and one additional void question. Two independently implemented verifiers reproduce the server's six scored participant rows.

`DEMO_SEED=1 pnpm e2e` retains clearly labelled simulation questions and public fixture histories in the local database and adds three open questions for browser exercises. These open questions have real GitHub API rules but local simulation commitments. Browser QA exercises sign-in, consent, probability changes, an external Agent token and submission, sign-out, verification access, and desktop/mobile layouts.

## Recorded checks

- Local round: three human fixtures, three Agent fixtures, 12 forecast versions, one void; TypeScript and Python scores matched.
- Independent container: read-only inputs, no network, no server source, no database; exit zero.
- Independent scalability fixture: 500 participants × 20 questions, 10,000 events, 2.785 seconds on macOS 26.5.1 arm64 after extracting the Python scoring function.
- No fiat or mainnet ADA spent; local ledger records carry no transaction fee. Preprod fees and confirmation latency remain unmeasured because wallet/address/faucet configuration is explicitly deferred.

Final per-requirement evidence and CI status are maintained in `implementation-status.md`; do not infer deployment or completion from this round alone.
