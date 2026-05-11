import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ROOT = path.resolve(process.cwd(), "..");
const SCREENSHOTS_DIR = path.join(ROOT, "docs", "screenshots");
const FRONTEND_URL = "http://127.0.0.1:5173/space_apps_hackaton/";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // ignore until timeout
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startProcess(command, args, cwd) {
  const proc = spawn(command, args, {
    cwd,
    stdio: "pipe",
    env: process.env
  });
  proc.stdout.on("data", (d) => process.stdout.write(`[${command}] ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`[${command}] ${d}`));
  return proc;
}

async function safeClick(page, selector) {
  const locator = page.locator(selector);
  if (await locator.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await locator.first().click();
    return true;
  }
  return false;
}

async function main() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const backend = startProcess(path.join(ROOT, "backend", "venv", "bin", "python"), ["main.py"], path.join(ROOT, "backend"));
  const frontend = startProcess("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"], path.join(ROOT, "frontend"));

  let browser;
  try {
    await waitForUrl("http://127.0.0.1:5173");
    await sleep(2000);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
      permissions: ["geolocation"]
    });
    const page = await context.newPage();

    await page.goto(FRONTEND_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "01-notification-modal.png"), fullPage: true });

    await page.fill('input[id="name"]', "Demo User").catch(() => {});
    await page.fill('input[id="phone"]', "+1 (212) 555-0199").catch(() => {});
    await safeClick(page, "button:has-text('Get My Current Location')");
    await page.waitForTimeout(2500);
    await safeClick(page, "button:has-text('Skip for Now')");
    await page.waitForTimeout(1000);

    await safeClick(page, "button:has-text('Search')");
    await page.waitForTimeout(500);
    await page.fill('input[placeholder*="Search"]', "New York");
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "02-location-search.png"), fullPage: true });

    const firstSuggestion = page.locator("button").filter({ hasText: "New York" }).first();
    if (await firstSuggestion.isVisible().catch(() => false)) {
      await firstSuggestion.click();
    } else {
      await page.keyboard.press("Escape");
      await safeClick(page, "button:has-text('My Location')");
    }

    await page.waitForTimeout(7000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "03-openweather-current-aqi.png"), fullPage: true });

    await safeClick(page, "button:has-text('Forecast')");
    await page.waitForTimeout(6000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "04-air-quality-forecast.png"), fullPage: true });

    await page.locator("h3:has-text('Risk Group Health Info')").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "05-health-risk-groups.png"), fullPage: true });

    await page.locator("text=Weather Forecast").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "06-weather-forecast.png"), fullPage: true });

    await page.locator("[role='combobox']").first().click().catch(() => {});
    await page.waitForTimeout(500);
    await safeClick(page, "text=NASA TEMPO");
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "07-tempo-satellite-mode.png"), fullPage: true });

    await safeClick(page, "button:has-text('Climate')");
    await page.waitForTimeout(10000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "08-daymet-climate-visualization.png"), fullPage: true });

    await context.close();
  } finally {
    if (browser) await browser.close().catch(() => {});
    backend.kill("SIGTERM");
    frontend.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
