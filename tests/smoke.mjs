import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAVE_KEY = "mars-dvorniki-save-v1";
const chromeBin = process.env.CHROME_PATH || "google-chrome";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
};

function fail(message) {
  console.error("FAIL:", message);
  process.exitCode = 1;
  throw new Error(message);
}

function assert(cond, message) {
  if (!cond) fail(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startServer() {
  const server = createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      if (urlPath === "/") urlPath = "/index.html";
      const file = path.join(root, urlPath);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end("no");
        return;
      }
      const data = await readFile(file);
      const ext = path.extname(file);
      res.writeHead(200, {
        "content-type": types[ext] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
    } catch (err) {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

async function waitForChrome(port) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((t) => t.type === "page");
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {
      /* retry */
    }
    await sleep(100);
  }
  fail("Chrome debug port did not open");
}

async function main() {
  const errors = [];
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  const debugPort = 9337;
  const profile = `/tmp/lunnye-dvorniki-chrome-${process.pid}`;
  const chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--mute-audio",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let chromeLog = "";
  chrome.stderr.on("data", (buf) => { chromeLog += buf.toString(); });

  const cleanup = () => {
    chrome.kill("SIGKILL");
    server.close();
  };
  process.on("exit", cleanup);

  try {
    const wsUrl = await waitForChrome(debugPort);
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", () => reject(new Error("websocket")));
    });
    const cdp = new Cdp(ws);
    const note = (msg) => {
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        errors.push("exception: " + (d.exception?.description || d.text || "unknown"));
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        const text = msg.params.args.map((a) => a.value || a.description || "").join(" ");
        errors.push("console.error: " + text);
      } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
        const text = msg.params.entry.text || "";
        if (/favicon|deprecated|GPU stall|swiftshader|fallback to software|GL Driver|ReadPixels|CLOSE_PATH|dbus|UPower/i.test(text)) return;
        errors.push("log: " + text);
      }
    };
    cdp.on(note);
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url });

    async function ev(expression) {
      const source = expression.trim();
      const wrapped = /[\n;]/.test(source) && !source.startsWith("(")
        ? `(() => {\n${source}\n})()`
        : `(() => (${source}))()`;
      const result = await cdp.send("Runtime.evaluate", {
        expression: wrapped,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        fail("eval: " + (result.exceptionDetails.exception?.description || result.exceptionDetails.text));
      }
      return result.result?.value;
    }

    async function waitReady() {
      for (let i = 0; i < 50; i++) {
        try {
          const ready = await ev("Boolean(window.__LUNAR && window.__LUNAR.ready)");
          if (ready) return;
        } catch {
          /* page is navigating */
        }
        await sleep(100);
      }
      fail("game did not become ready");
    }

    await waitReady();
    const title = await ev("document.title");
    const models = await ev("window.__LUNAR.modelsLoaded === true");
    assert(models, "3D models did not load");
    await ev("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const facing = await ev("__LUNAR.testing.facing()");
    assert(facing > 0.5, "character should face its movement, dot " + facing);
    const roses = await ev(`
      __LUNAR.testing.sow(18);
      return new Promise((resolve) => {
        const started = performance.now();
        const step = () => {
          const count = __LUNAR.testing.flowerCount();
          if (count > 4 || performance.now() - started > 1500) resolve(count);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    `);
    assert(roses > 4, "roses should grow on cleaned ground, got " + roses);
    await ev(`
      __LUNAR.testing.setTool(1);
      __LUNAR.setMove(0, -1);
      __LUNAR.tick(0.05);
      return true;
    `);
    await ev("new Promise((resolve) => requestAnimationFrame(resolve))");
    const toolA = await ev("__LUNAR.testing.toolWorld()");
    await ev("__LUNAR.tick(0.32)");
    await ev("new Promise((resolve) => requestAnimationFrame(resolve))");
    const toolB = await ev("__LUNAR.testing.toolWorld()");
    await ev("__LUNAR.clearMove()");
    const toolMove = Math.hypot(
      (toolB.x - toolB.px) - (toolA.x - toolA.px),
      (toolB.y - toolB.py) - (toolA.y - toolA.py),
      (toolB.z - toolB.pz) - (toolA.z - toolA.pz),
    );
    assert(toolMove > 0.12, "tool should move while sweeping, delta " + toolMove);
    assert(title === "Марсианские дворники", "title " + title);
    const heading = await ev("document.querySelector('h1').textContent");
    assert(heading.includes("Марсианские дворники"), "heading");
    await ev("new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const canvasSize = await ev("(() => { const c = document.getElementById('view'); return {w: c.width, h: c.height}; })()");
    assert(canvasSize.w > 100 && canvasSize.h > 100, "canvas size " + JSON.stringify(canvasSize));

    const names = await ev("[0,1,2,3,4].map(i => __LUNAR.economy.toolName(i))");
    assert(JSON.stringify(names) === JSON.stringify([
      "Зубная щётка", "Веник", "Швабра", "Пылесос", "Промышленный пылесос",
    ]), "tool ladder " + JSON.stringify(names));

    const econ = await ev(`({
      c0: __LUNAR.economy.backpackCost(0),
      c1: __LUNAR.economy.backpackCost(1),
      v0: __LUNAR.economy.value(0),
      v1: __LUNAR.economy.value(1),
      gain: __LUNAR.economy.prestigeGain(200000, 0),
      fmt: __LUNAR.format(1500),
      fmtM: __LUNAR.format(1e6),
    })`);
    assert(econ.c1 > econ.c0 * 1.5, "backpack cost should grow exponentially");
    assert(econ.v1 > econ.v0, "next sector dust should pay more");
    assert(econ.gain >= 1, "prestige gain");
    assert(String(econ.fmt).endsWith("K"), "format 1500 -> " + econ.fmt);
    assert(String(econ.fmtM).endsWith("M"), "format 1e6 -> " + econ.fmtM);

    const before = await ev("__LUNAR.snapshot()");
    await ev(`
      const spot = __LUNAR.findDust();
      __LUNAR.teleport(spot.x, spot.y, spot.z);
      __LUNAR.setMove(0, -1);
      let guard = 0;
      while (__LUNAR.snapshot().money < __LUNAR.economy.backpackCost(0) && guard < 6) {
        for (let i = 0; i < 80; i++) __LUNAR.tick(0.1);
        const depot = __LUNAR.snapshot().depot;
        __LUNAR.clearMove();
        __LUNAR.teleport(depot.x, depot.y, depot.z);
        for (let i = 0; i < 40; i++) __LUNAR.tick(0.1);
        __LUNAR.launch();
        __LUNAR.teleport(spot.x, spot.y, spot.z);
        __LUNAR.setMove(0, -1);
        guard++;
      }
      return __LUNAR.snapshot().money;
    `);
    const swept = await ev("__LUNAR.snapshot()");
    assert(swept.remaining0 < before.remaining0, "dust should decrease");
    assert(swept.clean0 > before.clean0, "cleanliness should rise");
    assert(swept.money > 0 || swept.hopper.worth > 0 || swept.backpack.worth > 0, "cleaning should produce value");
    assert(swept.launches >= 1, "shipment should launch");
    assert(swept.money >= econ.c0, "need enough credits to buy a backpack, have " + swept.money);

    await ev("document.getElementById('shop-open').click()");
    const shopOpen = await ev("!document.getElementById('shop').classList.contains('hidden')");
    assert(shopOpen, "shop opens");
    await ev(`
      const gear = [...document.querySelectorAll('.tab')].find((t) => t.textContent.includes('Снаряжение'));
      gear.click();
      return true;
    `);
    const bought = await ev(`
      const beforeLevel = __LUNAR.snapshot().backpackLevel;
      const btn = document.querySelector('[data-buy="backpack"]');
      if (!btn) return { ok: false, reason: "no button" };
      btn.click();
      const after = __LUNAR.snapshot();
      return { ok: after.backpackLevel === beforeLevel + 1, level: after.backpackLevel, money: after.money };
    `);
    assert(bought.ok, "backpack buy failed " + JSON.stringify(bought));

    await ev("__LUNAR.testing.setMoney(0)");
    const denied = await ev(`
      const level = __LUNAR.snapshot().backpackLevel;
      const btn = document.querySelector('[data-buy="backpack"]');
      const disabled = !btn || btn.disabled;
      if (btn && !btn.disabled) btn.click();
      return { disabled, level, next: __LUNAR.snapshot().backpackLevel };
    `);
    assert(denied.disabled, "poor upgrade should be disabled");
    assert(denied.level === denied.next, "poor buy must not level up");

    await ev("document.getElementById('shop-close').click()");
    await ev("window.dispatchEvent(new Event('pagehide'))");
    const saved = await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}))`);
    assert(saved && saved.v === 2 && saved.planet === "mars", "save missing");
    assert(saved.money >= 0 && saved.backpackLevel >= 1, "save should keep the upgrade");
    assert(typeof saved.lastSave === "number", "lastSave");
    assert(typeof saved.dust === "string" && saved.dust.length > 100, "planet dust saved");
    const camCheck = await ev(`
      const before = __LUNAR.testing.camera();
      __LUNAR.testing.orbit(140, -40);
      for (let i = 0; i < 8; i++) __LUNAR.tick(0.05);
      __LUNAR.testing.zoom(0.02);
      __LUNAR.save();
      const cam = __LUNAR.testing.camera();
      const stored = JSON.parse(localStorage.getItem(${JSON.stringify("mars-dvorniki-save-v1")}));
      return {
        dyaw: Math.abs(cam.yaw - before.yaw),
        pitch: cam.pitch,
        dist: cam.dist,
        savedDist: stored.camera && stored.camera.dist,
        savedYaw: stored.camera && stored.camera.yaw,
      };
    `);
    assert(camCheck.dyaw > 0.3, "orbit should change yaw " + JSON.stringify(camCheck));
    assert(camCheck.dist >= 1.7 && camCheck.dist <= 2.2, "zoom should clamp near " + camCheck.dist);
    assert(Math.abs(camCheck.savedDist - camCheck.dist) < 0.05, "camera dist saved");
    assert(typeof camCheck.savedYaw === "number", "camera yaw saved");

    const stamp = saved.lastSave;
    await sleep(6200);
    const later = await ev(`JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)})).lastSave`);
    assert(later > stamp, "autosave should refresh lastSave");

    await ev("__LUNAR.testing.setRunCredits(200000)");
    await ev("document.getElementById('shop-open').click()");
    await ev(`
      const tabs = [...document.querySelectorAll(".tab")];
      const shift = tabs.find((t) => t.textContent.includes("Смена"));
      if (!shift) return "no-shift-tab";
      shift.click();
      const prestige = document.querySelector('[data-buy="prestige"]');
      if (!prestige) return "no-prestige";
      prestige.click();
      return "opened";
    `);
    const modalTitle = await ev("document.getElementById('modal-title').textContent");
    assert(modalTitle.includes("смена") || modalTitle.includes("Смена"), "prestige confirm, got " + modalTitle);
    const shifted = await ev(`
      const btn = [...document.querySelectorAll("#modal-actions button")].find((b) => b.textContent.includes("Сдать"));
      if (!btn) return "missing";
      btn.click();
      return "done";
    `);
    assert(shifted === "done", "prestige confirm button: " + shifted);
    const afterShift = await ev("__LUNAR.snapshot()");
    assert(afterShift.patches >= 1, "patches after prestige");
    assert(afterShift.money === 0, "money resets on prestige");
    assert(afterShift.toolName === "Зубная щётка", "tool resets");
    assert(afterShift.unlocked === 1, "sectors reset");

    await ev("document.getElementById('shop-open').click()");
    await ev("document.getElementById('reset').click()");
    const resetTitle = await ev("document.getElementById('modal-title').textContent");
    assert(resetTitle.includes("Стереть"), "reset confirm " + resetTitle);
    await ev(`
      const btn = [...document.querySelectorAll("#modal-actions button")].find((b) => b.textContent === "Отмена");
      if (!btn) return "missing";
      btn.click();
      return "done";
    `);
    const still = await ev("__LUNAR.snapshot().patches");
    assert(still >= 1, "cancel keeps patches");
    await ev("document.getElementById('reset').click()");
    await ev(`
      const btn = [...document.querySelectorAll("#modal-actions button")].find((b) => b.textContent === "Стереть");
      if (!btn) return "missing";
      btn.click();
      return "done";
    `);
    const wiped = await ev("__LUNAR.snapshot()");
    assert(wiped.patches === 0 && wiped.money === 0 && wiped.tool === 0, "hard reset");

    try {
      await ev(`
        __LUNAR.testing.holdSave(false);
        const data = JSON.parse(localStorage.getItem(${JSON.stringify(SAVE_KEY)}));
        data.lastSave = Date.now() - 10 * 60 * 60 * 1000;
        data.money = 0;
        data.runCredits = 0;
        data.robots = [
          { type: "chistik", x: data.px, y: data.py, mass: 0, worth: 0, mode: "seek" },
          { type: "chistik", x: data.px + 20, y: data.py, mass: 0, worth: 0, mode: "seek" }
        ];
        localStorage.setItem(${JSON.stringify(SAVE_KEY)}, JSON.stringify(data));
        window.__LUNAR.ready = false;
        location.reload();
        return true;
      `);
    } catch (err) {
      const text = String(err && err.message ? err.message : err);
      if (!/destroyed|navigat|context|target/i.test(text)) throw err;
    }
    await waitReady();
    const back = await ev(`({
      title: document.getElementById('modal-title') && document.getElementById('modal-title').textContent,
      hidden: document.getElementById('modal').classList.contains('hidden'),
      body: document.getElementById('modal-body').innerText,
      money: __LUNAR.snapshot().money
    })`);
    assert(!back.hidden, "offline modal hidden: " + JSON.stringify(back));
    assert(back.title === "Пока тебя не было", "offline title " + back.title);
    assert(back.body.includes("8 часов"), "offline cap text: " + back.body);
    assert(back.money > 100, "offline credits " + back.money);

    assert(errors.length === 0, "console errors:\\n" + errors.join("\\n"));
    console.log("SMOKE PASS");
  } catch (err) {
    if (!process.exitCode) process.exitCode = 1;
    console.error(err && err.stack ? err.stack : err);
    if (errors.length) console.error("captured:\\n" + errors.join("\\n"));
    if (chromeLog) console.error("chrome:\\n" + chromeLog.slice(-2000));
  } finally {
    cleanup();
  }
}

main();
