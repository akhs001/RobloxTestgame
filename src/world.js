import * as THREE from 'three';
import { GUARDS, STATIONS, WORLD, HATCHERY, PET_YARD } from './config.js';
import { rbox, stdMat, mk, makeSign } from './models.js';

function canvasTex(size, draw, repeat) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// Roblox-style studded baseplate with a two-tone checker.
function studTexture(c1, c2) {
  return canvasTex(256, (g) => {
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const base = (tx + ty) % 2 ? c2 : c1;
      g.fillStyle = base; g.fillRect(tx * 128, ty * 128, 128, 128);
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const x = tx * 128 + sx * 32, y = ty * 128 + sy * 32;
        g.fillStyle = 'rgba(0,60,0,.28)'; g.fillRect(x + 6, y + 6, 22, 22);
        g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x + 8, y + 8, 18, 18);
      }
    }
  });
}

function brickTexture() {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#7a4634'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#5b3224';
    for (let r = 0; r < 8; r++) {
      g.fillRect(0, r * 32, s, 3);
      for (let x = (r % 2) * 32; x < s; x += 64) g.fillRect(x, r * 32, 3, 32);
    }
    g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * s, Math.random() * s, 20, 8);
  });
}

function skyTexture() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#2f95ff'); gr.addColorStop(0.55, '#7cc4ff'); gr.addColorStop(1, '#d4efff');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function stripeTexture() {
  return canvasTex(64, (g, s) => {
    g.fillStyle = '#24272f'; g.fillRect(0, 0, s, s); g.fillStyle = '#3d4350';
    g.fillRect(0, 0, s, 12); g.fillRect(0, 32, s, 12);
  }, [1, 4]);
}

