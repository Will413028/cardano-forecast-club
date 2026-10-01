import test from "node:test";
import assert from "node:assert/strict";
import { modelForecast } from "../apps/server/baseline.js";
import { PreprodChain } from "../packages/chain/index.js";
test("Provider adapters parse bounded responses with synthetic credentials and no paid calls", async () => {
  const original = globalThis.fetch;
  const saved = { ...process.env };
  try {
    for (const provider of ["openai", "anthropic", "google"]) {
      process.env.BASELINE_PROVIDER = provider;
      process.env.OPENAI_API_KEY =
        process.env.ANTHROPIC_API_KEY =
        process.env.GEMINI_API_KEY =
          "synthetic-test-only";
      let calls = 0;
      globalThis.fetch = async (url, init) => {
        calls++;
        const body = JSON.parse(String(init?.body));
        assert.equal(init?.method, "POST");
        assert.ok(String(url).startsWith("https://"));
        if (provider === "openai") {
          assert.equal(body.max_output_tokens, 4096);
          return new Response(
            JSON.stringify({
              output: [{ content: [{ text: '{"probability_yes":0.65}' }] }],
            }),
          );
        }
        if (provider === "anthropic") {
          assert.equal(body.max_tokens, 4096);
          return new Response(
            JSON.stringify({ content: [{ text: '{"probability_yes":0.65}' }] }),
          );
        }
        assert.equal(body.generationConfig.maxOutputTokens, 4096);
        return new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"probability_yes":0.65}' }] } },
            ],
          }),
        );
      };
      assert.equal(await modelForecast("Synthetic forecast prompt"), 0.65);
      assert.equal(calls, 1);
    }
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(
      modelForecast("Synthetic prompt"),
      /Model request failed/,
    );
  } finally {
    globalThis.fetch = original;
    for (const key of [
      "BASELINE_PROVIDER",
      "OPENAI_API_KEY",
      "ANTHROPIC_API_KEY",
      "GEMINI_API_KEY",
    ]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
test("Preprod public reader matches metadata to independently returned transaction timestamp", async () => {
  const original = globalThis.fetch;
  const metadata = {
    v: 1,
    id: "a".repeat(64),
    root: "b".repeat(64),
    count: 3,
    kind: "close",
  };
  const tx = "c".repeat(64);
  let calls = 0;
  try {
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.deepEqual(JSON.parse(String(init?.body)), { _tx_hashes: [tx] });
      return new Response(
        JSON.stringify(
          String(url).endsWith("tx_info")
            ? [{ tx_timestamp: 1790812800 }]
            : [{ metadata: { "674": metadata } }],
        ),
      );
    };
    const proof = await new PreprodChain().read(tx);
    assert.equal(proof.txId, tx);
    assert.equal(proof.network, "preprod");
    assert.deepEqual(proof.metadata, metadata);
    assert.equal(Date.parse(proof.confirmedAt), 1790812800000);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
