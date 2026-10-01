# MVP requirement audit

Scope follows the session instruction: complete MVP software, defer wallet/address/faucet, external accounts, SMTP and deployment setup. D1-B skips manual pilot. Deferred validations below are not represented as successful Cardano transactions or user evidence.

Implementation commit: `7ecdc8a`. Local `pnpm check` passed all 18 tests, formatting, strict TypeScript and Vite build. All 16 mutation gates rejected their injected faults. Full local round, batch CLI, ops and desktop/mobile browser workflows passed. The [CI check job](https://github.com/Will413028/cardano-forecast-club/actions/runs/36868168859/job/110388833803) completed with `success` on Node 24 and PostgreSQL 17, including all named local gates.

| Requirement | Status | Inspected evidence |
|---|---|---|
| R1 | Verified locally | Question list/detail UI; HTTP question reads; browser desktop/mobile |
| R2 | Verified locally | Consent and two forecast versions through browser; HTTP append-only tests |
| R3 | Verified locally | Profile UI/API per-question and aggregate scores; resolution tests |
| R4 | Verified locally | Public #profile=id route, profile API and share link |
| R5 | Verified locally | Leaderboard with kind/model/count; exact independent score comparison |
| R6 | Verified locally | Boundary disclosures test; public export and verification specification |
| R7 | Verified locally | English interface; browser screenshots |
| R8 | Verified locally | Agent token creation/API submission browser flow; ownership/revocation tests; agent-api.md |
| R9 | Verified locally | Public export; independently verified complete local fixture round |
| R10 | Verified locally | Question schema/input validation, immutable published rules, batch CLI smoke |
| R11 | Verified locally | Append-only DB trigger; version/idempotency/deadline/concurrency tests |
| R12 | Verified locally | Human/Agent records; token-owned identity; self-reported model disclosure |
| R13 | Verified locally | Resolution evidence/history/disputes/void/finalization tests |
| R14 | Adapter implemented; real-chain validation deferred | Anchor metadata, immutable prepared bytes, authoritative local receipts; mocked Preprod reader test |
| R15 | Verified locally | Core Brier golden vectors; per-question/profile/aggregate scores; Python equality |
| R16 | Verified locally | Batch CLI smoke creates/publishes two questions; max 20 batch; fixed short horizons |
| R17 | Scheduler implemented; real-chain validation deferred | Daily/close cadence and retry tests; local ledger is simulation |
| R18 | Verified locally; real-chain validation deferred | Rules confirmation gates publication; SQL immutable rules; publish fault test |
| R19 | Verified locally | Stable GitHub release rule, pagination/window/evidence and source-failure regression |
| R20 | Verified locally | Seven-day disputes, correction restart, unanswered gate and void tests |
| R21 | Verified locally | TypeScript and independent Python exact score agreement; altered product formula mutation rejected |
| R22 | Verified locally; real-chain validation deferred | Read-only network-disabled Python container; golden vectors; tampered public exports rejected |
| R23 | Not executed by D1-B | User chose direct MVP; no demand-validation claim |
| R24 | Deferred by plan/session | Public launch, user recruitment and hosting excluded from this delivery |
| R25 | Verified local mechanisms; wallet setup deferred | Prepared transaction persistence/read-before-submit retry; signing key file adapter; secret scan |
| R26 | Verified declared boundary | Token ownership/revocation/rate/session tests; multiple email identities/model impersonation disclosed as unprevented |
| R27 | Verified locally | Structured failure logs, pending anchors/resolutions, ops-check and fault tests |
| R28 | Verified locally | Commands added after runnable scaffold; check/e2e/container/batch/browser executed |
| R29 | Verified current documentation | README and checkpoint distinguish local implementation from deployment, actual chain and demand validation |

## Other gates

- F1: real confirmation latency and five-run median deferred until test-wallet setup; local timing is not substituted.
- F2: independent 500 × 20 / 10,000-event benchmark completed in 2.785 seconds on macOS 26.5.1 arm64 (proposal: ≤60 seconds).
- F3/F5: no paid chain/model/hosting execution; no mainnet use. Testnet fees remain unmeasured.
- F4: US$30/month shared atomic reservation; failed attempts charged; provider parsing tested with synthetic credentials, actual model quality untested.
- F6/F7: secret scanner includes file injection; anchor metadata contains version/id/root/count/kind only, not participant data.
- F8: hashed single-use login, rotated sessions, idle timeout, same-origin writes, HttpOnly/SameSite cookies; Secure enforced for production HTTPS.
- F9/F10: failure logging and ops pending work; immutable forecast/resolution/ledger triggers and retained public records after identity unlink.
- F11: no public SLA requested.
- Format invariants: safe-integer canonical JSON, domain-separated Merkle hashing, CJK/lone-surrogate vectors, immutable confirmed metadata, exact last-predeadline Brier, void exclusion, permanent version history and hidden predeadline probabilities are covered by tests and independent verification.
- CI check conclusion: success. Real-chain and external-account gates remain explicitly deferred rather than silently marked complete.
