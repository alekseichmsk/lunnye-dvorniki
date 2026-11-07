import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const M = 1 / 30;

const MODEL_FILES = [
  "janitor",
  "tool_brush", "tool_broom", "tool_mop", "tool_vac", "tool_ind",
  "tool_turbo", "tool_cyclone", "tool_plasma", "tool_grav", "tool_comet", "tool_aurora",
  "depot", "rocket",
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

const DECOR_FILE = {
  airlock: "prop_airlock",
  cactus: "prop_crystals",
  dish: "prop_dish",
  domes: "prop_dome",
  quarry: "prop_crater",
  flags: "prop_flag",
  crater: "prop_crater",
  ink: "prop_hut",
};

function findNamed(root, name) {
  let found = null;
  root.traverse((obj) => {
    if (obj.name === name || obj.name.startsWith(name + ".") || obj.name.endsWith(name)) {
      if (!found || obj.name === name) found = obj;
    }
  });
  return found;
}

function sitOnGround(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  obj.position.x -= (box.min.x + box.max.x) / 2;
  obj.position.z -= (box.min.z + box.max.z) / 2;
  obj.position.y -= box.min.y;
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
  obj.position.y -= grounded.min.y;
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
    transparent: !!material.transparent,
    opacity: material.opacity === undefined ? 1 : material.opacity,
    emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000),
  });
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    obj.material = Array.isArray(obj.material) ? obj.material.map(convert) : convert(obj.material);
  });
}

