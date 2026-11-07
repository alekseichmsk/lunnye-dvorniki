// One Mars: cube-sphere dust, noise relief, and biome regions.
export const RADIUS = 148;
export const DUST_N = 80;
export const CELLS = DUST_N * DUST_N;
export const FACE_COUNT = 6;

export const BIOMES = [
  { id: "plains", short: "Равнины", name: "Ржавые равнины", price: 1, density: 1, color: "#b56a45" },
  { id: "highlands", short: "Нагорье", name: "Рыжие нагорья", price: 1.35, density: 1.18, color: "#9a5a3c" },
  { id: "dunes", short: "Дюны", name: "Дюны Сирокко", price: 1.55, density: 1.42, color: "#c48955" },
  { id: "canyon", short: "Каньон", name: "Каньон Эхо", price: 1.95, density: 1.6, color: "#7d4636" },
  { id: "olympus", short: "Олимп", name: "Склоны Олимпа", price: 2.7, density: 1.85, color: "#6a4034" },
  { id: "ice", short: "Льды", name: "Полярные шапки", price: 2.25, density: 0.62, color: "#d9c7b4" },
];

const FACES = [
  { axis: [1, 0, 0], u: [0, 0, -1], v: [0, -1, 0] },
  { axis: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] },
  { axis: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { axis: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { axis: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0] },
  { axis: [0, 0, -1], u: [-1, 0, 0], v: [0, -1, 0] },
];

export const HOME = norm({ x: 0.18, y: 0.04, z: 0.98 });
const OLYMPUS = norm({ x: 0.62, y: 0.38, z: 0.68 });
const CANYON = norm({ x: 0.22, y: 0.9, z: 0.37 });

const CRATERS = [];
for (let i = 0; i < 16; i++) {
  const y = 1 - (i + 0.5) / 16 * 2;
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * 2.399963;
  const dir = norm({ x: Math.cos(theta) * ring, y, z: Math.sin(theta) * ring });
  if (angle(dir, HOME) < 0.45) continue;
  CRATERS.push({
    dir,
    radius: 0.09 + (i % 5) * 0.035,
    depth: 2.2 + (i % 4) * 1.1,
  });
}

export const cellDir = new Float32Array(FACE_COUNT * CELLS * 3);
export const cellBiome = new Uint8Array(FACE_COUNT * CELLS);

function fillCells() {
  for (let face = 0; face < FACE_COUNT; face++) {
    for (let j = 0; j < DUST_N; j++) {
      for (let i = 0; i < DUST_N; i++) {
        const u = ((i + 0.5) / DUST_N) * 2 - 1;
        const v = ((j + 0.5) / DUST_N) * 2 - 1;
        const dir = faceDir(face, u, v);
        const index = face * CELLS + j * DUST_N + i;
        cellDir[index * 3] = dir.x;
        cellDir[index * 3 + 1] = dir.y;
        cellDir[index * 3 + 2] = dir.z;
        cellBiome[index] = biomeIndex(dir);
      }
    }
  }
}

export function v3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

export function copy(a, b) {
  a.x = b.x;
  a.y = b.y;
  a.z = b.z;
  return a;
}

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function len(a) {
  return Math.hypot(a.x, a.y, a.z);
}

