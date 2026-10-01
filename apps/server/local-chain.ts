import { pool, type DbClient } from "./db.js";
import { hashRecord } from "../../packages/core/index.js";
import {
  PreprodChain,
  type Chain,
  type AnchorMetadata,
  type PreparedAnchor,
} from "../../packages/chain/index.js";
export class LocalChain implements Chain {
  network = "local" as const;
  constructor(private now = () => new Date()) {}
  async prepare(metadata: AnchorMetadata) {
    return { txId: hashRecord(metadata), network: this.network, metadata };
  }
  async submit(p: PreparedAnchor, db: DbClient = pool) {
    await db.query(
      "INSERT INTO local_ledger(id,metadata,confirmed_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [p.txId, p.metadata, this.now().toISOString()],
    );
  }
  async read(id: string, db: DbClient = pool) {
    const r = await db.query("SELECT * FROM local_ledger WHERE id=$1", [id]);
    if (!r.rowCount) throw new Error("Local commitment not found");
    return {
      txId: id,
      network: this.network,
      metadata: r.rows[0].metadata,
      confirmedAt: r.rows[0].confirmed_at,
    };
  }
}
export function configuredChain(): Chain {
  if (process.env.CHAIN_MODE === "preprod") return new PreprodChain();
  if (process.env.CHAIN_MODE && process.env.CHAIN_MODE !== "local")
    throw new Error("Only local and preprod networks are allowed");
  return new LocalChain();
}
