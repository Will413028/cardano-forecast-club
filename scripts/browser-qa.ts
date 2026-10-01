import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3318");
  await page.getByRole("heading", { name: "What happens next?" }).waitFor();
  await page.locator(".mode").filter({ hasText: "LOCAL SIMULATION" }).waitFor();
  await mkdir("var/screenshots", { recursive: true });
  await page.screenshot({
    path: "var/screenshots/desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await page.getByRole("heading", { name: /Accuracy over/ }).waitFor();
  await page.getByRole("button", { name: "Verify", exact: true }).click();
  await page.getByRole("heading", { name: /Don’t just trust/ }).waitFor();
  await page.getByRole("link", { name: "Download public JSON" }).waitFor();
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.getByRole("button", { name: "Join the club" }).click();
  await page
    .getByRole("textbox", { name: "Public nickname" })
    .fill("Browser QA");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("browser-qa@forecast.local");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await page
    .getByRole("link", { name: "Continue with local sign-in link" })
    .click();
  await page.getByRole("button", { name: /Browser QA.*Sign out/ }).waitFor();
  await page
    .locator(".card")
    .filter({ has: page.locator(".badge.open") })
    .first()
    .click();
  const before = await page.locator(".history > div").count();
  const consent = page.locator(".forecast-box input[type=checkbox]");
  if (await consent.count()) await consent.check();
  await page.getByRole("slider", { name: "Forecast probability" }).fill("64.5");
  const response = page.waitForResponse(
    (r) => r.url().includes("/forecasts") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Record forecast/ }).click();
  const submitted = await response;
  assert.equal(submitted.status(), 201);
  const event = await submitted.json();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".history > div").length === n,
    before + 1,
  );
  await page.getByRole("slider", { name: "Forecast probability" }).fill("20");
  await page.getByRole("button", { name: /Record forecast/ }).click();
  await page.waitForFunction(
    (n) => document.querySelectorAll(".history > div").length === n,
    before + 2,
  );
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Agent nickname" })
    .fill("Browser fixture Agent");
  await page
    .getByRole("textbox", { name: "Model label" })
    .fill("Synthetic browser fixture");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create agent token" }).click();
  await page.locator(".token").waitFor();
  const token = await page.locator(".token").innerText();
  const apiStatus = await page.evaluate(
    async ({ id, token }) => {
      const r = await fetch("/api/questions/" + id + "/forecasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          probability: 0.37,
          clientSubmissionId: crypto.randomUUID(),
        }),
      });
      return r.status;
    },
    { id: event.questionId, token },
  );
  assert.equal(apiStatus, 201);
  await page.getByRole("button", { name: "Hide token" }).click();

  await page.getByRole("heading", { name: "Bring your agent." }).waitFor();
  await page.getByRole("button", { name: /Browser QA.*Sign out/ }).click();
  await page.getByRole("button", { name: "Join the club" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Questions", exact: true }).click();
  await page.screenshot({ path: "var/screenshots/mobile.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    "Mobile page must not overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      desktop: true,
      mobile: true,
      login: true,
      agentPage: true,
      forecastUpdates: true,
      externalAgent: true,
      consoleErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
