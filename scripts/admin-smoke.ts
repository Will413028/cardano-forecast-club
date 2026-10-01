import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
process.env.DATABASE_SCHEMA = `forecast_cli_${process.pid}`;
const { pool } = await import("../apps/server/db.js");
await pool.query(`CREATE SCHEMA ${process.env.DATABASE_SCHEMA}`);
try {
  await mkdir("var", { recursive: true });
  const after = new Date().toISOString();
  const deadline = new Date(Date.now() + 86400000).toISOString();
  const inputs = ["nodejs/node", "denoland/deno"].map((repository) => ({
    title: "[Fixture] Will the CLI publish a stable release question?",
    deadline,
    rule: "Synthetic CLI smoke fixture; stable GitHub release in the fixed source window.",
    source: {
      type: "github_release",
      repository,
      publishedAfter: after,
      tagPattern: "v*",
    },
  }));
  await writeFile("var/cli-batch.json", JSON.stringify(inputs));
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/admin.ts", "batch", "var/cli-batch.json"],
    { encoding: "utf8", env: process.env },
  );
  const published = JSON.parse(output);
  assert.equal(published.length, 2);
  assert.ok(published.every((q: any) => q.status === "open"));
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM anchors WHERE kind='rules' AND state='confirmed'",
        )
      ).rows[0].count,
    ),
    2,
  );
  console.log(
    JSON.stringify({ passed: true, published: 2, confirmedRules: 2 }),
  );
} finally {
  await pool.query(`DROP SCHEMA ${process.env.DATABASE_SCHEMA} CASCADE`);
  await pool.end();
}