export function norm(a) {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function lattice(ix, iy, iz) {
  let n = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(iz | 0, 1440662683);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (((n ^ (n >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

function noise3(x, y, z) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const xf = fade(x - x0);
  const yf = fade(y - y0);
  const zf = fade(z - z0);
  let acc = 0;
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const w = (dx ? xf : 1 - xf) * (dy ? yf : 1 - yf) * (dz ? zf : 1 - zf);
        acc += lattice(x0 + dx, y0 + dy, z0 + dz) * w;
      }
    }
  }
  return acc;
}

function fbm(dir, freq) {
  const p = scale(dir, freq);
  return noise3(p.x, p.y, p.z) * 0.62
    + noise3(p.x * 2.1, p.y * 2.1, p.z * 2.1) * 0.28
    + noise3(p.x * 4.2, p.y * 4.2, p.z * 4.2) * 0.1;
}

export function angle(a, b) {
  return Math.acos(clamp(dot(norm(a), norm(b)), -1, 1));
}

function faceDir(face, u, v) {
  const f = FACES[face];
  return norm({
    x: f.axis[0] + f.u[0] * u + f.v[0] * v,
    y: f.axis[1] + f.u[1] * u + f.v[1] * v,
    z: f.axis[2] + f.u[2] * u + f.v[2] * v,
  });
}

export function cubeMap(dir) {
  const d = norm(dir);
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  let face = 4;
  if (ax >= ay && ax >= az) face = d.x > 0 ? 0 : 1;
  else if (ay >= ax && ay >= az) face = d.y > 0 ? 2 : 3;
  else face = d.z > 0 ? 4 : 5;
  const f = FACES[face];
  const axis = { x: f.axis[0], y: f.axis[1], z: f.axis[2] };
  const uu = { x: f.u[0], y: f.u[1], z: f.u[2] };
  const vv = { x: f.v[0], y: f.v[1], z: f.v[2] };
  const denom = dot(d, axis) || 1e-6;
  const u = dot(d, uu) / denom;
  const v = dot(d, vv) / denom;
  return {
    face,
    u: clamp((u + 1) * 0.5, 0, 0.999999),
    v: clamp((v + 1) * 0.5, 0, 0.999999),
  };
}

export function height(dir) {
  const d = norm(dir);
  let h = fbm(d, 2.4) * 8.5 + fbm(d, 6.5) * 2.4;
  const polar = Math.abs(d.y);
  if (polar > 0.62) h *= 1 - clamp((polar - 0.62) / 0.28, 0, 1) * 0.75;
  for (const crater of CRATERS) {
    const dist = angle(d, crater.dir);
    if (dist < crater.radius) {
      const t = dist / crater.radius;
      h -= crater.depth * 1.45 * (1 - t * t);
      if (t > 0.72) h += crater.depth * 0.42 * Math.sin(((t - 0.72) / 0.28) * Math.PI);
    }
  }
  const canyon = Math.abs(dot(d, CANYON));
  if (canyon < 0.2) {
    const t = canyon / 0.2;
    const edge = Math.sin(t * Math.PI);
    h -= (1 - t * t) * 14;
    h += edge * 2.4;
  }
  const volcano = angle(d, OLYMPUS);
  if (volcano < 0.55) {
    const t = volcano / 0.55;
    const cone = Math.cos(t * Math.PI * 0.5);
    h += cone * 26;
    if (volcano < 0.08) h -= (1 - volcano / 0.08) * 6;
  }
  if (angle(d, HOME) < 0.22) h *= 0.35;
  return h;
}

export function surface(dir) {
  const d = norm(dir);
  return scale(d, RADIUS + height(d));
}

export function up(pos) {
  return norm(pos);
}

export function surfaceNormal(dir) {
  const n = norm(dir);
  const eps = 0.02;
  let t1 = cross({ x: 0, y: 1, z: 0 }, n);
  if (dot(t1, t1) < 1e-8) t1 = cross({ x: 1, y: 0, z: 0 }, n);
  t1 = norm(t1);
  const t2 = norm(cross(n, t1));
  const p = surface(n);
  const p1 = surface(norm(add(n, scale(t1, eps))));
  const p2 = surface(norm(add(n, scale(t2, eps))));
  const normal = norm(cross(sub(p1, p), sub(p2, p)));
  return dot(normal, n) < 0 ? scale(normal, -1) : normal;
}

export function basis(pos, heading) {
  const n = up(pos);
  let east = cross({ x: 0, y: 1, z: 0 }, n);
  if (dot(east, east) < 1e-8) east = cross({ x: 1, y: 0, z: 0 }, n);
  east = norm(east);
  const north = norm(cross(n, east));
  const forward = norm(add(scale(north, Math.cos(heading)), scale(east, Math.sin(heading))));
  const right = norm(cross(forward, n));
  return { up: n, forward, right, east, north };
}

export function moveAlong(pos, tangent, distance) {
  const n = up(pos);
  let t = sub(tangent, scale(n, dot(tangent, n)));
  if (dot(t, t) < 1e-10) return pos;
  t = norm(t);
  const axis = norm(cross(n, t));
  const angleStep = distance / RADIUS;
  const c = Math.cos(angleStep);
  const s = Math.sin(angleStep);
  const rotated = add(add(scale(pos, c), scale(cross(axis, pos), s)), scale(axis, dot(axis, pos) * (1 - c)));
  const landed = meshSurface(norm(rotated));
  pos.x = landed.x;
  pos.y = landed.y;
  pos.z = landed.z;
  return pos;
}

export function headingFromWish(pos, wish, fallback) {
  const frame = basis(pos, fallback || 0);
  const northD = dot(wish, frame.north);
  const eastD = dot(wish, frame.east);
  if (northD * northD + eastD * eastD < 1e-8) return fallback || 0;
  return Math.atan2(eastD, northD);
}

function biomeIndex(dir) {
  const d = norm(dir);
  if (Math.abs(d.y) > 0.74) return 5;
  if (angle(d, OLYMPUS) < 0.42) return 4;
  if (Math.abs(dot(d, CANYON)) < 0.16 && angle(d, HOME) > 0.3) return 3;
  if (angle(d, HOME) < 0.38) return 0;
  const roll = fbm(d, 1.7);
  if (roll > 0.18) return 2;
  if (height(d) > 3.2) return 1;
  return 0;
}

export function biomeAt(dir) {
  return BIOMES[biomeIndex(dir)];
}

export function cellIndex(dir) {
  const map = cubeMap(dir);
  const i = clamp(Math.floor(map.u * DUST_N), 0, DUST_N - 1);
  const j = clamp(Math.floor(map.v * DUST_N), 0, DUST_N - 1);
  return map.face * CELLS + j * DUST_N + i;
}

export function sparkleMul(index) {
  const n = lattice(index, 19, 3);
  return n > 0.9 ? 3 : 1;
}

function initialAmount(index) {
  const biome = BIOMES[cellBiome[index]];
  const vary = 0.75 + (lattice(index, 4, 9) * 0.5 + 0.5) * 0.55;
  let amount = 55 * biome.density * vary;
  const dir = {
    x: cellDir[index * 3],
    y: cellDir[index * 3 + 1],
    z: cellDir[index * 3 + 2],
  };
  if (angle(dir, HOME) < 0.07) amount = 0;
  return amount;
}

export function createDust() {
  const amount = new Float32Array(FACE_COUNT * CELLS);
  const initial = new Float32Array(BIOMES.length);
  for (let i = 0; i < amount.length; i++) {
    const value = initialAmount(i);
    amount[i] = value;
    initial[cellBiome[i]] += value;
  }
  return { amount, initial };
}

export function totalRemaining(dust) {
  let total = 0;
  const data = dust.amount;
  for (let i = 0; i < data.length; i++) total += data[i];
  return total;
}

export function biomeRemaining(dust, biome) {
  let total = 0;
  const data = dust.amount;
  for (let i = 0; i < data.length; i++) if (cellBiome[i] === biome) total += data[i];
  return total;
}

export function biomeClean(dust, biome) {
  const start = dust.initial[biome] || 1;
  return clamp(1 - biomeRemaining(dust, biome) / start, 0, 1);
}

export function cellValue(index) {
  return 0.5 * BIOMES[cellBiome[index]].price * sparkleMul(index);
}

export function cleanAround(dust, pos, radius, budget) {
  if (budget <= 0) return { taken: 0, worth: 0, sparks: 0 };
  const origin = norm(pos);
  const cosLim = Math.cos(Math.min(radius / RADIUS + 0.02, 1.2));
  const map = cubeMap(origin);
  const faces = new Set([map.face]);
  if (map.u < 0.08 || map.u > 0.92 || map.v < 0.08 || map.v > 0.92) {
    for (let face = 0; face < FACE_COUNT; face++) faces.add(face);
  }
  const hits = [];
  let weight = 0;
  for (const face of faces) {
    const base = face * CELLS;
    for (let n = 0; n < CELLS; n++) {
      const index = base + n;
      const dir = { x: cellDir[index * 3], y: cellDir[index * 3 + 1], z: cellDir[index * 3 + 2] };
      if (dot(dir, origin) < cosLim) continue;
      const spot = surface(dir);
      const dx = spot.x - pos.x;
      const dy = spot.y - pos.y;
      const dz = spot.z - pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > radius || dust.amount[index] <= 0.05) continue;
      const w = (1 - dist / radius) ** 2;
      hits.push({ index, dist, w, spot });
      weight += w;
    }
  }
  if (!weight) return { taken: 0, worth: 0, sparks: 0 };
  let taken = 0;
  let worth = 0;
  let sparks = 0;
  for (const hit of hits) {
    const have = dust.amount[hit.index];
    const want = Math.min(have, budget * (hit.w / weight));
    if (want <= 0) continue;
    dust.amount[hit.index] = have - want;
    const spark = sparkleMul(hit.index) > 1;
    taken += want;
    worth += want * cellValue(hit.index);
    if (spark) sparks += 1;
  }
  return { taken, worth, sparks };
}

export function bulkClean(dust, biome, mass) {
  let total = 0;
  const data = dust.amount;
  for (let i = 0; i < data.length; i++) if (biome < 0 || cellBiome[i] === biome) total += data[i];
  if (total <= 0 || mass <= 0) return 0;
  const take = Math.min(mass, total);
  const keep = (total - take) / total;
  let worth = 0;
  for (let i = 0; i < data.length; i++) {
    if (biome >= 0 && cellBiome[i] !== biome) continue;
    const removed = data[i] * (1 - keep);
    data[i] *= keep;
    worth += removed * cellValue(i);
  }
  return { mass: take, worth };
}

export function bestDustyBiome(dust) {
  let best = -1;
  let bestScore = -1;
  for (let b = 0; b < BIOMES.length; b++) {
    const rem = biomeRemaining(dust, b);
    if (rem < 8) continue;
    const score = rem * BIOMES[b].price;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

export function randomDustyPoint(dust, biome) {
  let guard = 0;
  while (guard++ < 40) {
    const index = (Math.random() * dust.amount.length) | 0;
    if (biome >= 0 && cellBiome[index] !== biome) continue;
    if (dust.amount[index] < 8) continue;
    return surface({
      x: cellDir[index * 3],
      y: cellDir[index * 3 + 1],
      z: cellDir[index * 3 + 2],
    });
  }
  return surface(HOME);
}

export function geodesic(a, b) {
  return angle(a, b) * RADIUS;
}

export function homeSurface() {
  return surface(HOME);
}

export function spawnNearHome(distance) {
  const home = homeSurface();
  const frame = basis(home, 0.4);
  const pos = { x: home.x, y: home.y, z: home.z };
  moveAlong(pos, frame.forward, distance);
  return pos;
}

export function rockField() {
  const rocks = [];
  for (let i = 0; i < 70; i++) {
    const dir = norm({
      x: lattice(i, 2, 8),
      y: lattice(i, 5, 1),
      z: lattice(i, 9, 4),
    });
    if (angle(dir, HOME) < 0.12) continue;
    if (Math.abs(dot(dir, CANYON)) < 0.05) continue;
    const spot = surface(dir);
    rocks.push({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      s: 0.55 + (i % 5) * 0.18,
      rot: lattice(i, 3, 3) * Math.PI,
      up: surfaceNormal(dir),
    });
  }
  return rocks;
}

export const MESH_SEG = 42;
let meshPos = null;

function buildMeshCache() {
  if (meshPos) return;
  const seg = MESH_SEG;
  const n = seg + 1;
  meshPos = new Float32Array(6 * n * n * 3);
  for (let face = 0; face < 6; face++) {
    const grid = faceGrid(face, seg);
    meshPos.set(grid.positions, face * n * n * 3);
  }
}

function triPoint(face, i, j) {
  const n = MESH_SEG + 1;
  const k = (face * n * n + j * n + i) * 3;
  return { x: meshPos[k], y: meshPos[k + 1], z: meshPos[k + 2] };
}

function rayOnTriangle(dir, p0, p1, p2) {
  const e1 = sub(p1, p0);
  const e2 = sub(p2, p0);
  const h = cross(dir, e2);
  const a = dot(e1, h);
  if (Math.abs(a) < 1e-8) return null;
  const f = 1 / a;
  const s = f * dot({ x: -p0.x, y: -p0.y, z: -p0.z }, h);
  if (s < -0.02 || s > 1.02) return null;
  const q = cross({ x: -p0.x, y: -p0.y, z: -p0.z }, e1);
  const u = f * dot(dir, q);
  if (u < -0.02 || s + u > 1.04) return null;
  const t = f * dot(e2, q);
  if (t < RADIUS * 0.4) return null;
  return scale(dir, t);
}

export function meshSurface(dir) {
  buildMeshCache();
  const seg = MESH_SEG;
  const map = cubeMap(dir);
  const fu = Math.min(seg - 0.0001, map.u * seg);
  const fv = Math.min(seg - 0.0001, map.v * seg);
  const i = Math.floor(fu);
  const j = Math.floor(fv);
  const tu = fu - i;
  const tv = fv - j;
  const p00 = triPoint(map.face, i, j);
  const p10 = triPoint(map.face, i + 1, j);
  const p01 = triPoint(map.face, i, j + 1);
  const p11 = triPoint(map.face, i + 1, j + 1);
  const unit = norm(dir);
  const hit = tu + tv <= 1
    ? rayOnTriangle(unit, p00, p01, p10)
    : rayOnTriangle(unit, p10, p01, p11);
  return hit || surface(dir);
}

export function faceGrid(face, seg) {
  const count = (seg + 1) * (seg + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(seg * seg * 6);
  let v = 0;
  for (let j = 0; j <= seg; j++) {
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const vv = j / seg;
      const dir = faceDir(face, u * 2 - 1, vv * 2 - 1);
      const point = surface(dir);
      const nrm = surfaceNormal(dir);
      positions[v * 3] = point.x;
      positions[v * 3 + 1] = point.y;
      positions[v * 3 + 2] = point.z;
      normals[v * 3] = nrm.x;
      normals[v * 3 + 1] = nrm.y;
      normals[v * 3 + 2] = nrm.z;
      const hex = BIOMES[biomeIndex(dir)].color;
      const rgb = hexToRgb(hex);
      colors[v * 3] = rgb[0];
      colors[v * 3 + 1] = rgb[1];
      colors[v * 3 + 2] = rgb[2];
      uvs[v * 2] = u;
      uvs[v * 2 + 1] = vv;
      v += 1;
    }
  }
  let t = 0;
  const row = seg + 1;
  for (let j = 0; j < seg; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * row + i;
      indices[t++] = a;
      indices[t++] = a + row;
      indices[t++] = a + 1;
      indices[t++] = a + 1;
      indices[t++] = a + row;
      indices[t++] = a + row + 1;
    }
  }
  return { positions, normals, colors, uvs, indices };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

fillCells();
