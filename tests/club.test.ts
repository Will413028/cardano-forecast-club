import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
process.env.DATABASE_QUERY_TIMEOUT_MS = "120000";
process.env.DATABASE_SCHEMA = `forecast_test_${process.pid}`;
const { pool, migrate } = await import("../apps/server/db.js");
const { Club } = await import("../apps/server/service.js");
const { LocalChain } = await import("../apps/server/local-chain.js");
const { createApp } = await import("../apps/server/http.js");
const { verifyRound } = await import("../apps/verifier/verify.js");
const { reserveBudget, runBaseline } =
  await import("../apps/server/baseline.js");
let clock = new Date("2026-10-01T00:00:00.000Z");
const now = () => clock;
const club = new Club(new LocalChain(now), now);
let server: any, base: string;
before(async () => {
  await pool.query(`CREATE SCHEMA ${process.env.DATABASE_SCHEMA}`);
  await migrate();
  server = createApp(club).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  await pool.query(`DROP SCHEMA ${process.env.DATABASE_SCHEMA} CASCADE`);
  await pool.end();
});
async function human(n: string) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO participants(id,nickname,kind,consent_at) VALUES($1,$2,'human',now())",
    [id, n],
  );
  return id;
}
async function question() {
  clock = new Date("2026-10-01T00:00:00.000Z");
  const q = await club.createQuestion({
    title: "Will a stable test release occur?",
    deadline: "2026-10-01T00:10:00.000Z",
    rule: "Use the fixed GitHub API source and published_at window.",
    source: {
      type: "github_release",
      repository: "nodejs/node",
      publishedAfter: "2026-10-01T00:00:00.000Z",
      tagPattern: "v*",
    },
  });
  await club.publish(q.id);
  return q.id;
}
async function req(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
  method?: string,
) {
  const r = await fetch(base + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(email: string, nickname: string) {
  const requested = await req("/auth/request", { email, nickname });
  const token = new URL(requested.data.developmentLink).searchParams.get(
    "login",
  );
  const consumed = await req("/auth/consume", { token });
  assert.equal(consumed.status, 200);
  return { cookie: consumed.cookie!, "x-csrf-token": consumed.data.csrf };
}

test("HTTP privacy, consent, append-only updates, idempotency and close gate", async () => {
  const id = await question();
  const headers = await login("alice@example.com", "Alice");
  let r = await req(
    `/questions/${id}/forecasts`,
    { probability: 0.6, clientSubmissionId: "first-forecast" },
    headers,
  );
  assert.equal(r.status, 403);
  assert.equal(
    (await req("/consent", { accept: true }, { cookie: headers.cookie }))
      .status,
    403,
  );
  await req("/consent", { accept: true }, headers);
  r = await req(
    `/questions/${id}/forecasts`,
    { probability: 0.6, clientSubmissionId: "first-forecast" },
    headers,
  );
  assert.equal(r.status, 201);
  const event = r.data;
  const again = await req(
    `/questions/${id}/forecasts`,
    { probability: 0.6, clientSubmissionId: "first-forecast" },
    headers,
  );
  assert.equal(again.data.id, event.id);
  assert.equal(
    (
      await req(
        `/questions/${id}/forecasts`,
        { probability: 0.7, clientSubmissionId: "first-forecast" },
        headers,
      )
    ).status,
    409,
  );
  clock = new Date("2026-10-01T00:01:00Z");
  await req(
    `/questions/${id}/forecasts`,
    { probability: 0.7, clientSubmissionId: "second-forecast" },
    headers,
  );
  assert.equal((await req(`/questions/${id}`)).data.events.length, 0);
  assert.equal(
    (await req(`/questions/${id}`, undefined, headers)).data.events.length,
    2,
  );
  assert.equal((await req("/export")).data.events.length, 0);
  await assert.rejects(
    pool.query("UPDATE forecast_events SET body=$1 WHERE id=$2", [
      {},
      event.id,
    ]),
    /append-only/,
  );
  await assert.rejects(
    pool.query("DELETE FROM forecast_events WHERE id=$1", [event.id]),
    /append-only/,
  );
  await assert.rejects(
    pool.query("UPDATE questions SET record=$1 WHERE id=$2", [{}, id]),
    /immutable/,
  );
  clock = new Date("2026-10-01T00:10:00Z");
  assert.equal(
    (
      await req(
        `/questions/${id}/forecasts`,
        { probability: 0.8, clientSubmissionId: "late-forecast" },
        headers,
      )
    ).status,
    409,
  );
  await club.closeRound(id);
  assert.equal((await req(`/questions/${id}`)).data.events.length, 2);
});

test("Agent ownership, cross-identity access, token revocation and invalid tokens", async () => {
  const owner = await login("owner@example.com", "Owner");
  const stranger = await login("stranger@example.com", "Stranger");
  const a = await req(
    "/agents",
    { nickname: "External agent", model: "test model", accept: true },
    owner,
  );
  assert.equal(a.status, 200);
  const id = await question();
  const token = { Authorization: `Bearer ${a.data.token}` };
  const e = await req(
    `/questions/${id}/forecasts`,
    {
      probability: 0.25,
      clientSubmissionId: "agent-forecast",
      participantId: "must-not-impersonate",
    },
    token,
  );
  assert.equal(e.status, 201);
  assert.equal(e.data.participantId, a.data.id);
  clock = new Date("2026-10-01T00:10:00Z");
  assert.equal(
    (
      await req(
        `/questions/${id}/forecasts`,
        { probability: 0.9, clientSubmissionId: "agent-late" },
        token,
      )
    ).status,
    409,
  );
  clock = new Date("2026-10-01T00:00:00Z");
  assert.equal(
    (
      await req(
        "/agents/" + a.data.id + "/token",
        undefined,
        stranger,
        "DELETE",
      )
    ).status,
    404,
  );
  assert.equal(
    (await req("/agents/" + a.data.id + "/token", undefined, owner, "DELETE"))
      .status,
    200,
  );
  assert.equal(
    (
      await req(
        `/questions/${id}/forecasts`,
        { probability: 0.4, clientSubmissionId: "revoked-forecast" },
        token,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await req("/questions", undefined, {
        Authorization: "Bearer " + "a".repeat(64),
      })
    ).status,
    401,
  );
});

test("Resolution, disputes, correction history, finalization, void and independent verifiers", async () => {
  const id = await question();
  const p = await human("Verifier participant");
  await club.submitForecast(id, p, {
    probability: 0.2,
    clientSubmissionId: "verify-original",
  });
  clock = new Date("2026-10-01T00:05:00Z");
  await club.submitForecast(id, p, {
    probability: 0.8,
    clientSubmissionId: "verify-updated",
  });
  await club.commitOpen(id);
  clock = new Date("2026-10-01T00:10:00Z");
  await club.closeRound(id);
  await club.resolveQuestion(id, 0, "Initial test fixture resolution", {
    fixture: true,
  });
  await club.commitResolution(id);
  await club.dispute(id, p, "The fixture evidence was incomplete");
  await assert.rejects(club.finalize(id), /seven-day/);
  const d = (
    await pool.query("SELECT id FROM disputes WHERE question_id=$1", [id])
  ).rows[0];
  await club.answerDispute(d.id, "Evidence reviewed and corrected");
  await club.resolveQuestion(id, 1, "Corrected test fixture resolution", {
    fixture: true,
  });
  await club.commitResolution(id);
  clock = new Date("2026-10-08T00:11:00Z");
  await club.finalize(id);
  const data = await club.exportRound();
  const ledger = {
    network: "local",
    simulation: true,
    entries: (await pool.query("SELECT * FROM local_ledger")).rows.map((r) => ({
      txId: r.id,
      metadata: r.metadata,
      confirmedAt: r.confirmed_at,
      network: "local",
    })),
  };
  const score = data.scores.find((s) => s.participantId === p)!;
  assert.equal(score.scorePPM, 40000);
  assert.equal(score.count, 1);
  const profile = (await req("/profiles/" + p)).data;
  assert.equal(
    profile.questionScores.find((x: any) => x.questionId === id).scorePPM,
    40000,
  );
  assert.equal(profile.participant.email, undefined);
  assert.equal((await verifyRound(data, ledger)).verified, true);
  await mkdir("var/tests", { recursive: true });
  await writeFile("var/tests/export.json", JSON.stringify(data));
  await writeFile("var/tests/ledger.json", JSON.stringify(ledger));
  const output = JSON.parse(
    execFileSync(
      "python3",
      [
        "verifier-ref/verify.py",
        "var/tests/export.json",
        "--ledger",
        "var/tests/ledger.json",
      ],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(output.scores, data.scores);
  for (const mutate of [
    (x: any) => x.events[0].probabilityPPM++,
    (x: any) => x.events.shift(),
    (x: any) => (x.questions[0].record.rule += " changed"),
    (x: any) => x.scores[0].scorePPM++,
    (x: any) => {
      [x.events[0], x.events[1]] = [x.events[1], x.events[0]];
    },
    (x: any) =>
      (x.questions.find((q: any) => q.resolution).resolution.outcome = 0),
  ]) {
    const bad = structuredClone(data);
    mutate(bad);
    await assert.rejects(verifyRound(bad, ledger));
    await writeFile("var/tests/bad.json", JSON.stringify(bad));
    assert.throws(() =>
      execFileSync(
        "python3",
        [
          "verifier-ref/verify.py",
          "var/tests/bad.json",
          "--ledger",
          "var/tests/ledger.json",
        ],
        { stdio: "pipe" },
      ),
    );
  }
  const voidId = await question();
  clock = new Date("2026-10-01T00:10:00Z");
  await club.closeRound(voidId);
  await club.resolveQuestion(voidId, null, "Unresolvable test fixture", {
    fixture: true,
  });
  await club.commitResolution(voidId);
  clock = new Date("2026-10-08T00:11:00Z");
  await club.finalize(voidId);
  assert.equal((await club.question(voidId)).status, "void");
});

test("Prepared anchor survives broadcast failure and retry, commitment bytes are immutable", async () => {
  const id = await question();
  const before = Number(
    (await pool.query("SELECT count(*) FROM local_ledger")).rows[0].count,
  );
  const read = club.chain.read.bind(club.chain),
    submit = club.chain.submit.bind(club.chain),
    prepare = club.chain.prepare.bind(club.chain);
  let reads = 0,
    submissions = 0,
    preparations = 0;
  club.chain.read = async (tx) => {
    reads++;
    if (reads <= 2) throw new Error("simulated interruption after broadcast");
    return read(tx);
  };
  club.chain.submit = async (p) => {
    submissions++;
    await submit(p);
  };
  club.chain.prepare = async (m) => {
    preparations++;
    return prepare(m);
  };
  try {
    await assert.rejects(club.commitOpen(id), /interruption/);
    const failed = (
      await pool.query(
        "SELECT * FROM anchors WHERE question_id=$1 AND kind='forecasts'",
        [id],
      )
    ).rows[0];
    assert.equal(failed.state, "failed");
    assert.ok(failed.proof.txId);
    club.chain.read = read;
    await club.commitOpen(id);
    assert.equal(submissions, 1);
    assert.equal(preparations, 1);
    const after = Number(
      (await pool.query("SELECT count(*) FROM local_ledger")).rows[0].count,
    );
    assert.equal(after - before, 1);
    await assert.rejects(
      pool.query("UPDATE anchors SET metadata='{}' WHERE question_id=$1", [id]),
      /immutable/,
    );
  } finally {
    club.chain.read = read;
    club.chain.submit = submit;
    club.chain.prepare = prepare;
  }
});

test("Monthly budget is atomic and baseline goes through ordinary consent and forecast path", async () => {
  await question();
  const p = await human("Budget fixture");
  await pool.query(
    "INSERT INTO baseline_spend(id,month,participant_id,reserved_cents) VALUES($1,'2026-10',$2,2980)",
    [randomUUID(), p],
  );
  const result = await Promise.allSettled([
    reserveBudget(p, clock),
    reserveBudget(p, clock),
  ]);
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT sum(reserved_cents) cents FROM baseline_spend WHERE month='2026-10'",
        )
      ).rows[0].cents,
    ),
    3000,
  );
  clock = new Date("2026-11-01T00:00:00Z");
  const q = await club.createQuestion({
    title: "Will another fixture release occur?",
    deadline: "2026-11-02T00:00:00Z",
    rule: "Public stable GitHub API release within the defined window.",
    source: {
      type: "github_release",
      repository: "nodejs/node",
      publishedAfter: clock.toISOString(),
    },
  });
  await club.publish(q.id);
  const e = await runBaseline(club, q.id, async () => 0.55, []);
  assert.equal(e.kind, "agent");
  assert.equal(e.probabilityPPM, 550000);
  assert.equal(e.model, "synthetic test fixture");
  await assert.rejects(runBaseline(club, q.id), /setup is deferred/);
});

test("Login links are single use, cross-origin writes rejected, identity unlink retains forecasts", async () => {
  const r = await req("/auth/request", {
    email: "unlink@example.com",
    nickname: "Unlink",
  });
  const token = new URL(r.data.developmentLink).searchParams.get("login");
  const u = await req("/auth/consume", { token });
  assert.equal((await req("/auth/consume", { token })).status, 401);
  const headers = { cookie: u.cookie!, "x-csrf-token": u.data.csrf };
  assert.equal(
    (
      await req(
        "/consent",
        { accept: true },
        { ...headers, Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  await req("/consent", { accept: true }, headers);
  const id = await question();
  await req(
    `/questions/${id}/forecasts`,
    { probability: 0.3, clientSubmissionId: "unlink-history" },
    headers,
  );
  assert.equal((await req("/privacy/unlink", {}, headers)).status, 200);
  assert.equal((await club.events(id)).length, 1);
  assert.equal(
    (
      await pool.query("SELECT email FROM participants WHERE id=$1", [
        u.data.id,
      ])
    ).rows[0].email,
    null,
  );
  assert.equal((await req("/me", undefined, headers)).data.participant, null);
});

test("Background commitment cadence is daily and closure is immediate", async () => {
  const id = await question();
  const p = await human("Cadence fixture");
  await club.submitForecast(id, p, {
    probability: 0.4,
    clientSubmissionId: "daily-first",
  });
  await club.tick();
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM anchors WHERE question_id=$1 AND kind='forecasts'",
          [id],
        )
      ).rows[0].count,
    ),
    0,
  );
  clock = new Date("2026-10-01T00:10:00Z");
  await club.tick();
  assert.equal((await club.question(id)).status, "closed");
  assert.equal(
    Number(
      (
        await pool.query(
          "SELECT count(*) FROM anchors WHERE question_id=$1 AND kind='close'",
          [id],
        )
      ).rows[0].count,
    ),
    1,
  );
});

test("Automatic API resolution follows stable-release rule; source failures remain unresolved", async () => {
  const original = globalThis.fetch;
  try {
    const id = await question();
    clock = new Date("2026-10-01T00:10:00Z");
    await club.closeRound(id);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            tag_name: "v26.0.0",
            published_at: "2026-10-01T00:05:00Z",
            draft: false,
            prerelease: false,
            html_url: "https://github.com/nodejs/node/releases/tag/v26.0.0",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const result = await club.autoResolve(id);
    assert.equal(result.outcome, 1);
    assert.equal((result.evidence as any).matches.length, 1);
    const no = await question();
    clock = new Date("2026-10-01T00:10:00Z");
    await club.closeRound(no);
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            tag_name: "v26.0.0-rc",
            published_at: "2026-10-01T00:05:00Z",
            draft: false,
            prerelease: true,
            html_url: "https://github.com/nodejs/node/releases/tag/v26.0.0-rc",
          },
        ]),
        { status: 200 },
      );
    assert.equal((await club.autoResolve(no)).outcome, 0);
    const unavailable = await question();
    clock = new Date("2026-10-01T00:10:00Z");
    await club.closeRound(unavailable);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(club.autoResolve(unavailable), /source unavailable/);
    assert.equal(await club.resolution(unavailable), null);
    assert.equal((await club.question(unavailable)).status, "closed");
  } finally {
    globalThis.fetch = original;
  }
});

