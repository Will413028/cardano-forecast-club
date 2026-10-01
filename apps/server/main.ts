import { migrate, pool } from "./db.js";
import { Club } from "./service.js";
import { createApp } from "./http.js";
await migrate();
const club = new Club();
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3318);
if (
  process.env.NODE_ENV !== "production" &&
  !["127.0.0.1", "::1", "localhost"].includes(host)
)
  throw new Error("Development auth preview must be bound to loopback");
const server = createApp(club).listen(port, host, () =>
  console.log(
    JSON.stringify({
      event: "listening",
      host,
      port,
      network: club.chain.network,
    }),
  ),
);
let busy = false;
const timer = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await club.tick();
  } catch {
    console.error(JSON.stringify({ event: "tick_failed" }));
  } finally {
    busy = false;
  }
}, 30000);
timer.unref();
process.on("SIGTERM", () => {
  clearInterval(timer);
  server.close(() => {
    void pool.end();
  });
});
