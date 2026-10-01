import { migrate, pool } from "../apps/server/db.js";
import { Club } from "../apps/server/service.js";
import { runBaseline } from "../apps/server/baseline.js";
await migrate();
try {
  console.log(JSON.stringify(await runBaseline(new Club(), process.argv[2])));
} finally {
  await pool.end();
}