export function buildWorld(scene) {
  const colliders = [], clouds = [];
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xcfeaff, 140, 420);

  scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x6fb35a, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -48; sc.right = sc.top = 48; sc.near = 10; sc.far = 260;
  scene.add(sun, sun.target);

  // ---- ground
  const gt = studTexture('#4cd13f', '#42c038'); gt.repeat.set(170 / 8, 150 / 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(170, 150), stdMat(0xffffff, { map: gt, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), stdMat(0x3aa832)); far.rotation.x = -Math.PI / 2; far.position.y = -0.2; scene.add(far);

  // ---- outer brick walls with grass rim
  const bt = brickTexture();
  const wall = (x, z, w, d) => {
    const t = bt.clone(); t.needsUpdate = true; t.repeat.set(Math.max(w, d) / 10, 1.6);
    const m = mk(new THREE.BoxGeometry(w, 16, d), stdMat(0xffffff, { map: t }), x, 8, z, false); scene.add(m);
    const rim = mk(new THREE.BoxGeometry(w + (w > d ? 0 : 3), 2.2, d + (w > d ? 3 : 0)), stdMat(0x39c23a), x, 17.1, z, false); scene.add(rim);
    colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  };
  wall(0, -75, 190, 10); wall(0, 75, 190, 10); wall(-85, 0, 10, 160); wall(85, 0, 10, 160);

  // distant palace towers (set dressing, like the screenshot)
  const towerM = stdMat(0xf4f1ff), roofM = stdMat(0xffc933, { metalness: 0.4, roughness: 0.3 });
  [[-60, -120, 8, 46], [-25, -130, 10, 62], [10, -125, 7, 40], [45, -135, 11, 70], [80, -118, 8, 44], [-95, -105, 7, 36]].forEach(([x, z, r, h]) => {
    const t = mk(new THREE.CylinderGeometry(r, r * 1.1, h, 14), towerM, x, h / 2, z, false);
    const rf = mk(new THREE.ConeGeometry(r * 1.3, r * 1.8, 14), roofM, x, h + r * 0.9, z, false);
    scene.add(t, rf);
  });

  // ---- clouds
  const cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(5 + Math.random() * 4, 10, 8), cloudM);
      s.position.set(j * 7 - n * 3, Math.random() * 3, Math.random() * 4); s.scale.y = 0.6; g.add(s);
    }
    g.position.set(-300 + Math.random() * 600, 70 + Math.random() * 40, -200 + Math.random() * 100);
    g.userData.v = 1 + Math.random() * 2; scene.add(g); clouds.push(g);
  }

  // ---- fences
  const postM = stdMat(0x4a2815), railM = stdMat(0xb4691f), capM = stdMat(0x5e341a);
  function fence(x0, z0, x1, z1) {
    const alongX = z0 === z1, L = Math.abs(alongX ? x1 - x0 : z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const n = Math.max(1, Math.round(L / 5));
    for (let i = 0; i <= n; i++) {
      const px = alongX ? x0 + (x1 - x0) * i / n : x0, pz = alongX ? z0 : z0 + (z1 - z0) * i / n;
      scene.add(mk(rbox(1, 4.2, 1, 0.12), postM, px, 2.1, pz), mk(rbox(1.18, 0.3, 1.18, 0.1), capM, px, 4.3, pz));
    }
    for (const h of [0.9, 2.0, 3.1]) {
      const r = mk(rbox(alongX ? L : 0.4, 0.7, alongX ? 0.4 : L, 0.1), railM, cx, h, cz); scene.add(r);
    }
    colliders.push({ x0: Math.min(x0, x1) - (alongX ? 0 : 0.6), x1: Math.max(x0, x1) + (alongX ? 0 : 0.6), z0: Math.min(z0, z1) - (alongX ? 0.6 : 0), z1: Math.max(z0, z1) + (alongX ? 0.6 : 0) });
  }

  // ---- pens
  const pens = GUARDS.map((gd, i) => {
    const cx = gd.penX, minX = cx - 15, maxX = cx + 15, minZ = -66, maxZ = -34;
    const ft = gt.clone(); ft.needsUpdate = true; ft.repeat.set(30 / 8, 32 / 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 32), stdMat(gd.tint, { map: ft, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0.03, -50); floor.receiveShadow = true; scene.add(floor);
    fence(minX, minZ, maxX, minZ); fence(minX, minZ, minX, maxZ); fence(maxX, minZ, maxX, maxZ);
    fence(minX, maxZ, cx - 5, maxZ); fence(cx + 5, maxZ, maxX, maxZ);
    // gate pillars + glowing entrance strip
    const cm = stdMat(gd.color, { emissive: gd.color, emissiveIntensity: 0.5 });
    for (const s of [-1, 1]) scene.add(mk(rbox(1.6, 7, 1.6, 0.2), postM, cx + s * 5.4, 3.5, maxZ), mk(rbox(2.0, 0.9, 2.0, 0.2), cm, cx + s * 5.4, 7.2, maxZ));
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), new THREE.MeshBasicMaterial({ color: gd.color, transparent: true, opacity: 0.55 }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(cx, 0.06, maxZ); scene.add(strip);
    // pedestal
    const ped = new THREE.Group(); ped.position.set(cx, 0, -61);
    ped.add(mk(new THREE.CylinderGeometry(2.6, 3, 0.9, 20), stdMat(0xb9b4c8), 0, 0.45, 0), mk(new THREE.CylinderGeometry(2.4, 2.4, 0.25, 20), stdMat(gd.color, { emissive: gd.color, emissiveIntensity: 0.4 }), 0, 1.0, 0));
    scene.add(ped);
    // banner behind the pen
    const sign = makeSign(gd.name.toUpperCase(), 15, 3.2, '#1f1630', '#ffffff', '#' + gd.color.toString(16).padStart(6, '0'));
    sign.position.set(cx, 10.5, -68.3); scene.add(sign);
    for (const s of [-1, 1]) scene.add(mk(rbox(0.9, 10, 0.9, 0.1), postM, cx + s * 7.8, 5, -68.3));
    // egg locked cage
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 4.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    dome.position.set(cx, 3.0, -61); scene.add(dome);
    return { idx: i, cx, minX, maxX, minZ, maxZ, home: { x: cx, z: -51 }, egg: { x: cx, z: -61 }, dome };
  });

  // ---- hatchery
  const H = new THREE.Group(); H.position.set(HATCHERY.x, 0, HATCHERY.z); scene.add(H);
  H.add(mk(new THREE.CylinderGeometry(HATCHERY.r, HATCHERY.r + 0.4, 0.5, 40), stdMat(0xf4f0ff), 0, 0.25, 0));
  const ring = mk(new THREE.TorusGeometry(HATCHERY.r - 0.3, 0.28, 8, 48), stdMat(0xffc933, { metalness: 0.5, roughness: 0.3 }), 0, 0.55, 0); ring.rotation.x = Math.PI / 2; H.add(ring);
  const zone = new THREE.Mesh(new THREE.CircleGeometry(HATCHERY.r - 0.6, 40), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.35 }));
  zone.rotation.x = -Math.PI / 2; zone.position.y = 0.53; H.add(zone);
  H.add(mk(new THREE.CylinderGeometry(2.1, 2.5, 1.3, 20), stdMat(0xffc933, { metalness: 0.5, roughness: 0.3 }), 0, 1.15, 0));
  const glass = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.25, roughness: 0.05 }));
  glass.position.y = 1.8; H.add(glass);
  const hs = makeSign('HATCHERY', 11, 2.6, '#2b1a4a', '#fff2b0', '#ffc933'); hs.position.set(0, 16, -10); H.add(hs);
  for (const s of [-1, 1]) H.add(mk(rbox(0.9, 16, 0.9, 0.1), postM, s * 6.5, 8, -10));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 160, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 80; beam.visible = false; H.add(beam);
  const hatchery = { group: H, eggAnchor: new THREE.Vector3(HATCHERY.x, 3.1, HATCHERY.z), beam, zone };

  // ---- gym + speed zone
  const slate = stdMat(0x39414f), trim = stdMat(0x4aa3ff, { emissive: 0x2a6bd6, emissiveIntensity: 0.35 });
  const mat = (x, z, w, d, tr) => { scene.add(mk(rbox(w, 0.3, d, 0.1), slate, x, 0.15, z, false), mk(rbox(w + 0.8, 0.2, 0.7, 0.05), tr, x, 0.2, z + d / 2), mk(rbox(w + 0.8, 0.2, 0.7, 0.05), tr, x, 0.2, z - d / 2)); };
  mat(-43.5, 40, 58, 22, trim);
  const gs = makeSign('GYM', 10, 3, '#14202e', '#8fd4ff', '#4aa3ff'); gs.position.set(-43.5, 14, 25); scene.add(gs);
  for (const x of [-49, -38]) scene.add(mk(rbox(0.9, 14, 0.9, 0.1), postM, x, 7, 25));
  const treadTex = stripeTexture();
  const stations = STATIONS.map((st) => {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z); scene.add(g);
    const padMat = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.6 });
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.1, 28), padMat); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.34; g.add(pad);
    const rim = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.5, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.35; g.add(rim);
    const metal = stdMat(0x2d3038, { metalness: 0.6, roughness: 0.35 }), col = stdMat(st.color, { roughness: 0.35, metalness: 0.3, emissive: st.color, emissiveIntensity: 0.15 });
    let belt = null;
    if (st.kind === 'speed') {
      g.remove(pad, rim); padMat.opacity = 0;
      g.add(mk(rbox(4.6, 0.7, 9, 0.15), stdMat(0x2b2f3a), 0, 0.35 + 0.15, 0));
      belt = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 8.4), new THREE.MeshBasicMaterial({ map: treadTex })); belt.rotation.x = -Math.PI / 2; belt.position.set(0, 0.72, 0); g.add(belt);
      for (const s of [-1, 1]) g.add(mk(rbox(0.3, 4, 0.3, 0.05), metal, s * 2.2, 2.4, -4.2), mk(rbox(0.25, 0.25, 8.4, 0.05), metal, s * 2.2, 3.4, -0.2));
      g.add(mk(rbox(3.6, 1.5, 0.4, 0.1), stdMat(0x111, { emissive: 0x2fd37a, emissiveIntensity: 0.6 }), 0, 4.6, -4.4));
    } else {
      // decor: weight tower + bench + overhead frame scaled by tier
      const k = st.db;
      const b = mk(rbox(3.2, 0.8, 1.4, 0.2), stdMat(0x2a2d36), 0, 0.9, -5); g.add(b, mk(rbox(3, 0.35, 1.2, 0.15), col, 0, 1.4, -5));
      for (const s of [-1, 1]) g.add(mk(rbox(0.3, 0.6, 1, 0.05), metal, s * 1.2, 0.5, -5));
      for (let i = 0; i < 4; i++) { const p = mk(new THREE.CylinderGeometry(0.9 * k, 0.9 * k, 0.28, 18), col, 3.1, 0.55 + i * 0.3, -4.2); g.add(p); }
      for (const s of [-1, 1]) { const p = mk(new THREE.CylinderGeometry(0.5 * k + 0.4, 0.5 * k + 0.4, 0.3, 18), col, s * 2.2, 3.4, -6.2); p.rotation.z = Math.PI / 2; g.add(p); }
      const bar = mk(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), metal, 0, 3.4, -6.2); bar.rotation.z = Math.PI / 2; g.add(bar);
      for (const s of [-1, 1]) g.add(mk(rbox(0.3, 3.4, 0.3, 0.05), metal, s * 1.6, 1.7, -6.2));
      if (st.id === 'titan') { const o = mk(new THREE.IcosahedronGeometry(0.9, 1), stdMat(0xc77dff, { emissive: 0xc77dff, emissiveIntensity: 0.9 }), 0, 5.2, -6.2); g.add(o); g.userData.orb = o; }
    }
    return { def: st, group: g, padMat, belt, standY: st.standY || 0 };
  });


  // ---- pet yard (fenced area east of the hatchery; gate faces the hatchery)
  const Y = PET_YARD, yc = { x: (Y.minX + Y.maxX) / 2, z: (Y.minZ + Y.maxZ) / 2 };
  const yt = gt.clone(); yt.needsUpdate = true; yt.repeat.set((Y.maxX - Y.minX) / 8, (Y.maxZ - Y.minZ) / 8);
  const yfloor = new THREE.Mesh(new THREE.PlaneGeometry(Y.maxX - Y.minX, Y.maxZ - Y.minZ), stdMat(0xd8ffc8, { map: yt, roughness: 0.95 }));
  yfloor.rotation.x = -Math.PI / 2; yfloor.position.set(yc.x, 0.03, yc.z); yfloor.receiveShadow = true; scene.add(yfloor);
  fence(Y.minX, Y.minZ, Y.maxX, Y.minZ); fence(Y.minX, Y.maxZ, Y.maxX, Y.maxZ); fence(Y.maxX, Y.minZ, Y.maxX, Y.maxZ);
  fence(Y.minX, Y.minZ, Y.minX, 39.5); fence(Y.minX, 48.5, Y.minX, Y.maxZ);
  const ys = makeSign('PET YARD', 11, 2.8, '#10301a', '#c9ffb8', '#ff9acb'); ys.position.set(yc.x, 14, Y.minZ - 1); scene.add(ys);
  for (const s of [-1, 1]) scene.add(mk(rbox(0.9, 14, 0.9, 0.1), postM, yc.x + s * 6.5, 7, Y.minZ - 1));
  const house = new THREE.Group(); house.position.set(Y.maxX - 6, 0, Y.minZ + 6);
  house.add(mk(rbox(6, 3.4, 5, 0.2), stdMat(0xd9a05b), 0, 1.7, 0), mk(new THREE.ConeGeometry(4.8, 2.6, 4), stdMat(0xc0392b), 0, 4.6, 0), mk(rbox(2, 2.2, 0.3, 0.1), stdMat(0x2a1a10), 0, 1.1, 2.5));
  house.children[1].rotation.y = Math.PI / 4; scene.add(house);
  const bowl = mk(new THREE.CylinderGeometry(1.2, 0.9, 0.6, 16), stdMat(0xff6b9a), Y.minX + 5, 0.3, Y.maxZ - 5); scene.add(bowl);
  const ball = mk(new THREE.SphereGeometry(0.9, 14, 10), stdMat(0xff4d4d), Y.maxX - 8, 0.9, Y.maxZ - 7); scene.add(ball);

  // ---- trees & bushes (avoid play areas)
  const leaf1 = stdMat(0x36b83a), leaf2 = stdMat(0x4fd24a), trunk = stdMat(0x7a4a22);
  const tree = (x, z, s = 1) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s);
    g.add(mk(new THREE.CylinderGeometry(0.8, 1.1, 5, 8), trunk, 0, 2.5, 0));
    g.add(mk(new THREE.IcosahedronGeometry(3.6, 1), leaf1, 0, 7, 0), mk(new THREE.IcosahedronGeometry(2.6, 1), leaf2, 1.8, 9, 0.8), mk(new THREE.IcosahedronGeometry(2.2, 1), leaf2, -1.8, 8.4, -0.8));
    scene.add(g);
  };
  for (let z = -28; z <= 62; z += 11) { tree(-76, z + Math.random() * 3, 0.9 + Math.random() * 0.4); tree(76, z + Math.random() * 3, 0.9 + Math.random() * 0.4); }
  for (let x = -70; x <= 70; x += 14) if (Math.abs(x) > 12) tree(x + Math.random() * 3, 68, 0.9 + Math.random() * 0.4);
  const bushM = [stdMat(0x2fa534), stdMat(0xff7aa8), stdMat(0xffd84a)];
  const blocked = (x, z) => (z < -30) || (x > -75 && x < -13 && z > 26 && z < 54) || (x > 16 && x < 60 && z > 26 && z < 64) || (Math.hypot(x, z - 44) < 11);
  for (let i = 0; i < 60; i++) {
    const x = -78 + Math.random() * 156, z = -28 + Math.random() * 98;
    if (blocked(x, z)) continue;
    const m = bushM[Math.random() < 0.7 ? 0 : 1 + (Math.random() < 0.5 ? 0 : 1)];
    scene.add(mk(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.6, 1), m, x, 0.5, z));
  }

  return {
    colliders, pens, stations, hatchery, sun, yard: { ...Y, cx: yc.x, cz: yc.z },
    treadSpeed: 0,
    update(dt) {
      for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 340) c.position.x = -340; }
      treadTex.offset.y -= dt * this.treadSpeed;
    },
  };
}
