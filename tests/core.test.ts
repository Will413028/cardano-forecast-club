import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalize,
  merkleRoot,
  scoreForecasts,
} from "../packages/core/index.js";
test("Canonicalization uses safe integers and deterministic object ordering", () => {
  assert.equal(canonicalize({ b: 2, a: 1 }), ' {"a":1,"b":2}'.trim());
  assert.throws(() => canonicalize({ p: 0.5 }));
  assert.equal(
    merkleRoot([]),
    "dbc1b4c900ffe48d575b5da5c638040125f65db0fe3e24494b76ea986457d986",
  );
  assert.notEqual(
    merkleRoot([{ a: 1 }, { a: 2 }]),
    merkleRoot([{ a: 2 }, { a: 1 }]),
  );
});
test("Last forecast, exact deadline exclusion, void exclusion and participation count", () => {
  const q: any = {
    record: { id: "q", deadline: "2026-10-01T01:00:00Z" },
    status: "resolved",
    resolution: { outcome: 1 },
  };
  const base: any = {
    questionId: "q",
    participantId: "p",
    nickname: "P",
    kind: "human",
    model: null,
  };
  const events = [
    {
      ...base,
      seq: 1,
      probabilityPPM: 200000,
      receivedAt: "2026-10-01T00:00:00Z",
    },
    {
      ...base,
      seq: 2,
      probabilityPPM: 800000,
      receivedAt: "2026-10-01T00:30:00Z",
    },
    { ...base, seq: 3, probabilityPPM: 0, receivedAt: "2026-10-01T01:00:00Z" },
  ];
  assert.equal(scoreForecasts([q], events)[0].scorePPM, 40000);
  assert.equal(scoreForecasts([{ ...q, status: "void" }], events).length, 0);
});
