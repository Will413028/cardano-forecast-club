import { readFile } from "node:fs/promises";
export interface AnchorMetadata {
  v: number;
  id: string;
  root: string;
  count: number;
  kind: string;
}
export interface AnchorProof {
  txId: string;
  network: "local" | "preprod";
  confirmedAt: string;
  metadata: AnchorMetadata;
}
export interface PreparedAnchor {
  txId: string;
  network: "local" | "preprod";
  metadata: AnchorMetadata;
  signedTx?: string;
}
export interface Chain {
  network: "local" | "preprod";
  prepare(m: AnchorMetadata): Promise<PreparedAnchor>;
  submit(p: PreparedAnchor): Promise<void>;
  read(id: string): Promise<AnchorProof>;
}
export class PreprodChain implements Chain {
  network = "preprod" as const;
  private base = "https://preprod.koios.rest/api/v1";
  async read(id: string): Promise<AnchorProof> {
    const [info, meta] = await Promise.all([
      this.request("tx_info", { _tx_hashes: [id] }),
      this.request("tx_metadata", { _tx_hashes: [id] }),
    ]);
    if (!info[0] || !meta[0])
      throw new Error("Transaction not confirmed/indexed");
    const metadata = meta[0].metadata?.["674"] as AnchorMetadata;
    if (!metadata || metadata.v !== 1)
      throw new Error("Invalid anchor metadata");
    return {
      txId: id,
      network: this.network,
      confirmedAt: new Date(info[0].tx_timestamp * 1000).toISOString(),
      metadata,
    };
  }
  private async request(endpoint: string, body: unknown) {
    const r = await fetch(`${this.base}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`Koios ${endpoint} failed (${r.status})`);
    return r.json();
  }
  async prepare(metadata: AnchorMetadata): Promise<PreparedAnchor> {
    const { MeshWallet, KoiosProvider, MeshTxBuilder, resolveTxHash } =
      await import("@meshsdk/core");
    const path = process.env.OPERATOR_KEY_FILE;
    if (!path)
      throw new Error(
        "Preprod wallet setup is deferred: OPERATOR_KEY_FILE missing",
      );
    const key = JSON.parse(await readFile(path, "utf8"));
    const provider = new KoiosProvider("preprod");
    const wallet = new MeshWallet({
      networkId: 0,
      fetcher: provider,
      submitter: provider,
      key,
    });
    const address = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos();
    const unsigned = await new MeshTxBuilder({
      fetcher: provider,
      submitter: provider,
    })
      .metadataValue(674, metadata)
      .txOut(address, [{ unit: "lovelace", quantity: "2000000" }])
      .changeAddress(address)
      .selectUtxosFrom(utxos)
      .complete();
    const signedTx = await wallet.signTx(unsigned);
    return {
      txId: resolveTxHash(signedTx),
      network: this.network,
      metadata,
      signedTx,
    };
  }
  async submit(p: PreparedAnchor) {
    if (!p.signedTx) throw new Error("Signed transaction missing");
    const { KoiosProvider } = await import("@meshsdk/core");
    await new KoiosProvider("preprod").submitTx(p.signedTx);
  }
}
