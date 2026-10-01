import { readFile } from "node:fs/promises";
import { verifyRound } from "./verify.js";
try {
  const data = JSON.parse(await readFile(process.argv[2], "utf8"));
  const ledger = process.argv[3]
    ? JSON.parse(await readFile(process.argv[3], "utf8"))
    : undefined;
  console.log(JSON.stringify(await verifyRound(data, ledger), null, 2));
} catch (e) {
  console.error(e instanceof Error ? e.message : "Verification failed");
  process.exitCode = 1;
}
