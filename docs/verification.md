# Public verification format v1

The reference implementation uses Python's standard library. It shares no product code, server storage, or scoring helper. Local mode is an explicitly labelled simulation; its supplied ledger is fixture evidence, not independently secured blockchain data. Preprod mode obtains transaction metadata and timestamps directly from public Koios endpoints.

## Data and ordering

`GET /api/export` returns `version`, `network`, `boundaries`, `questions`, `events`, `anchors`, and `scores`. Draft and open questions are excluded; pre-deadline events are never included. A closed question can still be provisional. Scores include only finalized, non-void questions.

Submission probabilities are rounded to the nearest integer part per million. A client submission ID has 8–100 characters; retrying it returns the original event only when its rounded probability is unchanged. Server receipt time is captured after participant validation while holding the question lock.

Each question contains its immutable `record`, workflow `status`, ordered `resolutions`, latest `resolution`, and `finalization`. Forecast events carry `id`, global increasing integer `seq`, `questionId`, `participantId`, snapshot `nickname`, `kind`, nullable `model`, integer `probabilityPPM`, and ISO UTC `receivedAt`. Events for each question retain ascending sequence order; modifications append a new event. Resolution history is ordered by its database sequence, even when timestamps are equal. A correction restarts the seven-day dispute window. Finalization identifies the final resolution, public dispute responses, status, and finalization time.

## Canonical bytes

Accept JSON null, booleans, strings, arrays, objects, and integers in [-9007199254740991, 9007199254740991]. Reject floats, missing values, non-JSON objects, and invalid keys. Object keys must contain one or more ASCII letters, digits, or underscores. Sort keys lexicographically by their ASCII bytes. Preserve array order. Serialize without whitespace, use JSON string escaping, preserve Unicode characters without ASCII escaping, and encode the result as UTF-8. Unpaired UTF-16 surrogate code units are escaped as lowercase `\uXXXX` sequences, matching JSON.stringify; they are never emitted as invalid UTF-8. No normalization of strings or dates is performed. SHA-256 digests are lowercase hexadecimal.

`docs/golden-vectors.json` contains exact canonical strings, hashes, empty roots, one leaf, two leaves, and an odd-length tree. Both implementations execute these vectors in `make check`.

## Merkle commitments

For record R, a leaf is SHA256(byte 0 || canonical UTF-8 R). A parent is SHA256(byte 1 || left 32-byte digest || right 32-byte digest). Duplicate the last node when a level has odd length. Repeat until one digest remains. The empty root is SHA256(byte 2).

Metadata under Cardano label 674 is `{v:1,id,root,count,kind}`. `id` is SHA256(canonical `{questionId,kind,upto}`). The anchor identity is SHA256(canonical metadata). Kinds:

- `rules`: one question record; `upto=0`.
- `forecasts`: complete forecast prefix through global event sequence `upto`.
- `close`: complete final forecast prefix; `upto` must equal the last event sequence, or zero for no events.
- `resolution`: complete resolution-history prefix; `upto` is its record count.
- `final`: one finalization record; `upto=0`.

Rules must be confirmed before accepting forecasts. Normal forecast commitments are due daily; closing commits immediately. Persist a prepared transaction before broadcasting. Retries reuse identical signed bytes and check the chain before resubmission. Public proofs contain `txId`, `network`, `confirmedAt`, and `metadata`; they must equal independently read ledger data. Rule confirmation must precede the first receipt, and final confirmation cannot precede finalization.

## Scoring

A question must have final status `resolved` and binary outcome 0 or 1. A `void` question contributes neither score nor participation count. Select the highest sequence event for each participant with `receivedAt < deadline`; equality is late. For each scored question, squared error is `(probabilityPPM - outcome*1000000)^2`. Sum squared errors and divide by `(participationCount*1000000)`, rounding down once, to obtain `scorePPM`. Displayed Brier score is `scorePPM/1000000`; lower is better. Sort by score and then participant ID. Display participation count alongside accuracy.

## Commands

After `make e2e`, `var/round.json` and `var/ledger.json` contain a synthetic local round. Run `make verify-clean` to build and execute a container containing only Python and the independent verifier, with read-only data, no network, no server source, and no database. Or run `python3 verifier-ref/verify.py var/round.json --ledger var/ledger.json`. For Preprod exports omit `--ledger`; the standalone verifier queries Koios publicly. Real Preprod signing and confirmation remain deferred until operator wallet configuration exists.

Verification rejects missing final close commitments, reordered events, changed probabilities, changed rules, omitted committed forecasts, divergent resolution/finalization histories, changed ledger proofs, premature finalization, and a leaderboard that differs from independently recomputed Brier scores.

## Boundaries

Cardano commits records; it does not decide external outcomes. A GitHub Releases API snapshot supplies evidence for the fixed release rule; failed or incomplete queries never become a No outcome. Operators can correct provisional results with evidence, answer public disputes, or void an unclear question. Seven days must pass after the latest resolution before finalization, with no unanswered disputes.

The operator can omit records before commitment. Receipt timestamps within a batch are asserted by the operator; later commitments do not prove exact submission times. Model identity is self-reported. Private, unregistered forecasts cannot be verified. Email identity and rate limits do not prevent one person from using multiple accounts. An Agent token authenticates its holder, not the model that produced the forecast. Nicknames and every update remain public after the deadline even if login mapping is removed. Tokens and email addresses are never part of public export.
