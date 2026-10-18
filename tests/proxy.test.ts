import test, { after } from "node:test";
import assert from "node:assert/strict";
const { pool } = await import("../apps/server/db.js");
const { createApp } = await import("../apps/server/http.js");
after(() => pool.end());
async function statuses(trustProxy: string | undefined, ips: string[]) {
  if (trustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = trustProxy;
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/config`;
  try {
    const out: number[] = [];
    for (const ip of ips)
      out.push(
        (await fetch(base, { headers: { "X-Forwarded-For": ip } })).status,
      );
    return out;
  } finally {
    delete process.env.TRUST_PROXY;
    await new Promise<void>((r) => server.close(() => r()));
  }
}
const spread = (n: number) =>
  Array.from({ length: n }, (_, i) => `198.51.100.${i + 1}`);
test("forwarded addresses cannot bypass the rate limit without a trusted proxy", async () => {
  const s = await statuses(undefined, spread(121));
  assert.equal(s.at(-1), 429);
});
test("a trusted proxy rate-limits each forwarded client separately", async () => {
  const s = await statuses("loopback", [
    ...Array(120).fill("198.51.100.1"),
    "198.51.100.2",
    "198.51.100.1",
  ]);
  assert.deepEqual(s.slice(-2), [200, 429]);
});
