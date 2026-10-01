import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const demo = process.env.DEMO_SEED === "1";
if (!demo) process.env.DATABASE_SCHEMA = `forecast_e2e_${process.pid}`;
const { pool, migrate } = await import("../apps/server/db.js");
const { Club } = await import("../apps/server/service.js");
const { LocalChain } = await import("../apps/server/local-chain.js");
const { createApp } = await import("../apps/server/http.js");
const { verifyRound } = await import("../apps/verifier/verify.js");
if (!demo) await pool.query(`CREATE SCHEMA ${process.env.DATABASE_SCHEMA}`);
await migrate();
let clock = new Date(Date.now() - 9 * 86400000);
const club = new Club(new LocalChain(() => clock), () => clock);
const server = createApp(club).listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const address = server.address() as { port: number };
const base = `http://127.0.0.1:${address.port}/api`;
async function call(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.ok(r.ok, `${path}: ${JSON.stringify(data)}`);
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
async function login(email: string, nickname: string) {
  const link = await call("/auth/request", { email, nickname });
  const token = new URL(link.data.developmentLink).searchParams.get("login");
  const result = await call("/auth/consume", { token });
  return { cookie: result.cookie!, "x-csrf-token": result.data.csrf };
}
try {
  const admin = await login("operator@forecast.local", "Operator");
  const deadline = new Date(clock.getTime() + 60000).toISOString();
  const make = async (title: string) =>
    (
      await call(
        "/admin/questions",
        {
          title,
          deadline,
          rule: "SIMULATION FIXTURE: result is supplied by the test harness, not a real external fact. Production questions use GitHub Releases.",
          source: {
            type: "github_release",
            repository: "nodejs/node",
            publishedAfter: clock.toISOString(),
            tagPattern: "v*",
          },
        },
        admin,
      )
    ).data;
  const q = await make(
    "[Simulation] Will a technology project publish a stable release?",
  );
  const v = await make(
    "[Simulation] Will an ambiguous release rule be voided?",
  );
  await call("/admin/questions/" + q.id + "/publish", {}, admin);
  await call("/admin/questions/" + v.id + "/publish", {}, admin);
  for (let i = 0; i < 3; i++) {
    const human = await login(
      `fixture-${randomUUID()}@example.com`,
      `Human fixture ${i + 1}`,
    );
    await call("/consent", { accept: true }, human);
    await call(
      `/questions/${q.id}/forecasts`,
      { probability: 0.3 + i * 0.15, clientSubmissionId: randomUUID() },
      human,
    );
    await call(
      `/questions/${q.id}/forecasts`,
      { probability: 0.5 + i * 0.15, clientSubmissionId: randomUUID() },
      human,
    );
    const agent = (
      await call(
        "/agents",
        {
          nickname: `AI fixture ${i + 1}`,
          model: "synthetic test fixture",
          accept: true,
        },
        human,
      )
    ).data;
    const bearer = { Authorization: `Bearer ${agent.token}` };
    await call(
      `/questions/${q.id}/forecasts`,
      { probability: 0.4 + i * 0.1, clientSubmissionId: randomUUID() },
      bearer,
    );
    await call(
      `/questions/${q.id}/forecasts`,
      { probability: 0.6 + i * 0.1, clientSubmissionId: randomUUID() },
      bearer,
    );
  }
  assert.equal((await call("/questions/" + q.id)).data.events.length, 0);
  await club.commitOpen(q.id);
  clock = new Date(new Date(deadline).getTime() + 1000);
  await call("/admin/questions/" + q.id + "/close", {}, admin);
  await call("/admin/questions/" + v.id + "/close", {}, admin);
  await call(
    "/admin/questions/" + q.id + "/correct",
    {
      outcome: 1,
      reason: "Synthetic fixture outcome for an end-to-end check",
      evidence: {
        fixture: true,
        source: "test harness; not an external event",
      },
    },
    admin,
  );
  await call(
    "/admin/questions/" + v.id + "/void",
    { reason: "Synthetic fixture with deliberately ambiguous outcome" },
    admin,
  );
  clock = new Date(clock.getTime() + 7 * 86400000 + 1000);
  await call("/admin/questions/" + q.id + "/finalize", {}, admin);
  await call("/admin/questions/" + v.id + "/finalize", {}, admin);
  const data = (await call("/export")).data;
  const ledger = (await call("/ledger")).data;
  const result = await verifyRound(data, ledger);
  assert.equal(
    data.scores.filter((s: any) => s.nickname.includes("fixture")).length >= 6,
    true,
  );
  await mkdir("var", { recursive: true });
  await writeFile("var/round.json", JSON.stringify(data, null, 2));
  await writeFile("var/ledger.json", JSON.stringify(ledger, null, 2));
  const reference = JSON.parse(
    execFileSync(
      "python3",
      [
        "verifier-ref/verify.py",
        "var/round.json",
        "--ledger",
        "var/ledger.json",
      ],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(reference.scores, result.scores);
  if (demo) {
    clock = new Date();
    for (const [repo, title] of [
      [
        "nodejs/node",
        "Will Node.js publish a stable GitHub release in the next 7 days?",
      ],
      [
        "astral-sh/uv",
        "Will uv publish a new stable GitHub release in the next 7 days?",
      ],
      ["denoland/deno", "Will Deno publish a stable release before next week?"],
    ]) {
      const x = await club.createQuestion({
        title,
        deadline: new Date(clock.getTime() + 7 * 86400000).toISOString(),
        rule: "Yes if GitHub Releases contains at least one non-draft, non-prerelease entry with published_at at or after the window start and strictly before the deadline. Git tags alone do not count. API outages cannot resolve No.",
        source: {
          type: "github_release",
          repository: repo,
          publishedAfter: clock.toISOString(),
        },
      });
      await club.publish(x.id);
    }
  }
  console.log(
    JSON.stringify({
      passed: true,
      humanFixtures: 3,
      agentFixtures: 3,
      updates: 12,
      voided: 1,
      independentVerifier: true,
      network: "local",
      demoSeed: demo,
    }),
  );
} finally {
  await new Promise<void>((r) => server.close(() => r()));
  if (!demo)
    await pool.query(`DROP SCHEMA ${process.env.DATABASE_SCHEMA} CASCADE`);
  await pool.end();
}