test("Rules confirmation gates publication and session renewal invalidates the prior session", async () => {
  clock = new Date("2026-10-01T00:00:00Z");
  const q = await club.createQuestion({
    title: "Publication must wait for confirmation",
    deadline: "2026-10-02T00:00:00Z",
    rule: "Fixed stable GitHub release window with public evidence",
    source: {
      type: "github_release",
      repository: "nodejs/node",
      publishedAfter: clock.toISOString(),
    },
  });
  const read = club.chain.read.bind(club.chain);
  club.chain.read = async () => {
    throw new Error("unconfirmed transaction");
  };
  try {
    await assert.rejects(club.publish(q.id));
    assert.equal((await club.question(q.id)).status, "draft");
  } finally {
    club.chain.read = read;
  }
  await club.publish(q.id);
  const h = await login("rotation@example.com", "Rotation");
  const requested = await req(
    "/auth/request",
    { email: "rotation@example.com", nickname: "Rotation" },
    h,
  );
  const token = new URL(requested.data.developmentLink).searchParams.get(
    "login",
  );
  const renewed = await req("/auth/consume", { token }, h);
  assert.equal(renewed.status, 200);
  assert.notEqual(renewed.cookie, h.cookie);
  assert.equal((await req("/me", undefined, h)).data.participant, null);
  assert.ok(
    (await req("/me", undefined, { cookie: renewed.cookie! })).data.participant,
  );
});

