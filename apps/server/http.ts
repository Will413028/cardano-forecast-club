import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomUUID, randomBytes } from "node:crypto";
import { z, ZodError } from "zod";
import { pool, transaction } from "./db.js";
import { Club, HttpError, requireValue } from "./service.js";
import {
  sha256,
  BOUNDARY_TEXT,
  scoreForecasts,
} from "../../packages/core/index.js";
import { runBaseline } from "./baseline.js";
const secret = () => randomBytes(32).toString("hex");
export function createApp(club = new Club()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "128kb" }));
  const production = process.env.NODE_ENV === "production";
  const origin = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3318";
  if (production && (!process.env.SMTP_URL || !origin.startsWith("https://")))
    throw new Error("Production requires SMTP delivery and HTTPS origin");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    next();
  });
  const counts = new Map<string, { at: number; n: number }>();
  app.use("/api", async (req, res, next) => {
    try {
      const key = req.ip ?? "unknown";
      const now = Date.now();
      if (counts.size > 10000)
        for (const [k, v] of counts) if (now - v.at > 60000) counts.delete(k);
      const count = counts.get(key);
      const v = count && now - count.at < 60000 ? count : { at: now, n: 0 };
      v.n++;
      counts.set(key, v);
      requireValue(v.n <= 120, 429, "Rate limit exceeded");
      let person, session;
      const bearer = req.headers.authorization?.match(
        /^Bearer ([a-f0-9]{64})$/,
      )?.[1];
      if (req.headers.authorization)
        requireValue(bearer, 401, "Malformed Agent token");
      if (bearer) {
        const r = await pool.query(
          "SELECT p.* FROM participants p JOIN agent_tokens t ON t.participant_id=p.id WHERE t.hash=$1",
          [sha256(bearer)],
        );
        requireValue(r.rowCount, 401, "Agent token invalid or revoked");
        person = r.rows[0];
      } else {
        const cookie = req.headers.cookie
          ?.split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("forecast_session="))
          ?.slice(17);
        if (cookie) {
          const r = await pool.query(
            "SELECT s.*,p.nickname,p.kind,p.model,p.admin,p.consent_at FROM sessions s JOIN participants p ON p.id=s.participant_id WHERE s.hash=$1 AND s.expires_at>$2 AND s.idle_at>$3",
            [sha256(cookie), new Date(), new Date(Date.now() - 30 * 60000)],
          );
          if (r.rowCount) {
            session = r.rows[0];
            person = { ...session, id: session.participant_id };
            await pool.query(
              "UPDATE sessions SET idle_at=now() WHERE hash=$1",
              [session.hash],
            );
          }
        }
      }
      res.locals.person = person;
      res.locals.session = session;
      if (!["GET", "HEAD"].includes(req.method) && !bearer) {
        requireValue(
          !req.headers.origin || req.headers.origin === origin,
          403,
          "Cross-origin write rejected",
        );
        if (person)
          requireValue(
            req.headers["x-csrf-token"] === session.csrf,
            403,
            "CSRF token required",
          );
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  const auth = (_req: Request, res: Response, next: NextFunction) =>
    res.locals.person ? next() : next(new HttpError(401, "Sign in first"));
  const admin = (_req: Request, res: Response, next: NextFunction) =>
    res.locals.person?.admin
      ? next()
      : next(new HttpError(403, "Operator access required"));
  app.get("/api/config", (_req, res) =>
    res.json({
      network: club.chain.network,
      localAuthPreview: !production,
      boundaries: BOUNDARY_TEXT,
      aiBudgetUSD: 30,
    }),
  );
  app.get("/api/me", (_req, res) =>
    res.json({
      participant: res.locals.person
        ? {
            id: res.locals.person.id,
            nickname: res.locals.person.nickname,
            kind: res.locals.person.kind,
            admin: res.locals.person.admin,
            consent: !!res.locals.person.consent_at,
          }
        : null,
      csrf: res.locals.session?.csrf ?? null,
    }),
  );
  app.post("/api/auth/request", async (req, res) => {
    const { email, nickname } = z
      .object({ email: z.email(), nickname: z.string().min(2).max(40) })
      .parse(req.body);
    const token = secret();
    await pool.query(
      "INSERT INTO login_links(hash,email,nickname,expires_at) VALUES($1,$2,$3,$4)",
      [
        sha256(token),
        email.toLowerCase(),
        nickname,
        new Date(Date.now() + 15 * 60000),
      ],
    );
    const link = `${origin}/?login=${token}`;
    if (production) {
      const { default: mailer } = await import("nodemailer");
      await mailer.createTransport(process.env.SMTP_URL!).sendMail({
        from: process.env.MAIL_FROM ?? "Forecast Club <noreply@example.com>",
        to: email,
        subject: "Sign in to Forecast Club",
        text: link,
      });
      res.json({ sent: true });
    } else res.json({ sent: true, developmentLink: link });
  });
  app.post("/api/auth/consume", async (req, res) => {
    const { token } = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(req.body);
    const person = await transaction(async (c) => {
      const r = await c.query(
        "DELETE FROM login_links WHERE hash=$1 AND expires_at>now() RETURNING email,nickname",
        [sha256(token)],
      );
      requireValue(
        r.rowCount,
        401,
        "Login link invalid, expired or already used",
      );
      const x = r.rows[0];
      const admins = (
        process.env.ADMIN_EMAILS ??
        (production ? "" : "operator@forecast.local")
      ).split(",");
      const p = await c.query(
        "INSERT INTO participants(id,email,nickname,kind,admin) VALUES($1,$2,$3,'human',$4) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING *",
        [randomUUID(), x.email, x.nickname, admins.includes(x.email)],
      );
      return p.rows[0];
    });
    const sessionToken = secret(),
      csrf = secret();
    const old = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("forecast_session="))
      ?.slice(17);
    if (old)
      await pool.query("DELETE FROM sessions WHERE hash=$1", [sha256(old)]);
    await pool.query(
      "INSERT INTO sessions(hash,participant_id,csrf,expires_at,idle_at) VALUES($1,$2,$3,$4,now())",
      [
        sha256(sessionToken),
        person.id,
        csrf,
        new Date(Date.now() + 12 * 3600000),
      ],
    );
    res.cookie("forecast_session", sessionToken, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      maxAge: 12 * 3600000,
      path: "/",
    });
    res.json({ id: person.id, csrf });
  });
  app.post("/api/auth/logout", auth, async (_req, res) => {
    await pool.query("DELETE FROM sessions WHERE hash=$1", [
      res.locals.session?.hash,
    ]);
    res.clearCookie("forecast_session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/consent", auth, async (req, res) => {
    requireValue(req.body.accept === true, 422, "Explicit consent required");
    await pool.query("UPDATE participants SET consent_at=now() WHERE id=$1", [
      res.locals.person.id,
    ]);
    res.json({ ok: true });
  });
  app.post("/api/privacy/unlink", auth, async (_req, res) => {
    const id = res.locals.person.id;
    await transaction(async (c) => {
      await c.query(
        "UPDATE participants SET email=NULL,admin=false WHERE id=$1",
        [id],
      );
      await c.query(
        "DELETE FROM agent_tokens WHERE participant_id=$1 OR participant_id IN (SELECT agent_id FROM agent_owners WHERE owner_id=$1)",
        [id],
      );
      await c.query("DELETE FROM sessions WHERE participant_id=$1", [id]);
    });
    res.clearCookie("forecast_session", { path: "/" });
    res.json({
      ok: true,
      message:
        "Account mapping removed. Public forecasts and nickname snapshots are retained.",
    });
  });
  app.post("/api/agents", auth, async (req, res) => {
    const data = z
      .object({
        nickname: z.string().min(2).max(40),
        model: z.string().min(1).max(100),
        accept: z.literal(true),
      })
      .parse(req.body);
    const id = randomUUID(),
      token = secret();
    await transaction(async (c) => {
      await c.query(
        "INSERT INTO participants(id,nickname,kind,model,consent_at) VALUES($1,$2,'agent',$3,now())",
        [id, data.nickname, data.model],
      );
      await c.query(
        "INSERT INTO agent_tokens(hash,participant_id) VALUES($1,$2)",
        [sha256(token), id],
      );
      await c.query(
        "INSERT INTO agent_owners(owner_id,agent_id) VALUES($1,$2)",
        [res.locals.person.id, id],
      );
    });
    res.json({ id, token, nickname: data.nickname, model: data.model });
  });
  app.get("/api/agents", auth, async (_req, res) => {
    const r = await pool.query(
      "SELECT p.id,p.nickname,p.model,EXISTS(SELECT 1 FROM agent_tokens t WHERE t.participant_id=p.id) AS active FROM participants p JOIN agent_owners o ON o.agent_id=p.id WHERE o.owner_id=$1",
      [res.locals.person.id],
    );
    res.json(r.rows);
  });
  app.delete("/api/agents/:id/token", auth, async (req, res) => {
    const r = await pool.query(
      "DELETE FROM agent_tokens WHERE participant_id=$1 AND EXISTS(SELECT 1 FROM agent_owners WHERE owner_id=$2 AND agent_id=$1) RETURNING hash",
      [req.params.id, res.locals.person.id],
    );
    requireValue(r.rowCount, 404, "Owned active agent not found");
    res.json({ ok: true });
  });
  app.get("/api/questions", async (_req, res) => {
    const rows = (
      await pool.query(
        res.locals.person?.admin
          ? "SELECT id FROM questions ORDER BY created_at DESC"
          : "SELECT id FROM questions WHERE status!='draft' ORDER BY created_at DESC",
      )
    ).rows;
    res.json(
      await Promise.all(
        rows.map((r) =>
          club.publicQuestion(
            r.id,
            res.locals.person?.id,
            !!res.locals.person?.admin,
          ),
        ),
      ),
    );
  });
  app.get("/api/questions/:id", async (req, res) => {
    const q = await club.question(String(req.params.id));
    requireValue(
      q.status !== "draft" || res.locals.person?.admin,
      404,
      "Question not found",
    );
    res.json(
      await club.publicQuestion(
        q.id,
        res.locals.person?.id,
        !!res.locals.person?.admin,
      ),
    );
  });
  app.post("/api/questions/:id/forecasts", auth, async (req, res) =>
    res
      .status(201)
      .json(
        await club.submitForecast(
          String(req.params.id),
          res.locals.person.id,
          req.body,
        ),
      ),
  );
  app.post("/api/questions/:id/disputes", auth, async (req, res) =>
    res.json(
      await club.dispute(
        String(req.params.id),
        res.locals.person.id,
        z.string().parse(req.body.reason),
      ),
    ),
  );
  app.get("/api/leaderboard", async (_req, res) =>
    res.json(await club.leaderboard()),
  );
  app.get("/api/profiles/:id", async (req, res) => {
    const id = String(req.params.id),
      data = await club.exportRound();
    res.json({
      participant: (({ id, nickname, kind, model }) => ({
        id,
        nickname,
        kind,
        model,
      }))(await club.participant(id)),
      events: data.events.filter((e) => e.participantId === id),
      score: data.scores.find((s) => s.participantId === id) ?? null,
      questionScores: data.questions.flatMap((q) =>
        scoreForecasts([q], data.events)
          .filter((s) => s.participantId === id)
          .map((s) => ({
            questionId: q.id,
            title: q.record.title,
            outcome: q.resolution!.outcome,
            scorePPM: s.scorePPM,
          })),
      ),
    });
  });
  app.get("/api/export", async (_req, res) => {
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="forecast-round.json"',
    );
    res.json(await club.exportRound());
  });
  app.get("/api/ledger", async (_req, res) => {
    requireValue(
      club.chain.network === "local",
      404,
      "Use the public Preprod chain instead",
    );
    const rows = await pool.query("SELECT * FROM local_ledger ORDER BY id");
    res.json({
      network: "local",
      simulation: true,
      entries: rows.rows.map((x) => ({
        txId: x.id,
        metadata: x.metadata,
        confirmedAt: x.confirmed_at,
        network: "local",
      })),
    });
  });
  app.get("/api/admin/ops", admin, async (_req, res) =>
    res.json(await club.ops()),
  );
  app.post("/api/admin/questions", admin, async (req, res) =>
    res.status(201).json(await club.createQuestion(req.body)),
  );
  app.post("/api/admin/questions/:id/publish", admin, async (req, res) =>
    res.json(await club.publish(String(req.params.id))),
  );
  app.post("/api/admin/questions/:id/close", admin, async (req, res) =>
    res.json(await club.closeRound(String(req.params.id))),
  );
  app.post("/api/admin/questions/:id/resolve", admin, async (req, res) =>
    res.json(await club.autoResolve(String(req.params.id))),
  );
  app.post("/api/admin/questions/:id/void", admin, async (req, res) => {
    const v = await club.resolveQuestion(
      String(req.params.id),
      null,
      z.string().parse(req.body.reason),
      { operatorReason: req.body.reason },
    );
    await club.commitResolution(String(req.params.id));
    res.json(v);
  });
  app.post("/api/admin/questions/:id/correct", admin, async (req, res) => {
    const data = z
      .object({
        outcome: z.union([z.literal(0), z.literal(1)]),
        reason: z.string().min(8),
        evidence: z.record(z.string(), z.unknown()),
      })
      .parse(req.body);
    const result = await club.resolveQuestion(
      String(req.params.id),
      data.outcome,
      data.reason,
      data.evidence,
    );
    await club.commitResolution(String(req.params.id));
    res.json(result);
  });
  app.post("/api/admin/questions/:id/finalize", admin, async (req, res) =>
    res.json(await club.finalize(String(req.params.id))),
  );
  app.post("/api/admin/disputes/:id/answer", admin, async (req, res) => {
    await club.answerDispute(
      String(req.params.id),
      z.string().parse(req.body.response),
    );
    res.json({ ok: true });
  });
  app.post("/api/admin/tick", admin, async (_req, res) => {
    await club.tick();
    res.json(await club.ops());
  });
  app.post("/api/admin/baseline/:id", admin, async (req, res) =>
    res.json(await runBaseline(club, String(req.params.id))),
  );
  app.use(express.static(new URL("../../dist/web", import.meta.url).pathname));
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof ZodError)
        res.status(422).json({
          error: "Invalid request",
          details: error.issues.map((i) => ({
            path: i.path,
            message: i.message,
          })),
        });
      else if (error instanceof HttpError)
        res.status(error.status).json({ error: error.message });
      else {
        console.error(
          JSON.stringify({
            level: "error",
            error: "Unhandled request failure",
          }),
        );
        res
          .status(500)
          .json({ error: "Operation failed. Check operator status." });
      }
    },
  );
  return app;
}
