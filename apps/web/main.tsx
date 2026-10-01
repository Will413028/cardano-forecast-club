import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
type Q = any;
let csrf: string | null = null;
async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch("/api" + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "Request failed");
  return d;
}
const date = (s: string) => new Date(s).toLocaleString();
const percent = (n: number) => (n / 10000).toFixed(1) + "%";
function App() {
  const [config, setConfig] = useState<any>({});
  const [me, setMe] = useState<any>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [tab, setTab] = useState("questions");
  const [selected, setSelected] = useState<Q>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [login, setLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [link, setLink] = useState("");
  const [p, setP] = useState(50);
  const [consent, setConsent] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [agentToken, setAgentToken] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [ops, setOps] = useState<any>(null);
  async function refresh() {
    const [c, u, q, l] = await Promise.all([
      api("/config"),
      api("/me"),
      api("/questions"),
      api("/leaderboard"),
    ]);
    setConfig(c);
    setMe(u.participant);
    csrf = u.csrf;
    setQuestions(q);
    setScores(l.scores);
    setSelected((current: Q) =>
      current ? (q.find((x: Q) => x.id === current.id) ?? null) : null,
    );
    if (u.participant) {
      setAgents(await api("/agents"));
      if (u.participant.admin) setOps(await api("/admin/ops"));
    }
  }
  async function act(fn: () => Promise<any>, success = "Saved") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fn();
      setMessage(success);
      await refresh();
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void (async () => {
      try {
        const token = new URLSearchParams(location.search).get("login");
        if (token) {
          await api("/auth/consume", { token });
          history.replaceState({}, "", location.pathname);
        }
        await refresh();
        const match = location.hash.match(/^#profile=(.+)$/);
        if (match) {
          setProfile(await api("/profiles/" + encodeURIComponent(match[1])));
          setTab("profile");
        }
      } catch (e) {
        setError(String(e));
      }
    })();
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const remaining = (q: Q) =>
    new Date(q.record.deadline).getTime() > Date.now();
  const open = questions.filter((q) => q.status === "open" && remaining(q));
  async function openProfile(id: string) {
    await act(async () => {
      setProfile(await api("/profiles/" + id));
      setTab("profile");
      location.hash = "profile=" + id;
    }, "");
  }
  function select(q: Q) {
    setSelected(q);
    const own = q.events.filter((e: any) => e.participantId === me?.id).at(-1);
    setP(own ? own.probabilityPPM / 10000 : 50);
    setTab("questions");
  }
  const btn = (text: string, fn: () => Promise<any>, kind = "secondary") => (
    <button className={kind} disabled={busy} onClick={() => void act(fn)}>
      {text}
    </button>
  );
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={() => {
            setTab("questions");
            setSelected(null);
          }}
        >
          ◈ <span>FORECAST CLUB</span>
        </a>
        <nav>
          <button
            className={tab === "questions" ? "active" : ""}
            onClick={() => setTab("questions")}
          >
            Questions
          </button>
          <button
            className={tab === "scores" ? "active" : ""}
            onClick={() => setTab("scores")}
          >
            Leaderboard
          </button>
          <button
            className={tab === "verify" ? "active" : ""}
            onClick={() => setTab("verify")}
          >
            Verify
          </button>
          {me && <button onClick={() => setTab("agents")}>Agents</button>}
          {me?.admin && (
            <button onClick={() => setTab("admin")}>Operator</button>
          )}
        </nav>
        <div>
          {me ? (
            <button
              onClick={() =>
                void act(() => api("/auth/logout", {}), "Signed out")
              }
            >
              {me.nickname} ↗ Sign out
            </button>
          ) : (
            <button className="primary" onClick={() => setLogin(true)}>
              Join the club ↗
            </button>
          )}
        </div>
      </header>
      <main>
        {error && (
          <div role="alert" className="notice error">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {message && (
          <div role="status" className="notice">
            {message}
          </div>
        )}
        <div className="mode">
          <span className="dot" />
          {config.network === "local"
            ? "LOCAL SIMULATION · no blockchain timestamps"
            : config.network === "preprod"
              ? "CARDANO PREPROD · test network"
              : "CONNECTING · loading club status"}
          <span>Human intuition. Machine reasoning. One record.</span>
        </div>
        {tab === "questions" && !selected && (
          <>
            <section className="hero">
              <div className="eyebrow">YOUR NEXT CALL MATTERS</div>
              <h1>
                What happens
                <br />
                next?
              </h1>
              <p>
                Make your call on technology’s near future.
                <br />
                Compare your probabilities with people and AI.
              </p>
              <div className="hero-foot">
                <span>{open.length} open questions</span>
                <span>Binary forecasts · Brier scoring</span>
              </div>
              <div className="orb">
                ◈
                <small>
                  MAKE A CALL
                  <br />
                  KEEP A RECORD
                </small>
              </div>
            </section>
            <div className="section-title">
              <h2>The forecast board</h2>
              <input
                aria-label="Search questions"
                placeholder="Search questions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filters">
              {["all", "open", "closed", "resolved", "void"].map((x) => (
                <button
                  className={filter === x ? "active" : ""}
                  onClick={() => setFilter(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </div>
            <div className="cards">
              {questions
                .filter(
                  (q) =>
                    (filter === "all" ||
                      (filter === "open"
                        ? q.status === "open" && remaining(q)
                        : q.status === filter)) &&
                    q.record.title.toLowerCase().includes(query.toLowerCase()),
                )
                .map((q) => (
                  <button className="card" key={q.id} onClick={() => select(q)}>
                    <div className="card-top">
                      <span className={"badge " + q.status}>
                        {q.status === "open" && !remaining(q)
                          ? "awaiting close"
                          : q.status}
                      </span>
                      <span>↗</span>
                    </div>
                    <h3>{q.record.title}</h3>
                    <p>{q.record.source.repository} · GitHub Releases</p>
                    <div className="card-bottom">
                      <span>
                        {remaining(q) ? "Closes" : "Closed"}{" "}
                        {new Date(q.record.deadline).toLocaleDateString()}
                      </span>
                      <span>
                        {q.resolution?.outcome === null && q.status === "void"
                          ? "Voided"
                          : q.resolution
                            ? `Outcome: ${q.resolution.outcome ? "Yes" : "No"}`
                            : "Make a forecast →"}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
            {config.network && !questions.length && (
              <div className="empty">
                <h3>A fresh forecast board.</h3>
                <p>
                  The operator can publish the first question. Sign in locally
                  as operator@forecast.local to use the Operator workspace.
                </p>
              </div>
            )}
          </>
        )}
        {tab === "questions" && selected && (
          <>
            <button className="back" onClick={() => setSelected(null)}>
              ← All questions
            </button>
            <div className="detail">
              <article>
                <span className={"badge " + selected.status}>
                  {selected.status}
                </span>
                <h1>{selected.record.title}</h1>
                <div className="meta">
                  Deadline {date(selected.record.deadline)} · UTC rules
                </div>
                <h3>Resolution rules</h3>
                <p className="rule">{selected.record.rule}</p>
                <div className="source">
                  <strong>Official API source</strong>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={
                      "https://api.github.com/repos/" +
                      selected.record.source.repository +
                      "/releases"
                    }
                  >
                    {selected.record.source.repository} ↗
                  </a>
                  <small>
                    Stable releases · after{" "}
                    {date(selected.record.source.publishedAfter)} · tag{" "}
                    {selected.record.source.tagPattern || "any"}
                  </small>
                </div>
                {selected.resolution && (
                  <section className="result">
                    <h3>
                      {selected.status === "provisional"
                        ? "Provisional result"
                        : selected.status === "void"
                          ? "Question voided"
                          : "Final result"}
                      :{" "}
                      {selected.resolution.outcome === null
                        ? "Void"
                        : selected.resolution.outcome
                          ? "Yes"
                          : "No"}
                    </h3>
                    <p>{selected.resolution.reason}</p>
                    <small>
                      Dispute window ends{" "}
                      {date(selected.resolution.disputeUntil)}
                    </small>
                    <details>
                      <summary>Public evidence</summary>
                      <pre>
                        {JSON.stringify(selected.resolution.evidence, null, 2)}
                      </pre>
                    </details>
                  </section>
                )}
                <h3>
                  {remaining(selected)
                    ? "Your submission history"
                    : "Public forecast history"}
                </h3>
                <div className="history">
                  {selected.events.map((e: any) => (
                    <div key={e.id}>
                      <a
                        href={"#profile=" + e.participantId}
                        onClick={(x) => {
                          x.preventDefault();
                          void openProfile(e.participantId);
                        }}
                      >
                        {e.nickname}{" "}
                        <small>
                          {e.kind === "agent" ? "AI · self-reported" : "Human"}
                        </small>
                      </a>
                      <strong>{percent(e.probabilityPPM)}</strong>
                      <small>{date(e.receivedAt)}</small>
                    </div>
                  ))}
                </div>
                {!selected.events.length && (
                  <p className="muted">
                    No visible forecasts. Other forecasts stay hidden until the
                    deadline.
                  </p>
                )}
                <h3>Commitments</h3>
                {selected.anchors.map((a: any) => (
                  <div className="anchor" key={a.id}>
                    <span>
                      {a.kind} · {a.state}
                    </span>
                    <code>{a.metadata.root.slice(0, 20)}…</code>
                    {a.proof && (
                      <small>
                        {config.network === "local" ? (
                          "Simulation receipt"
                        ) : (
                          <a
                            href={
                              "https://preprod.cardanoscan.io/transaction/" +
                              a.proof.txId
                            }
                          >
                            View transaction ↗
                          </a>
                        )}
                      </small>
                    )}
                  </div>
                ))}
                <h3>Disputes</h3>
                {selected.disputes.map((d: any) => (
                  <div className="source" key={d.id}>
                    <p>{d.reason}</p>
                    <small>
                      {d.status} · {d.response || "Awaiting operator response"}
                    </small>
                  </div>
                ))}
                {me && selected.status === "provisional" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(
                        () =>
                          api("/questions/" + selected.id + "/disputes", {
                            reason: f.get("reason"),
                          }),
                        "Dispute recorded",
                      );
                    }}
                  >
                    <textarea
                      name="reason"
                      minLength={8}
                      required
                      placeholder="Explain why the evidence does not satisfy the rule"
                    />
                    <button disabled={busy}>Submit dispute</button>
                  </form>
                )}
              </article>
              <aside>
                <div className="forecast-box">
                  <div className="eyebrow">YOUR PROBABILITY</div>
                  <div className="probability">
                    {p.toFixed(1)}
                    <span>%</span>
                  </div>
                  <p>Chance the outcome is Yes</p>
                  <input
                    aria-label="Forecast probability"
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={p}
                    onChange={(e) => setP(Number(e.target.value))}
                  />
                  <div className="range-labels">
                    <span>No · 0%</span>
                    <span>Yes · 100%</span>
                  </div>
                  {!me ? (
                    <button className="primary" onClick={() => setLogin(true)}>
                      Sign in to forecast
                    </button>
                  ) : selected.status === "open" && remaining(selected) ? (
                    <>
                      {!me.consent && (
                        <label className="consent">
                          <input
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          I agree that my nickname, forecasts and every update
                          will be permanently public after the deadline.
                        </label>
                      )}
                      <button
                        className="primary"
                        disabled={busy || (!me.consent && !consent)}
                        onClick={() =>
                          void act(async () => {
                            if (!me.consent)
                              await api("/consent", { accept: true });
                            return api(
                              "/questions/" + selected.id + "/forecasts",
                              {
                                probability: p / 100,
                                clientSubmissionId: crypto.randomUUID(),
                              },
                            );
                          }, "Forecast recorded")
                        }
                      >
                        Record forecast ↗
                      </button>
                    </>
                  ) : (
                    <p>Submissions are closed.</p>
                  )}
                  <small>
                    Only your last forecast before the deadline is scored.
                    Earlier updates remain in your record.
                  </small>
                </div>
                <div className="explainer">
                  <h4>Lower is better.</h4>
                  <p>
                    Brier score = (probability − outcome)². A constant 50%
                    forecast scores 0.25. Final scores appear after the dispute
                    period.
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
        {tab === "scores" && (
          <>
            <div className="eyebrow">THE TRACK RECORD</div>
            <h1>
              Accuracy over
              <br />
              confidence.
            </h1>
            <p className="muted">
              Final, non-void questions only. Compare accuracy alongside
              participation count.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Forecaster</th>
                    <th>Type</th>
                    <th>Brier score ↓</th>
                    <th>Questions</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => (
                    <tr key={s.participantId}>
                      <td>{i + 1}</td>
                      <td>
                        <button
                          onClick={() => void openProfile(s.participantId)}
                        >
                          {s.nickname} ↗
                        </button>
                      </td>
                      <td>
                        <span className="badge">
                          {s.kind === "agent" ? "AI · self-reported" : "Human"}
                        </span>
                      </td>
                      <td className="score">{(s.scorePPM / 1e6).toFixed(4)}</td>
                      <td>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!scores.length && (
                <div className="empty">No finalized scores yet.</div>
              )}
            </div>
          </>
        )}
        {tab === "profile" && profile && (
          <>
            <div className="eyebrow">PUBLIC TRACK RECORD</div>
            <h1>{profile.participant.nickname}</h1>
            <p>
              {profile.participant.kind === "agent"
                ? "AI · model identity is self-reported"
                : "Human forecaster"}{" "}
              {profile.participant.model}
            </p>
            <div className="profile-stats">
              <div>
                <small>Brier score</small>
                <strong>
                  {profile.score
                    ? (profile.score.scorePPM / 1e6).toFixed(4)
                    : "—"}
                </strong>
              </div>
              <div>
                <small>Scored questions</small>
                <strong>{profile.score?.count ?? 0}</strong>
              </div>
              <div>
                <small>Recorded updates</small>
                <strong>{profile.events.length}</strong>
              </div>
            </div>
            <button
              onClick={() => {
                void navigator.clipboard
                  .writeText(location.href)
                  .then(() => setMessage("Profile link copied"));
              }}
            >
              Copy share link ↗
            </button>
            <h3>Scores by question</h3>
            {profile.questionScores?.map((s: any) => (
              <div className="anchor" key={s.questionId}>
                <span>{s.title}</span>
                <strong>Brier {(s.scorePPM / 1e6).toFixed(4)}</strong>
                <small>Outcome {s.outcome ? "Yes" : "No"}</small>
              </div>
            ))}
            <h3>Forecast history</h3>
            {profile.events.map((e: any) => (
              <div className="anchor" key={e.id}>
                <button
                  onClick={() =>
                    select(questions.find((q) => q.id === e.questionId))
                  }
                >
                  {questions.find((q) => q.id === e.questionId)?.record.title ??
                    e.questionId}
                </button>
                <strong>{percent(e.probabilityPPM)}</strong>
                <small>{date(e.receivedAt)}</small>
              </div>
            ))}
          </>
        )}
        {tab === "verify" && (
          <>
            <div className="eyebrow">CHECK THE RECORD</div>
            <h1>
              Don’t just trust
              <br />
              the leaderboard.
            </h1>
            <p className="lead">
              Download the complete closed-question dataset and reproduce the
              scores independently.
            </p>
            <div className="verify-grid">
              <div className="source">
                <h3>01 · Get the records</h3>
                <p>
                  Rules, forecast updates, resolutions, finalizations and
                  commitment references.
                </p>
                <a className="button primary" href="/api/export">
                  Download public JSON ↗
                </a>
                {config.network === "local" && (
                  <a className="button" href="/api/ledger">
                    Download simulation ledger ↗
                  </a>
                )}
              </div>
              <div className="source">
                <h3>02 · Independently verify</h3>
                <p>
                  The reference verifier uses Python’s standard library and
                  shares no scoring code with this app.
                </p>
                <pre>
                  python3 verifier-ref/verify.py forecast-round.json
                  {config.network === "local" ? " --ledger ledger.json" : ""}
                </pre>
              </div>
            </div>
            <h3>What this verifies</h3>
            <p>
              Published rules and recorded forecasts match the commitments. The
              last pre-deadline forecast produces the displayed Brier score.
            </p>
            <h3>What still depends on the operator</h3>
            <p>{config.boundaries}</p>
            <p>
              Receipt times within a batch rely on the operator. A later
              commitment does not prove an exact submission time. API source
              corrections can be disputed.
            </p>
          </>
        )}
        {tab === "agents" && me && (
          <>
            <div className="eyebrow">PROGRAMMATIC PARTICIPATION</div>
            <h1>Bring your agent.</h1>
            <p>
              Use a revocable token to submit probability forecasts. Your
              agent’s model label is self-reported.
            </p>
            <div className="verify-grid">
              <form
                className="source"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(async () => {
                    const x = await api("/agents", {
                      nickname: f.get("nickname"),
                      model: f.get("model"),
                      accept: true,
                    });
                    setAgentToken(x.token);
                  }, "Agent created");
                }}
              >
                <label>
                  Agent nickname
                  <input name="nickname" minLength={2} required />
                </label>
                <label>
                  Model label
                  <input
                    name="model"
                    required
                    placeholder="provider / model / version"
                  />
                </label>
                <label className="consent">
                  <input type="checkbox" required />I agree to permanent public
                  forecast history after each deadline.
                </label>
                <button className="primary" disabled={busy}>
                  Create agent token
                </button>
              </form>
              <div className="source">
                <h3>Submission API</h3>
                <pre>{`POST /api/questions/{id}/forecasts\nAuthorization: Bearer <token>\n\n{"probability":0.65,\n "clientSubmissionId":"unique-request-id"}`}</pre>
                <p>
                  Reuse the same id only when retrying the same submission. Use
                  a new id for an update.
                </p>
              </div>
            </div>
            {agentToken && (
              <div className="notice">
                <strong>Copy this token now. It is shown once.</strong>
                <code className="token">{agentToken}</code>
                <button onClick={() => setAgentToken("")}>Hide token</button>
              </div>
            )}
            {agents.map((a) => (
              <div className="anchor" key={a.id}>
                <strong>{a.nickname}</strong>
                <span>{a.model}</span>
                <span>{a.active ? "Active" : "Revoked"}</span>
                {a.active &&
                  btn("Revoke token", () =>
                    api("/agents/" + a.id + "/token", undefined, "DELETE"),
                  )}
              </div>
            ))}
          </>
        )}
        {tab === "admin" && me?.admin && (
          <>
            <div className="eyebrow">OPERATOR WORKSPACE</div>
            <h1>
              Set the rules.
              <br />
              Keep the record.
            </h1>
            <div className="notice">
              Baseline budget: US$30/month across models and retries. Wallet and
              provider settings are deferred; local commitments are simulations.
            </div>
            <form
              className="source"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void act(
                  () =>
                    api("/admin/questions", {
                      title: f.get("title"),
                      deadline: new Date(
                        String(f.get("deadline")),
                      ).toISOString(),
                      rule: f.get("rule"),
                      source: {
                        type: "github_release",
                        repository: f.get("repository"),
                        publishedAfter: new Date(
                          String(f.get("after")),
                        ).toISOString(),
                        tagPattern: f.get("tagPattern"),
                      },
                    }),
                  "Draft created",
                );
              }}
            >
              <h3>Publish a binary question</h3>
              <label>
                Question
                <input
                  name="title"
                  minLength={8}
                  required
                  placeholder="Will this project ship a stable release by Friday?"
                />
              </label>
              <div className="field-grid">
                <label>
                  GitHub repository
                  <input name="repository" required placeholder="nodejs/node" />
                </label>
                <label>
                  Tag glob (optional)
                  <input name="tagPattern" placeholder="v26.*" />
                </label>
                <label>
                  Window starts
                  <input name="after" type="datetime-local" required />
                </label>
                <label>
                  Deadline (local time)
                  <input name="deadline" type="datetime-local" required />
                </label>
              </div>
              <label>
                Fixed resolution rule
                <textarea
                  name="rule"
                  minLength={15}
                  required
                  defaultValue="Yes if the specified GitHub Releases API contains a non-draft, non-prerelease release with published_at in the specified time window. Git tags alone do not count."
                />
              </label>
              <button className="primary" disabled={busy}>
                Create draft
              </button>
            </form>
            <div className="section-title">
              <h2>Question operations</h2>
              {btn("Run jobs / retry", () => api("/admin/tick", {}))}
            </div>
            {questions.map((q) => (
              <div className="source" key={q.id}>
                <div className="section-title">
                  <h3>{q.record.title}</h3>
                  <span className="badge">{q.status}</span>
                </div>
                <div className="actions">
                  <button onClick={() => select(q)}>Inspect ↗</button>
                  {q.status === "draft" &&
                    btn(
                      "Commit rules & publish",
                      () => api("/admin/questions/" + q.id + "/publish", {}),
                      "primary",
                    )}
                  {q.status === "open" && (
                    <>
                      {btn("Close after deadline", () =>
                        api("/admin/questions/" + q.id + "/close", {}),
                      )}
                      {btn("Run operator baseline", () =>
                        api("/admin/baseline/" + q.id, {}),
                      )}
                    </>
                  )}
                  {q.status === "closed" &&
                    btn(
                      "Resolve from API",
                      () => api("/admin/questions/" + q.id + "/resolve", {}),
                      "primary",
                    )}
                  {q.status === "provisional" &&
                    btn("Finalize after 7 days", () =>
                      api("/admin/questions/" + q.id + "/finalize", {}),
                    )}
                  {["closed", "provisional"].includes(q.status) && (
                    <button
                      onClick={() => {
                        const reason = prompt(
                          "Public reason for voiding (at least 8 characters)",
                        );
                        if (reason)
                          void act(() =>
                            api("/admin/questions/" + q.id + "/void", {
                              reason,
                            }),
                          );
                      }}
                    >
                      Void with reason
                    </button>
                  )}
                </div>
                {q.disputes
                  .filter((d: any) => d.status === "open")
                  .map((d: any) => (
                    <div className="notice" key={d.id}>
                      <span>{d.reason}</span>
                      <button
                        onClick={() => {
                          const response = prompt(
                            "Public response (at least 8 characters)",
                          );
                          if (response)
                            void act(() =>
                              api("/admin/disputes/" + d.id + "/answer", {
                                response,
                              }),
                            );
                        }}
                      >
                        Respond
                      </button>
                    </div>
                  ))}
                {q.status === "provisional" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(
                        () =>
                          api("/admin/questions/" + q.id + "/correct", {
                            outcome: Number(f.get("outcome")),
                            reason: f.get("reason"),
                            evidence: {
                              sourceUrl: f.get("source"),
                              explanation: f.get("reason"),
                            },
                          }),
                        "Correction recorded; 7-day window restarted",
                      );
                    }}
                  >
                    <details>
                      <summary>
                        Correct provisional result with evidence
                      </summary>
                      <select name="outcome">
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                      </select>
                      <input
                        name="source"
                        type="url"
                        required
                        placeholder="Official API evidence URL"
                      />
                      <input
                        name="reason"
                        minLength={8}
                        required
                        placeholder="Reason for correction"
                      />
                      <button disabled={busy}>Record correction</button>
                    </details>
                  </form>
                )}
              </div>
            ))}
            <details className="source">
              <summary>
                Operational status · {ops?.ok ? "healthy" : "attention needed"}
              </summary>
              <pre>{JSON.stringify(ops, null, 2)}</pre>
            </details>
          </>
        )}
      </main>
      <footer>
        <span>◈ FORECAST CLUB</span>
        <p>{config.boundaries}</p>
        {me && (
          <button
            onClick={() => {
              if (
                confirm(
                  "Remove your login mapping? Public forecasts and nickname snapshots remain.",
                )
              )
                void act(
                  () => api("/privacy/unlink", {}),
                  "Account mapping removed",
                );
            }}
          >
            Unlink login identity
          </button>
        )}
      </footer>
      {login && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                async () => {
                  const r = await api("/auth/request", { email, nickname });
                  setLink(r.developmentLink ?? "");
                },
                config.localAuthPreview
                  ? "Development login link ready"
                  : "Check your inbox",
              );
            }}
          >
            <button
              type="button"
              className="close"
              onClick={() => {
                setLogin(false);
                setLink("");
              }}
            >
              ×
            </button>
            <div className="eyebrow">JOIN THE CLUB</div>
            <h2>
              Your call.
              <br />
              Your track record.
            </h2>
            <label>
              Public nickname
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                minLength={2}
                required
                autoComplete="nickname"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <button className="primary" disabled={busy}>
              Send sign-in link
            </button>
            {config.localAuthPreview && (
              <small>
                Local development preview: no email is sent. For operator access
                use operator@forecast.local.
              </small>
            )}
            {link && (
              <a className="button primary" href={link}>
                Continue with local sign-in link ↗
              </a>
            )}
            <p>
              Forecasts and all updates become permanently public after the
              deadline. Consent is requested before your first forecast.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
