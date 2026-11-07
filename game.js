(() => {
  "use strict";

  const SAVE_KEY = "lunnye-dvorniki-save-v1";
  const COLS = 30;
  const ROWS = 22;
  const TILE = 30;
  const SW = COLS * TILE;
  const SH = ROWS * TILE;
  const GAP = 120;
  const STRIDE = SW + GAP;
  const VIEW_H = 640;
  const UNLOCK_AT = 0.8;
  const MAX_OFFLINE = 8 * 60 * 60 * 1000;
  const OFFLINE_EFF = 0.5;
  const ROBOT_CAP_TOTAL = 30;
  const DEPOT_CAP = 10;

  const BIOMES = [
    { id: "lock", short: "Шлюз", name: "Двор у шлюза", ground: ["#f6d7a8", "#e7b97a"], dust: [148, 128, 140], accent: "#ff7a59", price: 1, decor: "airlock" },
    { id: "cactus", short: "Колючка", name: "Оранжерея «Колючка»", ground: ["#d7e7a4", "#b5d18a"], dust: [150, 146, 120], accent: "#3aaa5a", price: 1.08, decor: "cactus" },
    { id: "dish", short: "Тарелки", name: "Поле тарелок", ground: ["#d5e4f7", "#b7c9e6"], dust: [126, 134, 156], accent: "#4c7cff", price: 1.12, decor: "dish" },
    { id: "domes", short: "Купола", name: "Ряд куполов", ground: ["#f8d5e4", "#f0b4ce"], dust: [164, 126, 146], accent: "#ff5d8f", price: 1.16, decor: "domes" },
    { id: "quarry", short: "Карьер", name: "Сухой карьер", ground: ["#efc7a4", "#d39268"], dust: [122, 96, 78], accent: "#d86b32", price: 1.22, decor: "quarry" },
    { id: "terrace", short: "Тишина", name: "Терраса тишины", ground: ["#d4f3ef", "#a9e0d8"], dust: [112, 142, 150], accent: "#1aa58f", price: 1.28, decor: "flags" },
    { id: "bagel", short: "Бублик", name: "Кратер Бублик", ground: ["#f6e6c4", "#e6c98a"], dust: [154, 132, 104], accent: "#e2a122", price: 1.34, decor: "crater" },
    { id: "ink", short: "Чернила", name: "Чернильная низина", ground: ["#d5def8", "#aeb6e6"], dust: [96, 86, 140], accent: "#6d5efc", price: 1.42, decor: "ink" },
  ];

  const TOOLS = [
    { id: "brush", name: "Зубная щётка", blurb: "Маленький круг. До приёмника придётся ходить часто.", power: 190, radius: 36, cost: 0 },
    { id: "broom", name: "Веник", blurb: "Шире взмах, двор светлеет быстрее.", power: 320, radius: 50, cost: 1600 },
    { id: "mop", name: "Швабра", blurb: "Длинная чистая полоса за один проход.", power: 520, radius: 64, cost: 6200 },
    { id: "vac", name: "Пылесос", blurb: "Тянет пыль вокруг дворника.", power: 860, radius: 78, cost: 18000 },
    { id: "ind", name: "Промышленный пылесос", blurb: "Для дворов, которые занесло всерьёз.", power: 1400, radius: 94, cost: 52000 },
    { id: "turbo", name: "Турбометла", blurb: "Воет, но плитка сияет.", power: 2200, radius: 108, cost: 140000 },
    { id: "cyclone", name: "Циклон «Буран»", blurb: "Закручивает налёт в аккуратный столб.", power: 3400, radius: 120, cost: 380000 },
    { id: "plasma", name: "Плазменная швабра", blurb: "Снимает копоть и не царапает камень.", power: 5200, radius: 134, cost: 980000 },
    { id: "grav", name: "Гравиуборщик", blurb: "Пыль сама бежит в рюкзак.", power: 8000, radius: 148, cost: 2500000 },
    { id: "comet", name: "Кометный пылесос", blurb: "За спиной остаётся хвост чистой земли.", power: 12000, radius: 162, cost: 6400000 },
    { id: "aurora", name: "Сияние-3000", blurb: "Посёлок после него видно с орбиты.", power: 18000, radius: 178, cost: 16000000 },
  ];

  const VEHICLES = [
    { id: "pyh", name: "Лунокат «Пых»", blurb: "Быстрее шага и чуть шире метёт.", speed: 1.4, power: 1.22, radius: 16, cost: 12000, color: "#ffd23f" },
    { id: "blin", name: "Каток «Блин»", blurb: "Медленный блин на весь двор.", speed: 0.95, power: 1.9, radius: 54, cost: 48000, color: "#ff8fab" },
    { id: "iskra", name: "Гонщик «Искра»", blurb: "Почти не задевает края, зато летит.", speed: 1.9, power: 1.08, radius: 6, cost: 125000, color: "#8ee7ff" },
  ];

  const ROBOTS = [
    { id: "chistik", name: "Чистик", blurb: "Круглый малыш с метёлочкой.", rate: 26, cap: 480, speed: 80, radius: 30, cost: 7500, growth: 1.62, color: "#3ecf8e" },
    { id: "beetle", name: "Жук-пылесос", blurb: "Ползёт и втягивает серый налёт.", rate: 55, cap: 900, speed: 100, radius: 34, cost: 26000, growth: 1.66, color: "#ff8a3d" },
    { id: "drone", name: "Дрон «Мётлыч»", blurb: "Летает над двором и смахивает пыль.", rate: 100, cap: 1200, speed: 145, radius: 36, cost: 84000, growth: 1.68, color: "#4c7cff" },
    { id: "caravan", name: "Караван «Тихоход»", blurb: "Медленный, зато с большим баком.", rate: 170, cap: 3000, speed: 72, radius: 42, cost: 230000, growth: 1.7, color: "#f2d2a9" },
  ];

  const TABS = [
    { id: "tools", name: "Инструменты" },
    { id: "gear", name: "Снаряжение" },
    { id: "tech", name: "Техника" },
    { id: "bots", name: "Роботы" },
    { id: "shift", name: "Смена" },
  ];

  const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

  const $ = (id) => document.getElementById(id);
  const canvas = $("view");
  const ctx = canvas.getContext("2d");
  const stage = $("stage");
  const moneyEl = $("money");
  const mulEl = $("mul");
  const patchesEl = $("patches");
  const sectorNameEl = $("sector-name");
  const priceEl = $("price");
  const sectorPctEl = $("sector-pct");
  const sectorBar = $("sector-bar");
  const stripEl = $("strip");
  const packLabel = $("pack-label");
  const packBar = $("pack-bar");
  const hintEl = $("hint");
  const launchBtn = $("launch");
  const launchLabel = $("launch-label");
  const shopBtn = $("shop-open");
  const placeBtn = $("place");
  const rideBtn = $("ride");
  const stickEl = $("stick");
  const knobEl = $("knob");
  const toastEl = $("toast");
  const bannerEl = $("banner");
  const shopEl = $("shop");
  const shopBody = $("shop-body");
  const shopSummary = $("shop-summary");
  const tabsEl = $("tabs");
  const modalEl = $("modal");
  const modalTitle = $("modal-title");
  const modalBody = $("modal-body");
  const modalActions = $("modal-actions");

  if (!ctx) throw new Error("canvas");

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = Math.min(typeof r === "number" ? r : 0, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + radius, y);
    this.arcTo(x + w, y, x + w, y + h, radius);
    this.arcTo(x + w, y + h, x, y + h, radius);
    this.arcTo(x, y + h, x, y, radius);
    this.arcTo(x, y, x + w, y, radius);
    this.closePath();
  };
}

  const view = { w: 800, h: 600, dpr: 1, scale: 1 };
  const cam = { x: 120, y: SH / 2 };
  const keys = new Set();
  const stick = { active: false, x: 0, y: 0, pointer: -1, manual: null };
  const robots = [];
  const particles = [];
  const floaters = [];
  const sweeps = [];
  const rockets = [];
  const hitPool = [];
  let hitCount = 0;
  let state;
  let anim = 0;
  let shake = 0;
  let paused = false;
  let hiddenAt = 0;
  let tab = "tools";
  let frameStats = { power: 190, radius: 36, speed: 128, tool: TOOLS[0] };
  let frameCleaning = false;
  let frameMoving = false;
  let frameFacing = 1;
  let lastHere = -2;
  let toastTimer = 0;
  let lastToast = "";
  let bannerTimer = 0;
  let saveWarned = false;
  let savesEnabled = true;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function num(v, d = 0, min = -Infinity, max = Infinity) {
    if (typeof v !== "number" || !Number.isFinite(v)) return d;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  function int(v, d = 0, max = 9999) {
    return Math.floor(num(v, d, 0, max));
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return "∞";
    const sign = n < 0 ? "−" : "";
    n = Math.abs(n);
    if (n < 1000) {
      if (n < 10) {
        const r = Math.round(n * 10) / 10;
        return sign + String(r);
      }
      return sign + String(Math.floor(n));
    }
    const exp = Math.floor(Math.log10(n) / 3);
    if (exp <= 0 || exp >= SUFFIX.length) return sign + n.toExponential(2);
    const v = n / 1000 ** exp;
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return sign + v.toFixed(digits) + SUFFIX[exp];
  }

  function formatDuration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h} ч ${m} мин`;
    if (m > 0) return `${m} мин`;
    return `${s} с`;
  }

  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  function hash2(a, b) {
    let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
    n = (n ^ (n >>> 13)) >>> 0;
    return (Math.imul(n, 1274126177) >>> 0) / 4294967296;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function biomeOf(index) {
    return BIOMES[index % BIOMES.length];
  }

  function sectorTitle(index) {
    const b = biomeOf(index);
    const season = Math.floor(index / BIOMES.length) + 1;
    return season === 1 ? b.name : `${b.name} · сезон ${season}`;
  }

  function valueOf(index) {
    const b = biomeOf(index);
    return 0.22 * b.price * 1.46 ** index;
  }

  function sparkleMul(index, tile) {
    return hash2(index * 13 + 7, tile) > 0.955 ? 3 : 1;
  }

  function sectorOrigin(index) {
    return { x: index * STRIDE, y: 0 };
  }

  function spawnPoint() {
    return { x: 120, y: SH / 2 };
  }

  function homeDepot() {
    return { x: 120, y: SH / 2, home: true };
  }

  function capacityAt(level) {
    return Math.round(1000 * 1.4 ** level);
  }

  function capacity() {
    return capacityAt(state.backpackLevel);
  }

  function backpackCost(level) {
    return Math.round(480 * 1.62 ** level);
  }

  function speedCost(level) {
    return Math.round(420 * 1.58 ** level);
  }

  function shipCost(level) {
    return Math.round(1600 * 1.7 ** level);
  }

  function polishCost(level) {
    return Math.round(7000 * 1.88 ** level);
  }

  function batteryCost(level) {
    return Math.round(12000 * 1.74 ** level);
  }

  function depotPrice(bought) {
    return Math.round(2200 * 2.2 ** bought);
  }

  function prestigeCost(patches) {
    return 180000 * 1.85 ** patches;
  }

  function prestigeGain(credits, patches) {
    let gain = 0;
    let cost = prestigeCost(patches);
    let pool = credits;
    while (pool >= cost && gain < 30) {
      pool -= cost;
      gain += 1;
      cost *= 1.85;
    }
    return gain;
  }

  function payMul() {
    return (1 + state.patches * 0.4) * (1 + state.shipLevel * 0.08);
  }

  function payout(base) {
    return base * payMul();
  }

  function robotDef(id) {
    return ROBOTS.find((r) => r.id === id) || ROBOTS[0];
  }

  function vehicleById(id) {
    return VEHICLES.find((v) => v.id === id) || null;
  }

  function robotCount(id) {
    let n = 0;
    for (const r of robots) if (r.type === id) n++;
    return n;
  }

  function robotRateMul() {
    return (1 + state.battery * 0.12) * (1 + state.patches * 0.1);
  }

  function combatStats() {
    const tool = TOOLS[state.tool] || TOOLS[0];
    const polish = 1.14 ** state.polish;
    const prestige = 1 + state.patches * 0.12;
    let power = tool.power * polish * prestige;
    let radius = tool.radius * (1 + state.patches * 0.015);
    let speed = 128 * 1.072 ** state.speedLevel * (1 + state.patches * 0.025);
    if (state.riding) {
      const v = vehicleById(state.riding);
      if (v) {
        power *= v.power;
        radius += v.radius;
        speed *= v.speed;
      }
    }
    return { power, radius, speed, tool };
  }

  function freshState() {
    const sp = spawnPoint();
    return {
      money: 0,
      runCredits: 0,
      lifetime: 0,
      patches: 0,
      tool: 0,
      polish: 0,
      backpackLevel: 0,
      speedLevel: 0,
      shipLevel: 0,
      battery: 0,
      depotBought: 0,
      depotStock: 0,
      placed: [],
      vehicles: {},
      riding: null,
      seenDust: false,
      launches: 0,
      cleaned: 0,
      px: sp.x,
      py: sp.y,
      backpack: { mass: 0, worth: 0 },
      hopper: { mass: 0, worth: 0 },
      sectors: [],
      nearDepot: false,
      launchLock: 0,
      sweepCd: 0,
      fullCd: 0,
    };
  }

  function generateDust(index) {
    const rand = mulberry32(index * 9973 + 42);
    const dust = new Float32Array(COLS * ROWS);
    const growth = 1.15 ** index;
    let initial = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i = row * COLS + col;
        const x = (col + 0.5) * TILE;
        const y = (row + 0.5) * TILE;
        let n = (46 + rand() * 34) * growth;
        if (Math.abs(y - SH / 2) < 64) n *= 0.22;
        if (x < 78 || x > SW - 78) n *= 0.35;
        if (index === 0 && Math.hypot(x - 120, y - SH / 2) < 110) n = 0;
        dust[i] = n;
        initial += n;
      }
    }
    return { dust, initial };
  }

  function makeBoulders(index) {
    const rand = mulberry32(9000 + index * 17);
    const list = [];
    const n = 5 + (index % 4);
    let guard = 0;
    while (list.length < n && guard++ < 70) {
      const x = 90 + rand() * (SW - 180);
      const y = 90 + rand() * (SH - 180);
      if (Math.abs(y - SH / 2) < 90) continue;
      if (index === 0 && Math.hypot(x - 120, y - SH / 2) < 170) continue;
      const r = 16 + rand() * 14;
      let ok = true;
      for (const b of list) {
        if (Math.hypot(b.x - x, b.y - y) < r + b.r + 26) ok = false;
      }
      if (!ok) continue;
      list.push({ x, y, r });
    }
    return list;
  }

  function createSector(index, dust, initial) {
    const sector = {
      index,
      dust: dust || null,
      initial: initial || 0,
      boulders: makeBoulders(index),
    };
    if (!sector.dust) {
      const gen = generateDust(index);
      sector.dust = gen.dust;
      sector.initial = gen.initial;
    }
    return sector;
  }

  function applyFresh() {
    state = freshState();
    robots.length = 0;
    particles.length = 0;
    floaters.length = 0;
    sweeps.length = 0;
    rockets.length = 0;
    state.sectors = [createSector(0)];
    const sp = spawnPoint();
    state.px = sp.x;
    state.py = sp.y;
    cam.x = sp.x;
    cam.y = sp.y;
    shake = 0;
    lastHere = -2;
  }

  function encodeF32(f32) {
    const u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      const sub = u8.subarray(i, Math.min(u8.length, i + chunk));
      let part = "";
      for (let j = 0; j < sub.length; j++) part += String.fromCharCode(sub[j]);
      binary += part;
    }
    return btoa(binary);
  }

  function decodeF32(b64, len) {
    if (typeof b64 !== "string" || !b64) throw new Error("dust");
    const binary = atob(b64);
    const u8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i) & 255;
    if (u8.byteLength !== len * 4) throw new Error("dustlen");
    const out = new Float32Array(len);
    out.set(new Float32Array(u8.buffer));
    for (let i = 0; i < out.length; i++) {
      if (!Number.isFinite(out[i]) || out[i] < 0) out[i] = 0;
    }
    return out;
  }

  function inWalkable(x, y) {
    const pad = 12;
    if (x < pad) return false;
    const i = Math.floor(x / STRIDE);
    if (i < 0) return false;
    const local = x - i * STRIDE;
    if (local <= SW) {
      if (i >= state.sectors.length) return false;
      return y >= pad && y <= SH - pad;
    }
    if (i + 1 >= state.sectors.length) return false;
    return Math.abs(y - SH / 2) <= 36;
  }

  function sectorIndexAt(x, y) {
    const i = Math.floor(x / STRIDE);
    if (i < 0 || i >= state.sectors.length) return null;
    const local = x - i * STRIDE;
    if (local > SW) return null;
    if (y < 0 || y > SH) return null;
    return i;
  }

  function hitsBoulder(x, y) {
    const s = sectorIndexAt(x, y);
    if (s == null) return false;
    const o = sectorOrigin(s);
    const sector = state.sectors[s];
    for (const b of sector.boulders) {
      if (Math.hypot(x - (o.x + b.x), y - (o.y + b.y)) < b.r + 14) return true;
    }
    return false;
  }

  function moveEntity(ent, nx, ny, read) {
    const x = read ? read.x : ent.x;
    const y = read ? read.y : ent.y;
    if (inWalkable(nx, ny) && !hitsBoulder(nx, ny)) {
      ent.x = nx;
      ent.y = ny;
      return;
    }
    if (inWalkable(nx, y) && !hitsBoulder(nx, y)) {
      ent.x = nx;
      return;
    }
    if (inWalkable(x, ny) && !hitsBoulder(x, ny)) ent.y = ny;
  }

  function allDepots() {
    const list = [homeDepot()];
    for (const d of state.placed) list.push({ x: d.x, y: d.y, home: false });
    return list;
  }

  function nearestDepot(x, y) {
    let best = homeDepot();
    let bd = Infinity;
    for (const d of allDepots()) {
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < bd) {
        bd = dist;
        best = d;
      }
    }
    return { depot: best, dist: bd };
  }

  function remaining(sector) {
    let t = 0;
    const d = sector.dust;
    for (let i = 0; i < d.length; i++) t += d[i];
    return t;
  }

  function cleanliness(sector) {
    if (!sector || sector.initial <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - remaining(sector) / sector.initial));
  }

  function locationInfo() {
    const i = Math.floor(state.px / STRIDE);
    const local = state.px - i * STRIDE;
    if (i >= 0 && i < state.sectors.length && local <= SW && state.py >= 0 && state.py <= SH) {
      return { index: i, bridge: false };
    }
    if (local > SW && i >= 0 && i + 1 < state.sectors.length) return { index: i, bridge: true };
    return { index: Math.max(0, state.sectors.length - 1), bridge: true };
  }

  function allocHit() {
    let h = hitPool[hitCount];
    if (!h) h = hitPool[hitCount] = {};
    hitCount += 1;
    return h;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n && particles.length < 420; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        age: 0,
        life: 0.35 + Math.random() * 0.45,
        size: 2 + Math.random() * 3.5,
        color,
        g: 40,
      });
    }
  }

  function spawnPuff(x, y, gold) {
    if (particles.length > 380) return;
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 50,
      vy: -30 - Math.random() * 50,
      age: 0,
      life: 0.4 + Math.random() * 0.25,
      size: 3 + Math.random() * 3,
      color: gold ? "#ffd23f" : "#efe8f4",
      g: 50,
    });
  }

  function floater(text, x, y, color) {
    floaters.push({ text, x, y, age: 0, life: 1.05, color: color || "#24183a" });
    if (floaters.length > 24) floaters.shift();
  }

  function collect(power, dt, x, y, radius, bag, cap) {
    const space = cap - bag.mass;
    if (space <= 0.05 || power <= 0 || radius <= 0) return 0;
    const budget = Math.min(power * dt, space);
    hitCount = 0;
    const r2 = radius * radius;
    const i0 = Math.max(0, Math.floor((x - radius) / STRIDE));
    const i1 = Math.min(state.sectors.length - 1, Math.floor((x + radius) / STRIDE));
    let weight = 0;
    for (let si = i0; si <= i1; si++) {
      const o = sectorOrigin(si);
      const sector = state.sectors[si];
      const c0 = Math.max(0, Math.floor((x - radius - o.x) / TILE));
      const c1 = Math.min(COLS - 1, Math.floor((x + radius - o.x) / TILE));
      const r0 = Math.max(0, Math.floor((y - radius - o.y) / TILE));
      const r1 = Math.min(ROWS - 1, Math.floor((y + radius - o.y) / TILE));
      if (c1 < c0 || r1 < r0) continue;
      const base = valueOf(si);
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const tx = o.x + (col + 0.5) * TILE;
          const ty = o.y + (row + 0.5) * TILE;
          const dx = tx - x;
          const dy = ty - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const ti = row * COLS + col;
          const dust = sector.dust[ti];
          if (dust <= 0.08) continue;
          const dist = Math.sqrt(d2);
          const w = (1 - dist / radius) ** 2;
          const hit = allocHit();
          hit.sector = sector;
          hit.ti = ti;
          hit.dust = dust;
          hit.w = w;
          hit.spark = sparkleMul(si, ti) > 1;
          hit.value = base * (hit.spark ? 3 : 1);
          hit.wx = tx;
          hit.wy = ty;
          weight += w;
        }
      }
    }
    if (!hitCount || weight <= 0) return 0;
    let taken = 0;
    let spawned = 0;
    for (let i = 0; i < hitCount; i++) {
      const hit = hitPool[i];
      const want = Math.min(hit.dust, budget * (hit.w / weight));
      if (want <= 0.0001) continue;
      hit.sector.dust[hit.ti] = Math.max(0, hit.dust - want);
      bag.mass += want;
      bag.worth += want * hit.value;
      taken += want;
      if (spawned < 4 && (hit.spark || Math.random() < 0.18)) {
        spawnPuff(hit.wx, hit.wy, hit.spark);
        spawned += 1;
      }
    }
    return taken;
  }

  function pickRobotTarget() {
    let best = null;
    let bestV = -1;
    for (const s of state.sectors) {
      let rem = 0;
      const dust = s.dust;
      for (let i = 0; i < dust.length; i++) rem += dust[i];
      if (rem < 12) continue;
      const v = valueOf(s.index);
      if (v > bestV) {
        bestV = v;
        best = s;
      }
    }
    if (!best) return null;
    let chosen = -1;
    let bestDust = 0;
    for (let k = 0; k < 18; k++) {
      const i = (Math.random() * best.dust.length) | 0;
      if (best.dust[i] > bestDust) {
        bestDust = best.dust[i];
        chosen = i;
      }
    }
    if (chosen < 0) return null;
    const col = chosen % COLS;
    const row = (chosen / COLS) | 0;
    const o = sectorOrigin(best.index);
    return { x: o.x + (col + 0.5) * TILE, y: o.y + (row + 0.5) * TILE };
  }

  function updateRobots(dt) {
    const mul = robotRateMul();
    for (let ri = 0; ri < robots.length; ri++) {
      const r = robots[ri];
      const def = robotDef(r.type);
      const cap = def.cap * (1 + state.patches * 0.05);
      r.retarget -= dt;
      if (r.mass >= cap - 0.2) r.mode = "dump";
      if (r.mode === "dump") {
        const d = nearestDepot(r.x, r.y);
        r.tx = d.depot.x;
        r.ty = d.depot.y;
        if (d.dist < 40) {
          state.hopper.mass += r.mass;
          state.hopper.worth += r.worth;
          r.mass = 0;
          r.worth = 0;
          r.mode = "seek";
          r.retarget = 0;
          burst(d.depot.x, d.depot.y, "#b8ffe8", 8, 50);
        }
      } else if (r.retarget <= 0) {
        const target = pickRobotTarget();
        if (!target) {
          const home = homeDepot();
          r.tx = home.x;
          r.ty = home.y;
        } else {
          r.tx = target.x + ((ri % 5) - 2) * 18;
          r.ty = target.y + ((ri % 3) - 1) * 16;
        }
        r.retarget = 0.65 + (ri % 5) * 0.08;
      }
      const dx = (r.tx || r.x) - r.x;
      const dy = (r.ty || r.y) - r.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = r.x + (dx / dist) * def.speed * dt;
      const ny = r.y + (dy / dist) * def.speed * dt;
      const bx = r.x;
      const by = r.y;
      moveEntity(r, nx, ny);
      if (!inWalkable(r.x, r.y)) {
        const home = homeDepot();
        r.x = home.x + 16;
        r.y = home.y + 28;
      }
      const moved = Math.hypot(r.x - bx, r.y - by);
      if (moved < def.speed * dt * 0.25) {
        r.stuck = (r.stuck || 0) + dt;
        if (r.stuck > 0.75) {
          r.stuck = 0;
          r.retarget = 0;
          r.x += ((ri % 2) ? 18 : -18);
          r.y += 10;
        }
      } else r.stuck = 0;
      if (r.mode !== "dump") {
        const got = collect(def.rate * mul, dt, r.x, r.y, def.radius, r, cap);
        if (got > 0) state.cleaned += got;
      }
    }
  }

  function updateUnload(dt) {
    const near = nearestDepot(state.px, state.py);
    state.nearDepot = near.dist < 64;
    if (!state.nearDepot || state.backpack.mass <= 0) return;
    const rate = Math.max(capacity(), 900) * 2;
    const move = Math.min(state.backpack.mass, rate * dt);
    const frac = state.backpack.mass > 0 ? move / state.backpack.mass : 0;
    const worth = state.backpack.worth * frac;
    state.backpack.mass -= move;
    state.backpack.worth -= worth;
    if (state.backpack.mass <= 0.05) {
      state.backpack.mass = 0;
      state.backpack.worth = 0;
    }
    state.hopper.mass += move;
    state.hopper.worth += worth;
    if (Math.random() < dt * 10) spawnPuff(state.px, state.py, false);
  }

  function checkUnlocks() {
    let guard = 0;
    while (guard++ < 3) {
      const last = state.sectors[state.sectors.length - 1];
      if (!last || cleanliness(last) < UNLOCK_AT) break;
      const created = createSector(state.sectors.length);
      state.sectors.push(created);
      banner("Открыт участок: " + sectorTitle(created.index));
      burst(state.px, state.py, "#ffc857", 26, 120);
    }
  }

  function movementVec() {
    if (stick.manual) {
      const m = Math.hypot(stick.manual.x, stick.manual.y);
      if (m < 0.08) return { x: 0, y: 0 };
      return { x: stick.manual.x / m, y: stick.manual.y / m };
    }
    if (stick.active) {
      const m = Math.hypot(stick.x, stick.y);
      if (m < 0.12) return { x: 0, y: 0 };
      return { x: stick.x / m, y: stick.y / m };
    }
    let x = 0;
    let y = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const m = Math.hypot(x, y);
    return { x: x / m, y: y / m };
  }

  function uiBlocked() {
    return !shopEl.classList.contains("hidden") || !modalEl.classList.contains("hidden");
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.life) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
      f.y -= 28 * dt;
      if (f.age >= f.life) floaters.splice(i, 1);
    }
    for (let i = sweeps.length - 1; i >= 0; i--) {
      sweeps[i].age += dt;
      if (sweeps[i].age >= sweeps[i].life) sweeps.splice(i, 1);
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      rockets[i].age += dt;
      if (rockets[i].age >= rockets[i].life) rockets.splice(i, 1);
    }
  }

  function updateCamera(dt) {
    const k = Math.min(1, dt * 6);
    cam.x += (state.px - cam.x) * k;
    cam.y += (state.py - cam.y) * k;
  }

  function update(dt) {
    if (paused) return;
    dt = Math.max(0, Math.min(0.1, dt));
    anim += dt;
    state.launchLock = Math.max(0, state.launchLock - dt);
    if (!reduceMotion) shake = Math.max(0, shake - dt * 16);
    frameStats = combatStats();
    const vec = uiBlocked() ? { x: 0, y: 0 } : movementVec();
    frameMoving = vec.x !== 0 || vec.y !== 0;
    if (vec.x > 0.2) frameFacing = 1;
    else if (vec.x < -0.2) frameFacing = -1;
    frameCleaning = false;
    if (!uiBlocked()) {
      const nx = state.px + vec.x * frameStats.speed * dt;
      const ny = state.py + vec.y * frameStats.speed * dt;
      const body = { x: state.px, y: state.py };
      moveEntity(body, nx, ny);
      state.px = body.x;
      state.py = body.y;
      const cap = capacity();
      const before = state.backpack.mass;
      const taken = collect(frameStats.power, dt, state.px, state.py, frameStats.radius, state.backpack, cap);
      if (taken > 0) {
        frameCleaning = true;
        state.seenDust = true;
        state.cleaned += taken;
        state.sweepCd -= dt;
        if (state.sweepCd <= 0) {
          sweeps.push({
            x: state.px,
            y: state.py,
            r: frameStats.radius,
            age: 0,
            life: 0.32,
            a: anim * 3,
          });
          state.sweepCd = 0.12;
        }
      }
      if (state.backpack.mass >= cap - 0.4 && taken <= 0 && dustUnderPlayer() > 8) {
        state.fullCd -= dt;
        if (state.fullCd <= 0) {
          floater("Рюкзак полон", state.px, state.py - 28, "#ff6b6b");
          state.fullCd = 1.7;
        }
      }
      if (state.backpack.mass > before + 40 && !state.seenFullHint && state.backpack.mass > cap * 0.92) {
        state.seenFullHint = true;
      }
      updateUnload(dt);
    }
    updateRobots(dt);
    updateParticles(dt);
    checkUnlocks();
    updateCamera(dt);
    updateUI();
  }

  function dustUnderPlayer() {
    const s = sectorIndexAt(state.px, state.py);
    if (s == null) return 0;
    const o = sectorOrigin(s);
    const col = Math.floor((state.px - o.x) / TILE);
    const row = Math.floor((state.py - o.y) / TILE);
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return 0;
    return state.sectors[s].dust[row * COLS + col];
  }

  function tryLaunch() {
    if (uiBlocked()) return false;
    if (!state.nearDepot) {
      toast("Подойди к зелёному приёмнику");
      return false;
    }
    if (state.hopper.worth <= 0.05) {
      toast("Бункер пуст");
      return false;
    }
    if (state.launchLock > 0) return false;
    const pay = payout(state.hopper.worth);
    state.hopper.mass = 0;
    state.hopper.worth = 0;
    state.money += pay;
    state.runCredits += pay;
    state.lifetime += pay;
    state.launches += 1;
    state.launchLock = 0.7;
    if (!reduceMotion) shake = 8;
    const d = nearestDepot(state.px, state.py).depot;
    rockets.push({ x: d.x, y: d.y, age: 0, life: 1.25 });
    burst(d.x, d.y, "#ffc857", 18, 90);
    floater("+" + formatNumber(pay), d.x, d.y - 20, "#24183a");
    popMoney();
    save();
    updateUI();
    return true;
  }

  function tryPlace() {
    if (uiBlocked()) return;
    if (state.depotStock <= 0) return;
    const here = sectorIndexAt(state.px, state.py);
    if (here == null) {
      toast("На мостике приёмник не ставят");
      return;
    }
    for (const d of allDepots()) {
      if (Math.hypot(d.x - state.px, d.y - state.py) < 170) {
        toast("Слишком близко к другому приёмнику");
        return;
      }
    }
    if (hitsBoulder(state.px, state.py)) {
      toast("Здесь камень");
      return;
    }
    state.placed.push({ x: state.px, y: state.py });
    state.depotStock -= 1;
    toast("Приёмник стоит");
    burst(state.px, state.py, "#14b889", 14, 70);
    save();
    updateUI();
  }

  function cycleRide() {
    const owned = VEHICLES.filter((v) => state.vehicles[v.id]);
    if (!owned.length || uiBlocked()) return;
    const order = [null, ...owned.map((v) => v.id)];
    let i = order.indexOf(state.riding);
    if (i < 0) i = 0;
    state.riding = order[(i + 1) % order.length];
    toast(state.riding ? "Сел: " + vehicleById(state.riding).name : "Снова пешком");
    updateUI();
  }

  function canAfford(cost) {
    return state.money + 1e-6 >= cost;
  }

function spend(cost, label) {
  if (!canAfford(cost)) return false;
  state.money -= cost;
  toast("Куплено: " + label);
popMoney();
    burst(state.px, state.py, "#ffc857", 12, 80);
    return true;
}

function finishBuy() {
  save();
  updateUI();
  renderShop();
}

  function buy(id) {
    if (id === "tool") {
      const next = state.tool + 1;
      if (next >= TOOLS.length) return false;
      const tool = TOOLS[next];
      if (!spend(tool.cost, tool.name)) return false;
      state.tool = next;
      finishBuy();
      return true;
    }
    if (id === "polish") {
      const cost = polishCost(state.polish);
      if (!spend(cost, "Полировка " + (state.polish + 1))) return false;
      state.polish += 1;
      finishBuy();
      return true;
    }
    if (id === "backpack") {
      const cost = backpackCost(state.backpackLevel);
      if (!spend(cost, "Рюкзак")) return false;
      state.backpackLevel += 1;
      finishBuy();
      return true;
    }
    if (id === "speed") {
      const cost = speedCost(state.speedLevel);
      if (!spend(cost, "Ботинки")) return false;
      state.speedLevel += 1;
      finishBuy();
      return true;
    }
    if (id === "ship") {
      const cost = shipCost(state.shipLevel);
      if (!spend(cost, "Тариф рейса")) return false;
      state.shipLevel += 1;
      finishBuy();
      return true;
    }
    if (id === "battery") {
      const cost = batteryCost(state.battery);
      if (!spend(cost, "Батареи")) return false;
      state.battery += 1;
      finishBuy();
      return true;
    }
    if (id === "depot") {
      if (state.depotBought >= DEPOT_CAP) {
        toast("Больше приёмников посёлок не тянет");
        return false;
      }
      const cost = depotPrice(state.depotBought);
      if (!spend(cost, "Запасной приёмник")) return false;
      state.depotBought += 1;
      state.depotStock += 1;
      finishBuy();
      return true;
    }
    if (id.startsWith("vehicle:")) {
      const vid = id.slice(8);
      const v = vehicleById(vid);
      if (!v || state.vehicles[vid]) return false;
      if (!spend(v.cost, v.name)) return false;
      state.vehicles[vid] = true;
      finishBuy();
      return true;
    }
    if (id.startsWith("robot:")) {
      if (robots.length >= ROBOT_CAP_TOTAL) {
        toast("На дворе больше не помещается");
        return false;
      }
      const rid = id.slice(6);
      const def = robotDef(rid);
      if (!ROBOTS.some((r) => r.id === rid)) return false;
      const cost = Math.round(def.cost * def.growth ** robotCount(rid));
      if (!spend(cost, def.name)) return false;
      const home = homeDepot();
      robots.push({
        type: rid,
        x: home.x + (Math.random() - 0.5) * 30,
        y: home.y + 24 + Math.random() * 20,
        mass: 0,
        worth: 0,
        mode: "seek",
        tx: home.x,
        ty: home.y,
        retarget: 0,
        stuck: 0,
      });
      finishBuy();
      return true;
    }
    if (id === "prestige") {
      openPrestigeConfirm();
      return false;
    }
    return false;
  }

  function doPrestige() {
    const gain = prestigeGain(state.runCredits, state.patches);
    if (gain <= 0) return;
    const patches = state.patches + gain;
    const lifetime = state.lifetime;
    const cleaned = state.cleaned;
    const launches = state.launches;
    applyFresh();
    state.patches = patches;
    state.lifetime = lifetime;
    state.cleaned = cleaned;
    state.launches = launches;
    toast(gain > 1 ? `Новая смена: +${gain} нашивки` : "Новая смена: +1 нашивка");
    save();
    updateUI();
    renderStrip();
  }

  function hardReset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    applyFresh();
    save();
    toast("Сохранение стерто");
    updateUI();
    renderStrip();
    if (!shopEl.classList.contains("hidden")) renderShop();
  }

  function removeDustBulk(sector, mass) {
    let total = 0;
    const dust = sector.dust;
    for (let i = 0; i < dust.length; i++) total += dust[i];
    if (total <= 0 || mass <= 0) return 0;
    const take = Math.min(mass, total);
    const keep = (total - take) / total;
    for (let i = 0; i < dust.length; i++) dust[i] *= keep;
    return take;
  }

  function simulateOffline(ms) {
    if (!(ms > 5000)) return null;
    const capped = ms > MAX_OFFLINE + 800;
    let time = Math.min(ms, MAX_OFFLINE) / 1000;
    const rate = robots.reduce((sum, r) => sum + robotDef(r.type).rate, 0) * robotRateMul() * OFFLINE_EFF;
    if (rate <= 0) return null;
    let earnedBase = 0;
    let massCleaned = 0;
    let guard = 0;
    while (time > 0.05 && guard++ < 10000) {
      let best = null;
      let bestV = -1;
      let remBest = 0;
      for (const s of state.sectors) {
        const rem = remaining(s);
        if (rem < 1) continue;
        const v = valueOf(s.index);
        if (v > bestV) {
          bestV = v;
          best = s;
          remBest = rem;
        }
      }
      if (!best) break;
      const dt = Math.min(time, remBest / rate);
      const mass = removeDustBulk(best, rate * dt);
      earnedBase += mass * valueOf(best.index) * 1.09;
      massCleaned += mass;
      time -= dt;
    }
    const earned = payout(earnedBase);
    if (earned < 0.5) return null;
    state.money += earned;
    state.runCredits += earned;
    state.lifetime += earned;
    state.cleaned += massCleaned;
    return { elapsed: Math.min(ms, MAX_OFFLINE), capped, earned, massCleaned };
  }

  function serialize() {
    return {
      v: 1,
      cols: COLS,
      rows: ROWS,
      money: state.money,
      runCredits: state.runCredits,
      lifetime: state.lifetime,
      patches: state.patches,
      tool: state.tool,
      polish: state.polish,
      backpackLevel: state.backpackLevel,
      speedLevel: state.speedLevel,
      shipLevel: state.shipLevel,
      battery: state.battery,
      depotBought: state.depotBought,
      depotStock: state.depotStock,
      placed: state.placed.map((d) => ({ x: d.x, y: d.y })),
      vehicles: { ...state.vehicles },
      riding: state.riding,
      seenDust: state.seenDust ? 1 : 0,
      launches: state.launches,
      cleaned: state.cleaned,
      px: state.px,
      py: state.py,
      backpack: { mass: state.backpack.mass, worth: state.backpack.worth },
      hopper: { mass: state.hopper.mass, worth: state.hopper.worth },
      sectors: state.sectors.map((s) => ({
        index: s.index,
        initial: s.initial,
        dust: encodeF32(s.dust),
      })),
      robots: robots.map((r) => ({
        type: r.type, x: r.x, y: r.y, mass: r.mass, worth: r.worth, mode: r.mode,
      })),
      lastSave: Date.now(),
    };
  }

  function save() {
    if (!savesEnabled) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize()));
    } catch (e) {
      if (!saveWarned) {
        saveWarned = true;
        toast("Не удалось сохранить — память браузера недоступна");
      }
    }
  }

  function loadRobots(list) {
    robots.length = 0;
    if (!Array.isArray(list)) return;
    const home = homeDepot();
    for (const raw of list) {
      if (!raw || !ROBOTS.some((r) => r.id === raw.type)) continue;
      if (robots.length >= ROBOT_CAP_TOTAL) break;
      robots.push({
        type: raw.type,
        x: num(raw.x, home.x, -1e6, 1e7),
        y: num(raw.y, home.y, -1e6, 1e7),
        mass: num(raw.mass, 0, 0),
        worth: num(raw.worth, 0, 0),
        mode: raw.mode === "dump" ? "dump" : "seek",
        tx: home.x,
        ty: home.y,
        retarget: 0,
        stuck: 0,
      });
    }
  }

  function applyFrom(data) {
    state = freshState();
    state.money = num(data.money, 0, 0, 1e300);
    state.runCredits = num(data.runCredits, 0, 0, 1e300);
    state.lifetime = num(data.lifetime, state.money, 0, 1e300);
    state.patches = int(data.patches, 0, 500);
    state.tool = int(data.tool, 0, TOOLS.length - 1);
    state.polish = int(data.polish, 0, 400);
    state.backpackLevel = int(data.backpackLevel, 0, 400);
    state.speedLevel = int(data.speedLevel, 0, 400);
    state.shipLevel = int(data.shipLevel, 0, 400);
    state.battery = int(data.battery, 0, 400);
    state.depotBought = int(data.depotBought, 0, DEPOT_CAP);
    state.depotStock = int(data.depotStock, 0, DEPOT_CAP);
    state.seenDust = !!data.seenDust;
    state.launches = int(data.launches, 0, 1e7);
    state.cleaned = num(data.cleaned, 0, 0, 1e300);
    state.vehicles = {};
    if (data.vehicles && typeof data.vehicles === "object") {
      for (const v of VEHICLES) if (data.vehicles[v.id]) state.vehicles[v.id] = true;
    }
    state.riding = state.vehicles[data.riding] ? data.riding : null;
    state.placed = [];
    if (Array.isArray(data.placed)) {
      for (const d of data.placed) {
        if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
        state.placed.push({ x: d.x, y: d.y });
      }
    }
    const bag = data.backpack || {};
    const hop = data.hopper || {};
    state.hopper.mass = num(hop.mass, 0, 0);
    state.hopper.worth = num(hop.worth, 0, 0);
    state.backpack.mass = num(bag.mass, 0, 0);
    state.backpack.worth = num(bag.worth, 0, 0);
    const cap = capacity();
    if (state.backpack.mass > cap) {
      const extra = state.backpack.mass - cap;
      const frac = extra / state.backpack.mass;
      state.hopper.mass += extra;
      state.hopper.worth += state.backpack.worth * frac;
      state.backpack.worth *= 1 - frac;
      state.backpack.mass = cap;
    }
    if (!Array.isArray(data.sectors) || !data.sectors.length) throw new Error("sectors");
    state.sectors = [];
    for (const s of data.sectors) {
      const dust = decodeF32(s.dust, COLS * ROWS);
      const initial = num(s.initial, 1, 1);
      state.sectors.push(createSector(state.sectors.length, dust, initial));
    }
    loadRobots(data.robots);
    const sp = spawnPoint();
    state.px = num(data.px, sp.x);
    state.py = num(data.py, sp.y);
    if (!inWalkable(state.px, state.py)) {
      state.px = sp.x;
      state.py = sp.y;
    }
    cam.x = state.px;
    cam.y = state.py;
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); }
    catch (e) {
      applyFresh();
      return { storage: false };
    }
    if (!raw) {
      applyFresh();
      return null;
    }
    try {
      const data = JSON.parse(raw);
      if (!data || data.v !== 1 || data.cols !== COLS || data.rows !== ROWS) throw new Error("version");
      applyFrom(data);
      const away = Date.now() - num(data.lastSave, Date.now());
      const report = simulateOffline(away);
      save();
      return report;
    } catch (e) {
      applyFresh();
      save();
      return { corrupt: true };
    }
  }

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function popMoney() {
    moneyEl.classList.remove("pop");
    void moneyEl.offsetWidth;
    moneyEl.classList.add("pop");
  }

  function toast(text) {
    const now = performance.now();
    if (text === lastToast && now - toastTimer < 700) return;
    lastToast = text;
    toastTimer = now;
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  function banner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.remove("show"), 2600);
  }

  function updateUI() {
    setText(moneyEl, formatNumber(state.money));
    const mul = payMul();
    setText(mulEl, mul > 1.01 ? "рейс ×" + formatNumber(mul) : "");
    if (state.patches > 0) {
      patchesEl.hidden = false;
      setText(patchesEl, state.patches + " " + plural(state.patches, "нашивка", "нашивки", "нашивок"));
    } else patchesEl.hidden = true;

    const loc = locationInfo();
    const sector = state.sectors[loc.index];
    const title = loc.bridge ? "Мостик" : sectorTitle(loc.index);
    setText(sectorNameEl, title);
    const rel = valueOf(loc.index) / valueOf(0);
    setText(priceEl, "пыль ×" + formatNumber(rel));
    const clean = sector ? cleanliness(sector) : 0;
    const pct = clean * 100;
    setText(sectorPctEl, (pct < 10 ? pct.toFixed(1) : String(Math.floor(pct))) + "%");
    sectorBar.style.width = (clean * 100).toFixed(1) + "%";
    sectorBar.style.background = biomeOf(loc.index).accent;

    const cap = capacity();
    const mass = state.backpack.mass;
    setText(packLabel, formatNumber(mass) + " / " + formatNumber(cap));
    const frac = cap > 0 ? Math.min(1, mass / cap) : 0;
    packBar.style.width = (frac * 100).toFixed(1) + "%";
    packBar.style.background = frac > 0.92 ? "#ff6b6b" : frac > 0.62 ? "#ffc857" : "#14b889";

    if (!state.seenDust) hintEl.textContent = "Веди дворника по серой пыли. Чистая земля проявится под ней.";
    else if (state.nearDepot && state.backpack.mass > 1) hintEl.textContent = "Выгружаем пыль в общий бункер…";
    else if (state.nearDepot && state.hopper.worth > 1) hintEl.textContent = "Бункер ждёт. Запускай рейс.";
    else if (frac > 0.97) hintEl.textContent = "Рюкзак полон. Неси к зелёному кругу.";
    else if (state.riding) hintEl.textContent = "За рулём: " + vehicleById(state.riding).name;
    else hintEl.textContent = "В руках: " + TOOLS[state.tool].name;

    const canLaunch = state.nearDepot && state.hopper.worth > 0.05 && state.launchLock <= 0;
    launchBtn.disabled = !canLaunch;
    launchLabel.textContent = state.hopper.worth > 0.05 && !state.nearDepot ? "Рейс у приёмника" : "Запустить рейс";

    placeBtn.hidden = state.depotStock <= 0;
    placeBtn.textContent = "Поставить (" + state.depotStock + ")";

    const owned = VEHICLES.filter((v) => state.vehicles[v.id]);
    rideBtn.hidden = owned.length === 0;
    if (owned.length) {
      const order = [null, ...owned.map((v) => v.id)];
      let i = order.indexOf(state.riding);
      if (i < 0) i = 0;
      const next = order[(i + 1) % order.length];
      rideBtn.textContent = next ? vehicleById(next).name.replace(/«|»/g, "").split(" ").slice(-1)[0] : "Пешком";
      rideBtn.title = "Переключить технику";
    }

    shopBtn.classList.toggle("deal", anyDeal());
    renderStrip();
  }

  function renderStrip() {
    const count = state.sectors.length + 1;
    if (stripEl.childElementCount !== count) {
      stripEl.replaceChildren();
      for (let i = 0; i < count; i++) {
        const el = document.createElement("span");
        el.className = "chip";
        stripEl.appendChild(el);
      }
    }
    const here = sectorIndexAt(state.px, state.py);
    const kids = stripEl.children;
    for (let i = 0; i < kids.length; i++) {
      const locked = i >= state.sectors.length;
      const name = locked ? "дальше" : biomeOf(i).short;
      if (kids[i].textContent !== name) kids[i].textContent = name;
      kids[i].className = "chip" + (locked ? " locked" : "") + (here === i ? " here" : "");
      kids[i].title = sectorTitle(i);
    }
    if (here !== lastHere && here != null && kids[here]) {
      lastHere = here;
      kids[here].scrollIntoView({ inline: "center", block: "nearest" });
    }
  }

  function row(title, text, meta, buttonHtml) {
    return `<div class="row"><div><strong>${esc(title)}</strong><p>${esc(text)}</p><em>${esc(meta)}</em></div>${buttonHtml}</div>`;
  }

  function buyBtn(id, label, ok) {
    return `<button type="button" data-buy="${esc(id)}" ${ok ? "" : "disabled"}>${esc(label)}</button>`;
  }

  function badge(text) {
    return `<span class="badge">${esc(text)}</span>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function renderShop() {
    if (shopEl.classList.contains("hidden")) return;
    const stats = combatStats();
    shopSummary.textContent = `${stats.tool.name} · радиус ${Math.round(stats.radius)} · сила ${formatNumber(stats.power)} · шаг ${Math.round(stats.speed)}`;
    tabsEl.replaceChildren();
    for (const t of TABS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tab" + (t.id === tab ? " on" : "") + (tabDeal(t.id) ? " deal" : "");
      b.textContent = t.name;
      b.addEventListener("click", () => {
        tab = t.id;
        renderShop();
      });
      tabsEl.appendChild(b);
    }
    const top = shopBody.scrollTop;
    shopBody.innerHTML = shopHtml();
    shopBody.scrollTop = top;
  }

  function shopHtml() {
    if (tab === "tools") return toolsHtml();
    if (tab === "gear") return gearHtml();
    if (tab === "tech") return techHtml();
    if (tab === "bots") return botsHtml();
    return shiftHtml();
  }

  function toolsHtml() {
    let html = "";
    for (let i = 0; i < TOOLS.length; i++) {
      const tool = TOOLS[i];
      const meta = `радиус ${tool.radius} · сила ${formatNumber(tool.power * (1 + state.patches * 0.12))}`;
      if (i < state.tool) html += row(tool.name, tool.blurb, meta, badge("есть"));
      else if (i === state.tool) html += row(tool.name, tool.blurb, meta, badge("в руках"));
      else if (i === state.tool + 1) html += row(tool.name, tool.blurb, meta, buyBtn("tool", formatNumber(tool.cost), canAfford(tool.cost)));
      else html += row(tool.name, tool.blurb, meta, badge("потом"));
    }
    const pCost = polishCost(state.polish);
    html += row(
      "Полировка",
      "Точит то, что уже в руках. Бесконечная лестница силы.",
      `сила ×${formatNumber(1.14 ** state.polish)} → ×${formatNumber(1.14 ** (state.polish + 1))}`,
      buyBtn("polish", formatNumber(pCost), canAfford(pCost)),
    );
    return html;
  }

  function gearHtml() {
    const bCost = backpackCost(state.backpackLevel);
    const sCost = speedCost(state.speedLevel);
    const tCost = shipCost(state.shipLevel);
    return [
      row(
        "Рюкзак",
        "Больше пыли за одну ходку до приёмника.",
        `вместимость ${formatNumber(capacityAt(state.backpackLevel))} → ${formatNumber(capacityAt(state.backpackLevel + 1))}`,
        buyBtn("backpack", formatNumber(bCost), canAfford(bCost)),
      ),
      row(
        "Ботинки дворника",
        "Короче дорога с полным рюкзаком.",
        `шаг +${Math.round((1.072 ** state.speedLevel - 1) * 100)}% → +${Math.round((1.072 ** (state.speedLevel + 1) - 1) * 100)}%`,
        buyBtn("speed", formatNumber(sCost), canAfford(sCost)),
      ),
      row(
        "Тариф рейса",
        "Бункер платит щедрее за ту же пыль.",
        `оплата +${state.shipLevel * 8}% → +${(state.shipLevel + 1) * 8}%`,
        buyBtn("ship", formatNumber(tCost), canAfford(tCost)),
      ),
    ].join("");
  }

  function techHtml() {
    let html = "";
    for (const v of VEHICLES) {
      const meta = `скорость ×${v.speed} · сила ×${v.power} · радиус +${v.radius}`;
      if (state.vehicles[v.id]) html += row(v.name, v.blurb, meta, badge(state.riding === v.id ? "едешь" : "в гараже"));
      else html += row(v.name, v.blurb, meta, buyBtn("vehicle:" + v.id, formatNumber(v.cost), canAfford(v.cost)));
    }
    if (state.depotBought >= DEPOT_CAP) {
      html += row("Запасной приёмник", "Ставь ближе к пыли, чтобы меньше носить.", "лимит посёлка", badge("лимит"));
    } else {
      const cost = depotPrice(state.depotBought);
      html += row(
        "Запасной приёмник",
        "Купи, потом встань на участок и нажми «Поставить». Общий бункер один на весь посёлок.",
        `в запасе: ${state.depotStock} · поставлено: ${state.placed.length}`,
        buyBtn("depot", formatNumber(cost), canAfford(cost)),
      );
    }
    return html;
  }

  function botsHtml() {
    let html = "";
    const mul = robotRateMul();
    for (const def of ROBOTS) {
      const owned = robotCount(def.id);
      const cost = Math.round(def.cost * def.growth ** owned);
      const meta = `на дворе: ${owned} · каждый ${formatNumber(def.rate * mul)}/с`;
      const label = robots.length >= ROBOT_CAP_TOTAL ? "лимит" : formatNumber(cost);
      const ok = robots.length < ROBOT_CAP_TOTAL && canAfford(cost);
      html += row(def.name, def.blurb, meta, robots.length >= ROBOT_CAP_TOTAL ? badge("лимит") : buyBtn("robot:" + def.id, label, ok));
    }
    const cost = batteryCost(state.battery);
    html += row(
      "Батареи",
      "Все роботы метут быстрее. Пока тебя нет, тоже.",
      `скорость роботов +${state.battery * 12}% → +${(state.battery + 1) * 12}%`,
      buyBtn("battery", formatNumber(cost), canAfford(cost)),
    );
    html += `<div class="shift-copy"><p>Роботы сами носят пыль в бункер. Рейс запускаешь ты. Пока игра закрыта, они отправляют рейс сами, но не открывают новые участки и работают примерно вполсилы.</p></div>`;
    return html;
  }

  function shiftHtml() {
    const gain = prestigeGain(state.runCredits, state.patches);
    const next = prestigeCost(state.patches);
    const html = [
      `<div class="shift-copy">`,
      `<p><strong>Нашивки:</strong> ${state.patches}. Рейс ×${formatNumber(1 + state.patches * 0.4)}, уборка +${Math.round(state.patches * 12)}%.</p>`,
      `<p>Кредиты этой смены: ${formatNumber(state.runCredits)}. Следующая нашивка стоит ${formatNumber(next)}.</p>`,
      `<p>Эта смена даст нашивок: ${gain}. Новая смена стирает кредиты, инструменты, рюкзак, технику, роботов и участки. Нашивки остаются и усиливают следующую.</p>`,
      `<p>Сметено за всё время: ${formatNumber(state.cleaned)}. Рейсов: ${state.launches}.</p>`,
      `</div>`,
      row(
        "Новая смена",
        "Сдать двор и начать сначала, но уже с нашивками на куртке.",
        gain > 0 ? `получишь ${gain} ${plural(gain, "нашивку", "нашивки", "нашивок")}` : "пока рано",
        buyBtn("prestige", gain > 0 ? "Сдать смену" : "Рано", gain > 0),
      ),
    ];
    return html.join("");
  }

  function tabDeal(id) {
    if (id === "tools") {
      const next = TOOLS[state.tool + 1];
      if (next && canAfford(next.cost)) return true;
      return canAfford(polishCost(state.polish));
    }
    if (id === "gear") {
      return canAfford(backpackCost(state.backpackLevel)) || canAfford(speedCost(state.speedLevel)) || canAfford(shipCost(state.shipLevel));
    }
    if (id === "tech") {
      if (state.depotBought < DEPOT_CAP && canAfford(depotPrice(state.depotBought))) return true;
      return VEHICLES.some((v) => !state.vehicles[v.id] && canAfford(v.cost));
    }
    if (id === "bots") {
      if (canAfford(batteryCost(state.battery))) return true;
      if (robots.length >= ROBOT_CAP_TOTAL) return false;
      return ROBOTS.some((def) => canAfford(Math.round(def.cost * def.growth ** robotCount(def.id))));
    }
    if (id === "shift") return prestigeGain(state.runCredits, state.patches) > 0;
    return false;
  }

  function anyDeal() {
    return TABS.some((t) => tabDeal(t.id));
  }

  function openShop() {
    shopEl.classList.remove("hidden");
    renderShop();
    $("shop-close").focus();
  }

  function closeShop() {
    shopEl.classList.add("hidden");
  }

  function openModal(opts) {
    modalTitle.textContent = opts.title;
    modalBody.replaceChildren();
    for (const line of opts.lines) {
      const p = document.createElement("p");
      p.textContent = line;
      modalBody.appendChild(p);
    }
    modalActions.replaceChildren();
    let focusEl = null;
    for (const a of opts.actions) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      b.className = a.danger ? "danger" : a.primary ? "primary" : "ghost";
      b.addEventListener("click", () => {
        closeModal();
        if (a.onClick) a.onClick();
      });
      modalActions.appendChild(b);
      if (a.primary || a.danger) focusEl = b;
      if (!focusEl) focusEl = b;
    }
    modalEl.classList.remove("hidden");
    if (focusEl) focusEl.focus();
  }

  function closeModal() {
    modalEl.classList.add("hidden");
  }

  function openPrestigeConfirm() {
    const gain = prestigeGain(state.runCredits, state.patches);
    if (gain <= 0) {
      toast("Для новой смены нужно больше кредитов за эту смену");
      return;
    }
    openModal({
      title: "Новая смена?",
      lines: [
        `Получишь ${gain} ${plural(gain, "нашивку", "нашивки", "нашивок")}.`,
        "Пропадут кредиты, инструменты, рюкзак, техника, роботы и открытые участки.",
        "Нашивки останутся и усилят оплату рейсов.",
      ],
      actions: [
        { label: "Отмена" },
        { label: "Сдать смену", danger: true, onClick: doPrestige },
      ],
    });
  }

  function openResetConfirm() {
    openModal({
      title: "Стереть сохранение?",
      lines: ["Пропадут участки, кредиты, роботы и нашивки. Вернуть это нельзя."],
      actions: [
        { label: "Отмена" },
        { label: "Стереть", danger: true, onClick: hardReset },
      ],
    });
  }

  function showOffline(report) {
    const lines = [
      `Тебя не было ${formatDuration(report.elapsed)}.`,
      "Роботы смели пыль и сами отправили рейс.",
      `Кредиты: +${formatNumber(report.earned)}.`,
      `Сметено: ${formatNumber(report.massCleaned)}.`,
    ];
    if (report.capped) lines.push("Посчитано не больше 8 часов.");
    if (state.hopper.worth > 1) lines.push("В бункере ещё лежит пыль — её забери рейсом сам.");
    openModal({
      title: "Пока тебя не было",
      lines,
      actions: [{ label: "Забрать", primary: true }],
    });
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    view.w = Math.max(2, rect.width);
    view.h = Math.max(2, rect.height);
    view.dpr = dpr;
    canvas.width = Math.floor(view.w * dpr);
    canvas.height = Math.floor(view.h * dpr);
  }

  function worldToScreen(x, y) {
    return {
      x: (x - cam.x) * view.scale + view.w / 2,
      y: (y - cam.y) * view.scale + view.h / 2,
    };
  }

