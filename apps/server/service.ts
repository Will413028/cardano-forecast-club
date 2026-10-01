import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool, transaction, type DbClient } from "./db.js";
import {
  hashRecord,
  merkleRoot,
  scoreForecasts,
  FORMAT_VERSION,
  BOUNDARY_TEXT,
  type QuestionRecord,
  type ForecastEvent,
  type ResolutionRecord,
} from "../../packages/core/index.js";
import {
  type Chain,
  type AnchorMetadata,
  type PreparedAnchor,
} from "../../packages/chain/index.js";
import { configuredChain, LocalChain } from "./local-chain.js";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireValue(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
const iso = z.string().datetime();
export const questionInput = z.object({
  title: z.string().min(8).max(240),
  deadline: iso,
  rule: z.string().min(15).max(4000),
  source: z.object({
    type: z.literal("github_release"),
    repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
    publishedAfter: iso,
    tagPattern: z.string().max(100).default(""),
  }),
});
export const forecastInput = z.object({
  probability: z.number().min(0).max(1),
  clientSubmissionId: z.string().min(8).max(100),
});
export class Club {
  constructor(
    public chain: Chain = configuredChain(),
    public now = () => new Date(),
  ) {}
  async question(id: string, db: DbClient = pool) {
    const r = await db.query("SELECT * FROM questions WHERE id=$1", [id]);
    requireValue(r.rowCount, 404, "Question not found");
    return r.rows[0] as {
      id: string;
      record: QuestionRecord;
      status: string;
      finalization?: any;
    };
  }
  async participant(id: string, db: DbClient = pool) {
    const r = await db.query(
      "SELECT id,nickname,kind,model,admin,consent_at FROM participants WHERE id=$1",
      [id],
    );
    requireValue(r.rowCount, 401, "Participant not found");
    return r.rows[0];
  }
  async createQuestion(input: unknown) {
    const parsed = questionInput.parse(input);
    const deadline = new Date(parsed.deadline);
    requireValue(deadline > this.now(), 422, "Deadline must be in the future");
    requireValue(
      deadline.getTime() - this.now().getTime() <= 28 * 86400000,
      422,
      "Question horizon must be at most 28 days",
    );
    requireValue(
      new Date(parsed.source.publishedAfter) < deadline,
      422,
      "Source window must precede deadline",
    );
    if (parsed.source.tagPattern)
      requireValue(
        /^[A-Za-z0-9._*+-]+$/.test(parsed.source.tagPattern),
        422,
        "Use a simple tag glob (no regular expression)",
      );
    const record: QuestionRecord = { id: randomUUID(), ...parsed };
    await pool.query(
      "INSERT INTO questions(id,record,status) VALUES($1,$2,$3)",
      [record.id, record, "draft"],
    );
    return this.question(record.id);
  }
  async events(id: string): Promise<ForecastEvent[]> {
    const r = await pool.query(
      "SELECT body,seq FROM forecast_events WHERE question_id=$1 ORDER BY seq",
      [id],
    );
    return r.rows.map((x) => ({ ...x.body, seq: Number(x.seq) }));
  }
  async resolution(
    id: string,
    db: DbClient = pool,
  ): Promise<ResolutionRecord | null> {
    const r = await db.query(
      "SELECT body FROM resolutions WHERE question_id=$1 ORDER BY seq DESC LIMIT 1",
      [id],
    );
    return r.rows[0]?.body ?? null;
  }
  async enqueue(
    id: string,
    kind: "rules" | "forecasts" | "close" | "resolution" | "final",
    records: unknown[],
    upto: number,
  ) {
    const metadata: AnchorMetadata = {
      v: FORMAT_VERSION,
      id: hashRecord({ questionId: id, kind, upto }),
      root: merkleRoot(records),
      count: records.length,
      kind,
    };
    const key = hashRecord(metadata);
    await pool.query(
      "INSERT INTO anchors(id,question_id,kind,upto,metadata,state) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [key, id, kind, upto, metadata, "pending"],
    );
    await this.anchorJob(key);
    return key;
  }
  async anchorJob(id: string) {
    const c = await pool.connect();
    try {
      await c.query("SELECT pg_advisory_lock(hashtext($1))", [id]);
      const r = await c.query("SELECT * FROM anchors WHERE id=$1", [id]);
      requireValue(r.rowCount, 404, "Anchor missing");
      const a = r.rows[0];
      if (a.state === "confirmed") return;
      let prepared: PreparedAnchor = a.proof;
      if (!prepared) {
        prepared = await this.chain.prepare(a.metadata);
        await c.query(
          "UPDATE anchors SET proof=$2,attempts=attempts+1 WHERE id=$1",
          [id, prepared],
        );
      }
      // Retry the exact prepared bytes. A crash after broadcast never constructs another transaction.
      const read = (txId: string) =>
        this.chain instanceof LocalChain
          ? this.chain.read(txId, c)
          : this.chain.read(txId);
      const submit = (anchor: PreparedAnchor) =>
        this.chain instanceof LocalChain
          ? this.chain.submit(anchor, c)
          : this.chain.submit(anchor);
      let proof;
      try {
        proof = await read(prepared.txId);
      } catch {
        try {
          await submit(prepared);
        } catch {
          /* May already have been broadcast; read is authoritative. */
        }
        proof = await read(prepared.txId);
      }
      requireValue(
        hashRecord(proof.metadata) === hashRecord(a.metadata),
        422,
        "Chain metadata differs from prepared commitment",
      );
      await c.query(
        "UPDATE anchors SET state='confirmed',proof=$2,error=NULL WHERE id=$1",
        [id, proof],
      );
    } catch (e) {
      await c.query(
        "UPDATE anchors SET state='failed',error=$2,attempts=attempts+1 WHERE id=$1",
        [id, "Anchor submission or confirmation failed"],
      );
      await this.failure("anchor", id, c);
      throw e;
    } finally {
      try {
        await c.query("SELECT pg_advisory_unlock(hashtext($1))", [id]);
      } finally {
        c.release();
      }
    }
  }
  async publish(id: string) {
    const q = await this.question(id);
    requireValue(
      q.status === "draft",
      409,
      "Only draft questions may be published",
    );
    await this.enqueue(id, "rules", [q.record], 0);
    requireValue(
      new Date(q.record.deadline) > this.now(),
      409,
      "Question expired before rules commitment",
    );
    await pool.query(
      "UPDATE questions SET status='open' WHERE id=$1 AND status='draft'",
      [id],
    );
    return this.question(id);
  }
  async submitForecast(id: string, participantId: string, input: unknown) {
    const body = forecastInput.parse(input);
    const ppm = Math.round(body.probability * 1_000_000);
    return transaction(async (c) => {
      const qr = await c.query(
        "SELECT * FROM questions WHERE id=$1 FOR UPDATE",
        [id],
      );
      requireValue(qr.rowCount, 404, "Question not found");
      const q = qr.rows[0];
      const existing = await c.query(
        "SELECT body,seq FROM forecast_events WHERE question_id=$1 AND participant_id=$2 AND client_id=$3",
        [id, participantId, body.clientSubmissionId],
      );
      if (existing.rowCount) {
        requireValue(
          existing.rows[0].body.probabilityPPM === ppm,
          409,
          "Idempotency key has different content",
        );
        return { ...existing.rows[0].body, seq: Number(existing.rows[0].seq) };
      }
      const person = await this.participant(participantId, c);
      requireValue(person.consent_at, 403, "Public history consent required");
      const acceptedAt = this.now();
      requireValue(
        q.status === "open" && acceptedAt < new Date(q.record.deadline),
        409,
        "Question closed",
      );
      const event = {
        id: randomUUID(),
        questionId: id,
        participantId,
        nickname: person.nickname,
        kind: person.kind,
        model: person.model,
        probabilityPPM: ppm,
        receivedAt: acceptedAt.toISOString(),
      };
      const row = await c.query(
        "INSERT INTO forecast_events(id,question_id,participant_id,client_id,body) VALUES($1,$2,$3,$4,$5) RETURNING seq",
        [event.id, id, participantId, body.clientSubmissionId, event],
      );
      return { ...event, seq: Number(row.rows[0].seq) };
    });
  }
  async closeRound(id: string) {
    await transaction(async (c) => {
      const r = await c.query(
        "SELECT * FROM questions WHERE id=$1 FOR UPDATE",
        [id],
      );
      requireValue(r.rowCount, 404, "Question not found");
      requireValue(
        this.now() >= new Date(r.rows[0].record.deadline),
        409,
        "Cannot close before deadline",
      );
      await c.query(
        "UPDATE questions SET status='closed' WHERE id=$1 AND status='open'",
        [id],
      );
    });
    const events = await this.events(id);
    await this.enqueue(id, "close", events, events.at(-1)?.seq ?? 0);
    return this.question(id);
  }
  async commitOpen(id: string) {
    const q = await this.question(id);
    requireValue(q.status === "open", 409, "Question is not open");
    const e = await this.events(id);
    return this.enqueue(id, "forecasts", e, e.at(-1)?.seq ?? 0);
  }
  async failure(kind: string, id: string, db: DbClient = pool) {
    await db.query(
      "INSERT INTO ops_events(kind,question_id,error) VALUES($1,$2,$3)",
      [kind, id, "Operation failed; inspect configuration and retry"],
    );
    console.error(
      JSON.stringify({
        level: "error",
        kind,
        questionId: id,
        error: "Operation failed",
      }),
    );
  }
  async resolveQuestion(
    id: string,
    outcome: 0 | 1 | null,
    reason: string,
    evidence: unknown,
  ) {
    return transaction(async (c) => {
      const r = await c.query(
        "SELECT * FROM questions WHERE id=$1 FOR UPDATE",
        [id],
      );
      requireValue(r.rowCount, 404, "Question not found");
      requireValue(
        ["closed", "provisional"].includes(r.rows[0].status) &&
          !r.rows[0].finalization,
        409,
        "Close the question first; final outcomes cannot be rewritten",
      );
      requireValue(
        reason.trim().length >= 8,
        422,
        "Evidence/reason is required",
      );
      const record: ResolutionRecord = {
        id: randomUUID(),
        questionId: id,
        outcome,
        reason,
        evidence,
        recordedAt: this.now().toISOString(),
        disputeUntil: new Date(
          this.now().getTime() + 7 * 86400000,
        ).toISOString(),
      };
      await c.query(
        "INSERT INTO resolutions(id,question_id,body,created_at) VALUES($1,$2,$3,$4)",
        [record.id, id, record, this.now()],
      );
      await c.query("UPDATE questions SET status='provisional' WHERE id=$1", [
        id,
      ]);
      return record;
    });
  }
  async commitResolution(id: string) {
    const history = await pool.query(
      "SELECT body FROM resolutions WHERE question_id=$1 ORDER BY seq",
      [id],
    );
    requireValue(history.rowCount, 409, "No resolution to commit");
    return this.enqueue(
      id,
      "resolution",
      history.rows.map((x) => x.body),
      history.rowCount!,
    );
  }
  async autoResolve(id: string) {
    try {
      const q = await this.question(id);
      requireValue(q.status === "closed", 409, "Question must be closed");
      const releases = [] as {
        tag_name: string;
        published_at: string;
        draft: boolean;
        prerelease: boolean;
        html_url: string;
      }[];
      let complete = false;
      for (let page = 1; page <= 10; page++) {
        const response = await fetch(
          `https://api.github.com/repos/${q.record.source.repository}/releases?per_page=100&page=${page}`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "forecast-club",
            },
            signal: AbortSignal.timeout(15000),
          },
        );
        requireValue(
          response.ok,
          502,
          "Resolution source unavailable; do not treat errors as No",
        );
        const batch = await response.json();
        requireValue(Array.isArray(batch), 502, "Invalid source response");
        releases.push(
          ...batch.map((x: any) => ({
            tag_name: x.tag_name,
            published_at: x.published_at,
            draft: x.draft,
            prerelease: x.prerelease,
            html_url: x.html_url,
          })),
        );
        if (batch.length < 100) {
          complete = true;
          break;
        }
      }
      requireValue(
        complete,
        502,
        "Source pagination incomplete; manual evidence or void required",
      );
      const pattern = q.record.source.tagPattern;
      const match = (tag: string) =>
        !pattern ||
        new RegExp(
          "^" +
            pattern
              .split("*")
              .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
              .join(".*") +
            "$",
        ).test(tag);
      const hits = releases.filter(
        (x) =>
          !x.draft &&
          !x.prerelease &&
          x.published_at &&
          new Date(x.published_at) >=
            new Date(q.record.source.publishedAfter) &&
          new Date(x.published_at) < new Date(q.record.deadline) &&
          match(x.tag_name),
      );
      const evidence = {
        sourceUrl: `https://api.github.com/repos/${q.record.source.repository}/releases`,
        observedAt: this.now().toISOString(),
        snapshotHash: hashRecord(releases),
        releases,
        matches: hits.map((x) => x.tag_name),
      };
      const result = await this.resolveQuestion(
        id,
        hits.length ? 1 : 0,
        "GitHub Releases matched the fixed API rule",
        evidence,
      );
      await this.commitResolution(id);
      return result;
    } catch (e) {
      await this.failure("resolution", id);
      throw e;
    }
  }
  async dispute(id: string, participantId: string, reason: string) {
    return transaction(async (c) => {
      await c.query("SELECT id FROM questions WHERE id=$1 FOR UPDATE", [id]);
      const q = await this.question(id, c);
      const result = await this.resolution(id, c);
      requireValue(
        q.status === "provisional" &&
          result &&
          this.now() < new Date(result.disputeUntil),
        409,
        "Dispute window closed",
      );
      requireValue(
        reason.trim().length >= 8 && reason.length <= 4000,
        422,
        "Give a clear dispute reason",
      );
      const did = randomUUID();
      await c.query(
        "INSERT INTO disputes(id,question_id,participant_id,reason,created_at) VALUES($1,$2,$3,$4,$5)",
        [did, id, participantId, reason, this.now()],
      );
      return { id: did };
    });
  }
  async answerDispute(id: string, response: string) {
    requireValue(response.trim().length >= 8, 422, "Response required");
    const r = await pool.query(
      "UPDATE disputes SET status='answered',response=$2 WHERE id=$1 AND status='open' RETURNING id",
      [id, response],
    );
    requireValue(r.rowCount, 404, "Open dispute not found");
  }
  async finalize(id: string) {
    await this.commitResolution(id);
    const record = await transaction(async (c) => {
      const qr = await c.query(
        "SELECT * FROM questions WHERE id=$1 FOR UPDATE",
        [id],
      );
      const q = qr.rows[0];
      requireValue(q, 404, "Question not found");
      if (q.finalization) return q.finalization;
      const result = await this.resolution(id, c);
      requireValue(
        q.status === "provisional" &&
          result &&
          this.now() >= new Date(result.disputeUntil),
        409,
        "Wait for the seven-day dispute window",
      );
      const disputes = await c.query(
        "SELECT id,reason,status,response FROM disputes WHERE question_id=$1 ORDER BY id",
        [id],
      );
      requireValue(
        !disputes.rows.some((x) => x.status === "open"),
        409,
        "Unanswered disputes remain",
      );
      const record = {
        questionId: id,
        resolutionId: result.id,
        status: result.outcome === null ? "void" : "resolved",
        finalizedAt: this.now().toISOString(),
        disputes: disputes.rows,
      };
      await c.query("UPDATE questions SET finalization=$2 WHERE id=$1", [
        id,
        record,
      ]);
      return record;
    });
    await this.enqueue(id, "final", [record], 0);
    await pool.query("UPDATE questions SET status=$2 WHERE id=$1", [
      id,
      record.status,
    ]);
    return { status: record.status };
  }
  async publicQuestion(id: string, viewer?: string, admin = false) {
    const q = await this.question(id);
    const canSee =
      this.now() >= new Date(q.record.deadline) && q.status !== "draft";
    let events = await this.events(id);
    if (!canSee && !admin)
      events = events.filter((e) => e.participantId === viewer);
    const anchors = await pool.query(
      "SELECT id,kind,upto,metadata,state,proof,error FROM anchors WHERE question_id=$1 ORDER BY kind,upto",
      [id],
    );
    const disputes = await pool.query(
      "SELECT id,participant_id,reason,status,response,created_at FROM disputes WHERE question_id=$1 ORDER BY created_at",
      [id],
    );
    return {
      ...q,
      resolution: await this.resolution(id),
      events,
      anchors: anchors.rows.map((a) => ({
        ...a,
        proof: a.state === "confirmed" ? a.proof : null,
      })),
      disputes: disputes.rows,
    };
  }
  async exportRound() {
    const q = (
      await pool.query(
        "SELECT id FROM questions WHERE status NOT IN ('draft','open') ORDER BY id",
      )
    ).rows;
    const questions = [];
    const events = [];
    const anchors = [];
    for (const x of q) {
      const a = await this.question(x.id);
      if (this.now() < new Date(a.record.deadline)) continue;
      const resolutions = (
        await pool.query(
          "SELECT body FROM resolutions WHERE question_id=$1 ORDER BY seq",
          [x.id],
        )
      ).rows.map((r) => r.body);
      const e = await this.events(x.id);
      questions.push({
        ...a,
        resolution: resolutions.at(-1) ?? null,
        resolutions,
      });
      events.push(...e);
      anchors.push(
        ...(
          await pool.query(
            "SELECT id,question_id,kind,upto,metadata,proof FROM anchors WHERE question_id=$1 AND state='confirmed' ORDER BY kind,upto",
            [x.id],
          )
        ).rows.map((a) => ({ ...a, upto: Number(a.upto) })),
      );
    }
    return {
      version: FORMAT_VERSION,
      network: this.chain.network,
      boundaries: BOUNDARY_TEXT,
      questions,
      events,
      anchors,
      scores: scoreForecasts(questions, events),
    };
  }
  async leaderboard() {
    const data = await this.exportRound();
    return { scores: data.scores, network: data.network };
  }
  async tick() {
    const rows = (
      await pool.query(
        "SELECT id,status,record FROM questions WHERE status IN ('open','closed','provisional')",
      )
    ).rows;
    for (const q of rows) {
      try {
        if (q.status === "open") {
          if (this.now() >= new Date(q.record.deadline))
            await this.closeRound(q.id);
          else {
            const last = (
              await pool.query(
                "SELECT proof FROM anchors WHERE question_id=$1 AND state='confirmed' AND kind IN ('rules','forecasts') ORDER BY proof->>'confirmedAt' DESC LIMIT 1",
                [q.id],
              )
            ).rows[0];
            if (
              !last ||
              this.now().getTime() - Date.parse(last.proof.confirmedAt) >=
                86400000
            )
              await this.commitOpen(q.id);
          }
        }
        if (q.status === "provisional") {
          const r = await this.resolution(q.id);
          if (r && this.now() >= new Date(r.disputeUntil))
            await this.finalize(q.id);
        }
      } catch {
        /* Failure recorded by anchor/resolution jobs; ops-check reports unresolved state. */
      }
    }
    const retry = (
      await pool.query("SELECT id FROM anchors WHERE state!='confirmed'")
    ).rows;
    for (const a of retry) {
      try {
        await this.anchorJob(a.id);
      } catch {}
    }
  }
  async ops() {
    const r = await pool.query(
      "SELECT id,question_id,kind,state,error,attempts FROM anchors WHERE state!='confirmed'",
    );
    const events = await pool.query(
      "SELECT * FROM ops_events ORDER BY id DESC LIMIT 20",
    );
    const unresolved = await pool.query(
      "SELECT id,record FROM questions WHERE status='closed'",
    );
    return {
      ok: r.rowCount === 0 && unresolved.rowCount === 0,
      pendingAnchors: r.rows,
      pendingResolutions: unresolved.rows,
      recentFailures: events.rows,
    };
  }
}
