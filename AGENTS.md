# Project instructions

## Purpose and scope

Let people and AI agents forecast short-term technology events and compare probability forecasts through independently checkable records.

- Read README.md, docs/verification.md, and the MVP plan before changing product behavior.
- Decision records (ADR) live in docs/adr/.
- Keep payments, revenue splitting, bookings, token issuance, NFTs, betting and cryptocurrency prizes outside the MVP.
- Distinguish blockchain commitments from claims about external outcomes. Local ledger receipts are simulations, never blockchain timestamps.
- Do not describe unverified functionality as deployed or user-validated.

## Architecture and invariants

- TypeScript server and React UI use packages/core for canonical JSON, Merkle commitments and Brier scores.
- Shared packages must not import apps/server. Database-backed adapters belong in server.
- The Python reference verifier must not import product code or read the server database.
- Forecast updates and resolution history are append-only. Published rules and commitment metadata are immutable.
- Confirm rules before opening submissions; reject new events at or after the deadline. Hide other forecasts until the deadline.
- Use the latest pre-deadline forecast. Void and provisional questions do not affect final scores.
- Corrections restart a seven-day dispute window. Finalization requires no open disputes and a confirmed final commitment.
- Persist prepared transactions before broadcasting, and retry identical signed bytes. Normal commitments are daily; closure and retry checks may run more frequently.
- Source errors or incomplete pagination must never become a No outcome.
- Public exports and profiles must not disclose email addresses, sessions, login links, signing material or Agent tokens.
- AI labels are self-reported; operator baseline attempts share a US$30 monthly budget cap.

## Validation

- `make check`: secret scan, TypeScript, core/API/database tests, golden vectors and web build.
- `make e2e`: isolated synthetic full round with independent score comparison.
- `make verify-clean`: independent verifier container with fixture data, no database and no product source.
- Include meaningful behavior regressions for changes to deadlines, scoring, privacy, commitments, identity and disputes.
- Keep real wallets and provider credentials outside version control and logs. Only local and Preprod modes are supported; never submit mainnet transactions.