function drawDustTiles(index, originX, originY) {
  const sector = state.sectors[index];
  const dust = sector.dust;
  const biome = biomeOf(index);
  const season = Math.floor(index / BIOMES.length);
  const dim = 0.9 ** Math.min(season, 6);
  const tw = TILE * view.scale;
  const gap = Math.max(1.25, tw * 0.14);
  const size = tw - gap * 2;
  if (size <= 0.5) return;
  const radius = Math.min(7, size * 0.38);
  const pulse = 0.55 + 0.45 * Math.sin(anim * 5);
  ctx.save();
  for (let i = 0; i < dust.length; i++) {
    const amount = dust[i];
    if (amount < 1.2) continue;
    const t = Math.max(0, Math.min(1, amount / 80));
    const col = i % COLS;
    const row = (i / COLS) | 0;
    const spark = amount > 8 && sparkleMul(index, i) > 1;
    ctx.globalAlpha = spark ? 0.55 + pulse * 0.4 : 0.28 + t * 0.67;
    ctx.fillStyle = spark
      ? "#ffe56a"
      : `rgb(${(biome.dust[0] * dim) | 0},${(biome.dust[1] * dim) | 0},${(biome.dust[2] * dim) | 0})`;
    roundRect(originX + col * tw + gap, originY + row * tw + gap, size, size, radius);
    ctx.fill();
  }
  ctx.restore();
}

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function label(text, x, y) {
    ctx.font = "700 13px Segoe UI, Liberation Sans, Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const w = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(255, 250, 243, 0.94)";
    roundRect(x - w / 2 - 8, y - 14, w + 16, 20, 8);
    ctx.fill();
    ctx.strokeStyle = "#24183a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#24183a";
    ctx.fillText(text, x, y);
  }

  function drawDecor(index, x, y, w, h) {
    const biome = biomeOf(index);
    const scale = view.scale;
    ctx.save();
    for (let k = 0; k < 28; k++) {
      const px = x + hash2(index + 3, k) * w;
      const py = y + hash2(k + 9, index) * h;
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.arc(px, py, (1.5 + hash2(k, index + 2) * 3) * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x, y + h / 2 - 20 * scale, w, 40 * scale);
    if (biome.decor === "airlock") {
      ctx.strokeStyle = "#ff7a59";
      ctx.lineWidth = 6 * scale;
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.22, 48 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#8ee7ff";
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.22, 18 * scale, 0, Math.PI * 2);
      ctx.fill();
    } else if (biome.decor === "cactus") {
      ctx.fillStyle = "#3aaa5a";
      for (let k = 0; k < 5; k++) {
        const px = x + (0.18 + hash2(index, k) * 0.64) * w;
        const py = y + (0.18 + hash2(k, index + 4) * 0.64) * h;
        if (Math.abs(py - (y + h / 2)) < 30 * scale) continue;
        ctx.fillRect(px, py, 10 * scale, 28 * scale);
        ctx.fillRect(px - 10 * scale, py + 8 * scale, 12 * scale, 6 * scale);
      }
    } else if (biome.decor === "dish") {
      for (let k = 0; k < 4; k++) {
        const px = x + (0.2 + k * 0.18) * w;
        const py = y + (0.25 + (k % 2) * 0.45) * h;
        ctx.strokeStyle = "#4c7cff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 26 * scale);
        ctx.stroke();
        ctx.fillStyle = "#fffaf3";
        ctx.beginPath();
        ctx.ellipse(px, py - 30 * scale, 16 * scale, 8 * scale, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (biome.decor === "domes") {
      const colors = ["#ff8fab", "#8ee7ff", "#ffd23f", "#c9b6ff"];
      for (let k = 0; k < 4; k++) {
        const px = x + (0.18 + k * 0.2) * w;
        const py = y + h * (k % 2 ? 0.28 : 0.72);
        ctx.fillStyle = colors[k];
        ctx.beginPath();
        ctx.arc(px, py, 22 * scale, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "#24183a";
        ctx.stroke();
      }
    } else if (biome.decor === "quarry") {
      ctx.strokeStyle = "rgba(120,70,40,0.45)";
      ctx.lineWidth = 3;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.ellipse(x + w * 0.45, y + h * 0.3, 30 * k * scale, 16 * k * scale, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (biome.decor === "flags") {
      for (let k = 0; k < 5; k++) {
        const px = x + (0.15 + k * 0.16) * w;
        const py = y + h * (0.22 + (k % 2) * 0.5);
        const wave = Math.sin(anim * 3 + k) * 4;
        ctx.strokeStyle = "#1aa58f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 28 * scale);
        ctx.stroke();
        ctx.fillStyle = k % 2 ? "#ffc857" : "#fffaf3";
        ctx.beginPath();
        ctx.moveTo(px, py - 28 * scale);
        ctx.lineTo(px + (18 + wave) * scale, py - 22 * scale);
        ctx.lineTo(px, py - 16 * scale);
        ctx.fill();
      }
    } else if (biome.decor === "crater") {
      ctx.strokeStyle = "#e2a122";
      ctx.lineWidth = 10 * scale;
      ctx.beginPath();
      ctx.arc(x + w * 0.55, y + h * 0.32, 50 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4 * scale;
      ctx.beginPath();
      ctx.arc(x + w * 0.55, y + h * 0.32, 28 * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (biome.decor === "ink") {
      ctx.fillStyle = "rgba(70, 60, 140, 0.35)";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(
          x + hash2(index, k) * w,
          y + hash2(k, index + 5) * h,
          30 * scale,
          16 * scale,
          0, 0, Math.PI * 2,
        );
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSlab(index, preview) {
    const o = sectorOrigin(index);
    const p = worldToScreen(o.x, o.y);
    const w = SW * view.scale;
    const h = SH * view.scale;
    const biome = biomeOf(index);
    ctx.fillStyle = "rgba(92, 58, 48, 0.95)";
    roundRect(p.x, p.y + Math.max(6, 8 * view.scale), w, h, 26);
    ctx.fill();

    ctx.save();
    roundRect(p.x, p.y, w, h, 24);
    ctx.clip();
    const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + h);
    g.addColorStop(0, biome.ground[0]);
    g.addColorStop(1, biome.ground[1]);
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y, w, h);
    drawDecor(index, p.x, p.y, w, h);
    if (!preview) {
      drawDustTiles(index, p.x, p.y);
    } else {
      ctx.fillStyle = "rgba(36, 24, 58, 0.48)";
      ctx.fillRect(p.x, p.y, w, h);
    }
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(36, 24, 58, 0.45)";
    roundRect(p.x, p.y, w, h, 24);
    ctx.stroke();

    if (!preview) {
      const sector = state.sectors[index];
      const origin = sectorOrigin(index);
      for (const b of sector.boulders) {
        const bp = worldToScreen(origin.x + b.x, origin.y + b.y);
        const r = b.r * view.scale;
        ctx.fillStyle = "#9a8792";
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(bp.x - r * 0.28, bp.y - r * 0.3, r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#24183a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (index === 0) {
        const mark = worldToScreen(o.x + SW / 2, o.y + 36);
        label("Тихая осыпь", mark.x, mark.y);
      }
    } else {
      const mark = worldToScreen(o.x + SW / 2, o.y + SH / 2);
      label(sectorTitle(index), mark.x, mark.y - 16);
      label("откроется на 80%", mark.x, mark.y + 14);
    }
  }

  function drawBridges() {
    const last = state.sectors.length;
    for (let i = 0; i < last; i++) {
      const open = i + 1 < state.sectors.length;
      const o = sectorOrigin(i);
      const a = worldToScreen(o.x + SW, SH / 2 - 32);
      const b = worldToScreen(o.x + SW + GAP, SH / 2 + 32);
      const planks = open ? 6 : 3;
      const span = b.x - a.x;
      for (let p = 0; p < planks; p++) {
        const px = a.x + ((p + 0.35) * span) / planks;
        ctx.fillStyle = open ? (p % 2 ? "#efe0cb" : "#d7c0a4") : "#6d6484";
        ctx.fillRect(px, a.y, Math.max(8, span / planks - 6), b.y - a.y);
        ctx.strokeStyle = "#24183a";
        ctx.lineWidth = 2;
        ctx.strokeRect(px, a.y, Math.max(8, span / planks - 6), b.y - a.y);
      }
    }
  }

  function drawDepots() {
    for (const d of allDepots()) {
      const p = worldToScreen(d.x, d.y);
      const rad = 40 * view.scale;
      ctx.fillStyle = "rgba(20, 184, 137, 0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fffaf3";
      ctx.stroke();
      const fill = 1 - Math.exp(-state.hopper.mass / 3500);
      ctx.fillStyle = "#fffaf3";
      roundRect(p.x - 11, p.y - 8 - fill * 8, 22, 20, 4);
      ctx.fill();
      ctx.strokeStyle = "#24183a";
      ctx.stroke();
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 26);
      ctx.lineTo(p.x + 8, p.y - 12);
      ctx.lineTo(p.x - 8, p.y - 12);
      ctx.fill();
      label(d.home ? "Главный приёмник" : "Приёмник", p.x, p.y - rad - 8);
    }
  }

  function drawRobot(r) {
    const p = worldToScreen(r.x, r.y);
    const def = robotDef(r.type);
    const bob = Math.sin(anim * 6 + r.x * 0.01) * 2;
    ctx.fillStyle = "rgba(20, 10, 40, 0.28)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, r.type === "caravan" ? 16 : 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    if (r.type === "caravan") ctx.ellipse(p.x, p.y + bob, 16, 9, 0, 0, Math.PI * 2);
    else ctx.arc(p.x, p.y + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#24183a";
    ctx.stroke();
    ctx.fillStyle = "#24183a";
    ctx.beginPath();
    ctx.arc(p.x + 3, p.y + bob - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    if (r.type === "drone") {
      ctx.strokeStyle = "#24183a";
      ctx.beginPath();
      ctx.moveTo(p.x - 10, p.y + bob - 10);
      ctx.lineTo(p.x + 10, p.y + bob - 10);
      ctx.stroke();
    }
  }

  function drawPlayer() {
    const p = worldToScreen(state.px, state.py);
    const bob = Math.sin(anim * (frameMoving ? 12 : 2)) * (frameMoving ? 2.2 : 0.4);
    const x = p.x;
    const y = p.y + bob;
    ctx.fillStyle = "rgba(20, 10, 40, 0.28)";
    ctx.beginPath();
    ctx.ellipse(x, p.y + 16, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (state.riding) {
      const v = vehicleById(state.riding);
      ctx.fillStyle = v ? v.color : "#ffd23f";
      ctx.beginPath();
      ctx.ellipse(x, y + 12, state.riding === "blin" ? 28 : 20, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#24183a";
      ctx.stroke();
    }
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#24183a";
    ctx.stroke();
    ctx.fillStyle = "#ff6b6b";
    roundRect(x - 11, y + 7, 22, 6, 3);
    ctx.fill();
    ctx.fillStyle = "#8ee7ff";
    ctx.beginPath();
    ctx.ellipse(x + frameFacing * 4, y - 1, 9, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#24183a";
    ctx.lineWidth = 2;
    ctx.stroke();
    const swing = Math.sin(anim * (frameCleaning ? 18 : 3)) * (frameCleaning ? 0.7 : 0.25);
    ctx.save();
    ctx.translate(x, y + 2);
    ctx.scale(frameFacing, 1);
    ctx.rotate(swing);
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#24183a";
    const id = frameStats.tool.id;
    if (id === "brush") {
      ctx.beginPath();
      ctx.moveTo(12, -2);
      ctx.lineTo(28, 14);
      ctx.stroke();
      ctx.fillStyle = "#7ad7ff";
      ctx.strokeStyle = "#24183a";
      roundRect(24, 10, 10, 8, 2);
      ctx.fill();
      ctx.stroke();
    } else if (id === "broom" || id === "turbo") {
      ctx.beginPath();
      ctx.moveTo(8, -2);
      ctx.lineTo(16, 14);
      ctx.stroke();
      ctx.strokeStyle = "#c47a3a";
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(16, 14);
        ctx.lineTo(22 + i * 2, 24);
        ctx.stroke();
      }
    } else if (id === "mop" || id === "plasma") {
      ctx.beginPath();
      ctx.moveTo(10, -4);
      ctx.lineTo(10, 14);
      ctx.stroke();
      ctx.fillStyle = id === "plasma" ? "#d7b4ff" : "#8ee7ff";
      ctx.fillRect(0, 12, 20, 7);
      ctx.strokeRect(0, 12, 20, 7);
    } else {
      ctx.fillStyle = id === "ind" ? "#ff7a59" : "#4c7cff";
      roundRect(4, -8, 16, 14, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.quadraticCurveTo(30, 8, 24, 18);
      ctx.stroke();
    }
    if (state.tool >= 8) {
      ctx.strokeStyle = "rgba(255, 214, 90, 0.9)";
      ctx.beginPath();
      ctx.arc(18, 8, 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(p.x, p.y, frameStats.radius * view.scale, 0, Math.PI * 2);
    ctx.strokeStyle = frameCleaning ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (frameCleaning) {
      const grd = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, frameStats.radius * view.scale);
      grd.addColorStop(0, "rgba(255,255,255,0.28)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, frameStats.radius * view.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawArrow() {
    const frac = capacity() > 0 ? state.backpack.mass / capacity() : 0;
    if (frac < 0.5) return;
    const d = nearestDepot(state.px, state.py);
    if (d.dist < 90) return;
    const ang = Math.atan2(d.depot.y - state.py, d.depot.x - state.px);
    const p = worldToScreen(state.px, state.py);
    const ax = p.x + Math.cos(ang) * 78;
    const ay = p.y + Math.sin(ang) * 78;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = "#14b889";
    ctx.strokeStyle = "#24183a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-8, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    view.scale = view.h / VIEW_H;
    const sx = reduceMotion ? 0 : Math.sin(anim * 40) * shake;
    const sy = reduceMotion ? 0 : Math.cos(anim * 37) * shake * 0.6;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, sx * view.dpr, sy * view.dpr);
    ctx.clearRect(-20, -20, view.w + 40, view.h + 40);
    const sky = ctx.createLinearGradient(0, 0, 0, view.h);
    sky.addColorStop(0, "#2a2160");
    sky.addColorStop(1, "#120e28");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.w, view.h);
    const neb = ctx.createRadialGradient(view.w * 0.15, view.h * 0.2, 10, view.w * 0.2, view.h * 0.2, view.w * 0.7);
    neb.addColorStop(0, "rgba(140, 170, 255, 0.22)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, view.w, view.h);

    ctx.fillStyle = "#fffaf3";
    for (let i = 0; i < 70; i++) {
      const sx0 = ((hash2(i, 1) * 4000 - cam.x * 0.15) % view.w + view.w) % view.w;
      const sy0 = ((hash2(i, 2) * 2400 - cam.y * 0.12) % view.h + view.h) % view.h;
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(anim * 2 + i));
      ctx.globalAlpha = tw;
      ctx.fillRect(sx0, sy0, hash2(i, 4) > 0.85 ? 2.4 : 1.4, hash2(i, 4) > 0.85 ? 2.4 : 1.4);
    }
    ctx.globalAlpha = 1;

    const margin = 80;
    for (let i = 0; i < state.sectors.length; i++) {
      const p = worldToScreen(sectorOrigin(i).x, 0);
      if (p.x > view.w + margin || p.x + SW * view.scale < -margin) continue;
      drawSlab(i, false);
    }
    const preview = state.sectors.length;
    const pp = worldToScreen(sectorOrigin(preview).x, 0);
    if (pp.x < view.w + margin && pp.x + SW * view.scale > -margin) drawSlab(preview, true);

    drawBridges();
    drawDepots();

    for (const s of sweeps) {
      const p = worldToScreen(s.x, s.y);
      const t = s.age / s.life;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.8})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.r * view.scale * (0.75 + t * 0.35), s.a, s.a + 1.5);
      ctx.stroke();
    }

    for (const r of robots) {
      const p = worldToScreen(r.x, r.y);
      if (p.x < -40 || p.y < -40 || p.x > view.w + 40 || p.y > view.h + 40) continue;
      drawRobot(r);
    }

    for (const particle of particles) {
      const p = worldToScreen(particle.x, particle.y);
      const t = 1 - particle.age / particle.life;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = particle.color;
      ctx.fillRect(p.x, p.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;

    drawPlayer();

    for (const rocket of rockets) {
      const p = worldToScreen(rocket.x, rocket.y - rocket.age * 220);
      ctx.fillStyle = "#fffaf3";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 16);
      ctx.lineTo(p.x + 7, p.y + 8);
      ctx.lineTo(p.x - 7, p.y + 8);
      ctx.fill();
      ctx.fillStyle = "#ffc857";
      ctx.fillRect(p.x - 3, p.y + 8, 6, 8 + rocket.age * 10);
    }

    drawArrow();

    for (const f of floaters) {
      const p = worldToScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
      ctx.font = "800 16px Segoe UI, Liberation Sans, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function findDust() {
    const sector = state.sectors[0];
    const origin = sectorOrigin(0);
    let best = 0;
    let bi = 0;
    for (let i = 0; i < sector.dust.length; i++) {
      if (sector.dust[i] <= best) continue;
      const col = i % COLS;
      const row = (i / COLS) | 0;
      const x = origin.x + (col + 0.5) * TILE;
      const y = origin.y + (row + 0.5) * TILE;
      if (hitsBoulder(x, y)) continue;
      best = sector.dust[i];
      bi = i;
    }
    const col = bi % COLS;
    const row = (bi / COLS) | 0;
    return {
      x: origin.x + (col + 0.5) * TILE,
      y: origin.y + (row + 0.5) * TILE,
      dust: best,
    };
  }

  function snapshot() {
    const s0 = state.sectors[0];
    const d = homeDepot();
    return {
      money: state.money,
      patches: state.patches,
      tool: state.tool,
      toolName: TOOLS[state.tool].name,
      backpackLevel: state.backpackLevel,
      backpack: { mass: state.backpack.mass, worth: state.backpack.worth, cap: capacity() },
      hopper: { mass: state.hopper.mass, worth: state.hopper.worth },
      remaining0: remaining(s0),
      clean0: cleanliness(s0),
      px: state.px,
      py: state.py,
      depot: { x: d.x, y: d.y },
      unlocked: state.sectors.length,
      runCredits: state.runCredits,
      robots: robots.length,
      nearDepot: state.nearDepot,
      launches: state.launches,
    };
  }

  function bind() {
    const MOVE = new Set(["KeyA", "KeyD", "KeyW", "KeyS", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    addEventListener("keydown", (e) => {
      if (MOVE.has(e.code) || e.code === "Space") e.preventDefault();
      if (MOVE.has(e.code)) keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "Escape") {
        if (!modalEl.classList.contains("hidden")) closeModal();
        else if (!shopEl.classList.contains("hidden")) closeShop();
        return;
      }
      if (uiBlocked()) return;
      if (e.code === "KeyE") openShop();
      if (e.code === "Space") tryLaunch();
    });
    addEventListener("keyup", (e) => {
      keys.delete(e.code);
    });
    addEventListener("blur", () => keys.clear());

    shopBtn.addEventListener("click", openShop);
    $("shop-close").addEventListener("click", closeShop);
    shopEl.addEventListener("click", (e) => {
      if (e.target === shopEl) closeShop();
    });
    shopBody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy]");
      if (!btn) return;
      const ok = buy(btn.dataset.buy);
      if (!ok) btn.classList.add("deny");
      setTimeout(() => btn.classList.remove("deny"), 240);
    });
    launchBtn.addEventListener("click", () => tryLaunch());
    placeBtn.addEventListener("click", () => tryPlace());
    rideBtn.addEventListener("click", () => cycleRide());
    $("reset").addEventListener("click", openResetConfirm);
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) closeModal();
    });

    function stickFrom(e) {
      const rect = stickEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = rect.width * 0.34;
      const mag = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(max, mag);
      const nx = (dx / mag) * clamped;
      const ny = (dy / mag) * clamped;
      knobEl.style.transform = `translate(${nx}px, ${ny}px)`;
      if (mag < 12) {
        stick.x = 0;
        stick.y = 0;
      } else {
        stick.x = dx / max;
        stick.y = dy / max;
      }
    }
    stickEl.addEventListener("pointerdown", (e) => {
      stick.active = true;
      stick.pointer = e.pointerId;
      stickEl.setPointerCapture(e.pointerId);
      stickFrom(e);
    });
    stickEl.addEventListener("pointermove", (e) => {
      if (!stick.active || e.pointerId !== stick.pointer) return;
      stickFrom(e);
    });
    function endStick(e) {
      if (e.pointerId !== stick.pointer) return;
      stick.active = false;
      stick.pointer = -1;
      stick.x = 0;
      stick.y = 0;
      knobEl.style.transform = "translate(0px, 0px)";
    }
    stickEl.addEventListener("pointerup", endStick);
    stickEl.addEventListener("pointercancel", endStick);

    addEventListener("resize", resize);
    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(stage);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        paused = true;
        hiddenAt = Date.now();
        save();
      } else {
        const elapsed = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        paused = false;
        if (elapsed > 5000) {
          const report = simulateOffline(elapsed);
          save();
          if (report && report.earned > 0.5 && modalEl.classList.contains("hidden")) showOffline(report);
        }
      }
    });
    addEventListener("pagehide", () => save());
    addEventListener("beforeunload", () => save());
  }

  function boot() {
    bind();
    resize();
    const report = load();
    frameStats = combatStats();
    updateUI();
    if (report && report.corrupt) toast("Сохранение повреждено — начали заново");
    else if (report && report.storage === false) toast("Память браузера недоступна, игра только на этот раз");
    else if (report && report.earned > 0.5) showOffline(report);

    window.__LUNAR = {
      ready: true,
      format: formatNumber,
      tick(dt) { update(dt); },
      teleport(x, y) {
        state.px = x;
        state.py = y;
        cam.x = x;
        cam.y = y;
      },
      setMove(x, y) { stick.manual = { x, y }; },
      clearMove() { stick.manual = null; },
      launch: tryLaunch,
      buy,
      save,
      findDust,
      snapshot,
      economy: {
        backpackCost,
        speedCost,
        prestigeGain,
        value: valueOf,
        toolName: (i) => TOOLS[i] ? TOOLS[i].name : "",
        toolCount: TOOLS.length,
      },
      testing: {
        setMoney(n) { state.money = n; updateUI(); if (!shopEl.classList.contains("hidden")) renderShop(); },
        setRunCredits(n) { state.runCredits = n; updateUI(); if (!shopEl.classList.contains("hidden")) renderShop(); },
        holdSave(on) { savesEnabled = !!on; },
      },
    };

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      update(dt);
      render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setInterval(() => { if (!paused) save(); }, 5000);
  }

  boot();
})();
