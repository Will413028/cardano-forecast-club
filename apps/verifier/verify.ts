import {
  hashRecord,
  canonicalize,
  merkleRoot,
  scoreForecasts,
} from "../../packages/core/index.js";
import { PreprodChain } from "../../packages/chain/index.js";
export async function verifyRound(data: any, ledger?: any) {
  const check = (x: unknown, message: string) => {
    if (!x) throw new Error(message);
  };
  check(data.version === 1, "Unknown format version");
  check(["local", "preprod"].includes(data.network), "Unknown network");
  const ids = new Set<string>();
  let allEvents: any[] = [];
  for (const q of data.questions) {
    check(
      !ids.has(q.id) && q.id === q.record.id,
      "Duplicate or inconsistent question",
    );
    ids.add(q.id);
    const events = data.events.filter((e: any) => e.questionId === q.id);
    const unique = new Set<string>();
    let seq = 0;
    for (const e of events) {
      check(
        Number.isSafeInteger(e.seq) && e.seq > seq,
        "Event order/sequence invalid",
      );
      seq = e.seq;
      check(!unique.has(e.id), "Duplicate event");
      unique.add(e.id);
      check(
        Number.isSafeInteger(e.probabilityPPM) &&
          e.probabilityPPM >= 0 &&
          e.probabilityPPM <= 1000000,
        "Probability invalid",
      );
      check(
        Date.parse(e.receivedAt) < Date.parse(q.record.deadline),
        "Late event exported",
      );
    }
    allEvents.push(...events);
    const anchors = data.anchors.filter((a: any) => a.question_id === q.id);
    check(
      anchors.some((a: any) => a.kind === "rules"),
      "Rules commitment missing",
    );
    check(
      anchors.some(
        (a: any) => a.kind === "close" && a.upto === (events.at(-1)?.seq ?? 0),
      ),
      "Complete close commitment missing",
    );
    for (const a of anchors) {
      let records;
      switch (a.kind) {
        case "rules":
          records = [q.record];
          break;
        case "forecasts":
        case "close":
          records = events.filter((e: any) => e.seq <= a.upto);
          break;
        case "resolution":
          records = q.resolutions.slice(0, a.upto);
          break;
        case "final":
          records = [q.finalization];
          break;
        default:
          throw new Error("Unknown anchor kind");
      }
      const expected = {
        v: 1,
        id: hashRecord({ questionId: q.id, kind: a.kind, upto: a.upto }),
        root: merkleRoot(records),
        count: records.length,
        kind: a.kind,
      };
      check(
        canonicalize(expected) === canonicalize(a.metadata),
        "Record commitment mismatch",
      );
      check(a.id === hashRecord(expected), "Anchor identity mismatch");
      let proof;
      if (data.network === "local") {
        check(
          ledger?.simulation === true && ledger.network === "local",
          "Local simulation ledger required",
        );
        proof = ledger.entries.find((p: any) => p.txId === a.proof.txId);
      } else proof = await new PreprodChain().read(a.proof.txId);
      check(
        proof &&
          proof.network === data.network &&
          canonicalize(proof.metadata) === canonicalize(a.metadata),
        "Chain proof mismatch",
      );
      check(
        canonicalize(proof) === canonicalize(a.proof),
        "Exported proof differs from authoritative ledger",
      );
      if (a.kind === "rules" && events.length)
        check(
          Date.parse(proof.confirmedAt) <= Date.parse(events[0].receivedAt),
          "Rules were committed after first submission",
        );
      if (a.kind === "final")
        check(
          Date.parse(proof.confirmedAt) >=
            Date.parse(q.finalization.finalizedAt),
          "Final commitment predates finalization",
        );
    }
    check(
      canonicalize(q.resolution) === canonicalize(q.resolutions.at(-1) ?? null),
      "Latest resolution mismatch",
    );
    if (["resolved", "void"].includes(q.status)) {
      check(
        q.finalization &&
          q.finalization.status === q.status &&
          q.finalization.resolutionId === q.resolution.id,
        "Final state not committed",
      );
      check(
        Date.parse(q.finalization.finalizedAt) >=
          Date.parse(q.resolution.disputeUntil),
        "Premature finalization",
      );
      check(
        anchors.some((a: any) => a.kind === "final"),
        "Final commitment missing",
      );
      check(
        anchors.some(
          (a: any) =>
            a.kind === "resolution" && a.upto === q.resolutions.length,
        ),
        "Resolution commitment missing",
      );
    }
  }
  check(
    allEvents.length === data.events.length,
    "Event refers to unknown question",
  );
  const scores = scoreForecasts(data.questions, data.events);
  check(
    canonicalize(scores) === canonicalize(data.scores),
    "Leaderboard score mismatch",
  );
  return {
    verified: true,
    network: data.network,
    simulation: data.network === "local",
    scores,
    warning:
      "Operator receipt timestamps are not independently proven by a later batch commitment.",
  };
}
