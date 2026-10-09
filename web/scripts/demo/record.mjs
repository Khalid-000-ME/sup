/**
 * Records the product demo by driving the real app in a browser, against the real DevNet ledger.
 * Output: out/video/*.webm and out/marks.json (scene boundaries and the waits to cut).
 *
 *   npm run dev            (in another terminal; the node must be reachable)
 *   node scripts/demo/record.mjs
 *
 * A visible cursor and click ripple are injected into the page, because screen recordings of a
 * headless browser carry no system cursor. Waits for the ledger are marked so the build step can
 * cut them out.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const root = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(root, "out");
fs.rmSync(path.join(OUT, "video"), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "video"), { recursive: true });
const W = 1440;
const H = 900;

function executablePath() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (!fs.existsSync(cache)) return undefined;
  const dir = fs.readdirSync(cache).find((d) => d.startsWith("chromium_headless_shell"));
  const exe = dir && path.join(cache, dir, "chrome-headless-shell-mac-arm64/chrome-headless-shell");
  return exe && fs.existsSync(exe) ? exe : undefined;
}

const browser = await chromium.launch({ executablePath: executablePath() });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: path.join(OUT, "video"), size: { width: W, height: H } } });

// A visible cursor: arrow, plus a ripple on press.
await ctx.addInitScript(() => {
  const install = () => {
    if (document.getElementById("__cur")) return;
    const el = document.createElement("div");
    el.id = "__cur";
    el.style.cssText = "position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .2s;will-change:transform";
    el.innerHTML =
      '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 2 L4 20 L8.6 15.6 L12 23 L15 21.6 L11.6 14.4 L18 14.2 Z" fill="#fff" stroke="#0b0b10" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(el);
    const ring = document.createElement("div");
    ring.style.cssText = "position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid rgba(214,182,230,.95);z-index:2147483646;pointer-events:none;opacity:0";
    document.documentElement.appendChild(ring);
    addEventListener("mousemove", (e) => {
      el.style.opacity = "1";
      el.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    }, true);
    addEventListener("mousedown", (e) => {
      ring.style.left = e.clientX + "px";
      ring.style.top = e.clientY + "px";
      ring.animate([{ opacity: 1, transform: "scale(.3)" }, { opacity: 0, transform: "scale(1.5)" }], { duration: 520, easing: "ease-out" });
    }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", install);
  else install();
});

const t0 = Date.now();
const page = await ctx.newPage();
const now = () => (Date.now() - t0) / 1000;
const pause = (ms) => page.waitForTimeout(ms);

let pos = { x: W / 2, y: H / 2 };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
async function glide(x, y, ms = 800) {
  const from = { ...pos };
  const n = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const k = ease(i / n);
    await page.mouse.move(from.x + (x - from.x) * k, from.y + (y - from.y) * k);
    await pause(ms / n);
  }
  pos = { x, y };
}
async function centre(loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error("not visible: " + loc);
  return { x: b.x + b.width / 2 + (Math.random() - 0.5) * Math.min(14, b.width / 4), y: b.y + b.height / 2 };
}
async function hover(loc, ms = 700) {
  const p = await centre(loc);
  await glide(p.x, p.y, ms);
}
async function click(loc, ms = 700) {
  await hover(loc, ms);
  await pause(180);
  await page.mouse.down();
  await pause(70);
  await page.mouse.up();
  await pause(250);
}
async function type(loc, text, delay = 60) {
  await click(loc, 600);
  await loc.pressSequentially(text, { delay });
  await pause(250);
}
async function ensureCursor() {
  await page.mouse.move(pos.x + 1, pos.y + 1);
  await page.mouse.move(pos.x, pos.y);
}
async function go(url) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await pause(900);
  await ensureCursor();
}
async function scrollY(y, ms = 1500) {
  await page.evaluate(
    ({ y, ms }) =>
      new Promise((res) => {
        const y0 = scrollY;
        const t0 = performance.now();
        const e = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const f = (now) => {
          const t = Math.min(1, (now - t0) / ms);
          scrollTo(0, y0 + (y - y0) * e(t));
          if (t < 1) requestAnimationFrame(f);
          else res();
        };
        requestAnimationFrame(f);
      }),
    { y, ms },
  );
}
async function scrollToSel(sel, offset = 90, ms = 1600) {
  const y = await page.locator(sel).first().evaluate((el, offset) => el.getBoundingClientRect().top + scrollY - offset, offset);
  await scrollY(y, ms);
}

// ------------------------------------------------------------------ timeline
const marks = { scenes: {}, fps: 30 };
let cur = null;
async function scene(id, fn) {
  cur = { start: now(), cuts: [] };
  console.log("scene", id);
  await fn();
  cur.end = now();
  marks.scenes[id] = cur;
}
/** Run `fn` (a wait on the ledger) and mark its middle for removal from the final video. */
async function cutting(fn) {
  const a = now();
  await fn();
  const b = now();
  if (b - a > 1.8) cur.cuts.push([a + 0.9, b - 0.5]);
}