function enableShadows(root, cast = true) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = cast;
      obj.receiveShadow = false;
    }
  });
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
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b1440);
  scene.fog = new THREE.Fog(0x1b1440, 28, 72);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(-8, 12, 8);

  const hemi = new THREE.HemisphereLight(0xe7f0ff, 0xf3c9a2, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e4, 1.85);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -14;
  sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  const starPositions = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = 40 + Math.random() * 20;
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) * 0.35 + 6;
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPositions, 3)),
    new THREE.PointsMaterial({ color: 0xfffaf3, size: 0.18, sizeAttenuation: true }),
  );
  scene.add(stars);

  const loader = new GLTFLoader();
  const templates = {};
  await Promise.all(MODEL_FILES.map(async (name) => {
    const gltf = await loader.loadAsync(`assets/models/${name}.glb`);
    const root = gltf.scene;
    root.name = name;
    toLambert(root);
    if (!name.startsWith("tool_")) sitOnGround(root);
    enableShadows(root, !name.startsWith("prop_"));
    rememberRest(root);
    templates[name] = root;
  }));

  function cloneModel(name) {
    const src = templates[name];
    if (!src) return new THREE.Group();
    const obj = src.clone(true);
    rememberRest(obj);
    return obj;
  }

  const world = new THREE.Group();
  scene.add(world);
  const sectorGroups = new Map();
  let builtCount = -1;

  const player = new THREE.Group();
  const janitor = cloneModel("janitor");
  player.add(janitor);
  scene.add(player);
  const legs = {
    l: findNamed(janitor, "leg_l"),
    r: findNamed(janitor, "leg_r"),
  };
  const armR = findNamed(janitor, "arm_r");
  const socket = findNamed(janitor, "tool_socket") || armR || janitor;
  let toolMesh = null;
  let toolId = "";
  let rideMesh = null;
  let rideId = null;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.035, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  const puffGeo = new THREE.SphereGeometry(0.08, 5, 4);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0xf4efe8 });
  const puffs = [];
  for (let i = 0; i < 80; i++) {
    const mesh = new THREE.Mesh(puffGeo, puffMat);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    puffs.push(mesh);
  }
  const floaterSprites = [];

  const depots = [];
  const bots = [];

  function paintDust(sector, image) {
    const dust = sector.dust;
    const data = image.data;
    for (let row = 0; row < 22; row++) {
      for (let col = 0; col < 30; col++) {
        const i = row * 30 + col;
        const amount = dust[i] || 0;
        const t = Math.max(0, Math.min(1, amount / 80));
        const spark = amount > 8 && ((col * 13 + row * 7) % 23 === 0);
        const py = 21 - row;
        const o = (py * 30 + col) * 4;
        if (spark && t > 0.15) {
          data[o] = 255;
          data[o + 1] = 214;
          data[o + 2] = 70;
          data[o + 3] = 230;
        } else {
          data[o] = 150;
          data[o + 1] = 132;
          data[o + 2] = 148;
          data[o + 3] = Math.round(t * 210);
        }
      }
    }
  }

  function makeSector(index, sector, preview, biome) {
    const group = new THREE.Group();
    const width = 30 * 30 * M;
    const depth = 22 * 30 * M;
    const color = new THREE.Color(biome.ground[0]);
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.45, depth),
      new THREE.MeshLambertMaterial({ color }),
    );
    ground.position.set(width / 2, -0.24, depth / 2);
    ground.receiveShadow = true;
    ground.castShadow = false;
    group.add(ground);
    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.06, 2.1),
      new THREE.MeshLambertMaterial({ color: biome.ground[1] }),
    );
    lane.position.set(width / 2, 0.02, depth / 2);
    lane.receiveShadow = true;
    group.add(lane);

    const dustCanvas = document.createElement("canvas");
    dustCanvas.width = 30;
    dustCanvas.height = 22;
    const dustCtx = dustCanvas.getContext("2d", { willReadFrequently: true });
    const image = dustCtx.createImageData(30, 22);
    const texture = new THREE.CanvasTexture(dustCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const dustMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const dustMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), dustMat);
    dustMesh.rotation.x = -Math.PI / 2;
    dustMesh.position.set(width / 2, 0.045, depth / 2);
    group.add(dustMesh);

    if (!preview && sector) {
      const decorName = DECOR_FILE[biome.decor] || "prop_rock";
      for (let k = 0; k < 3; k++) {
        const prop = cloneModel(decorName);
        const px = (0.18 + ((index * 17 + k * 29) % 60) / 100) * width;
        let pz = (0.16 + ((index * 11 + k * 37) % 68) / 100) * depth;
        if (Math.abs(pz - depth / 2) < 1.6) pz = k % 2 ? depth * 0.18 : depth * 0.82;
        prop.position.set(px, 0, pz);
        prop.rotation.y = k * 1.3;
        const big = decorName === "prop_airlock" || decorName === "prop_dome" || decorName === "prop_hut";
        fitInside(prop, big ? 4.2 : 1.5);
        group.add(prop);
      }
      for (const boulder of sector.boulders || []) {
        const rock = cloneModel("prop_rock");
        const s = Math.max(0.45, (boulder.r * M) / 0.45);
        rock.scale.multiplyScalar(s);
        rock.position.set(boulder.x * M, 0, boulder.y * M);
        group.add(rock);
      }
    } else {
      group.traverse((obj) => {
        if (obj.material && obj.material.color) {
          obj.material = obj.material.clone();
          obj.material.transparent = true;
          obj.material.opacity = 0.45;
        }
      });
    }
    group.userData.paint = () => {
      if (!sector) {
        image.data.fill(180);
        for (let p = 3; p < image.data.length; p += 4) image.data[p] = 190;
      } else {
        paintDust(sector, image);
      }
      dustCtx.putImageData(image, 0, 0);
      texture.needsUpdate = true;
    };
    group.userData.paint();
    return group;
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
    sprite.scale.set(1.8, 0.45, 1);
    return sprite;
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
    toolMesh.rotation.set(Math.PI / 2, 0, 0.4);
    toolMesh.scale.setScalar(1.15);
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
    rideMesh.rotation.y = Math.PI;
    player.add(rideMesh);
  }

  function render(frame) {
    const { state, cfg, robots, particles, floaters, rockets, anim, shake, frameStats, frameMoving, frameFacing, frameCleaning, reduceMotion } = frame;
    const count = state.sectors.length;
    if (count !== builtCount) {
      for (const group of sectorGroups.values()) world.remove(group);
      sectorGroups.clear();
      for (let i = 0; i < count; i++) {
        const biome = cfg.biomeOf(i);
        const group = makeSector(i, state.sectors[i], false, biome);
        const origin = cfg.sectorOrigin(i);
        group.position.set(origin.x * M, 0, origin.y * M);
        world.add(group);
        sectorGroups.set(i, group);
      }
      const previewBiome = cfg.biomeOf(count);
      const preview = makeSector(count, null, true, previewBiome);
      const origin = cfg.sectorOrigin(count);
      preview.position.set(origin.x * M, 0, origin.y * M);
      world.add(preview);
      sectorGroups.set("preview", preview);
      builtCount = count;
    }
    const here = Math.max(0, Math.min(count - 1, Math.floor(state.px / cfg.STRIDE)));
    for (const key of [here, here - 1, here + 1]) {
      const group = sectorGroups.get(key);
      if (group && group.userData.paint) group.userData.paint();
    }

    ensureTool(frameStats.tool.id);
    ensureRide(state.riding);
    player.position.set(state.px * M, 0, state.py * M);
    player.rotation.y = frameFacing > 0 ? Math.PI / 2 : -Math.PI / 2;
    janitor.position.y = state.riding ? 0.55 : (frameMoving ? Math.abs(Math.sin(anim * 10)) * 0.05 : 0);
    const step = frameMoving ? Math.sin(anim * (frameCleaning ? 12 : 8)) : Math.sin(anim * 2) * 0.15;
    if (legs.l && legs.l.userData.rest) {
      legs.l.quaternion.copy(legs.l.userData.rest);
      legs.l.rotateX(step * 0.7);
    }
    if (legs.r && legs.r.userData.rest) {
      legs.r.quaternion.copy(legs.r.userData.rest);
      legs.r.rotateX(-step * 0.7);
    }
    if (armR && armR.userData.rest) {
      armR.quaternion.copy(armR.userData.rest);
      armR.rotateX(frameCleaning ? Math.sin(anim * 16) * 0.8 : -step * 0.35);
    }
    if (rideMesh) {
      const spin = anim * (frameMoving ? 10 : 2);
      rideMesh.traverse((obj) => {
        if (obj.name.startsWith("wheel_") && !obj.name.includes("hub")) {
          obj.rotation.x = spin;
        }
      });
    }

    const list = cfg.allDepots();
    while (depots.length < list.length) {
      const mesh = cloneModel("depot");
      scene.add(mesh);
      depots.push(mesh);
    }
    while (depots.length > list.length) scene.remove(depots.pop());
    const launch = rockets[rockets.length - 1];
    list.forEach((depot, i) => {
      const mesh = depots[i];
      mesh.position.set(depot.x * M, 0, depot.y * M);
      const rocketNode = findNamed(mesh, "rocket");
      const flame = findNamed(mesh, "flame");
      const near = launch && Math.hypot(launch.x - depot.x, launch.y - depot.y) < 80;
      if (rocketNode) {
        if (!rocketNode.userData.baseY) rocketNode.userData.baseY = rocketNode.position.y;
        const age = near ? launch.age : 0;
        rocketNode.position.y = rocketNode.userData.baseY + age * 5.5;
        if (flame) {
          flame.visible = near && age < launch.life * 0.85;
          flame.scale.y = 1 + age * 2;
        }
      }
    });

    while (bots.length < robots.length) {
      const mesh = cloneModel(ROBOT_FILE[robots[bots.length].type] || "robot_chistik");
      scene.add(mesh);
      bots.push(mesh);
    }
    while (bots.length > robots.length) scene.remove(bots.pop());
    robots.forEach((robot, i) => {
      const mesh = bots[i];
      const bob = robot.type === "drone" ? 0.35 + Math.sin(anim * 4 + i) * 0.05 : Math.sin(anim * 6 + i) * 0.03;
      mesh.position.set(robot.x * M, bob, robot.y * M);
      const dx = (robot.tx || robot.x) - robot.x;
      const dz = (robot.ty || robot.y) - robot.y;
      if (dx * dx + dz * dz > 4) mesh.rotation.y = Math.atan2(dx, dz);
      const rotor = findNamed(mesh, "rotor");
      if (rotor) rotor.rotation.y = anim * 12;
      const legL = findNamed(mesh, "leg_l");
      const legR = findNamed(mesh, "leg_r");
      const swing = Math.sin(anim * 7 + i) * 0.4;
      if (legL && legL.userData.rest) {
        legL.quaternion.copy(legL.userData.rest);
        legL.rotateX(swing);
      }
      if (legR && legR.userData.rest) {
        legR.quaternion.copy(legR.userData.rest);
        legR.rotateX(-swing);
      }
    });

    const radius = Math.max(0.4, frameStats.radius * M);
    ring.position.set(state.px * M, 0.06, state.py * M);
    ring.scale.setScalar(radius);
    ring.material.opacity = frameCleaning ? 0.7 : 0.22;

    particles.forEach((particle, i) => {
      const mesh = puffs[i];
      if (!mesh) return;
      const life = 1 - particle.age / particle.life;
      mesh.visible = life > 0;
      mesh.position.set(particle.x * M, 0.15 + (1 - life) * 0.4, particle.y * M);
      const s = (particle.size || 4) * 0.03 * life;
      mesh.scale.setScalar(Math.max(0.2, s));
      mesh.material = puffMat;
    });
    for (let i = particles.length; i < puffs.length; i++) puffs[i].visible = false;

    while (floaterSprites.length < floaters.length) {
      const sprite = textSprite(floaters[floaterSprites.length].text, floaters[floaterSprites.length].color || "#24183a");
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
      const life = 1 - floater.age / floater.life;
      sprite.position.set(floater.x * M, 1.4 + floater.age * 0.8, floater.y * M);
      sprite.material.opacity = Math.max(0, life);
    });

    const focus = new THREE.Vector3(state.px * M, 0.8, state.py * M);
    const desired = focus.clone().add(new THREE.Vector3(-4.8, 6.4, 4.8));
    if (!reduceMotion && shake > 0) {
      desired.x += Math.sin(anim * 45) * shake * 0.015;
      desired.y += Math.cos(anim * 38) * shake * 0.01;
    }
    camera.position.lerp(desired, 0.18);
    camera.lookAt(focus);
    sun.position.copy(focus).add(new THREE.Vector3(7, 12, 5));
    sun.target.position.copy(focus);
    stars.position.copy(focus);
    renderer.render(scene, camera);
  }

  resize();
  return { resize, render, modelsLoaded: true };
}
