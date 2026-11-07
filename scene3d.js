import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as Planet from "./planet.js";

// Motions are in cycles of the arm. Scrub is a fast little brush, sweep is a
// side-to-side broom stroke, push is the vacuum going out and back.
const TOOL_MOTION = {
  brush: { style: "scrub", freq: 8.5, pitch: 0.38, roll: 0.72 },
  broom: { style: "sweep", freq: 3.1, pitch: 0.22, roll: 0.85 },
  mop: { style: "sweep", freq: 2.6, pitch: 0.2, roll: 0.78 },
  vac: { style: "push", freq: 2.5, pitch: 0.62, roll: 0.08 },
  ind: { style: "push", freq: 2.2, pitch: 0.55, roll: 0.06 },
  turbo: { style: "sweep", freq: 3.6, pitch: 0.28, roll: 0.7 },
  cyclone: { style: "push", freq: 2.4, pitch: 0.58, roll: 0.1 },
  plasma: { style: "sweep", freq: 2.8, pitch: 0.24, roll: 0.72 },
  grav: { style: "push", freq: 2.1, pitch: 0.5, roll: 0.12 },
  comet: { style: "push", freq: 2.7, pitch: 0.6, roll: 0.1 },
  aurora: { style: "sweep", freq: 2.4, pitch: 0.2, roll: 0.66 },
};

export function toolMotion(id) {
  return TOOL_MOTION[id] || TOOL_MOTION.broom;
}

export function sweepCycle(id, time, cleaning) {
  const motion = toolMotion(id);
  const freq = motion.freq * (cleaning ? 1 : 0.5);
  return (time * freq) / Math.PI;
}

const FLOWER_MAX = 480;

