import { migrate, pool } from "../apps/server/db.js";
import { Club } from "../apps/server/service.js";
await migrate();
const result = await new Club().ops();
console.log(JSON.stringify(result, null, 2));
await pool.end();
if (!result.ok) process.exitCode = 1;
