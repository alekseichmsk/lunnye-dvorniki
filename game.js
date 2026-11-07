import { createScene, sweepCycle } from "./scene3d.js";
import * as Planet from "./planet.js";

(() => {
  "use strict";

  const CAM = { pitchMin: 0.26, pitchMax: 1.18, distMin: 1.7, distMax: 11 };
  const SAVE_KEY = "mars-dvorniki-save-v1";
  const OLD_SAVE_KEY = "lunnye-dvorniki-save-v1";
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
    { id: "pyh", name: "Марсоход «Пых»", blurb: "Быстрее шага и чуть шире метёт.", speed: 1.4, power: 1.22, radius: 16, cost: 12000, color: "#ffd23f" },
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

  let sceneApi = null;

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
  let lastDt = 1 / 60;
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
    return Planet.spawnNearHome(7);
  }

  function homeDepot() {
    const p = Planet.homeSurface();
    return { x: p.x, y: p.y, z: p.z, home: true };
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

  const GARDEN_CAP = 15;

  function gardenCost(level) {
    return Math.round(850 * 1.62 ** level);
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
    return (1 + state.patches * 0.4) * (1 + state.shipLevel * 0.08) * (1 + (state.garden || 0) * 0.03);
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
      garden: 0,
      battery: 0,
      depotBought: 0,
      depotStock: 0,
      placed: [],
      vehicles: {},
      riding: null,
      seenDust: false,
      launches: 0,
      cleaned: 0,
      pos: { x: sp.x, y: sp.y, z: sp.z },
      heading: 0.6,
      camYaw: 0.6,
      camPitch: 0.5,
      camDist: 4.2,
      camYawTo: 0.6,
      camPitchTo: 0.5,
      camDistTo: 4.2,
      dust: null,
      discovered: { plains: true },
      backpack: { mass: 0, worth: 0 },
      hopper: { mass: 0, worth: 0 },
      nearDepot: false,
      launchLock: 0,
      sweepCd: 0,
      fullCd: 0,
      glide: 0,
      sweepBeat: -1,
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
    state.dust = Planet.createDust();
    state.dust.stamp = (Date.now() % 100000000) + 3;
    const sp = spawnPoint();
    state.pos = { x: sp.x, y: sp.y, z: sp.z };
    state.heading = 0.6;
    state.discovered = { plains: true };
    shake = 0;
    lastHere = "";
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
    for (const d of state.placed) list.push({ x: d.x, y: d.y, z: d.z, home: false });
    return list;
  }

  function nearestDepot(pos) {
    let best = homeDepot();
    let bd = Infinity;
    for (const d of allDepots()) {
      const dist = Planet.geodesic(pos, d);
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

  function burst(pos, color, n, speed) {
    const up = Planet.up(pos);
    for (let i = 0; i < n && particles.length < 80; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (speed || 2) * 0.04 * (0.4 + Math.random());
      particles.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s + up.x * 0.4,
        vy: Math.sin(a) * s + up.y * 0.4,
        vz: (Math.random() - 0.5) * s + up.z * 0.4,
        age: 0,
        life: 0.35 + Math.random() * 0.4,
        size: 2 + Math.random() * 2,
        color,
      });
    }
  }

  function spawnPuff(pos, gold, size) {
    if (particles.length > 70) return;
    const up = Planet.up(pos);
    particles.push({
      x: pos.x, y: pos.y, z: pos.z,
      vx: up.x * 0.8, vy: up.y * 0.8, vz: up.z * 0.8,
      age: 0,
      life: 0.42,
      size: size || 3,
      color: gold ? "#ffd23f" : "#e7b089",
    });
  }

  function floater(text, pos, color) {
    floaters.push({ text, x: pos.x, y: pos.y, z: pos.z, age: 0, life: 1.05, color: color || "#3a2018" });
    if (floaters.length > 16) floaters.shift();
  }

  function meters(pixels) {
    return pixels / 30;
  }

  function collect(power, dt, pos, radiusPx, bag, cap) {
    const space = cap - bag.mass;
    if (!state.dust || space <= 0.05 || power <= 0 || radiusPx <= 0) return 0;
    const budget = Math.min(power * dt, space);
    const result = Planet.cleanAround(state.dust, pos, Math.max(meters(radiusPx), 2.8), budget);
    if (result.taken > 0) {
      bag.mass += result.taken;
      bag.worth += result.worth;
      state.dust.stamp = (state.dust.stamp || 0) + 1;
      if (Math.random() < 0.45) spawnPuff(pos, result.sparks > 0);
    }
    return result.taken;
  }

  function robotPos(r) {
    return { x: r.x, y: r.y, z: r.z };
  }

  function updateRobots(dt) {
    const mul = robotRateMul();
    for (let ri = 0; ri < robots.length; ri++) {
      const r = robots[ri];
      const def = robotDef(r.type);
      const cap = def.cap * (1 + state.patches * 0.05);
      r.retarget -= dt;
      const pos = robotPos(r);
      if (r.mass >= cap - 0.2) r.mode = "dump";
      if (r.mode === "dump") {
        const d = nearestDepot(pos);
        r.tx = d.depot.x;
        r.ty = d.depot.y;
        r.tz = d.depot.z;
        if (d.dist < 5) {
          state.hopper.mass += r.mass;
          state.hopper.worth += r.worth;
          r.mass = 0;
          r.worth = 0;
          r.mode = "seek";
          r.retarget = 0;
          burst(d.depot, "#ffb089", 8, 2);
        }
      } else if (r.retarget <= 0) {
        const biome = Planet.bestDustyBiome(state.dust);
        const target = Planet.randomDustyPoint(state.dust, biome);
        r.tx = target.x;
        r.ty = target.y;
        r.tz = target.z;
        r.retarget = 0.8 + (ri % 4) * 0.15;
      }
      const target = { x: r.tx || pos.x, y: r.ty || pos.y, z: r.tz || pos.z };
      Planet.moveAlong(pos, Planet.sub(target, pos), meters(def.speed) * dt);
      r.x = pos.x;
      r.y = pos.y;
      r.z = pos.z;
      if (r.mode !== "dump") {
        const got = collect(def.rate * mul, dt, pos, def.radius, r, cap);
        if (got > 0) state.cleaned += got;
      }
    }
  }

  function updateUnload(dt) {
    const near = nearestDepot(state.pos);
    state.nearDepot = near.dist < (near.depot.home ? 7.5 : 5.2);
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
    if (Math.random() < dt * 8) spawnPuff(state.pos, false);
  }

  function checkUnlocks() {
    const biome = Planet.biomeAt(state.pos);
    if (!state.discovered[biome.id]) {
      state.discovered[biome.id] = true;
      banner("Новый край: " + biome.name);
      burst(state.pos, "#ffb089", 18, 2);
    }
    const clean = Planet.biomeClean(state.dust, Planet.BIOMES.findIndex((b) => b.id === biome.id));
    if (clean >= 0.62 && !state.discovered[biome.id + ":clear"]) {
      state.discovered[biome.id + ":clear"] = true;
      banner(biome.short + " выметен");
    }
  }

  function shapeStick(x, y) {
    const m = Math.hypot(x, y);
    const dead = 0.16;
    if (m <= dead) return { x: 0, y: 0 };
    const t = Math.min(1, (m - dead) / (1 - dead));
    const curved = t * t * (3 - 2 * t);
    const s = curved / m;
    return { x: x * s, y: y * s };
  }

  function movementVec() {
    if (stick.manual) return shapeStick(stick.manual.x, stick.manual.y);
    if (stick.active) return shapeStick(stick.x, stick.y);
    let x = 0;
    let y = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
    return shapeStick(x, y);
  }

  function wrapAngle(a) {
    const t = Math.atan2(Math.sin(a), Math.cos(a));
    return t;
  }

  function dampCamera(dt) {
    const k = 1 - Math.exp(-9 * dt);
    state.camYaw += wrapAngle((state.camYawTo || 0) - (state.camYaw || 0)) * k;
    state.camPitch += ((state.camPitchTo || 0.5) - (state.camPitch || 0.5)) * k;
    state.camDist += ((state.camDistTo || 4.2) - (state.camDist || 4.2)) * k;
  }

  function nudgeOrbit(dx, dy) {
    state.camYawTo = (state.camYawTo || 0) - dx * 0.0055;
    state.camPitchTo = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, (state.camPitchTo || 0.5) + dy * 0.0042));
  }

  function nudgeZoom(factor) {
    state.camDistTo = Math.max(CAM.distMin, Math.min(CAM.distMax, (state.camDistTo || 4.2) * factor));
  }

  function uiBlocked() {
    return !shopEl.classList.contains("hidden") || !modalEl.classList.contains("hidden");
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      p.z += (p.vz || 0) * dt;
      if (p.age >= p.life) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.age += dt;
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

  function updateCamera() {}

  function update(dt) {
    if (paused) return;
    dt = Math.max(0, Math.min(0.1, dt));
    lastDt = dt;
    anim += dt;
    state.launchLock = Math.max(0, state.launchLock - dt);
    if (!reduceMotion) shake = Math.max(0, shake - dt * 16);
    frameStats = combatStats();
    const vec = uiBlocked() ? { x: 0, y: 0 } : movementVec();
    const wishMag = Math.hypot(vec.x, vec.y);
    frameFacing = vec.x >= 0 ? 1 : -1;
    frameCleaning = false;
    if (!uiBlocked()) {
      dampCamera(dt);
      const camFrame = Planet.basis(state.pos, state.camYaw || 0);
      const wish = Planet.add(Planet.scale(camFrame.right, vec.x), Planet.scale(camFrame.forward, -vec.y));
      if (wishMag > 0.02) {
        const target = Planet.headingFromWish(state.pos, wish, state.heading);
        const delta = wrapAngle(target - (state.heading || 0));
        const maxTurn = 5.2 * dt;
        const applied = Math.max(-maxTurn, Math.min(maxTurn, delta));
        state.heading = (state.heading || 0) + applied;
        state.turnRate = applied / Math.max(dt, 0.001);
      } else state.turnRate = (state.turnRate || 0) * 0.8;
      const targetSpeed = wishMag * meters(frameStats.speed);
      const rate = wishMag > 0.02 ? 16 : 20;
      const glide = state.glide || 0;
      const step = Math.max(-rate * dt, Math.min(rate * dt, targetSpeed - glide));
      state.glide = Math.max(0, glide + step);
      frameMoving = state.glide > 0.15;
      if (state.glide > 0.02) {
        const moved = Planet.basis(state.pos, state.heading || 0);
        Planet.moveAlong(state.pos, moved.forward, state.glide * dt);
      }
      const cap = capacity();
      const before = state.backpack.mass;
      const taken = collect(frameStats.power, dt, state.pos, frameStats.radius, state.backpack, cap);
      if (taken > 0) {
        frameCleaning = true;
        state.seenDust = true;
        state.cleaned += taken;
        const beat = Math.floor(sweepCycle(frameStats.tool.id, anim, true));
        if (beat !== state.sweepBeat) {
          state.sweepBeat = beat;
          const swung = Planet.basis(state.pos, state.heading || 0);
          const side = Math.sin(anim * sweepCycle(frameStats.tool.id, 1, true) * Math.PI);
          const at = Planet.add(
            state.pos,
            Planet.add(Planet.scale(swung.forward, 0.9), Planet.scale(swung.right, side * 0.55)),
          );
          spawnPuff(at, false, 7);
          spawnPuff(Planet.add(at, Planet.scale(swung.right, 0.18)), false, 5);
        }
      }
      if (state.backpack.mass >= cap - 0.4 && taken <= 0 && dustUnderPlayer() > 8) {
        state.fullCd -= dt;
        if (state.fullCd <= 0) {
          floater("Рюкзак полон", state.pos, "#ff6b6b");
          state.fullCd = 1.7;
        }
      }
      if (state.backpack.mass > before + 40 && !state.seenFullHint && state.backpack.mass > cap * 0.92) {
        state.seenFullHint = true;
      }
      updateUnload(dt);
    } else {
      frameMoving = false;
      state.glide = Math.max(0, (state.glide || 0) - 20 * dt);
    }
    updateRobots(dt);
    updateParticles(dt);
    checkUnlocks();
    updateCamera(dt);
    updateUI();
  }

  function dustUnderPlayer() {
    if (!state.dust) return 0;
    return state.dust.amount[Planet.cellIndex(state.pos)] || 0;
  }

  function tryLaunch() {
    if (uiBlocked()) return false;
    if (!state.nearDepot) {
      toast("Подойди к кораблю");
      return false;
    }
    if (state.hopper.worth <= 0.05) {
      toast("Трюм пуст");
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
    const d = nearestDepot(state.pos).depot;
    rockets.push({ x: d.x, y: d.y, z: d.z, age: 0, life: 2.4 });
    burst(d, "#ffb089", 16, 3);
    floater("+" + formatNumber(pay), d, "#3a2018");
    popMoney();
    save();
    updateUI();
    return true;
  }

  function tryPlace() {
    if (uiBlocked()) return;
    if (state.depotStock <= 0) return;
    for (const d of allDepots()) {
      if (Planet.geodesic(state.pos, d) < 18) {
        toast("Слишком близко к другому кораблю");
        return;
      }
    }
    const spot = Planet.surface(state.pos);
    state.placed.push({ x: spot.x, y: spot.y, z: spot.z });
    state.depotStock -= 1;
    toast("Посадочный модуль стоит");
    burst(spot, "#ffb089", 12, 2);
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
    burst(state.pos, "#ffb089", 10, 2);
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
    if (id === "garden") {
      if (state.garden >= GARDEN_CAP) {
        toast("Сад уже на всю поляну");
        return false;
      }
      const cost = gardenCost(state.garden);
      if (!spend(cost, "Сад")) return false;
      state.garden += 1;
      state.dust.stamp = (state.dust.stamp || 0) + 1;
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
        toast("Больше модулей не поставить");
        return false;
      }
      const rid = id.slice(6);
      const def = robotDef(rid);
      if (!ROBOTS.some((r) => r.id === rid)) return false;
      const cost = Math.round(def.cost * def.growth ** robotCount(rid));
      if (!spend(cost, def.name)) return false;
      const home = homeDepot();
      const spot = Planet.spawnNearHome(4 + Math.random() * 3);
      robots.push({
        type: rid,
        x: spot.x,
        y: spot.y,
        z: spot.z,
        mass: 0,
        worth: 0,
        mode: "seek",
        tx: home.x,
        ty: home.y,
        tz: home.z,
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

  function simulateOffline(ms) {
    if (!(ms > 5000) || !state.dust) return null;
    const capped = ms > MAX_OFFLINE + 800;
    let time = Math.min(ms, MAX_OFFLINE) / 1000;
    const rate = robots.reduce((sum, r) => sum + robotDef(r.type).rate, 0) * robotRateMul() * OFFLINE_EFF;
    if (rate <= 0) return null;
    let earnedBase = 0;
    let massCleaned = 0;
    let guard = 0;
    while (time > 0.05 && guard++ < 20) {
      const biome = Planet.bestDustyBiome(state.dust);
      if (biome < 0) break;
      const rem = Planet.biomeRemaining(state.dust, biome);
      const dt = Math.min(time, rem / rate);
      const cleaned = Planet.bulkClean(state.dust, biome, rate * dt);
      earnedBase += cleaned.worth;
      massCleaned += cleaned.mass;
      time -= dt;
    }
    state.dust.stamp = (state.dust.stamp || 0) + 1;
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
      v: 2,
      planet: "mars",
      dustN: Planet.DUST_N,
      money: state.money,
      runCredits: state.runCredits,
      lifetime: state.lifetime,
      patches: state.patches,
      tool: state.tool,
      polish: state.polish,
      backpackLevel: state.backpackLevel,
      speedLevel: state.speedLevel,
      shipLevel: state.shipLevel,
      garden: state.garden || 0,
      battery: state.battery,
      depotBought: state.depotBought,
      depotStock: state.depotStock,
      placed: state.placed.map((d) => ({ x: d.x, y: d.y, z: d.z })),
      vehicles: { ...state.vehicles },
      riding: state.riding,
      seenDust: state.seenDust ? 1 : 0,
      launches: state.launches,
      cleaned: state.cleaned,
      pos: { ...state.pos },
      heading: state.heading || 0,
      camera: {
        yaw: state.camYawTo,
        pitch: state.camPitchTo,
        dist: state.camDistTo,
      },
      discovered: { ...state.discovered },
      dust: encodeBytes(quantizeDust(state.dust.amount)),
      initial: Array.from(state.dust.initial),
      backpack: { mass: state.backpack.mass, worth: state.backpack.worth },
      hopper: { mass: state.hopper.mass, worth: state.hopper.worth },
      robots: robots.map((r) => ({
        type: r.type, x: r.x, y: r.y, z: r.z, mass: r.mass, worth: r.worth, mode: r.mode,
      })),
      lastSave: Date.now(),
    };
  }

  function quantizeDust(amount) {
    const out = new Uint8Array(amount.length);
    for (let i = 0; i < amount.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(amount[i])));
    return out;
  }

  function encodeBytes(u8) {
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

  function decodeBytes(b64, len) {
    const binary = atob(b64);
    if (binary.length !== len) throw new Error("dustlen");
    const out = new Uint8Array(len);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 255;
    return out;
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
      const spot = Number.isFinite(raw.z) ? Planet.surface(raw) : Planet.spawnNearHome(4);
      robots.push({
        type: raw.type,
        x: spot.x,
        y: spot.y,
        z: spot.z,
        mass: num(raw.mass, 0, 0),
        worth: num(raw.worth, 0, 0),
        mode: raw.mode === "dump" ? "dump" : "seek",
        tx: home.x,
        ty: home.y,
        tz: home.z,
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
    state.garden = int(data.garden, 0, GARDEN_CAP);
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
        if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.z)) continue;
        const spot = Planet.surface(d);
        state.placed.push({ x: spot.x, y: spot.y, z: spot.z });
      }
    }
    state.discovered = { plains: true };
    if (data.discovered && typeof data.discovered === "object") {
      for (const key of Object.keys(data.discovered)) state.discovered[key] = !!data.discovered[key];
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
    state.dust = Planet.createDust();
    if (data.dust && data.dustN === Planet.DUST_N) {
      const bytes = decodeBytes(data.dust, state.dust.amount.length);
      for (let i = 0; i < bytes.length; i++) state.dust.amount[i] = bytes[i];
      if (Array.isArray(data.initial) && data.initial.length === state.dust.initial.length) {
        for (let i = 0; i < data.initial.length; i++) state.dust.initial[i] = num(data.initial[i], state.dust.initial[i], 1);
      }
    }
    state.dust.stamp = 1;
    loadRobots(data.robots);
    const sp = spawnPoint();
    const loaded = data.pos && Number.isFinite(data.pos.x) ? Planet.surface(data.pos) : sp;
    state.pos = { x: loaded.x, y: loaded.y, z: loaded.z };
    state.heading = num(data.heading, 0.6, -Math.PI * 4, Math.PI * 4);
    const cam = data.camera || {};
    state.camYawTo = num(cam.yaw, state.heading, -40, 40);
    state.camYaw = state.camYawTo;
    state.camPitchTo = num(cam.pitch, 0.5, CAM.pitchMin, CAM.pitchMax);
    state.camPitch = state.camPitchTo;
    state.camDistTo = num(cam.dist, 4.2, CAM.distMin, CAM.distMax);
    state.camDist = state.camDistTo;
  }

  function migrateOldSave(data) {
    applyFresh();
    state.money = num(data.money, 0, 0, 1e300);
    state.runCredits = num(data.runCredits, 0, 0, 1e300);
    state.lifetime = num(data.lifetime, state.money, 0, 1e300);
    state.patches = int(data.patches, 0, 500);
    state.tool = int(data.tool, 0, TOOLS.length - 1);
    state.polish = int(data.polish, 0, 400);
    state.backpackLevel = int(data.backpackLevel, 0, 400);
    state.speedLevel = int(data.speedLevel, 0, 400);
    state.shipLevel = int(data.shipLevel, 0, 400);
    state.garden = int(data.garden, 0, GARDEN_CAP);
    state.battery = int(data.battery, 0, 400);
    state.depotBought = int(data.depotBought, 0, DEPOT_CAP);
    state.depotStock = int(data.depotStock, 0, DEPOT_CAP);
    state.launches = int(data.launches, 0, 1e7);
    state.cleaned = num(data.cleaned, 0, 0, 1e300);
    if (data.vehicles && typeof data.vehicles === "object") {
      for (const v of VEHICLES) if (data.vehicles[v.id]) state.vehicles[v.id] = true;
    }
    const counts = {};
    if (Array.isArray(data.robots)) {
      for (const robot of data.robots) {
        if (!robot || !robot.type) continue;
        counts[robot.type] = (counts[robot.type] || 0) + 1;
      }
    }
    const home = homeDepot();
    for (const [type, count] of Object.entries(counts)) {
      for (let i = 0; i < count && robots.length < ROBOT_CAP_TOTAL; i++) {
        const spot = Planet.spawnNearHome(5 + i);
        robots.push({
          type, x: spot.x, y: spot.y, z: spot.z, mass: 0, worth: 0, mode: "seek",
          tx: home.x, ty: home.y, tz: home.z, retarget: 0, stuck: 0,
        });
      }
    }
    return { migrated: true };
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); }
    catch (e) {
      applyFresh();
      return { storage: false };
    }
    if (!raw) {
      let oldRaw = null;
      try { oldRaw = localStorage.getItem(OLD_SAVE_KEY); } catch (err) { oldRaw = null; }
      if (oldRaw) {
        try {
          const oldData = JSON.parse(oldRaw);
          const migrated = migrateOldSave(oldData);
          save();
          return migrated;
        } catch (err) {
          applyFresh();
          return null;
        }
      }
      applyFresh();
      return null;
    }
    try {
      const data = JSON.parse(raw);
      if (!data || data.v !== 2 || data.planet !== "mars") throw new Error("version");
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

    const biome = Planet.biomeAt(state.pos);
    const biomeIndex = Planet.BIOMES.findIndex((b) => b.id === biome.id);
    setText(sectorNameEl, biome.name);
    setText(priceEl, "пыль ×" + formatNumber(biome.price));
    const clean = state.dust ? Planet.biomeClean(state.dust, biomeIndex) : 0;
    const pct = clean * 100;
    setText(sectorPctEl, (pct < 10 ? pct.toFixed(1) : String(Math.floor(pct))) + "%");
    sectorBar.style.width = (clean * 100).toFixed(1) + "%";
    sectorBar.style.background = biome.color;

    const cap = capacity();
    const mass = state.backpack.mass;
    setText(packLabel, formatNumber(mass) + " / " + formatNumber(cap));
    const frac = cap > 0 ? Math.min(1, mass / cap) : 0;
    packBar.style.width = (frac * 100).toFixed(1) + "%";
    packBar.style.background = frac > 0.92 ? "#ff6b6b" : frac > 0.62 ? "#ffc857" : "#14b889";

    if (!state.seenDust) hintEl.textContent = "Иди по ржавой пыли. Под ней проступит марсианский грунт.";
    else if (state.nearDepot && state.backpack.mass > 1) hintEl.textContent = "Пыль едет по рампе в трюм…";
    else if (state.nearDepot && state.hopper.worth > 1) hintEl.textContent = "Трюм ждёт. Запускай корабль.";
    else if (frac > 0.97) hintEl.textContent = "Рюкзак полон. Неси к кораблю.";
    else if (state.riding) hintEl.textContent = "За рулём: " + vehicleById(state.riding).name;
    else hintEl.textContent = "В руках: " + TOOLS[state.tool].name;

    const canLaunch = state.nearDepot && state.hopper.worth > 0.05 && state.launchLock <= 0;
    launchBtn.hidden = !(state.nearDepot && (state.hopper.worth > 0.05 || state.backpack.mass > 1));
    launchBtn.disabled = !canLaunch;
    launchLabel.textContent = canLaunch ? "Запустить рейс" : "Сдать пыль";

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
    const count = Planet.BIOMES.length;
    if (stripEl.childElementCount !== count) {
      stripEl.replaceChildren();
      for (let i = 0; i < count; i++) {
        const el = document.createElement("span");
        el.className = "chip";
        stripEl.appendChild(el);
      }
    }
    const here = Planet.biomeAt(state.pos).id;
    const kids = stripEl.children;
    Planet.BIOMES.forEach((biome, i) => {
      const known = state.discovered && state.discovered[biome.id];
      const name = known ? biome.short : "···";
      if (kids[i].textContent !== name) kids[i].textContent = name;
      kids[i].className = "chip" + (known ? "" : " locked") + (here === biome.id ? " here" : "");
      kids[i].title = known ? biome.name : "Ещё не дошли";
      if (here === biome.id && lastHere !== here) kids[i].scrollIntoView({ inline: "center", block: "nearest" });
    });
    lastHere = here;
  }

  function row(title, text, meta, buttonHtml) {
    return `<div class="row"><div><strong>${esc(title)}</strong><p>${esc(text)}</p><em>${esc(meta)}</em></div>${buttonHtml}</div>`;
  }

  function rowIcon(src, title, text, meta, buttonHtml) {
    return `<div class="row rose-row"><img class="row-icon" src="${esc(src)}" alt=""><div><strong>${esc(title)}</strong><p>${esc(text)}</p><em>${esc(meta)}</em></div>${buttonHtml}</div>`;
  }

  function buyBtn(id, label, ok, cost) {
    const text = ok || cost == null ? label : "ещё " + formatNumber(Math.max(0, cost - state.money));
    return `<button type="button" class="buy ${ok ? "can" : "cannot"}" data-buy="${esc(id)}" ${ok ? "" : "disabled"}>${esc(text)}</button>`;
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
      else if (i === state.tool + 1) html += row(tool.name, tool.blurb, meta, buyBtn("tool", formatNumber(tool.cost), canAfford(tool.cost), tool.cost));
      else html += row(tool.name, tool.blurb, meta, badge("потом"));
    }
    const pCost = polishCost(state.polish);
    html += row(
      "Полировка",
      "Точит то, что уже в руках. Бесконечная лестница силы.",
      `сила ×${formatNumber(1.14 ** state.polish)} → ×${formatNumber(1.14 ** (state.polish + 1))}`,
      buyBtn("polish", formatNumber(pCost), canAfford(pCost), pCost),
    );
    return html;
  }

  function gearHtml() {
    const bCost = backpackCost(state.backpackLevel);
    const sCost = speedCost(state.speedLevel);
    const tCost = shipCost(state.shipLevel);
    const gCost = gardenCost(state.garden);
    const gardenFull = state.garden >= GARDEN_CAP;
    const gardenBtn = gardenFull
      ? badge("на всю")
      : buyBtn("garden", formatNumber(gCost), canAfford(gCost), gCost);
    return [
      rowIcon(
        "assets/rose-icon.png",
        "Сад",
        "На чистой земле всходят розы. Чем выше сад, тем гуще цветки и щедрее рейс.",
        gardenFull
          ? `розы густо · оплата +${state.garden * 3}%`
          : `оплата +${state.garden * 3}% → +${(state.garden + 1) * 3}%`,
        gardenBtn,
      ),
      row(
        "Рюкзак",
        "Больше пыли за одну ходку до корабля.",
        `вместимость ${formatNumber(capacityAt(state.backpackLevel))} → ${formatNumber(capacityAt(state.backpackLevel + 1))}`,
        buyBtn("backpack", formatNumber(bCost), canAfford(bCost), bCost),
      ),
      row(
        "Ботинки дворника",
        "Короче дорога с полным рюкзаком.",
        `шаг +${Math.round((1.072 ** state.speedLevel - 1) * 100)}% → +${Math.round((1.072 ** (state.speedLevel + 1) - 1) * 100)}%`,
        buyBtn("speed", formatNumber(sCost), canAfford(sCost), sCost),
      ),
      row(
        "Тариф рейса",
        "Корабль платит щедрее за ту же пыль.",
        `оплата +${state.shipLevel * 8}% → +${(state.shipLevel + 1) * 8}%`,
        buyBtn("ship", formatNumber(tCost), canAfford(tCost), tCost),
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
      html += row("Запасной модуль", "Ставь ближе к пыли, чтобы меньше носить.", "лимит станции", badge("лимит"));
    } else {
      const cost = depotPrice(state.depotBought);
      html += row(
        "Запасной модуль",
        "Купи, потом встань на грунт и нажми «Поставить». Трюм один на всю станцию.",
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
      const meta = `на планете: ${owned} · каждый ${formatNumber(def.rate * mul)}/с`;
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
    html += `<div class="shift-copy"><p>Роботы сами носят пыль в трюм. Рейс запускаешь ты. Пока игра закрыта, они отправляют рейс сами, но не открывают новые края и работают примерно вполсилы.</p></div>`;
    return html;
  }

  function shiftHtml() {
    const gain = prestigeGain(state.runCredits, state.patches);
    const next = prestigeCost(state.patches);
    const html = [
      `<div class="shift-copy">`,
      `<p><strong>Нашивки:</strong> ${state.patches}. Рейс ×${formatNumber(1 + state.patches * 0.4)}, уборка +${Math.round(state.patches * 12)}%.</p>`,
      `<p>Кредиты этой смены: ${formatNumber(state.runCredits)}. Следующая нашивка стоит ${formatNumber(next)}.</p>`,
      `<p>Эта смена даст нашивок: ${gain}. Новая смена стирает кредиты, инструменты, рюкзак, технику, роботов и открытые края. Нашивки остаются и усиливают следующую.</p>`,
      `<p>Сметено за всё время: ${formatNumber(state.cleaned)}. Рейсов: ${state.launches}.</p>`,
      `</div>`,
      row(
        "Новая смена",
        "Сдать планету и начать сначала, но уже с нашивками на куртке.",
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
      return canAfford(backpackCost(state.backpackLevel))
        || canAfford(speedCost(state.speedLevel))
        || canAfford(shipCost(state.shipLevel))
        || (state.garden < GARDEN_CAP && canAfford(gardenCost(state.garden)));
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
        "Пропадут кредиты, инструменты, рюкзак, техника, роботы и открытые края.",
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
      lines: ["Пропадут края, кредиты, роботы и нашивки. Вернуть это нельзя."],
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
    view.w = Math.max(2, rect.width);
    view.h = Math.max(2, rect.height);
    if (sceneApi) sceneApi.resize();
  }

  function render() {
    if (!sceneApi || !state) return;
    sceneApi.render({
      state,
      depots: allDepots(),
      robots,
      particles,
      floaters,
      rockets,
      anim,
      dt: lastDt,
      shake,
      frameStats,
      frameMoving,
      frameFacing,
      frameCleaning,
      reduceMotion,
    });
  }

  function findDust() {
    let best = 0;
    let index = 0;
    const data = state.dust.amount;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > best) {
        best = data[i];
        index = i;
      }
    }
    const spot = Planet.surface({
      x: Planet.cellDir[index * 3],
      y: Planet.cellDir[index * 3 + 1],
      z: Planet.cellDir[index * 3 + 2],
    });
    return { x: spot.x, y: spot.y, z: spot.z, dust: best };
  }

  function snapshot() {
    const d = homeDepot();
    const plains = Planet.BIOMES.findIndex((b) => b.id === "plains");
    return {
      money: state.money,
      patches: state.patches,
      tool: state.tool,
      toolName: TOOLS[state.tool].name,
      backpackLevel: state.backpackLevel,
      backpack: { mass: state.backpack.mass, worth: state.backpack.worth, cap: capacity() },
      hopper: { mass: state.hopper.mass, worth: state.hopper.worth },
      remaining0: state.dust ? Planet.totalRemaining(state.dust) : 0,
      clean0: state.dust ? 1 - Planet.totalRemaining(state.dust) / state.dust.amount.length : 0,
      px: state.pos.x,
      py: state.pos.y,
      pz: state.pos.z,
      depot: { x: d.x, y: d.y, z: d.z },
      unlocked: Object.keys(state.discovered || {}).length,
      runCredits: state.runCredits,
      robots: robots.length,
      nearDepot: state.nearDepot,
      launches: state.launches,
    };
  }

  function bindFullscreen() {
    const btn = $("fullscreen");
    const root = document.documentElement;
    function active() {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    }
    function label() {
      const on = !!active();
      btn.textContent = on ? "⤡" : "⛶";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-label", on ? "Выйти из полного экрана" : "На весь экран");
    }
    btn.addEventListener("click", () => {
      if (active()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
        return;
      }
      const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
      if (!req) {
        toast("На iPhone: «Поделиться» → «На экран Домой». Игра откроется на весь экран.");
        return;
      }
      Promise.resolve(req.call(root)).catch(() => {
        toast("На iPhone: «Поделиться» → «На экран Домой». Игра откроется на весь экран.");
      });
    });
    document.addEventListener("fullscreenchange", label);
    document.addEventListener("webkitfullscreenchange", label);
    label();
  }

  function bindNoZoom() {
    const view = $("view");
    const stop = (e) => e.preventDefault();
    view.addEventListener("gesturestart", stop, { passive: false });
    view.addEventListener("gesturechange", stop, { passive: false });
    view.addEventListener("contextmenu", stop);
    document.addEventListener("contextmenu", stop);
    document.addEventListener("selectstart", stop);
    let lastTouch = 0;
    view.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTouch < 320) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  function bindOrbit() {
    const view = $("view");
    const pointers = new Map();
    let pinchGap = 0;
    function gap() {
      const pts = [...pointers.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
    view.addEventListener("pointerdown", (e) => {
      if (uiBlocked()) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      view.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinchGap = gap();
    });
    view.addEventListener("pointermove", (e) => {
      if (!pointers.has(e.pointerId) || uiBlocked()) return;
      const prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        const next = gap();
        if (pinchGap > 10 && next > 10) nudgeZoom(pinchGap / next);
        pinchGap = next;
        return;
      }
      nudgeOrbit(e.clientX - prev.x, e.clientY - prev.y);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchGap = 0;
    };
    view.addEventListener("pointerup", end);
    view.addEventListener("pointercancel", end);
    view.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = Math.max(-90, Math.min(90, e.deltaY));
      nudgeZoom(Math.exp(delta * 0.0015));
    }, { passive: false });
  }

  function bind() {
    bindFullscreen();
    bindNoZoom();
    bindOrbit();
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
    $("menu-open").addEventListener("click", () => $("menu").classList.toggle("hidden"));
    let buyQty = 1;
    document.querySelectorAll("[data-qty]").forEach((button) => {
      button.addEventListener("click", () => {
        buyQty = button.dataset.qty === "max" ? 40 : Number(button.dataset.qty) || 1;
        document.querySelectorAll("[data-qty]").forEach((other) => other.classList.toggle("on", other === button));
      });
    });
    const grab = $("shop-grab");
    let grabY = 0;
    grab.addEventListener("pointerdown", (e) => { grabY = e.clientY; });
    grab.addEventListener("pointerup", (e) => { if (e.clientY - grabY > 48) closeShop(); });
    $("shop-close").addEventListener("click", closeShop);
    shopEl.addEventListener("click", (e) => {
      if (e.target === shopEl) closeShop();
    });
    shopBody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-buy]");
      if (!btn) return;
      let bought = 0;
      for (let i = 0; i < buyQty; i++) {
        if (!buy(btn.dataset.buy)) break;
        bought += 1;
      }
      shopBody.classList.remove("flash");
      if (bought) {
        void shopBody.offsetWidth;
        shopBody.classList.add("flash");
      } else btn.classList.add("deny");
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

  async function boot() {
    bind();
    const report = load();
    frameStats = combatStats();
    updateUI();
    sceneApi = await createScene(canvas);
    resize();
    if (report && report.corrupt) toast("Сохранение повреждено — начали заново");
    else if (report && report.migrated) toast("Лунный двор остался в памяти. Снаряжение переехало на Марс.");
    else if (report && report.storage === false) toast("Память браузера недоступна, игра только на этот раз");
    else if (report && report.earned > 0.5) showOffline(report);

    window.__LUNAR = {
      ready: true,
      modelsLoaded: true,
      format: formatNumber,
      tick(dt) { update(dt); },
      teleport(x, y, z) {
        const spot = Planet.surface({ x, y, z: z || 0 });
        state.pos = { x: spot.x, y: spot.y, z: spot.z };
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
        overview(on) { state.overview = !!on; },
        setTool(i) { state.tool = Math.max(0, Math.min(TOOLS.length - 1, i | 0)); frameStats = combatStats(); },
        facing() {
          const forward = Planet.basis(state.pos, state.heading || 0).forward;
          return sceneApi ? sceneApi.faceDot(forward) : 0;
        },
        camera() {
          return { yaw: state.camYawTo, pitch: state.camPitchTo, dist: state.camDistTo, shown: state.camYaw };
        },
        orbit(dx, dy) { nudgeOrbit(dx, dy); },
        zoom(factor) { nudgeZoom(factor); },
        toolWorld() { return sceneApi ? sceneApi.toolWorld() : null; },
        setCamera(yaw, pitch, dist) {
          state.camYawTo = yaw;
          state.camPitchTo = Math.max(CAM.pitchMin, Math.min(CAM.pitchMax, pitch));
          state.camDistTo = Math.max(CAM.distMin, Math.min(CAM.distMax, dist));
          state.camYaw = state.camYawTo;
          state.camPitch = state.camPitchTo;
          state.camDist = state.camDistTo;
        },
        pause(on) { paused = !!on; },
        wave() {
          const motion = sweepCycle(TOOLS[state.tool].id, 1, frameCleaning || frameMoving);
          return Math.sin(anim * motion * Math.PI);
        },
        toolId() { return TOOLS[state.tool].id; },
        flowerCount() { return sceneApi ? sceneApi.flowerCount() : 0; },
        sow(radius) {
          const reach = radius || 16;
          for (let n = 0; n < 6; n++) Planet.cleanAround(state.dust, state.pos, reach, 20000);
          state.garden = Math.max(state.garden || 0, 4);
          state.dust.stamp = (state.dust.stamp || 0) + 1;
          frameStats = combatStats();
        },
      },
    };

    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      try {
        update(dt);
        render();
      } catch (err) {
        if (!loop.reported) {
          loop.reported = true;
          console.error(err);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setInterval(() => { if (!paused) save(); }, 5000);
  }

  boot().catch((err) => {
    console.error(err);
  });
})();