function flowerHash(i) {
  let n = (i + 1) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const MODEL_FILES = [
  "tool_brush", "tool_broom", "tool_mop", "tool_vac", "tool_ind",
  "tool_turbo", "tool_cyclone", "tool_plasma", "tool_grav", "tool_comet", "tool_aurora",
  "ship", "lander", "rocket",
  "vehicle_pyh", "vehicle_blin", "vehicle_iskra",
  "robot_chistik", "robot_beetle", "robot_drone", "robot_caravan",
  "prop_rock", "prop_crater", "prop_dish", "prop_dome", "prop_hut",
  "prop_airlock", "prop_crystals", "prop_flag", "prop_cactus",
];

const ROBOT_FILE = {
  chistik: "robot_chistik",
  beetle: "robot_beetle",
  drone: "robot_drone",
  caravan: "robot_caravan",
};

const TERRAIN_VERT = `
  uniform sampler2D dustMap;
  in vec3 color;
  flat out vec3 vNormal;
  out vec3 vColor;
  out vec2 vUv;
  out vec3 vWorld;
  out float vDust;
  void main() {
    vUv = uv;
    vColor = color;
    float dust = texture(dustMap, uv).a;
    vDust = dust;
    vec3 displaced = position + normal * dust * 0.48;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const TERRAIN_FRAG = `
  precision highp float;
  uniform sampler2D dustMap;
  uniform vec3 sunDir;
  uniform vec3 skyColor;
  uniform vec3 groundBounce;
  uniform vec3 cameraPos;
  flat in vec3 vNormal;
  in vec3 vColor;
  in vec2 vUv;
  in vec3 vWorld;
  in float vDust;
  out vec4 fragColor;
  float grain(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  void main() {
    float dust = texture(dustMap, vUv).a;
    float speckle = grain(floor(vUv * vec2(48.0, 36.0)));
    vec3 dustCol = vec3(0.78, 0.68, 0.52) * (0.94 + 0.08 * speckle);
    vec3 cleanCol = mix(vec3(0.55, 0.28, 0.18), vColor, 0.45);
    float cover = smoothstep(0.05, 0.2, dust);
    vec3 albedo = mix(cleanCol, dustCol, cover);
    float edge = smoothstep(0.06, 0.14, dust) * (1.0 - smoothstep(0.22, 0.4, dust));
    albedo = mix(albedo, vec3(0.93, 0.84, 0.68), edge * 0.55);
    vec3 n = normalize(vNormal);
    float ndl = dot(n, normalize(sunDir)) * 0.35 + 0.65;
    float hemi = n.y * 0.22 + 0.78;
    vec3 light = mix(groundBounce, skyColor, hemi) * 0.72 + vec3(1.0, 0.93, 0.82) * ndl * 0.38;
    vec3 colorOut = albedo * light;
    fragColor = vec4(colorOut, 1.0);
  }
`;

function upperBodyClip(clip) {
  const tracks = clip.tracks.filter((track) => {
    const bone = track.name.toLowerCase();
    if (/hips|thigh|shin|foot|toe|root/.test(bone)) return false;
    return /spine|neck|head|arm|hand|shoulder|finger|f_|thumb/.test(bone);
  });
  return new THREE.AnimationClip("SweepUpper", clip.duration, tracks);
}

function findNamed(root, name) {
  let found = null;
  root.traverse((obj) => {
    if (obj.name === name) found = obj;
  });
  return found;
}

function rememberRest(root) {
  root.traverse((obj) => {
    obj.userData.rest = obj.quaternion.clone();
  });
}

function toSurface(root) {
  const convert = (material) => {
    const named = material.name || "";
    const color = material.color ? material.color.clone() : new THREE.Color(0xffffff);
    return new THREE.MeshLambertMaterial({
      name: named,
      color,
      map: material.map || null,
      emissive: new THREE.Color(0x000000),
      flatShading: true,
    });
  };
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    obj.material = Array.isArray(obj.material) ? obj.material.map(convert) : convert(obj.material);
    obj.castShadow = true;
    obj.receiveShadow = false;
  });
}

function freezeHierarchy(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const shift = new THREE.Matrix4().makeTranslation(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2,
  );
  const worlds = new Map();
  root.traverse((obj) => worlds.set(obj, obj.matrixWorld.clone()));
  root.position.set(0, 0, 0);
  root.quaternion.identity();
  root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  root.traverse((obj) => {
    if (obj === root) return;
    const parentInv = obj.parent.matrixWorld.clone().invert();
    const local = parentInv.multiply(worlds.get(obj).clone().premultiply(shift));
    local.decompose(obj.position, obj.quaternion, obj.scale);
    obj.updateMatrixWorld(true);
  });
}

function orientUp(object, normal, forwardHint) {
  const up = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
  const hint = forwardHint.clone().addScaledVector(up, -forwardHint.dot(up));
  if (hint.lengthSq() < 1e-8) hint.crossVectors(up, new THREE.Vector3(1, 0, 0));
  hint.normalize();
  const right = new THREE.Vector3().crossVectors(up, hint).normalize();
  const m = new THREE.Matrix4().makeBasis(right, up, hint);
  object.quaternion.setFromRotationMatrix(m);
}

export async function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7d3b4);
  scene.fog = new THREE.Fog(0xe4c9a8, 12, 78);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.12, 1400);
  const hemi = new THREE.HemisphereLight(0xf3e2c8, 0xa87858, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 0.55);
  sun.castShadow = false;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.4;
  sun.shadow.camera.far = 36;
  const shadowReach = 12;
  sun.shadow.camera.left = -shadowReach;
  sun.shadow.camera.right = shadowReach;
  sun.shadow.camera.top = shadowReach;
  sun.shadow.camera.bottom = -shadowReach;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xf6e6cf, 0.35);
  scene.add(fill);

  const roseTex = await new THREE.TextureLoader().loadAsync("assets/rose-bloom.png");
  roseTex.colorSpace = THREE.SRGBColorSpace;
  roseTex.anisotropy = 4;
  const roseAspect = roseTex.image ? roseTex.image.width / Math.max(1, roseTex.image.height) : 1;
  const roseGeo = new THREE.PlaneGeometry(1, 1);
  roseGeo.translate(0, 0.5, 0);
  const roseMesh = new THREE.InstancedMesh(
    roseGeo,
    new THREE.MeshBasicMaterial({
      map: roseTex,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      depthWrite: true,
    }),
    FLOWER_MAX,
  );
  roseMesh.count = 0;
  roseMesh.frustumCulled = false;
  scene.add(roseMesh);
  const flowers = [];
  const flowerByIndex = new Map();
  let flowerStamp = -1;
  let flowerGarden = -1;
  const flowerMatrix = new THREE.Matrix4();

  const loader = new GLTFLoader();
  const templates = {};
  let faceLocal = new THREE.Vector3(0, 0.2, -1);
  let skinIndex = -1;
  await Promise.all(MODEL_FILES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
      const root = gltf.scene;
      if (name === "janitor") skinIndex = materialSlot(root, "visor", /skin/i);
      toSurface(root);
      if (!name.startsWith("tool_")) freezeHierarchy(root);
      if (name === "janitor") faceLocal = measureFace(root, skinIndex);
      rememberRest(root);
      templates[name] = root;
    } catch (err) {
      console.error("Не загрузилась модель", name, err);
      throw err;
    }
  }));

  function cloneModel(name) {
    const src = templates[name];
    if (!src) return new THREE.Group();
    const obj = src.clone(true);
    rememberRest(obj);
    return obj;
  }

  const sunDir = new THREE.Vector3(0.35, 0.82, 0.45).normalize();
  const terrainMat = [];
  const dustTextures = [];
  const dustData = [];
  const seg = Planet.MESH_SEG;
  for (let face = 0; face < 6; face++) {
    const grid = Planet.faceGrid(face, seg);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(grid.positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(grid.normals, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(grid.colors, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(grid.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(grid.indices, 1));
    const data = new Uint8Array(Planet.DUST_N * Planet.DUST_N * 4);
    const texture = new THREE.DataTexture(data, Planet.DUST_N, Planet.DUST_N);
    texture.colorSpace = THREE.NoColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        dustMap: { value: texture },
        sunDir: { value: sunDir },
        skyColor: { value: new THREE.Color(0xe7d3b4) },
        groundBounce: { value: new THREE.Color(0xa07858) },
        cameraPos: { value: new THREE.Vector3() },
      },
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    scene.add(mesh);
    terrainMat.push(mat);
    dustTextures.push(texture);
    dustData.push(data);
  }

  const rockGeoSource = templates.prop_rock.getObjectByProperty("type", "Mesh") || templates.prop_rock;
  let rockMesh = null;
  templates.prop_rock.traverse((obj) => {
    if (obj.isMesh && !rockMesh) rockMesh = obj;
  });
  const rocks = Planet.rockField();
  let rockInstances = null;
  if (rockMesh) {
    rockInstances = new THREE.InstancedMesh(rockMesh.geometry, rockMesh.material, rocks.length);
    rockInstances.castShadow = false;
    rockInstances.receiveShadow = true;
    const dummy = new THREE.Object3D();
    rocks.forEach((rock, i) => {
      dummy.position.set(rock.x, rock.y, rock.z);
      orientUp(dummy, rock.up, new THREE.Vector3(1, 0, 0));
      dummy.rotateY(rock.rot);
      dummy.scale.setScalar(rock.s);
      dummy.updateMatrix();
      rockInstances.setMatrixAt(i, dummy.matrix);
    });
    rockInstances.instanceMatrix.needsUpdate = true;
    scene.add(rockInstances);
  }

  const landmarks = [
    { file: "prop_airlock", dir: Planet.norm(Planet.add(Planet.HOME, { x: 0.22, y: 0.05, z: 0.02 })), yaw: 0.4 },
    { file: "prop_dish", dir: Planet.norm(Planet.add(Planet.HOME, { x: -0.16, y: 0.12, z: 0.05 })), yaw: 1.2 },
    { file: "prop_dome", dir: Planet.norm({ x: 0.4, y: -0.15, z: 0.9 }), yaw: 0.2 },
    { file: "prop_hut", dir: Planet.norm({ x: -0.55, y: 0.2, z: 0.8 }), yaw: 2.1 },
    { file: "prop_crystals", dir: Planet.norm({ x: 0.1, y: 0.55, z: 0.83 }), yaw: 0.6 },
    { file: "prop_flag", dir: Planet.norm(Planet.add(Planet.HOME, { x: 0.08, y: -0.02, z: 0.01 })), yaw: 0.8 },
  ];
  for (const mark of landmarks) {
    const obj = cloneModel(mark.file);
    const spot = Planet.surface(mark.dir);
    obj.position.set(spot.x, spot.y, spot.z);
    orientUp(obj, Planet.surfaceNormal(mark.dir), new THREE.Vector3(mark.dir.z, 0, -mark.dir.x));
    obj.rotateY(mark.yaw);
    const cap = mark.file === "prop_flag" || mark.file === "prop_crystals" ? 1.6 : 4.5;
    fitInside(obj, cap);
    scene.add(obj);
  }

  const player = new THREE.Group();
  const sweeperGltf = await loader.loadAsync("assets/models/sweeper.glb");
  const janitor = sweeperGltf.scene;
  toSurface(janitor);
  janitor.traverse((obj) => {
    if (!obj.isSkinnedMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) mat.skinning = true;
  });
  // The rig's face and the jog clip both point along local +Z, which is the player's movement axis.
  player.add(janitor);
  scene.add(player);
  const hand = findNamed(janitor, "DEF-handR") || findNamed(janitor, "DEF-hand.R") || janitor;
  const mixer = new THREE.AnimationMixer(janitor);
  const byName = {};
  for (const clip of sweeperGltf.animations) byName[clip.name] = clip;
  const locoClips = {
    idle: byName.Idle_Loop,
    walk: byName.Walk_Loop,
    run: byName.Jog_Fwd_Loop,
  };
  const locoActions = {};
  for (const [name, clip] of Object.entries(locoClips)) {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.enabled = true;
    action.play();
    action.setEffectiveWeight(name === "idle" ? 1 : 0);
    locoActions[name] = action;
  }
  let locoName = "idle";
  const sweepAction = mixer.clipAction(upperBodyClip(byName.Sword_Attack));
  sweepAction.setLoop(THREE.LoopRepeat, Infinity);
  sweepAction.play();
  sweepAction.setEffectiveWeight(0);
  let sweepWeight = 0;
  let toolMesh = null;
  let toolId = "";
  let rideMesh = null;
  let rideId = null;

  const footShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 24),
    new THREE.MeshBasicMaterial({ color: 0x6a4634, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  footShadow.renderOrder = 1;
  scene.add(footShadow);
  const rim = new THREE.DirectionalLight(0xf3e6cf, 0.28);
  rim.position.set(-8, 5, -6);
  scene.add(rim);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 28),
    new THREE.MeshBasicMaterial({ color: 0xfff6ea, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  scene.add(ring);

  const puffGeo = new THREE.SphereGeometry(0.07, 5, 4);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xe7b089 });
  const puffs = [];
  for (let i = 0; i < 70; i++) {
    const mesh = new THREE.Mesh(puffGeo, puffMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    puffs.push(mesh);
  }
  const floaterSprites = [];
  const depots = [];
  const bots = [];
  let dustStamp = "";
  let camHold = null;
  const _quat = new THREE.Quaternion();
  const _v = new THREE.Vector3();

  function cloneModel(name) {
    const src = templates[name];
    if (!src) return new THREE.Group();
    const obj = src.clone(true);
    rememberRest(obj);
    return obj;
  }

  function fitInside(obj, maxSize) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    if (maxDim > maxSize) obj.scale.multiplyScalar(maxSize / maxDim);
    obj.updateMatrixWorld(true);
    const grounded = new THREE.Box3().setFromObject(obj);
    obj.position.add(new THREE.Vector3(0, 1, 0).applyQuaternion(obj.quaternion).multiplyScalar(-grounded.min.y * 0 + 0));
  }

  function plantFlower(index, anim) {
    const dir = {
      x: Planet.cellDir[index * 3],
      y: Planet.cellDir[index * 3 + 1],
      z: Planet.cellDir[index * 3 + 2],
    };
    const yaw = flowerHash(index + 17) * Math.PI * 2;
    const j1 = flowerHash(index + 101) - 0.5;
    const j2 = flowerHash(index + 307) - 0.5;
    const base = Planet.meshSurface(dir);
    const wander = Planet.basis(base, yaw);
    const spot = { x: base.x, y: base.y, z: base.z };
    Planet.moveAlong(spot, {
      x: wander.right.x * j1 + wander.forward.x * j2,
      y: wander.right.y * j1 + wander.forward.y * j2,
      z: wander.right.z * j1 + wander.forward.z * j2,
    }, 0.35 + Math.abs(j1) * 1.35);
    return {
      index,
      born: anim,
      size: 0.42 + flowerHash(index + 503) * 0.32,
      spin: yaw,
      x: spot.x,
      y: spot.y,
      z: spot.z,
    };
  }

  function syncFlowers(dust, garden, anim) {
    const chance = Math.min(0.55, 0.16 + garden * 0.035);
    const cap = Math.min(FLOWER_MAX, 80 + garden * 32);
    const amount = dust.amount;
    const bag = [];
    for (let i = 0; i < amount.length; i++) {
      if (amount[i] > 5) continue;
      const h = flowerHash(i);
      if (h > chance) continue;
      if (bag.length < cap) {
        bag.push(i);
        if (bag.length === cap) bag.sort((a, b) => flowerHash(a) - flowerHash(b));
      } else if (h < flowerHash(bag[cap - 1])) {
        let lo = 0;
        let hi = cap - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (flowerHash(bag[mid]) < h) lo = mid + 1;
          else hi = mid;
        }
        bag.splice(lo, 0, i);
        bag.pop();
      }
    }
    flowers.length = 0;
    const keep = new Set();
    for (const index of bag) {
      let rec = flowerByIndex.get(index);
      if (!rec) rec = plantFlower(index, anim);
      flowerByIndex.set(index, rec);
      flowers.push(rec);
      keep.add(index);
    }
    if (flowerByIndex.size !== keep.size) {
      for (const index of flowerByIndex.keys()) {
        if (!keep.has(index)) flowerByIndex.delete(index);
      }
    }
    roseMesh.count = flowers.length;
  }

  function poseFlowers(anim) {
    const cam = camera.position;
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      const age = Math.max(0, anim - f.born);
      const t = Math.min(1, age / 0.85);
      const e = t * t * (3 - 2 * t);
      const pop = e * (1 + Math.sin(e * Math.PI) * 0.12);
      const lean = Math.sin(anim * 1.35 + f.spin) * 0.12 * e;
      const h = f.size * pop;
      const w = h * roseAspect;
      const up = _v.set(f.x, f.y, f.z).normalize();
      const px = f.x;
      const py = f.y;
      const pz = f.z;
      const toCamX = cam.x - px;
      const toCamY = cam.y - py;
      const toCamZ = cam.z - pz;
      let rx = up.y * toCamZ - up.z * toCamY;
      let ry = up.z * toCamX - up.x * toCamZ;
      let rz = up.x * toCamY - up.y * toCamX;
      let rl = Math.hypot(rx, ry, rz);
      if (rl < 1e-5) {
        rx = up.y;
        ry = -up.x;
        rz = 0;
        rl = Math.hypot(rx, ry, rz) || 1;
      }
      rx /= rl;
      ry /= rl;
      rz /= rl;
      const ux = up.x * Math.cos(lean) + rx * Math.sin(lean);
      const uy = up.y * Math.cos(lean) + ry * Math.sin(lean);
      const uz = up.z * Math.cos(lean) + rz * Math.sin(lean);
      let fx = uy * rz - uz * ry;
      let fy = uz * rx - ux * rz;
      let fz = ux * ry - uy * rx;
      const fl = Math.hypot(fx, fy, fz) || 1;
      fx /= fl;
      fy /= fl;
      fz /= fl;
      flowerMatrix.set(
        rx * w, ux * h, fx, px,
        ry * w, uy * h, fy, py,
        rz * w, uz * h, fz, pz,
        0, 0, 0, 1,
      );
      roseMesh.setMatrixAt(i, flowerMatrix);
    }
    if (flowers.length) roseMesh.instanceMatrix.needsUpdate = true;
  }

  function paintDust(dust) {
    const maxCell = 140;
    for (let face = 0; face < 6; face++) {
      const data = dustData[face];
      const base = face * Planet.CELLS;
      for (let i = 0; i < Planet.CELLS; i++) {
        const amount = dust.amount[base + i];
        const spark = Planet.sparkleMul(base + i) > 1 && amount > 6;
        const t = Math.max(0, Math.min(1, amount / maxCell));
        const o = i * 4;
        if (spark) {
          data[o] = 255;
          data[o + 1] = 196;
          data[o + 2] = 70;
        } else {
          data[o] = 170;
          data[o + 1] = 92;
          data[o + 2] = 48;
        }
        data[o + 3] = Math.round(t * 255);
      }
      dustTextures[face].needsUpdate = true;
    }
  }

  function placeUpright(object, pos, headingForward, radial) {
    object.position.set(pos.x, pos.y, pos.z);
    const n = radial ? Planet.up(pos) : Planet.surfaceNormal(pos);
    const forward = headingForward || new THREE.Vector3(pos.z, 0, -pos.x).normalize();
    orientUp(object, n, forward);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(2, rect.width);
    const height = Math.max(2, rect.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function ensureTool(id) {
    if (toolId === id && toolMesh) return;
    if (toolMesh) hand.remove(toolMesh);
    toolMesh = cloneModel("tool_" + id);
    seatTool(toolMesh);
    hand.add(toolMesh);
    toolId = id;
  }

  function ensureRide(id) {
    if (rideId === id) return;
    if (rideMesh) player.remove(rideMesh);
    rideMesh = null;
    rideId = id;
    if (!id) return;
    rideMesh = cloneModel("vehicle_" + id);
    player.add(rideMesh);
  }

  function syncDepots(list, rockets) {
    while (depots.length < list.length) {
      const mesh = cloneModel(depots.length === 0 ? "ship" : "lander");
      scene.add(mesh);
      depots.push(mesh);
    }
    while (depots.length > list.length) scene.remove(depots.pop());
    const launch = rockets[rockets.length - 1];
    list.forEach((depot, i) => {
      const mesh = depots[i];
      const pos = { x: depot.x, y: depot.y, z: depot.z };
      placeUpright(mesh, pos, new THREE.Vector3(pos.z, 0, -pos.x));
      const liftSource = launch && Planet.geodesic(launch, depot) < 8 ? launch : null;
      const age = liftSource ? liftSource.age : 0;
      const life = liftSource ? liftSource.life : 1;
      const lift = liftSource ? Math.sin(Math.min(1, age / life) * Math.PI) * (i === 0 ? 26 : 16) : 0;
      const n = Planet.up(pos);
      mesh.position.add(new THREE.Vector3(n.x, n.y, n.z).multiplyScalar(lift));
      mesh.traverse((obj) => {
        if (obj.name.startsWith("flame")) {
          obj.visible = lift > 0.4;
          obj.scale.y = 0.6 + lift * 0.15;
        }
      });
    });
  }

  function render(frame) {
    const { state, robots, particles, floaters, rockets, anim, shake, frameStats, frameMoving, frameCleaning, reduceMotion } = frame;
    if (state.dust) {
      const stamp = state.dust.stamp | 0;
      const garden = state.garden | 0;
      if (stamp !== dustStamp) {
        paintDust(state.dust);
        dustStamp = stamp;
      }
      if (stamp !== flowerStamp || garden !== flowerGarden) {
        syncFlowers(state.dust, garden, anim);
        flowerStamp = stamp;
        flowerGarden = garden;
      }
    }
    ensureTool(frameStats.tool.id);
    ensureRide(state.riding);
    const pos = state.pos;
    const frameBasis = Planet.basis(pos, state.heading || 0);
    placeUpright(player, pos, new THREE.Vector3(frameBasis.forward.x, frameBasis.forward.y, frameBasis.forward.z), true);
    timeDelta = Math.max(0.001, Math.min(0.05, frame.dt || 1 / 60));
    stateRiding = !!state.riding;
    const lean = Math.max(-0.18, Math.min(0.18, (state.turnRate || 0) * 0.08));
    janitor.rotation.z = lean * 0.35;
    janitor.rotation.x = 0;
    janitor.position.y = stateRiding ? 0.55 : 0;
    driveSweeper(frameCleaning, reduceMotion, state.glide || 0, anim);
    if (footShadow) {
      footShadow.position.set(pos.x, pos.y, pos.z);
      const n = Planet.up(pos);
      footShadow.position.add(new THREE.Vector3(n.x, n.y, n.z).multiplyScalar(0.04));
      footShadow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n.x, n.y, n.z));
    }
    if (rideMesh) {
      const spin = anim * (frameMoving ? 9 : 1.5);
      rideMesh.traverse((obj) => {
        if (obj.name.startsWith("wheel_") && !obj.name.includes("hub")) obj.rotation.x = spin;
      });
    }

    const radius = Math.max(0.8, frameStats.radius / 30);
    const nrm = Planet.surfaceNormal(pos);
    const radial = Planet.up(pos);
    ring.position.set(pos.x, pos.y, pos.z);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nrm.x, nrm.y, nrm.z));
    ring.scale.setScalar(radius);
    ring.material.opacity = frameCleaning ? 0.75 : 0.28;

    syncDepots(frame.depots, rockets);

    while (bots.length < robots.length) {
      const mesh = cloneModel(ROBOT_FILE[robots[bots.length].type] || "robot_chistik");
      scene.add(mesh);
      bots.push(mesh);
    }
    while (bots.length > robots.length) scene.remove(bots.pop());
    robots.forEach((robot, i) => {
      const mesh = bots[i];
      const hover = robot.type === "drone" ? 0.45 : 0;
      const spot = { x: robot.x, y: robot.y, z: robot.z };
      placeUpright(mesh, spot, new THREE.Vector3((robot.tx || robot.x) - robot.x, (robot.ty || robot.y) - robot.y, (robot.tz || robot.z) - robot.z), true);
      const up = Planet.up(spot);
      mesh.position.add(new THREE.Vector3(up.x, up.y, up.z).multiplyScalar(hover + Math.sin(anim * 5 + i) * 0.04));
      const rotor = findNamed(mesh, "rotor");
      if (rotor) rotor.rotation.y = anim * 14;
      swing(findNamed(mesh, "leg_l"), Math.sin(anim * 7 + i) * 0.45);
      swing(findNamed(mesh, "leg_r"), -Math.sin(anim * 7 + i) * 0.45);
    });

    particles.forEach((particle, i) => {
      const mesh = puffs[i];
      if (!mesh) return;
      const life = 1 - particle.age / particle.life;
      mesh.visible = life > 0;
      mesh.position.set(particle.x, particle.y, particle.z);
      mesh.scale.setScalar(Math.max(0.12, (particle.size || 4) * 0.08) * Math.max(0.35, life));
    });
    for (let i = particles.length; i < puffs.length; i++) puffs[i].visible = false;

    while (floaterSprites.length < floaters.length) {
      const sprite = textSprite(floaters[floaterSprites.length].text, floaters[floaterSprites.length].color || "#3a2018");
      scene.add(sprite);
      floaterSprites.push(sprite);
    }
    floaterSprites.forEach((sprite, i) => {
      const floater = floaters[i];
      if (!floater) {
        sprite.visible = false;
        return;
      }
      sprite.visible = true;
      const up = Planet.up(floater);
      sprite.position.set(
        floater.x + up.x * (1.6 + floater.age),
        floater.y + up.y * (1.6 + floater.age),
        floater.z + up.z * (1.6 + floater.age),
      );
      sprite.material.opacity = Math.max(0, 1 - floater.age / floater.life);
    });

    const focus = new THREE.Vector3(pos.x, pos.y, pos.z);
    const back = new THREE.Vector3(frameBasis.forward.x, frameBasis.forward.y, frameBasis.forward.z);
    const up = new THREE.Vector3(radial.x, radial.y, radial.z);
    let desired;
    let look;
    if (state.overview) {
      desired = new THREE.Vector3(0.55, 0.82, 1).normalize().multiplyScalar(Planet.RADIUS * 3.45);
      look = new THREE.Vector3(0, 0, 0);
      scene.fog.near = 2000;
      scene.fog.far = 2600;
    } else {
      const orbit = Planet.basis(pos, state.camYaw || 0);
      const ahead = new THREE.Vector3(orbit.forward.x, orbit.forward.y, orbit.forward.z);
      const dist = Math.max(1.6, state.camDist || 4.2);
      const pitch = state.camPitch == null ? 0.5 : state.camPitch;
      desired = focus.clone()
        .addScaledVector(ahead, -Math.cos(pitch) * dist)
        .addScaledVector(up, Math.sin(pitch) * dist);
      look = focus.clone().addScaledVector(ahead, Math.min(1.5, dist * 0.2)).addScaledVector(up, 0.62);
      scene.fog.near = 10 + dist * 1.4;
      scene.fog.far = 42 + dist * 9;
    }
    if (!reduceMotion && shake > 0 && !state.overview) {
      desired.x += Math.sin(anim * 40) * shake * 0.02;
    }
    const dt = Math.max(0.001, Math.min(0.05, frame.dt || 1 / 60));
    const gap = camera.position.distanceTo(desired);
    const snap = gap > 50 || !camHold;
    const follow = snap ? 1 : 1 - Math.exp(-5.2 * dt);
    const roll = snap ? 1 : 1 - Math.exp(-3.6 * dt);
    const desiredUp = state.overview ? new THREE.Vector3(0, 1, 0) : up;
    if (!camHold) camHold = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
    camHold.pos.lerp(desired, follow);
    camHold.look.lerp(look, follow);
    camHold.up.lerp(desiredUp, roll).normalize();
    camera.position.copy(camHold.pos);
    camera.up.copy(camHold.up);
    camera.lookAt(camHold.look);
    for (const mat of terrainMat) mat.uniforms.cameraPos.value.copy(camera.position);
    sun.position.copy(focus).add(new THREE.Vector3(8, 14, 6));
    sun.target.position.copy(focus);
    fill.position.copy(camera.position);
    if (handView) frameHand();
    if (flowers.length) poseFlowers(anim);
    renderer.render(scene, camera);
  }

  let handView = null;
  function frameHand() {
    const palm = new THREE.Vector3();
    hand.getWorldPosition(palm);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(player.quaternion).normalize();
    const side = new THREE.Vector3(1, 0, 0).applyQuaternion(player.quaternion).normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.quaternion).normalize();
    const eye = palm.clone().addScaledVector(up, 0.08);
    if (handView === "side") eye.addScaledVector(side, 0.7);
    else eye.addScaledVector(forward, 0.72);
    camera.position.copy(eye);
    camera.up.copy(up);
    camera.lookAt(palm);
    camera.updateMatrixWorld();
  }

  function headForward(target) {
    const head = findNamed(janitor, "DEF-head");
    if (!head) return target.set(0, 0, 1);
    head.updateWorldMatrix(true, false);
    return target.set(0, 0, 1).applyQuaternion(head.getWorldQuaternion(_quat));
  }

  function faceDot(forward) {
    const face = headForward(new THREE.Vector3());
    const radial = player.position.clone().normalize();
    face.addScaledVector(radial, -face.dot(radial));
    if (face.lengthSq() < 1e-8) return 0;
    const wish = _v.set(forward.x, forward.y, forward.z).normalize();
    return face.normalize().dot(wish);
  }

  function runFootForward() {
    const foot = findNamed(janitor, "DEF-footR") || findNamed(janitor, "DEF-foot.R");
    const run = locoActions.run;
    if (!foot || !run) return 0;
    const saved = mixer._actions.map((action) => ({
      action,
      time: action.time,
      weight: action.getEffectiveWeight(),
      enabled: action.enabled,
    }));
    const mixerTime = mixer.time;
    for (const action of mixer._actions) action.setEffectiveWeight(0);
    run.enabled = true;
    run.setEffectiveWeight(1);
    run.play();
    const duration = run.getClip().duration;
    const samples = [];
    for (let i = 0; i <= 24; i++) {
      run.time = (i / 24) * duration;
      mixer.update(0);
      foot.updateWorldMatrix(true, false);
      const point = foot.getWorldPosition(new THREE.Vector3());
      janitor.worldToLocal(point);
      samples.push({ t: run.time, y: point.y, z: point.z });
    }
    mixer.time = mixerTime;
    for (const item of saved) {
      item.action.time = item.time;
      item.action.enabled = item.enabled;
      item.action.setEffectiveWeight(item.weight);
    }
    mixer.update(0);
    let lowest = Infinity;
    for (const sample of samples) lowest = Math.min(lowest, sample.y);
    const planted = samples.filter((sample) => sample.y < lowest + 0.06);
    if (planted.length < 2) return 0;
    const first = planted[0];
    const last = planted[planted.length - 1];
    const dt = last.t - first.t;
    if (Math.abs(dt) < 1e-4) return 0;
    const footZ = (last.z - first.z) / dt;
    // A planted foot slides backward. Travel is the opposite of that slide, along model +Z.
    const travel = -footZ;
    return travel > 0.2 ? 1 : travel < -0.2 ? -1 : 0;
  }

  let lastMixerAnim = null;
  function driveSweeper(cleaning, reduceMotion, glide, anim) {
    const speed = Math.max(0, glide || 0);
    let next = "idle";
    let scale = 1;
    if (!reduceMotion && speed > 2.6) {
      next = "run";
      scale = Math.max(0.7, Math.min(1.5, speed / 5.2));
    } else if (!reduceMotion && speed > 0.22) {
      next = "walk";
      scale = Math.max(0.65, Math.min(1.4, speed / 1.15));
    }
    if (next !== locoName) {
      const prev = locoActions[locoName];
      const action = locoActions[next];
      prev.fadeOut(0.25);
      action.reset().setEffectiveWeight(1).fadeIn(0.25).play();
      locoName = next;
    }
    locoActions[locoName].setEffectiveTimeScale(reduceMotion ? 0.35 : scale);
    const targetSweep = cleaning && !reduceMotion ? 4 : 0;
    sweepWeight += (targetSweep - sweepWeight) * (1 - Math.exp(-timeDelta / 0.25));
    sweepAction.setEffectiveWeight(sweepWeight);
    sweepAction.setEffectiveTimeScale(1);
    if (lastMixerAnim == null) lastMixerAnim = anim;
    const step = Math.max(0, Math.min(0.35, anim - lastMixerAnim));
    lastMixerAnim = anim;
    if (step > 0) mixer.update(step);
  }

  function poseArms(time, toolId, cleaning, moving, reduceMotion, glide) {
    const motion = toolMotion(toolId);
    const acting = cleaning || moving;
    const amp = reduceMotion ? 0.2 : acting ? 1 : 0.22;
    const freq = motion.freq * (acting ? 1 : 0.35);
    const wave = Math.sin(time * freq);
    const sweep = acting && !reduceMotion;
    const twist = sweep ? wave * (motion.roll > 0.4 ? 0.42 : 0.12) * amp : 0;
    twistUpper(twist);
    if (sweep && motion.roll > 0.4) {
      poseArm(armR, 1.05 + wave * 0.18, twist, wave * 1.35 * amp);
      poseArm(findNamed(janitor, "arm_r_fore"), 0.2, 0, 0);
      poseArm(armL, 0.35, twist * 0.6, -wave * 0.45 * amp);
    } else if (sweep) {
      poseArm(armR, 0.85 + wave * motion.pitch, twist, wave * 0.35);
      poseArm(armL, 0.25, twist * 0.4, -wave * 0.15);
    } else {
      const arm = moving ? Math.sin(walkPhase) * 0.55 : Math.sin(time * 1.3) * 0.08;
      poseArm(armR, 0.25 + arm, 0, 0.05);
      poseArm(armL, 0.25 - arm, 0, -0.05);
      const foreR = findNamed(janitor, "arm_r_fore");
      const foreL = findNamed(janitor, "arm_l_fore");
      poseArm(foreR, moving ? 0.35 + Math.max(0, arm) * 0.4 : 0.15, 0, 0);
      poseArm(foreL, moving ? 0.35 + Math.max(0, -arm) * 0.4 : 0.15, 0, 0);
    }
    stepLegs(moving ? glide : 0, time, reduceMotion);
    const bob = moving
      ? Math.abs(Math.sin(walkPhase)) * 0.1
      : Math.sin(time * 1.5) * 0.015;
    janitor.position.y = (stateRiding ? 0.62 : 0) + bob;
    const breathe = 1 + Math.sin(time * 1.6) * (moving ? 0.008 : 0.02);
    const body = findNamed(janitor, "body");
    if (body) body.scale.y = breathe;
  }

  let walkPhase = 0;
  let stateRiding = false;
  function stepLegs(speed, time, reduceMotion) {
    const stride = 0.64;
    if (speed > 0.05 && !reduceMotion) walkPhase += (speed / stride) * timeDelta * Math.PI * 2;
    const swing = reduceMotion ? 0 : Math.sin(walkPhase) * 0.48;
    const knee = (phase) => 0.18 + Math.pow(Math.max(0, Math.sin(phase)), 1.15) * 0.95;
    poseArm(legL, speed > 0.05 ? swing : 0, 0, 0);
    poseArm(legR, speed > 0.05 ? -swing : 0, 0, 0);
    poseArm(findNamed(janitor, "leg_l_shin"), speed > 0.05 ? -knee(walkPhase) : -0.12, 0, 0);
    poseArm(findNamed(janitor, "leg_r_shin"), speed > 0.05 ? -knee(walkPhase + Math.PI) : -0.12, 0, 0);
  }

  let timeDelta = 1 / 60;
  function twistUpper(amount) {
    for (const name of ["body", "chest", "helmet", "visor", "visor_glow", "backpack", "backpack_pad", "shoulder_l", "shoulder_r"]) {
      const part = findNamed(janitor, name);
      if (!part || !part.userData.rest) continue;
      part.quaternion.copy(part.userData.rest);
      part.rotateY(amount);
    }
  }

  resize();
  return {
    resize,
    render,
    modelsLoaded: true,
    planetRadius: Planet.RADIUS,
    faceDot,
    runFootForward,
    toolWorld() {
      if (!toolMesh) return { x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 };
      const p = toolMesh.getWorldPosition(new THREE.Vector3());
      return { x: p.x, y: p.y, z: p.z, px: player.position.x, py: player.position.y, pz: player.position.z };
    },
    flowerCount() {
      return flowers.length;
    },
    gripGap() {
      if (!toolMesh || !hand || !toolMesh.userData.gripLocal) return 1;
      hand.updateWorldMatrix(true, true);
      toolMesh.updateWorldMatrix(true, true);
      const palm = new THREE.Vector3();
      hand.getWorldPosition(palm);
      const grip = toolMesh.userData.gripLocal.clone().applyMatrix4(toolMesh.matrixWorld);
      return grip.distanceTo(palm);
    },
    upAlign() {
      const radial = player.position.clone().normalize();
      const upright = new THREE.Vector3(0, 1, 0).applyQuaternion(player.quaternion);
      return upright.dot(radial);
    },
    focusHand(side) {
      handView = side || null;
    },
    animState() {
      return { loco: locoName, hand: hand.name, time: locoActions[locoName].time };
    },
  };
}

function swing(part, amount) {
  if (!part || !part.userData.rest) return;
  part.quaternion.copy(part.userData.rest);
  part.rotateX(amount);
}

function poseArm(part, pitch, yaw, roll) {
  if (!part || !part.userData.rest) return;
  part.quaternion.copy(part.userData.rest);
  part.rotateZ(roll);
  part.rotateX(pitch);
  part.rotateY(yaw);
}

function materialSlot(root, meshName, pattern) {
  const mesh = findNamed(root, meshName);
  if (!mesh || !mesh.isMesh) return -1;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.findIndex((m) => pattern.test(m.name || ""));
}

function groupCentroid(mesh, slot) {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position");
  const index = geo.getIndex();
  const groups = geo.groups && geo.groups.length
    ? geo.groups
    : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }];
  const acc = new THREE.Vector3();
  const v = new THREE.Vector3();
  let n = 0;
  mesh.updateWorldMatrix(true, false);
  for (const g of groups) {
    if (slot >= 0 && g.materialIndex !== slot) continue;
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = index ? index.getX(i) : i;
      v.fromBufferAttribute(pos, vi).applyMatrix4(mesh.matrixWorld);
      acc.add(v);
      n += 1;
    }
  }
  return n ? acc.multiplyScalar(1 / n) : new THREE.Vector3();
}

function measureFace(root, slot) {
  const visor = findNamed(root, "visor");
  const helmet = findNamed(root, "helmet");
  const body = findNamed(root, "body");
  const faceMesh = visor && visor.isMesh ? visor : helmet;
  if (!faceMesh || !body || !faceMesh.isMesh || !body.isMesh) return new THREE.Vector3(0, 0.2, -1);
  const faceSlot = faceMesh === helmet ? slot : -1;
  return groupCentroid(faceMesh, faceSlot).sub(groupCentroid(body, -1));
}

const SHAFT_NAMES = ["stick", "handle", "pole", "grip"];

function shaftMesh(root) {
  let found = null;
  root.traverse((obj) => {
    if (found || !obj.isMesh) return;
    if (SHAFT_NAMES.includes(obj.name)) found = obj;
  });
  return found;
}

function seatTool(mesh) {
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrixWorld(true);
  const shaft = shaftMesh(mesh) || mesh;
  const box = new THREE.Box3().setFromObject(shaft);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  let axis = 1;
  if (size.x >= size.y && size.x >= size.z) axis = 0;
  else if (size.z > size.y && size.z >= size.x) axis = 2;
  const head = center.clone();
  const tail = center.clone();
  head.setComponent(axis, box.min.getComponent(axis));
  tail.setComponent(axis, box.max.getComponent(axis));
  let headScore = 0;
  let tailScore = 0;
  mesh.traverse((obj) => {
    if (!obj.isMesh || obj === shaft) return;
    const mid = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    headScore += 1 / (mid.distanceTo(head) + 0.05);
    tailScore += 1 / (mid.distanceTo(tail) + 0.05);
  });
  if (tailScore > headScore) {
    const swap = head.clone();
    head.copy(tail);
    tail.copy(swap);
  }
  const length = head.distanceTo(tail) || 1;
  const hold = length < 0.45 ? 0.42 : 0.16;
  const gripLocal = tail.clone().lerp(head, hold);
  const dir = head.clone().sub(tail);
  if (dir.lengthSq() < 1e-8) dir.set(0, -1, 0);
  dir.normalize();
  mesh.quaternion.setFromUnitVectors(dir, new THREE.Vector3(0, 1, 0));
  const parked = gripLocal.clone().applyQuaternion(mesh.quaternion);
  mesh.position.copy(parked).multiplyScalar(-1);
  mesh.userData.gripLocal = gripLocal;
}

function curlFist(handMesh) {
  ["arm_r_finger_0", "arm_r_finger_1", "arm_r_finger_2"].forEach((name, i) => {
    const finger = findNamed(handMesh.parent || handMesh, name) || findNamed(handMesh, name);
    if (!finger) return;
    handMesh.add(finger);
    const spread = (i - 1) * 0.35;
    finger.position.set(Math.sin(spread) * 0.02, (i - 1) * 0.022, 0.086);
    finger.scale.set(1.15, 1.7, 1.15);
    finger.rotation.set(0.35, spread * 0.25, Math.PI / 2);
    finger.userData.rest = finger.quaternion.clone();
  });
}

function textSprite(text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.font = "700 36px sans-serif";
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 34);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false }));
  sprite.scale.set(0.72, 0.18, 1);
  return sprite;
}
