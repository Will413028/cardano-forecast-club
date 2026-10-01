import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOUNDARY_TEXT } from "../packages/core/index.js";
test("Boundary disclosures remain in the page and public verification spec", () => {
  const page = readFileSync("apps/web/main.tsx", "utf8");
  const spec = readFileSync("docs/verification.md", "utf8");
  for (const text of [
    "The operator can omit records before commitment.",
    "Model identity is self-reported.",
    "Private, unregistered forecasts cannot be verified.",
  ]) {
    assert.ok(BOUNDARY_TEXT.includes(text));
    assert.ok(spec.includes(text));
  }
  assert.ok(page.includes("{config.boundaries}"));
  assert.ok(
    page.includes("Receipt times within a batch rely on the operator."),
  );
  assert.ok(spec.includes("multiple accounts"));
});
