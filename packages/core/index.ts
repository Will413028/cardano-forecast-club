import { createHash } from "node:crypto";
export type JSONValue =
  null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export function canonicalize(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(canonicalize).join(",") + "]";
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => {
          if (!/^[a-zA-Z0-9_]+$/.test(k))
            throw new Error("Canonical keys must be ASCII identifiers");
          return (
            JSON.stringify(k) +
            ":" +
            canonicalize((value as Record<string, unknown>)[k])
          );
        })
        .join(",") +
      "}"
    );
  }
  throw new Error("Canonical records require JSON and safe integers");
}
export const sha256 = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
export const hashRecord = (value: unknown) => sha256(canonicalize(value));
export function merkleRoot(records: unknown[]): string {
  if (!records.length) return sha256(Buffer.from([2]));
  let nodes: Buffer[] = records.map((r) =>
    Buffer.from(
      sha256(Buffer.concat([Buffer.from([0]), Buffer.from(canonicalize(r))])),
      "hex",
    ),
  );
  while (nodes.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < nodes.length; i += 2)
      next.push(
        Buffer.from(
          sha256(
            Buffer.concat([
              Buffer.from([1]),
              nodes[i],
              nodes[i + 1] ?? nodes[i],
            ]),
          ),
          "hex",
        ),
      );
    nodes = next;
  }
  return nodes[0].toString("hex");
}
export interface QuestionRecord {
  id: string;
  title: string;
  deadline: string;
  rule: string;
  source: {
    type: "github_release";
    repository: string;
    publishedAfter: string;
    tagPattern: string;
  };
}
export interface ForecastEvent {
  id: string;
  seq: number;
  questionId: string;
  participantId: string;
  nickname: string;
  kind: "human" | "agent";
  model: string | null;
  probabilityPPM: number;
  receivedAt: string;
}
export interface ResolutionRecord {
  id: string;
  questionId: string;
  outcome: 0 | 1 | null;
  reason: string;
  evidence: unknown;
  recordedAt: string;
  disputeUntil: string;
}
export interface Score {
  participantId: string;
  nickname: string;
  kind: string;
  model: string | null;
  count: number;
  totalSquaredError: number;
  scorePPM: number;
}
export function scoreForecasts(
  questions: {
    record: QuestionRecord;
    status: string;
    resolution: ResolutionRecord | null;
  }[],
  events: ForecastEvent[],
): Score[] {
  const totals = new Map<string, Score>();
  for (const q of questions) {
    if (
      q.status !== "resolved" ||
      !q.resolution ||
      q.resolution.outcome === null
    )
      continue;
    const last = new Map<string, ForecastEvent>();
    for (const e of events
      .filter((e) => e.questionId === q.record.id)
      .sort((a, b) => a.seq - b.seq)) {
      if (
        new Date(e.receivedAt).getTime() < new Date(q.record.deadline).getTime()
      )
        last.set(e.participantId, e);
    }
    for (const e of last.values()) {
      const score = totals.get(e.participantId) ?? {
        participantId: e.participantId,
        nickname: e.nickname,
        kind: e.kind,
        model: e.model,
        count: 0,
        totalSquaredError: 0,
        scorePPM: 0,
      };
      score.count++;
      score.totalSquaredError +=
        (e.probabilityPPM - q.resolution.outcome * 1_000_000) ** 2;
      score.scorePPM = Math.floor(
        score.totalSquaredError / score.count / 1_000_000,
      );
      totals.set(e.participantId, score);
    }
  }
  return [...totals.values()].sort(
    (a, b) =>
      a.scorePPM - b.scorePPM || a.participantId.localeCompare(b.participantId),
  );
}
export const FORMAT_VERSION = 1;
export const BOUNDARY_TEXT =
  "Cardano commits records; it does not decide external outcomes. Local mode is a simulation, not a blockchain timestamp. The operator can omit records before commitment. Model identity is self-reported. Private, unregistered forecasts cannot be verified.";
