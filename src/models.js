import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GUARDS } from './config.js';

const gcache = new Map();
export function rbox(w, h, d, r = 0.14) {
  const k = [w, h, d, r].join(',');
  let g = gcache.get(k);
  if (!g) {
    g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
    gcache.set(k, g);
  }
  return g;
}
export const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
export function mk(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

const faceCache = {};
function faceTexture(kind) {
  if (faceCache[kind]) return faceCache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.lineCap = 'round';
  g.fillStyle = '#1b1b1f'; g.strokeStyle = '#1b1b1f';
  if (kind === 'smile') {
    g.beginPath(); g.ellipse(44, 52, 7, 11, 0, 0, 7); g.ellipse(84, 52, 7, 11, 0, 0, 7); g.fill();
    g.lineWidth = 7; g.beginPath(); g.arc(64, 66, 28, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  } else {
    const glow = kind === 'glow';
    if (glow) { g.fillStyle = '#ff2a2a'; g.shadowColor = '#ff0000'; g.shadowBlur = 16; }
    g.beginPath(); g.ellipse(44, 62, 8, 7, 0, 0, 7); g.ellipse(84, 62, 8, 7, 0, 0, 7); g.fill();
    g.shadowBlur = 0; g.strokeStyle = '#1b1b1f'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(26, 36); g.lineTo(56, 52); g.moveTo(102, 36); g.lineTo(72, 52); g.stroke();
    g.lineWidth = 8; g.beginPath(); g.arc(64, 108, 26, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (faceCache[kind] = t);
}

function pizzaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ffcf4a'; g.beginPath(); g.moveTo(8, 8); g.lineTo(56, 14); g.lineTo(30, 58); g.closePath(); g.fill();
  g.fillStyle = '#d9772b'; g.beginPath(); g.moveTo(6, 6); g.lineTo(58, 12); g.lineTo(57, 18); g.lineTo(6, 12); g.fill();
  g.fillStyle = '#e8402a'; [[24, 24], [38, 26], [30, 40]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function makeDumbbell(color, scale) {
  const g = new THREE.Group();
  const m = stdMat(color, { roughness: 0.35, metalness: 0.4 }), d = stdMat(0x2b2b33);
  const bar = mk(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 8), d); bar.rotation.z = Math.PI / 2; g.add(bar);
  for (const s of [-1, 1]) {
    const p = mk(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 14), m, s * 0.58); p.rotation.z = Math.PI / 2; g.add(p);
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------------------------------------------------------------- humanoid rig
// Roblox-style blocky character. Faces +Z. Origin at the feet.
export function buildHumanoid(o) {
  const root = new THREE.Group(), pivot = new THREE.Group(), inner = new THREE.Group();
  pivot.position.y = 2.6; inner.position.y = -2.6; root.add(pivot); pivot.add(inner);
  const mats = [];
  const M = (c, e) => { const m = stdMat(c, e); mats.push(m); return m; };
  const skinM = M(o.skin), shirtM = M(o.shirt), pantsM = M(o.pants), shoeM = M(o.shoes ?? 0x333333), gloveM = M(o.glove ?? o.skin);
  const accM = M(o.accColor ?? 0xffffff, o.boss ? { roughness: 0.3, metalness: 0.5 } : {});

  const mkLeg = () => {
    const g = new THREE.Group(); g.position.y = 2.0;
    g.add(mk(rbox(1, 1.6, 1), pantsM, 0, -0.8), mk(rbox(1.04, 0.5, 1.12, 0.18), shoeM, 0, -1.75, 0.06));
    inner.add(g); return g;
  };
  const legL = mkLeg(), legR = mkLeg();

  const torsoG = new THREE.Group(); torsoG.position.y = 3.0; inner.add(torsoG);
  const torso = mk(rbox(2, 2, 1, 0.2), shirtM); torsoG.add(torso);
  if (o.pizza) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: pizzaTexture(), transparent: true }));
    p.position.set(0.1, 0.1, 0.51); torso.add(p);
  }
  if (o.acc?.includes('belt')) {
    torso.add(mk(rbox(2.08, 0.34, 1.08, 0.08), accM, 0, -0.78, 0), mk(rbox(0.5, 0.42, 0.1, 0.05), accM, 0, -0.78, 0.55));
  }

  const mkArm = () => {
    const g = new THREE.Group(); g.position.y = 3.95;
    g.add(mk(rbox(1, 1.45, 1), shirtM, 0, -0.72), mk(rbox(0.92, 0.62, 0.92, 0.2), gloveM, 0, -1.7));
    if (o.acc?.includes('shoulders')) g.add(mk(rbox(1.5, 0.5, 1.5, 0.2), accM, 0, 0.05));
    const hold = new THREE.Group(); hold.position.set(0, -1.75, 0.05); g.add(hold); g.hold = hold;
    inner.add(g); return g;
  };
  const armL = mkArm(), armR = mkArm();

  const head = new THREE.Group(); head.position.y = 4.0; inner.add(head);
  head.add(mk(rbox(1.3, 1.25, 1.3, 0.38), skinM, 0, 0.65, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: faceTexture(o.face || 'smile'), transparent: true }));
  face.position.set(0, 0.62, 0.66); head.add(face);

  const acc = o.acc || [];
  if (acc.includes('cap')) {
    head.add(mk(rbox(1.4, 0.55, 1.4, 0.25), accM, 0, 1.15, 0), mk(rbox(1.15, 0.1, 0.65, 0.04), accM, 0, 0.98, 0.95));
  }
  if (o.hair) {
    const hm = M(o.hair);
    head.add(mk(rbox(1.42, 0.5, 1.42, 0.2), hm, 0, 1.12, -0.03), mk(rbox(1.42, 0.9, 0.4, 0.15), hm, 0, 0.75, -0.62), mk(rbox(0.3, 0.7, 1.3, 0.1), hm, 0.68, 0.8, 0), mk(rbox(0.3, 0.7, 1.3, 0.1), hm, -0.68, 0.8, 0));
  }
  if (o.hat) head.add(mk(rbox(1.46, 0.5, 1.46, 0.22), M(o.hat), 0, 1.2, 0), mk(rbox(1.1, 0.1, 0.7, 0.04), M(o.hat), 0, 1.0, 0.95));
  if (acc.includes('shades')) {
    const b = M(0x0a0a0c); head.add(mk(rbox(1.32, 0.3, 0.14, 0.06), b, 0, 0.7, 0.66), mk(rbox(1.34, 0.08, 1.2, 0.03), b, 0, 0.75, 0));
  }
  if (acc.includes('viking')) {
    head.add(mk(rbox(1.5, 0.75, 1.5, 0.3), accM, 0, 1.1, 0));
    const horn = M(0xf3ead0);
    for (const s of [-1, 1]) {
      const h = mk(new THREE.ConeGeometry(0.22, 1.0, 10), horn, s * 0.85, 1.55, 0); h.rotation.z = -s * 0.7; head.add(h);
    }
  }
  if (acc.includes('crown')) {
    head.add(mk(new THREE.CylinderGeometry(0.75, 0.82, 0.4, 10), accM, 0, 1.4, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      head.add(mk(new THREE.ConeGeometry(0.16, 0.6, 6), accM, Math.cos(a) * 0.72, 1.85, Math.sin(a) * 0.72));
    }
  }

  const rig = { root, pivot, inner, mats, head, armL, armR, legL, legR, torso, phase: Math.random() * 6, time: 0, hold: [armL.hold, armR.hold] };
  rig.setBulk = (b) => {
    const tx = 1 + (b - 1) * 0.9, tz = 1 + (b - 1) * 0.55, ax = b, az = 1 + (b - 1) * 0.75, lx = 1 + (b - 1) * 0.6;
    torso.scale.set(tx, 1, tz);
    armL.scale.set(ax, 1, az); armR.scale.set(ax, 1, az);
    armL.position.x = tx + 0.5 * ax; armR.position.x = -(tx + 0.5 * ax);
    legL.scale.set(lx, 1, lx); legR.scale.set(lx, 1, lx);
    legL.position.x = 0.5 * lx; legR.position.x = -0.5 * lx;
    head.scale.setScalar(1 + (b - 1) * 0.15);
  };
  rig.flash = (c, k) => { for (const m of mats) { m.emissive.setHex(c); m.emissiveIntensity = k; } };
  rig.setBulk(o.bulk ?? 1);
  root.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return rig;
}

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// st: {walk, carry, pose:'idle'|'curl'|'run', rep, atk:{arms,t,wind,back,fwd,lean}, roll, ko, hit}
export function animateRig(rig, dt, st) {
  rig.time += dt;
  rig.phase += dt * (3 + st.walk * 10);
  const sw = Math.sin(rig.phase) * st.walk;
  const br = Math.sin(rig.time * 2.2) * 0.03;
  let aL = sw * 0.95 + br, aR = -sw * 0.95 - br, lL = -sw, lR = sw, lean = 0;
  if (st.carry) { aL = aR = -1.1; }
  if (st.pose === 'curl') {
    const c = (1 - Math.cos(st.rep * Math.PI * 2)) / 2;
    aL = aR = -0.2 - 1.6 * c; lean = -0.06 * c;
  }
  const a = st.atk;
  if (a) {
    const w = a.wind, t = a.t, rest = 0.1;
    const ang = t < w ? rest + (a.back - rest) * ease(t / w) : a.back + (a.fwd - a.back) * Math.pow(clamp01((t - w) / ((1 - w) * 0.6)), 2);
    if (a.arms !== 'L') aR = ang;
    if (a.arms !== 'R') aL = a.arms === 'B' ? ang : -0.3;
    lean = (a.lean || 0) * ease(clamp01((t - w * 0.5) / (1 - w * 0.5)));
    if (a.arms === 'R') aL = 0.4; // balance arm
  }
  let roll = 0;
  if (st.roll != null) { roll = st.roll; aL = aR = -2.4; lL = lR = -1.2; }
  rig.armL.rotation.x = aL; rig.armR.rotation.x = aR;
  rig.legL.rotation.x = lL; rig.legR.rotation.x = lR;
  const ko = st.ko || 0;
  rig.pivot.rotation.x = lean - 0.35 * (st.hit || 0) + roll * Math.PI * 2 - ko * (Math.PI / 2);
  rig.pivot.position.y = 2.6 - ko * 1.9;
  rig.torso.scale.y = 1 + br * 0.5;
  rig.head.rotation.x = ko * 0.3 + (st.hit || 0) * -0.2;
}

// ---------------------------------------------------------------- egg & pets
export function makeEgg(tier) {
  const e = GUARDS[tier].egg, g = new THREE.Group();
  const shell = mk(new THREE.SphereGeometry(0.8, 28, 20), stdMat(e.color, { roughness: 0.25, emissive: e.glow ? 0xffaa00 : e.color, emissiveIntensity: e.glow ? 0.5 : 0.12 }), 0, 1.05, 0);
  shell.scale.set(0.8, 1, 0.8); g.add(shell);
  const sm = stdMat(e.spot, { roughness: 0.4 });
  for (let i = 0; i < 7; i++) {
    const phi = i * 2.4, y = -0.45 + (i % 4) * 0.4, ring = Math.sqrt(Math.max(0.05, 1 - (y / 1) ** 2));
    const s = mk(new THREE.SphereGeometry(0.17, 10, 8), sm, Math.cos(phi) * 0.8 * 0.8 * ring, 1.05 + y * 0.95, Math.sin(phi) * 0.8 * 0.8 * ring);
    s.scale.set(1, 1, 0.45); s.lookAt(s.position.x * 3, s.position.y, s.position.z * 3); g.add(s);
  }
  g.scale.setScalar(1.35 + tier * 0.15);
  return g;
}

export function makePet(tier) {
  const c = GUARDS[tier].egg.pet.color, g = new THREE.Group();
  const M = (col) => stdMat(col, { roughness: 0.55 }), body = M(c), dark = M(0x1a1a1f), white = M(0xffffff);
  g.add(mk(rbox(1.3, 1.0, 1.8, 0.3), body, 0, 0.9, 0));
  const head = new THREE.Group(); head.position.set(0, 1.55, 0.85); g.add(head);
  head.add(mk(rbox(1.15, 1.0, 1.05, 0.3), body, 0, 0, 0.1));
  for (const s of [-1, 1]) head.add(mk(new THREE.SphereGeometry(0.11, 8, 8), dark, s * 0.28, 0.1, 0.64));
  head.add(mk(rbox(0.35, 0.22, 0.2, 0.08), white, 0, -0.18, 0.62));
  const ear = tier === 0 ? rbox(0.35, 0.5, 0.2, 0.1) : new THREE.ConeGeometry(0.25, 0.7, 4);
  for (const s of [-1, 1]) head.add(mk(ear, M(tier === 1 ? 0xffe3c2 : c), s * 0.38, 0.7, 0));
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) g.add(mk(rbox(0.38, 0.5, 0.38, 0.1), body, s * 0.42, 0.25, z));
  const tail = mk(tier === 2 ? new THREE.ConeGeometry(0.3, 1.2, 6) : rbox(0.3, 0.3, 0.9, 0.1), body, 0, 1.0, -1.3);
  if (tier === 2) { tail.rotation.x = -1.9; }
  g.add(tail);
  if (tier === 2) for (let i = 0; i < 4; i++) g.add(mk(new THREE.ConeGeometry(0.2, 0.45, 4), M(0x2a8a38), 0, 1.5, 0.6 - i * 0.45));
  if (tier === 3) {
    const gold = M(0xffc933);
    for (const s of [-1, 1]) {
      const w = mk(rbox(1.8, 0.1, 1.1, 0.04), M(0xff5a3a), s * 1.3, 1.6, -0.2); w.rotation.z = s * -0.4; g.add(w);
      const h = mk(new THREE.ConeGeometry(0.15, 0.6, 5), gold, s * 0.3, 0.75, 0); h.rotation.z = -s * 0.4; head.add(h);
    }
  }
  g.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  g.userData.head = head;
  return g;
}

export function makeSign(text, w, h, bg = '#2a1a0e', fg = '#ffe9a8', border = '#ffb62e') {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = border; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = bg; g.fillRect(16, 16, c.width - 32, c.height - 32);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  let fs = c.height * 0.55; g.font = `900 ${fs}px "Trebuchet MS", Arial Black, sans-serif`;
  while (g.measureText(text).width > c.width - 90) { fs -= 4; g.font = `900 ${fs}px "Trebuchet MS", Arial Black, sans-serif`; }
  g.lineWidth = fs * 0.08; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(text, c.width / 2, c.height / 2 + 4); g.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: t });
  const grp = new THREE.Group();
  const a = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m), b = a.clone(); b.rotation.y = Math.PI; b.position.z = -0.05; a.position.z = 0.05;
  grp.add(a, b, mk(rbox(w + 0.5, h + 0.5, 0.08, 0.04), stdMat(0x3a2412), 0, 0, 0));
  return grp;
}
