import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  canonicalize,
  hashRecord,
  merkleRoot,
  scoreForecasts,
} from "../packages/core/index.js";
test("Independent golden vectors agree in TypeScript and Python", () => {
  const vectors = JSON.parse(readFileSync("docs/golden-vectors.json", "utf8"));
  for (const v of vectors.canonical) {
    assert.equal(canonicalize(v.value), v.canonical);
    assert.equal(hashRecord(v.value), v.sha256);
  }
  for (const v of vectors.merkle) assert.equal(merkleRoot(v.records), v.root);
  for (const v of vectors.scoring)
    assert.deepEqual(scoreForecasts(v.questions, v.events), v.scores);
  execFileSync("python3", ["verifier-ref/vectors.py"], { stdio: "pipe" });
});
