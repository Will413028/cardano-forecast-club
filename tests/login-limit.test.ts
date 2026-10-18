import test, { before, after } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_SCHEMA = `forecast_login_${process.pid}`;
process.env.TRUST_PROXY = "loopback";
const { pool, migrate } = await import("../apps/server/db.js");
const { createApp } = await import("../apps/server/http.js");
let server: any, base: string;
before(async () => {
  await pool.query(`CREATE SCHEMA ${process.env.DATABASE_SCHEMA}`);
  await migrate();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/auth/request`;
});
after(async () => {
  delete process.env.TRUST_PROXY;
  if (server) await new Promise<void>((r) => server.close(() => r()));
  await pool.query(`DROP SCHEMA ${process.env.DATABASE_SCHEMA} CASCADE`);
  await pool.end();
});
const request = async (email: string, ip: string) =>
  (
    await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ email, nickname: "limit" }),
    })
  ).status;
test("one address receives at most three unused sign-in links", async () => {
  const s = [];
  for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3"])
    s.push(await request("Target@Example.com", ip));
  s.push(await request("target@example.com", "203.0.113.4"));
  s.push(await request("other@example.com", "203.0.113.4"));
  assert.deepEqual(s, [200, 200, 200, 429, 200]);
});
test("one client requests at most ten sign-in links per hour", async () => {
  const s = [];
  for (let i = 0; i < 11; i++)
    s.push(await request(`spray${i}@example.com`, "198.51.100.7"));
  assert.deepEqual(s, [...Array(10).fill(200), 429]);
  assert.equal(await request("spray@example.com", "198.51.100.8"), 200);
});
