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

const MODEL_FILES = [
  "janitor",
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
  in vec3 color;
  out vec3 vNormal;
  out vec3 vColor;
  out vec2 vUv;
  void main() {
    vUv = uv;
    vColor = color;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TERRAIN_FRAG = `
  precision highp float;
  uniform sampler2D dustMap;
  uniform vec3 sunDir;
  uniform vec3 skyColor;
  uniform vec3 groundBounce;
  in vec3 vNormal;
  in vec3 vColor;
  in vec2 vUv;
  out vec4 fragColor;
  void main() {
    float dust = texture(dustMap, vUv).a;
    vec3 rusty = vec3(0.55, 0.20, 0.07);
    vec3 albedo = mix(vColor, rusty, smoothstep(0.02, 0.4, dust));
    vec3 n = normalize(vNormal);
    float ndl = dot(n, normalize(sunDir)) * 0.5 + 0.5;
    float hemi = n.y * 0.35 + 0.65;
    vec3 light = mix(groundBounce, skyColor, hemi) * 0.55 + vec3(1.0, 0.92, 0.82) * ndl;
    fragColor = vec4(albedo * light, 1.0);
  }
`;

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

function toLambert(root) {
  const convert = (material) => new THREE.MeshLambertMaterial({
    color: material.color ? material.color.clone() : new THREE.Color(0xffffff),
    map: material.map || null,
    emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000),
  });
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7b7c6);
  scene.fog = new THREE.Fog(0xf3b3b8, 90, 340);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.12, 1400);
  const hemi = new THREE.HemisphereLight(0xffd0c2, 0x8a3d28, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2c4, 1.7);
  sun.castShadow = true;
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
  const fill = new THREE.DirectionalLight(0xfff4ea, 0.45);
  scene.add(fill);

  const loader = new GLTFLoader();
  const templates = {};
  let faceLocal = new THREE.Vector3(0, 0.2, -1);
  let skinIndex = -1;
  await Promise.all(MODEL_FILES.map(async (name) => {
    try {
      const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
      const root = gltf.scene;
      if (name === "janitor") skinIndex = materialSlot(root, "helmet", /skin/i);
      toLambert(root);
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
  const seg = 42;
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
        skyColor: { value: new THREE.Color(0xffcabb) },
        groundBounce: { value: new THREE.Color(0x7a3424) },
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
  const janitor = cloneModel("janitor");
  // The visor sits on local -Z. A half turn makes that axis the way the body walks.
  janitor.rotation.y = Math.PI;
  player.add(janitor);
  scene.add(player);
  const legL = findNamed(janitor, "leg_l");
  const legR = findNamed(janitor, "leg_r");
  const armL = findNamed(janitor, "arm_l");
  const armR = findNamed(janitor, "arm_r");
  const socket = findNamed(janitor, "tool_socket") || armR || janitor;
  let toolMesh = null;
  let toolId = "";
  let rideMesh = null;
  let rideId = null;

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

  function placeUpright(object, pos, headingForward) {
    object.position.set(pos.x, pos.y, pos.z);
    const n = Planet.surfaceNormal(pos);
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
    if (toolMesh) socket.remove(toolMesh);
    toolMesh = cloneModel("tool_" + id);
    seatTool(toolMesh, id);
    socket.add(toolMesh);
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
      if (stamp !== dustStamp) {
        paintDust(state.dust);
        dustStamp = stamp;
      }
    }
    ensureTool(frameStats.tool.id);
    ensureRide(state.riding);
    const pos = state.pos;
    const frameBasis = Planet.basis(pos, state.heading || 0);
    placeUpright(player, pos, new THREE.Vector3(frameBasis.forward.x, frameBasis.forward.y, frameBasis.forward.z));
    janitor.position.y = state.riding ? 0.62 : (frameMoving ? Math.abs(Math.sin(anim * 10)) * 0.05 : 0);
    const step = frameMoving ? Math.sin(anim * (frameCleaning ? 9 : 7)) : Math.sin(anim * 1.6) * 0.08;
    swing(legL, step * 0.55);
    swing(legR, -step * 0.55);
    poseArms(anim, frameStats.tool.id, frameCleaning, frameMoving, reduceMotion);
    if (rideMesh) {
      const spin = anim * (frameMoving ? 9 : 1.5);
      rideMesh.traverse((obj) => {
        if (obj.name.startsWith("wheel_") && !obj.name.includes("hub")) obj.rotation.x = spin;
      });
    }

    const radius = Math.max(0.8, frameStats.radius / 30);
    const nrm = Planet.surfaceNormal(pos);
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
      placeUpright(mesh, spot, new THREE.Vector3((robot.tx || robot.x) - robot.x, (robot.ty || robot.y) - robot.y, (robot.tz || robot.z) - robot.z));
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
    const up = new THREE.Vector3(nrm.x, nrm.y, nrm.z);
    let desired;
    let look;
    if (state.overview) {
      desired = new THREE.Vector3(0.55, 0.82, 1).normalize().multiplyScalar(Planet.RADIUS * 3.45);
      look = new THREE.Vector3(0, 0, 0);
      scene.fog.near = 2000;
      scene.fog.far = 2600;
    } else {
      desired = focus.clone().addScaledVector(back, -3.35).addScaledVector(up, 1.72);
      look = focus.clone().addScaledVector(back, 4.2).addScaledVector(up, 0.72);
      scene.fog.near = 90;
      scene.fog.far = 340;
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
    sun.position.copy(focus).add(new THREE.Vector3(8, 14, 6));
    sun.target.position.copy(focus);
    fill.position.copy(camera.position);
    renderer.render(scene, camera);
  }

  function faceDot(forward) {
    const world = faceLocal.clone().applyQuaternion(janitor.getWorldQuaternion(_quat));
    const radial = player.position.clone().normalize();
    world.addScaledVector(radial, -world.dot(radial));
    if (world.lengthSq() < 1e-8) return 0;
    return world.normalize().dot(_v.copy(forward).normalize());
  }

  function poseArms(time, toolId, cleaning, moving, reduceMotion) {
    const motion = toolMotion(toolId);
    const amp = reduceMotion ? 0.15 : cleaning ? 1 : moving ? 0.42 : 0.16;
    const freq = motion.freq * (cleaning ? 1 : 0.45);
    const wave = Math.sin(time * freq);
    const base = 0.7;
    poseArm(armR, base + wave * motion.pitch * amp, 0, wave * motion.roll * amp);
    poseArm(armL, 0.18 + wave * motion.pitch * amp * 0.4, 0, -wave * motion.roll * amp * 0.32);
  }

  resize();
  return {
    resize,
    render,
    modelsLoaded: true,
    planetRadius: Planet.RADIUS,
    faceDot,
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
  const helmet = findNamed(root, "helmet");
  const body = findNamed(root, "body");
  if (!helmet || !body || !helmet.isMesh || !body.isMesh) return new THREE.Vector3(0, 0.2, -1);
  return groupCentroid(helmet, slot).sub(groupCentroid(body, -1));
}

const HELD = {
  brush: [-Math.PI / 2, 0.15, 0.35],
  vac: [-0.55, 0.25, 0],
  ind: [-0.5, 0.2, 0],
  cyclone: [-0.7, 0.1, 0],
  grav: [-0.9, 0, 0],
  comet: [-0.45, 0.15, 0],
};

function seatTool(mesh, id) {
  const rot = HELD[id];
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.setScalar(id === "brush" ? 1.75 : rot ? 1.15 : 1.45);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const grip = rot
    ? box.getCenter(new THREE.Vector3())
    : new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - 0.05, (box.min.z + box.max.z) / 2);
  mesh.position.sub(grip);
  mesh.position.z -= 0.2;
  mesh.position.y -= rot ? 0.04 : 0.02;
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
