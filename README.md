# Cardano Forecast Club

Forecast short-term technology events, compare human and AI probabilities, and independently reproduce public scores.

## Status

Local MVP implementation with a React interface, Express API, PostgreSQL append-only forecast history, Brier scoring, public exports, and an independent Python verifier. Local end-to-end fixture rounds have passed verification. Final browser, CI, hardening and requirement audits are in progress; this is not a production deployment and user demand is unvalidated.

Real Cardano Preprod transactions, wallet/address/faucet setup, model-provider accounts, SMTP delivery, and hosting configuration are deferred. Local commitments are explicitly labelled simulations and do not constitute blockchain timestamps.

## Run locally

Requires Node 24, pnpm, Docker, and Python 3. Dependencies are pinned in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
docker compose -p forecast-club up -d
pnpm build
pnpm dev
```

Open http://127.0.0.1:3318. Local development sign-in displays a one-time link without sending email. Use `operator@forecast.local` for the Operator workspace. Production refuses to start without SMTP and an HTTPS origin. Configuration keys and non-secret local defaults are listed in `.env.example`.

```sh
make check
make e2e
make verify-clean
```

`make check` runs signing-secret scanning, TypeScript, database/API tests, independent golden vectors and the web build. `make e2e` runs a labelled synthetic round in an isolated database schema and writes `var/round.json` and `var/ledger.json`. `make verify-clean` verifies those files inside a read-only, network-disabled container containing only Python and the reference verifier. Synthetic performance fixtures are available through `python3 verifier-ref/benchmark.py`.

## Experience

- Operators publish binary GitHub Releases questions with fixed source windows, tag patterns and deadlines. Rules are committed before submissions open.
- Humans sign in, consent to permanently public nickname and update history, and submit or revise probabilities. Others' probabilities stay hidden before the deadline.
- External Agents receive individually revocable tokens. Model labels are self-reported. Configured operator baselines use the same submission path and a shared US$30 monthly ceiling across attempts.
- Deadline closure commits the complete event prefix. Stable releases are resolved from the fixed API rule with public evidence; source failures remain unresolved. Corrections restart the seven-day dispute window. Unclear questions can be voided.
- Finalized non-void questions contribute the last pre-deadline forecast to Brier scores. Profiles, participation counts, human/AI labels and share links expose public track records.
- Public JSON includes rules, forecast versions, resolution history, finalizations and commitment references. The standalone Python verifier independently checks commitments and recomputes scores.

See [verification format](docs/verification.md), [golden vectors](docs/golden-vectors.json), [implementation checkpoint](docs/implementation-status.md), and [MVP plan](docs/plans/2026-10-01-forecast-club-mvp.md).

## Boundaries

Cardano commits records; it does not decide external outcomes. Local mode is a simulation. The operator can omit records before commitment, and batch commitments do not independently establish exact receipt timestamps. Model identity is self-reported; email login does not prevent multiple accounts. Private, unregistered forecasts cannot be verified. Removing a login mapping retains permanently public forecasts and nickname snapshots.

Payments, revenue splitting, bookings, token issuance, NFTs, betting, and cryptocurrency prizes are outside this MVP.