test("Concurrent schema initialization is serialized", async () => {
  await Promise.all([migrate(), migrate()]);
  assert.equal(
    Number((await pool.query("SELECT count(*) FROM questions")).rows[0].count) >
      0,
    true,
  );
});

test("Deadline is checked after participant lookup, with one captured receipt time", async () => {
  const id = await question();
  const p = await human("Deadline race fixture");
  const lookup = club.participant.bind(club);
  club.participant = async (person, db) => {
    const result = await lookup(person, db);
    clock = new Date("2026-10-01T00:10:00Z");
    return result;
  };
  try {
    await assert.rejects(
      club.submitForecast(id, p, {
        probability: 0.5,
        clientSubmissionId: "deadline-race",
      }),
      /Question closed/,
    );
    assert.equal((await club.events(id)).length, 0);
  } finally {
    club.participant = lookup;
  }
});

test("Concurrent forecasts and commitments finish with a bounded connection pool", async () => {
  const maximum = pool.options.max,
    timeout = pool.options.connectionTimeoutMillis;
  pool.options.max = 2;
  pool.options.connectionTimeoutMillis = 1500;
  try {
    const id = await question();
    const a = await human("Concurrent fixture A"),
      b = await human("Concurrent fixture B");
    const results = await Promise.allSettled([
      club.submitForecast(id, a, {
        probability: 0.2,
        clientSubmissionId: "concurrent-a",
      }),
      club.submitForecast(id, b, {
        probability: 0.8,
        clientSubmissionId: "concurrent-b",
      }),
    ]);
    assert.equal(
      results.filter((x) => x.status === "fulfilled").length,
      2,
      "Transactions must reuse their checked-out client",
    );
    const second = await question();
    const jobs = await Promise.allSettled([
      club.commitOpen(id),
      club.commitOpen(second),
    ]);
    assert.equal(
      jobs.filter((x) => x.status === "fulfilled").length,
      2,
      "Local chain I/O must reuse the commitment job client",
    );
  } finally {
    pool.options.max = maximum;
    pool.options.connectionTimeoutMillis = timeout;
  }
});