let tradeId = "";
try {
  // 1 ---------------------------------------------------------------- hero
  await scene("hero", async () => {
    await go("/");
    await pause(2500);
    await glide(W / 2 + 120, 360, 1200);
    await pause(3500);
    await glide(W / 2 - 90, 590, 1200);
    await pause(5500);
  });

  // 2 -------------------------------------------------------------- problem
  await scene("problem", async () => {
    await click(page.locator('a:has-text("See why")'), 900);
    await scrollToSel("#problem", 70, 1800);
    await pause(2200);
    const cards = page.locator("#problem .grid > div");
    for (let i = 0; i < 3; i++) {
      await hover(cards.nth(i), 900);
      await pause(i === 2 ? 5500 : 4800);
    }
  });

  // 3 ------------------------------------------------------------ disclosure
  await scene("disclosure", async () => {
    await scrollToSel("#disclosure", 70, 1800);
    await pause(2500);
    const rows = page.locator("#disclosure tbody tr");
    await hover(rows.nth(1).locator("td").nth(1), 900);
    await pause(1800);
    await hover(rows.nth(1).locator("td").nth(2), 800);
    await pause(1800);
    await hover(rows.nth(3).locator("td").nth(2), 900);
    await pause(2200);
    await hover(rows.nth(3).locator("td").nth(4), 900);
    await pause(2500);
    await hover(rows.nth(4).locator("td").nth(1), 900);
    await pause(2500);
  });

  // 4 ------------------------------------------------------------------ how
  await scene("how", async () => {
    await scrollToSel("#how", 70, 1800);
    await pause(2000);
    const cards = page.locator("#how .grid > div");
    for (let i = 0; i < 4; i++) {
      await hover(cards.nth(i), 800);
      await pause(3000);
    }
  });

  // 5 ------------------------------------------------------------- /how page
  await scene("howpage", async () => {
    await click(page.locator('#how a[href="/how"]'), 900);
    await page.waitForURL("**/how");
    await pause(1500);
    await ensureCursor();
    await scrollY(520, 1800);
    await pause(2500);
    await hover(page.locator("text=Settles atomically").first(), 900);
    await pause(2500);
    await scrollToSel("text=Rules that hold even if our app is bypassed", 120, 2200);
    await pause(4200);
  });

  // 6 ----------------------------------------------------------- /proof page
  await scene("proofpage", async () => {
    await click(page.locator('nav a:has-text("Proof")').first(), 900);
    await page.waitForURL("**/proof");
    await pause(1500);
    await ensureCursor();
    await scrollY(480, 1600);
    const rows = page.locator("code.num");
    await hover(rows.nth(0), 900);
    await pause(2500);
    await hover(rows.nth(2), 900);
    await pause(3500);
  });

  // 7 -------------------------------------------------------------- /why page
  await scene("whypage", async () => {
    await click(page.locator('nav a:has-text("Why")').first(), 900);
    await page.waitForURL("**/why");
    await pause(1500);
    await ensureCursor();
    await scrollY(560, 1800);
    await hover(page.locator("text=Credit and bond desks").first(), 900);
    await pause(2600);
    await scrollY(1500, 2000);
    await pause(2200);
    await hover(page.locator("text=$12.1T").first(), 900);
    await pause(3500);
  });

  // 8 ------------------------------------------------------------ seller
  await scene("onboard", async () => {
    await click(page.locator('nav a:has-text("Open the desk")'), 900);
    await page.waitForURL("**/start");
    await pause(1200);
    await ensureCursor();
    await click(page.locator('a:has-text("I sell bonds")'), 900);
    await page.waitForURL("**/seller/onboard");
    await pause(1000);
    await click(page.locator('button:has-text("Continue as Seller")').first(), 700);
    await cutting(() => page.waitForSelector('button.btn-primary:has-text("Continue"):not([disabled])', { timeout: 60000 }));
    await click(page.locator('button.btn-primary:has-text("Continue")'), 700);
    await click(page.locator('button:has-text("Skip for now")'), 700);
    await pause(700);
    await click(page.locator('button:has-text("Open my trades")'), 700);
    await page.waitForURL("**/seller");
    await cutting(() => page.locator("li").first().waitFor({ state: "visible", timeout: 60000 }));
    await pause(900);
  });

  await scene("seller", async () => {
    await cutting(() => page.locator('section:has-text("Portfolio")').getByText("CashUSD").first().waitFor({ state: "visible", timeout: 60000 }));
    await pause(1200);
    await hover(page.locator("text=Markets").first(), 900);
    await pause(1500);
    await hover(page.locator("text=Portfolio").first(), 700);
    await pause(1200);

    await click(page.locator('button:has-text("New proposal")').first(), 900);
    await pause(900);
    const modal = page.locator('[role="dialog"]');
    const inputs = modal.locator('input[inputmode="decimal"]');
    await inputs.nth(0).fill("");
    await type(inputs.nth(0), "5", 150);
    await click(modal.locator('[role="tab"]:has-text("CBTC")'), 700);
    await pause(400);
    await inputs.nth(1).fill("");
    await type(inputs.nth(1), "0.01", 150);
    await click(modal.locator('[role="switch"]'), 700);
    await type(modal.locator('input[placeholder="CUSTODY-7741"]'), "CUSTODY-9024", 70);
    await pause(900);
    await click(modal.locator('button:has-text("Send offer")'), 700);
    await cutting(() => page.locator('li:has-text("New")').first().waitFor({ state: "visible", timeout: 90000 }));
    await pause(800);
    const txt = await page.locator('li:has-text("New")').first().innerText();
    tradeId = txt.match(/TRADE-[0-9A-F]+/)?.[0] ?? "";
    console.log("   trade", tradeId);
    await hover(page.locator('li:has-text("New")').first(), 800);
    await pause(2200);
  });
  if (!tradeId) throw new Error("no trade id");

  // 9 ------------------------------------------------------------- buyer
  await scene("buyer", async () => {
    await go("/buyer");
    await cutting(() => page.locator('[role="tab"]:has-text("CBTC")').first().waitFor({ state: "visible", timeout: 60000 }));
    await pause(1500);
    await hover(page.locator("text=Markets").first(), 800);
    await pause(2500);
    await hover(page.locator("text=Portfolio").first(), 800);
    await pause(2600);
    await click(page.locator('[role="tab"]:has-text("CBTC")').first(), 800);
    await pause(1500);
    const row = page.locator('li:has-text("BOND-2031")').first();
    await hover(row, 900);
    await pause(1800);
    await click(row.locator('button:has-text("Buy")'), 800);
    await pause(1500);
    await click(page.locator('[role="dialog"] button:has-text("Confirm purchase")'), 900);
    await cutting(() => page.waitForURL("**/buyer/trades/**", { timeout: 120000 }));
    await pause(2500);
    await ensureCursor();
  });

  // 10 ----------------------------------------------------------- deliver
  await scene("deliver", async () => {
    await go(`/seller/trades/${tradeId}`);
    await cutting(() => page.locator('button:has-text("Deliver bond")').first().waitFor({ state: "visible", timeout: 60000 }));
    await pause(1200);
    await click(page.locator('button:has-text("Deliver bond")').first(), 900);
    await cutting(() => page.locator("text=Waiting for the agent").first().waitFor({ state: "visible", timeout: 120000 }));
    await pause(2500);
  });

  // 11 -------------------------------------------------------------- agent
  await scene("agent", async () => {
    await go("/agent");
    const card = page.locator("div.overflow-hidden", { hasText: tradeId }).last();
    const input = card.locator("input");
    await cutting(() => input.first().waitFor({ state: "visible", timeout: 60000 }));
    await pause(900);
    await type(input.first(), "WRONG-REF", 70);
    await pause(2000);
    await input.first().fill("");
    await type(input.first(), "CUSTODY-9024", 70);
    await pause(1500);
    await click(card.locator('button:has-text("Confirm delivery")'), 800);
    // approval and the automatic settlement happen in one request; wait for its confirmation
    await cutting(() => page.getByText("the trade settled").first().waitFor({ state: "visible", timeout: 180000 }));
    await pause(1800);
  });

  // 12 ------------------------------------------------------------- verify
  await scene("verify", async () => {
    await go(`/seller/trades/${tradeId}`);
    await cutting(() => page.getByText("changed hands in one transaction").first().waitFor({ state: "visible", timeout: 90000 }));
    await pause(2600);
    await scrollToSel('h2:has-text("Proof on the ledger")', 90, 1800);
    await pause(900);
    const verify = page.locator('button:has-text("Verify")');
    await click(verify.last(), 900);
    await pause(2200);
    await click(page.locator('button:has-text("Inspect")').last(), 800);
    await cutting(() => page.locator('[class*="max-w-3xl"]').first().waitFor({ state: "visible", timeout: 30000 }));
    await pause(3500);
    await page.keyboard.press("Escape").catch(() => {});
    await click(page.locator('button[aria-label="Close"]').first(), 700).catch(() => {});
    await pause(600);
  });

  // 13 --------------------------------------------------------------- close
  await scene("close", async () => {
    await go("/");
    await scrollY(99999, 2600);
    await pause(1500);
    await hover(page.locator('a.btn-light:has-text("Open the desk")').last(), 1000);
    await pause(5500);
  });
} catch (e) {
  console.error("RECORDING FAILED at", Object.keys(marks.scenes).at(-1) ?? "start", e);
  process.exitCode = 1;
}

const vid = page.video();
await ctx.close();
await browser.close();
fs.writeFileSync(path.join(OUT, "marks.json"), JSON.stringify({ ...marks, tradeId }, null, 2));
console.log("video:", await vid.path());
