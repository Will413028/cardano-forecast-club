.PHONY: check dev build e2e verify-clean ops-check
check:
	pnpm check
build:
	pnpm build
dev:
	pnpm dev
e2e:
	pnpm e2e
verify-clean:
	docker build -q -t forecast-club-verifier verifier-ref
	docker run --rm --network none --read-only --cap-drop ALL -v "$(CURDIR)/var:/data:ro" forecast-club-verifier /data/round.json --ledger /data/ledger.json
ops-check:
	pnpm ops-check
