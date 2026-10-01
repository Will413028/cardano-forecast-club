import { readFile } from "node:fs/promises";
import { migrate, pool } from "../apps/server/db.js";
import { Club } from "../apps/server/service.js";
const [command, id, arg] = process.argv.slice(2);
await migrate();
const club = new Club();
try {
  if (command === "batch") {
    const inputs = JSON.parse(await readFile(id, "utf8"));
    if (!Array.isArray(inputs) || inputs.length > 20)
      throw new Error("Batch must contain at most 20 questions");
    const result = [];
    for (const input of inputs) {
      const q = await club.createQuestion(input);
      result.push(await club.publish(q.id));
    }
    console.log(JSON.stringify(result));
  } else if (command === "publish")
    console.log(JSON.stringify(await club.publish(id)));
  else if (command === "close")
    console.log(JSON.stringify(await club.closeRound(id)));
  else if (command === "resolve")
    console.log(JSON.stringify(await club.autoResolve(id)));
  else if (command === "finalize")
    console.log(JSON.stringify(await club.finalize(id)));
  else if (command === "void") {
    console.log(
      JSON.stringify(
        await club.resolveQuestion(id, null, arg, { operatorReason: arg }),
      ),
    );
    await club.commitResolution(id);
  } else if (command === "tick") {
    await club.tick();
    console.log(JSON.stringify(await club.ops()));
  } else
    throw new Error(
      "Usage: admin.ts batch <questions.json> | publish|close|resolve|finalize <id> | void <id> <reason> | tick",
    );
} finally {
  await pool.end();
}
