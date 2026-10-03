import * as THREE from 'three';
import { GUARDS, STATIONS, WORLD, HATCHERY, PET_YARD, RANKS, ATTACKS } from './config.js';
import { buildHumanoid, animateRig, makeEgg, makePet, makeDumbbell } from './models.js';
import { buildWorld } from './world.js';
import { initAudio, sfx } from './audio.js';

// ------------------------------------------------------------------ helpers
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const lerpAngle = (a, b, t) => a + angDiff(a, b) * t;
const fmt = (n) => (n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k' : Math.floor(n).toLocaleString());
const $ = (id) => document.getElementById(id);
const fmtP = (n) => (n < 100 ? (Math.floor(n * 10) / 10).toFixed(1) : fmt(n));
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ save data
const SAVE_KEY = 'egg-brawl-proto-v1';
const params = new URLSearchParams(location.search);
if (params.has('reset')) localStorage.removeItem(SAVE_KEY);
let S = { power: 0, speed: 0, coins: 0, owned: { bench: true, treadmill: true }, pets: [], equipped: null, beaten: {} };
try { Object.assign(S, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* ignore */ }
for (const k of ['power', 'speed', 'coins']) if (params.has(k)) S[k] = +params.get(k);
if (params.has('all')) for (const st of STATIONS) S.owned[st.id] = true;
const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };

// ------------------------------------------------------------------ renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.5, 700);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const world = buildWorld(scene);

// ------------------------------------------------------------------ particles, floating text, labels
const pGeo = new THREE.BoxGeometry(1, 1, 1), pMats = {}, parts = [], ringFx = [];
function burst(pos, color, n, spd, life, size, grav = 18, up = 0.7) {
  const m = pMats[color] || (pMats[color] = new THREE.MeshBasicMaterial({ color }));
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(pGeo, m); mesh.position.copy(pos); scene.add(mesh);
    const a = rnd(0, TAU), s = rnd(0.3, 1) * spd;
    parts.push({ mesh, vel: new THREE.Vector3(Math.cos(a) * s, rnd(0.2, 1) * spd * up + 2, Math.sin(a) * s), life, max: life, size: size * rnd(0.6, 1.2), grav });
  }
}
function spawnRing(pos, maxR, color, dur) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.12, pos.z); scene.add(m); ringFx.push({ m, t: 0, dur, maxR });
}
const floats = [];
function floatText(text, pos, cls = '', life = 0.9, rise = 3) {
  const el = document.createElement('div'); el.className = 'float shadow ' + cls; el.textContent = text; $('floats').appendChild(el);
  floats.push({ el, pos: pos.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6))), t: 0, life, rise });
}
const labels = [];
function addLabel(getPos, max, cls = '') {
  const el = document.createElement('div'); el.className = 'label shadow ' + cls; $('labels').appendChild(el);
  const l = { el, getPos, max, html: '', hideWhen: null, set(h) { if (h !== this.html) { this.html = h; el.innerHTML = h; } } };
  labels.push(l); return l;
}
const _v = new THREE.Vector3();
function toScreen(pos) { _v.copy(pos).project(camera); return _v.z < 1 && _v.z > -1 ? { x: (_v.x * 0.5 + 0.5) * innerWidth, y: (-_v.y * 0.5 + 0.5) * innerHeight } : null; }
function toast(text, small = false, ms = 2200, color = '#fff') {
  const el = document.createElement('div'); el.className = 'toast shadow' + (small ? ' small' : ''); el.style.color = color; el.textContent = text;
  $('toasts').appendChild(el); setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 500); }, ms);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}

// ------------------------------------------------------------------ derived stats
const powerMult = () => 1 + S.pets.reduce((a, t) => a + GUARDS[t].egg.pet.pw, 0);
const petCps = () => S.pets.reduce((a, t) => a + GUARDS[t].egg.pet.cps, 0);
const maxHp = () => 100 + 10 * S.power;
const pDmg = () => 5 + 1.5 * S.power;
const targetScale = () => Math.min(3.3, 1 + 0.07 * Math.sqrt(S.power));
const targetBulk = () => Math.min(2.0, 0.8 + 0.05 * Math.sqrt(S.power));
const moveSpd = () => Math.min(28, 13 + S.speed * 0.2);
const rankOf = (p) => RANKS.filter((r) => p >= r.at).pop().name;

// ------------------------------------------------------------------ player
const P = {
  rig: buildHumanoid({ skin: 0xf4f4ee, shirt: 0x2f6bd6, pants: 0x1f2a44, shoes: 0xe0902a, hair: 0x4a2a16, hat: 0xd22b2b, face: 'smile', pizza: true, bulk: 0.8 }),
  pos: new THREE.Vector3(WORLD.spawn.x, 0, WORLD.spawn.z), vel: new THREE.Vector3(), face: Math.PI, hp: maxHp(), state: 'free',
  scale: targetScale(), bulk: targetBulk(), pop: 0, iframe: 0, rollCd: 0, roll: null, atk: null, comboIdx: 0, comboT: 0, queued: false,
  train: null, carry: null, hit: 0, flash: 0, downT: 0, ko: 0, noHurtT: 0, dumbbells: [],
};
scene.add(P.rig.root);
P.hp = maxHp();
const pRadius = () => 0.9 * P.scale;

const COMBO = [
  { dur: 0.34, hitAt: 0.55, arms: 'R', back: 0.9, fwd: -1.55, wind: 0.3, mult: 1, lunge: 7, lean: 0.15, reach: 4.2 },
  { dur: 0.34, hitAt: 0.55, arms: 'L', back: 0.9, fwd: -1.55, wind: 0.3, mult: 1, lunge: 7, lean: 0.15, reach: 4.2 },
  { dur: 0.58, hitAt: 0.62, arms: 'B', back: -2.9, fwd: -0.5, wind: 0.5, mult: 1.7, lunge: 10, lean: 0.5, reach: 5.0, finisher: true },
];

// ------------------------------------------------------------------ guards
const teleA = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
const teleB = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
function makeTele(geo) {
  const area = new THREE.Mesh(geo, teleA), fill = new THREE.Mesh(geo, teleB), grp = new THREE.Group();
  area.rotation.x = fill.rotation.x = -Math.PI / 2; area.position.y = 0.07; fill.position.y = 0.09;
  grp.add(area, fill); grp.visible = false; scene.add(grp); return { grp, area, fill };
}
const coneGeo = new THREE.CircleGeometry(1, 32, -0.95, 1.9), circGeo = new THREE.CircleGeometry(1, 44), lineGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);

const guards = GUARDS.map((d, i) => {
  const rig = buildHumanoid({ ...d.look, bulk: d.bulk, boss: d.boss, accColor: d.look.accColor });
  rig.root.scale.setScalar(d.scale); scene.add(rig.root);
  const pen = world.pens[i];
  const egg = makeEgg(i); egg.position.set(pen.egg.x, 1.0, pen.egg.z); scene.add(egg);
  const g = {
    def: d, idx: i, rig, pen, pos: new THREE.Vector3(pen.home.x, 0, pen.home.z), face: 0, hp: d.hp, max: d.hp, state: 'idle', timer: 0, cd: 1,
    atk: null, anim: null, dir: new THREE.Vector3(0, 0, 1), egg: { mesh: egg, present: true, respawn: 0 }, radius: 1.25 * d.scale,
    hit: 0, ko: 0, lostT: 0, engaged: false, enraged: false, walk: 0, dashLeft: 0, dashHit: false,
    tele: { swing: makeTele(coneGeo), slam: makeTele(circGeo), charge: makeTele(lineGeo) },
    reach: 2.4 + 1.4 * d.scale, slamR: 3 + 2.2 * d.scale, chargeW: 2 + 0.8 * d.scale,
  };
  return g;
});

const guardLabels = guards.map((g) => { const l = addLabel(() => _v.set(g.pos.x, g.def.scale * 6.6 + 1.2, g.pos.z), 70); l.hideWhen = () => g.engaged && g.state !== 'ko'; return l; });

// ------------------------------------------------------------------ stations / hatchery labels
const stationLabels = world.stations.map((s) => addLabel(() => _v.set(s.def.x, 6.5, s.def.z), 32, 'dim'));
const yardLabel = addLabel(() => _v.set(YARD.cx, 7, YARD.cz), 55);
const hatchLabel = addLabel(() => _v.set(HATCHERY.x, 7, HATCHERY.z), 45);
hatchLabel.hideWhen = () => !P.carry && Math.hypot(P.pos.x - HATCHERY.x, P.pos.z - HATCHERY.z) < HATCHERY.r + 2;
const playerLabel = addLabel(() => _v.set(P.pos.x, 5.4 * P.scale + 1.4, P.pos.z), 999);
playerLabel.hideWhen = () => P.state === 'train' || guards.some((g) => g.engaged);

// ------------------------------------------------------------------ pets
// All owned pets live in the Pet Yard; ONE equipped pet follows you and helps in fights.
const pets = [], YARD = world.yard;
const yardPoint = () => new THREE.Vector3(rnd(YARD.minX + 3, YARD.maxX - 3), 0, rnd(YARD.minZ + 3, YARD.maxZ - 3));
const inYard = (v) => v.x > YARD.minX + 0.5 && v.x < YARD.maxX && v.z > YARD.minZ && v.z < YARD.maxZ;
function spawnPetMesh(tier, at) {
  const mesh = makePet(tier); mesh.scale.setScalar(0.9 + tier * 0.1); mesh.position.copy(at); scene.add(mesh);
  const p = { tier, mesh, pos: mesh.position, t: Math.random() * 6, mode: 'yard', target: null, wait: rnd(0, 2), cd: 0, lunge: 0 };
  pets.push(p); return p;
}
function applyEquip() {
  pets.forEach((p) => (p.mode = 'yard'));
  const f = S.equipped == null ? null : pets.find((p) => p.tier === S.equipped);
  if (f) { f.mode = 'follow'; f.target = null; } else S.equipped = null;
}
function setEquipped(tier) {
  S.equipped = S.equipped === tier ? null : tier; applyEquip(); refreshPetsHud(); save(); sfx('pickup');
  if (S.equipped != null) toast(`${GUARDS[tier].egg.pet.name} will help you fight!`, true, 1800, '#ffe08a');
}
S.pets.slice(0, 40).forEach((t) => spawnPetMesh(t, yardPoint()));
applyEquip();
function refreshPetsHud() {
  const counts = {}; S.pets.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  const rows = Object.keys(counts).map((t) => {
    const p = GUARDS[t].egg.pet, on = S.equipped === +t;
    return `<div class="pet${on ? ' on' : ''}" data-tier="${t}" style="border-color:#${p.color.toString(16).padStart(6, '0')}"><b>${on ? '⭐ ' : ''}${p.name} ×${counts[t]}</b> <small>${on ? 'with you · ' : 'click to equip · '}${p.help.text}<br>+${Math.round(p.pw * 100 * counts[t])}% power · ${(p.cps * counts[t]).toFixed(1)}🪙/s</small></div>`;
  });
  $('pets').innerHTML = rows.length ? '<div class="pt">🐾 PETS</div>' + rows.join('') : '';
}
$('pets').addEventListener('click', (e) => { const d = e.target.closest('.pet'); if (d) setEquipped(+d.dataset.tier); });
refreshPetsHud();

// ------------------------------------------------------------------ input
const keys = {}; const cam = { yaw: 0, pitch: 0.42, zoom: 1, shake: 0, focus: new THREE.Vector3(P.pos.x, 3, P.pos.z) };
let started = false, dragging = false, hitstop = 0, T = 0;
// Use the physical key (e.code) so WASD/E/J work on ANY keyboard layout (Greek, Russian, ...).
function keyName(e) {
  const c = e.code || '';
  if (c.startsWith('Key')) return c.slice(3).toLowerCase();
  if (c === 'Space') return ' ';
  if (c.startsWith('Shift')) return 'shift';
  return e.key.toLowerCase();
}
addEventListener('keydown', (e) => {
  if (!started) return;
  const k = keyName(e); keys[k] = true;
  if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  if (k === ' ' || k === 'shift') tryRoll();
  if (k === 'j') queueAttack();
  if (k === 'e') interact();
});
addEventListener('keyup', (e) => { keys[keyName(e)] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousedown', (e) => { if (!started || e.target.closest('#pets')) return; if (e.button === 0) queueAttack(); if (e.button === 2) dragging = true; });
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => { if (dragging) { cam.yaw -= e.movementX * 0.006; cam.pitch = clamp(cam.pitch + e.movementY * 0.004, 0.15, 1.2); } });
addEventListener('wheel', (e) => { cam.zoom = clamp(cam.zoom + Math.sign(e.deltaY) * 0.08, 0.6, 1.9); }, { passive: true });

function moveInput() {
  let x = 0, z = 0;
  if (keys.w) z += 1; if (keys.s) z -= 1; if (keys.d) x += 1; if (keys.a) x -= 1;
  const dx = -Math.sin(cam.yaw) * z + Math.cos(cam.yaw) * x, dz = -Math.cos(cam.yaw) * z - Math.sin(cam.yaw) * x, l = Math.hypot(dx, dz);
  return l > 0 ? { x: dx / l, z: dz / l, mag: 1 } : { x: 0, z: 0, mag: 0 };
}

// ------------------------------------------------------------------ collisions
function resolveCircle(pos, r, selfIgnoreGuard) {
  for (const c of world.colliders) {
    const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1), dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
      else { const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z, m = Math.min(l, rr, t, b); if (m === l) pos.x = c.x0 - r; else if (m === rr) pos.x = c.x1 + r; else if (m === t) pos.z = c.z0 - r; else pos.z = c.z1 + r; }
    }
  }
  pos.x = clamp(pos.x, -WORLD.halfX + r, WORLD.halfX - r); pos.z = clamp(pos.z, WORLD.minZ + r, WORLD.maxZ - r);
}

// ------------------------------------------------------------------ player actions
function nearStation() {
  let best = null, bd = 3.8;
  for (const s of world.stations) { const d = Math.hypot(P.pos.x - s.def.x, P.pos.z - s.def.z); if (d < bd) { bd = d; best = s; } }
  return best;
}
function interact() {
  if (P.state === 'down') return;
  const st = nearStation(); if (!st) return;
  if (!S.owned[st.def.id]) {
    if (S.coins >= st.def.cost) {
      S.coins -= st.def.cost; S.owned[st.def.id] = true; sfx('buy'); save();
      toast(`${st.def.name} unlocked!`, false, 2200, '#ffd23f'); burst(new THREE.Vector3(st.def.x, 2, st.def.z), st.def.color, 24, 9, 0.9, 0.35);
    } else { sfx('warn'); toast(`Need ${fmt(st.def.cost)} coins`, true, 1500, '#ff8a8a'); }
  } else if (P.state === 'train') stopTrain();
  else if (P.state === 'free') startTrain(st);
}
function startTrain(st) {
  P.state = 'train'; P.train = { st, rep: 0 }; P.vel.set(0, 0, 0);
  if (st.def.kind === 'power') P.dumbbells = P.rig.hold.map((h) => { const d = makeDumbbell(st.def.color, st.def.db * 0.9); h.add(d); return d; });
}
function stopTrain() {
  if (P.state !== 'train') return;
  P.dumbbells.forEach((d) => d.parent && d.parent.remove(d)); P.dumbbells = []; P.train = null; P.state = 'free'; world.treadSpeed = 0;
}
function gainPower(n) {
  const before = rankOf(S.power); S.power += n; P.hp += n * 10; P.pop = 1;
  if (rankOf(S.power) !== before) { toast(`RANK UP: ${rankOf(S.power)}!`, false, 2600, '#ffb347'); sfx('rank'); burst(P.pos.clone().setY(3), 0xffb347, 30, 10, 1, 0.4); }
}
function queueAttack() {
  if (P.state === 'down') return; initAudio();
  if (P.state === 'train') stopTrain();
  if (P.state === 'free') startAttack(); else if (P.state === 'attack') P.queued = true;
}
function autoTarget() {
  for (const g of guards) {
    if (g.state === 'ko') continue;
    const pen = g.pen; if (!(P.pos.x > pen.minX - 1 && P.pos.x < pen.maxX + 1 && P.pos.z > pen.minZ && P.pos.z < pen.maxZ + 0.5)) continue;
    if (Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z) <= COMBO[0].reach * (0.6 + 0.4 * P.scale) + g.radius - 0.4) return g;
  }
  return null;
}
function nearestGuard(maxD) {
  let best = null, bd = maxD;
  for (const g of guards) { if (g.state === 'ko') continue; const d = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z) - g.radius; if (d < bd) { bd = d; best = g; } }
  return best;
}
function startAttack() {
  const idx = P.comboT > 0 ? (P.comboIdx + 1) % 3 : 0, c = COMBO[idx];
  P.comboIdx = idx; P.state = 'attack'; P.queued = false;
  P.atk = { c, t: 0, hit: false };
  const g = nearestGuard(11);
  if (g) P.face = Math.atan2(g.pos.x - P.pos.x, g.pos.z - P.pos.z);
  P.vel.set(Math.sin(P.face) * c.lunge, 0, Math.cos(P.face) * c.lunge);
  sfx('swing');
}
function tryRoll() {
  if (P.state === 'down' || P.rollCd > 0 || P.state === 'roll') return;
  if (P.state === 'train') stopTrain();
  const inp = moveInput(), dir = inp.mag ? { x: inp.x, z: inp.z } : { x: Math.sin(P.face), z: Math.cos(P.face) };
  P.state = 'roll'; P.atk = null; P.roll = { t: 0, dur: 0.42, dir, spd: 24 + S.speed * 0.1 };
  P.face = Math.atan2(dir.x, dir.z); P.iframe = Math.max(P.iframe, 0.36); P.rollCd = Math.max(0.5, 1.0 - S.speed * 0.004);
  sfx('roll'); burst(P.pos.clone().setY(0.4), 0xdfffd0, 8, 5, 0.4, 0.4, 6);
}
function playerHit(c) {
  P.atk.hit = true;
  let hitAny = false;
  for (const g of guards) {
    if (g.state === 'ko') continue;
    const dx = g.pos.x - P.pos.x, dz = g.pos.z - P.pos.z, dist = Math.hypot(dx, dz);
    const reach = c.reach * (0.6 + 0.4 * P.scale) + g.radius;
    if (dist > reach) continue;
    if (dist > 1 && (dx * Math.sin(P.face) + dz * Math.cos(P.face)) / dist < 0.25) continue;
    damageGuard(g, pDmg() * c.mult * rnd(0.92, 1.08), c, dx / (dist || 1), dz / (dist || 1)); hitAny = true;
  }
  if (!hitAny) return;
}
function damageGuard(g, dmg, c, nx, nz, quiet = false) {
  g.hp -= dmg; g.hit = 1;
  const at = new THREE.Vector3(g.pos.x - nx * g.radius, 3.2 * g.def.scale, g.pos.z - nz * g.radius);
  floatText(fmt(dmg), at, c.finisher ? 'crit' : 'dmg', 0.8, 2.5);
  burst(at, c.finisher ? 0xffd23f : 0xffffff, c.finisher ? 16 : 8, 9, 0.45, 0.3);
  sfx(c.finisher ? 'bighit' : 'hit');
  if (!quiet) { hitstop = c.finisher ? 0.11 : 0.05; cam.shake = Math.max(cam.shake, c.finisher ? 0.5 : 0.18); }
  g.pos.x += nx * (c.finisher ? 1.4 : 0.5) / Math.sqrt(g.def.scale); g.pos.z += nz * (c.finisher ? 1.4 : 0.5) / Math.sqrt(g.def.scale);
  if (g.state === 'idle') { g.state = 'chase'; g.engaged = true; g.cd = 0.6; }
  if (!g.enraged && g.def.boss && g.hp < g.max * 0.5) { g.enraged = true; toast('THE TITAN IS ENRAGED!', false, 2400, '#ff6b6b'); sfx('warn'); }
  if (g.hp <= 0) { guardKO(g); return; }
  if (c.finisher && dmg >= g.max * 0.1 && (g.state === 'wind' || g.state === 'chase' || g.state === 'recover')) {
    for (const k in g.tele) g.tele[k].grp.visible = false;
    g.state = 'stagger'; g.timer = 1.0; g.anim = null; floatText('STAGGER!', at.clone().setY(at.y + 2), 'gain', 1, 2);
  }
}
function guardKO(g) {
  g.hp = 0; g.state = 'ko'; g.timer = 10; g.anim = null; g.enraged = false;
  for (const k in g.tele) g.tele[k].grp.visible = false;
  const first = !S.beaten[g.idx]; S.beaten[g.idx] = true;
  const bonus = Math.ceil(g.def.req * 0.05); gainPower(bonus);
  sfx('win'); hitstop = 0.2; cam.shake = 0.9;
  toast('VICTORY!', false, 2600, '#ffd23f'); toast(first ? `${g.def.name} defeated! Grab the egg!` : 'Grab the egg!', true, 2600);
  floatText(`+${bonus} Power`, P.pos.clone().setY(5 * P.scale), 'gain', 1.4, 3);
  for (const c of [0xffd23f, 0xff5a5a, 0x6dff9c, 0x66ccff]) burst(g.pos.clone().setY(5 * g.def.scale), c, 14, 14, 1.4, 0.45, 12, 1.2);
  save();
}
function hurtPlayer(dmg, fx, fz, heavy) {
  if (P.state === 'down') return;
  if (P.iframe > 0) { if (P.state === 'roll') { floatText('DODGE!', P.pos.clone().setY(5 * P.scale), 'dodge', 0.7, 2); sfx('dodge'); } return; }
  P.hp -= dmg; P.iframe = 0.7; P.hit = 1; P.flash = 1; P.noHurtT = 4;
  const dx = P.pos.x - fx, dz = P.pos.z - fz, l = Math.hypot(dx, dz) || 1;
  P.vel.set((dx / l) * (heavy ? 18 : 12), 0, (dz / l) * (heavy ? 18 : 12));
  if (P.state === 'attack') { P.state = 'free'; P.atk = null; }
  if (P.state === 'train') stopTrain();
  floatText('-' + fmt(dmg), P.pos.clone().setY(5 * P.scale), 'hurt', 0.9, 2.5);
  sfx('hurt'); cam.shake = Math.max(cam.shake, heavy ? 0.8 : 0.45); hitstop = 0.06;
  $('flash').style.opacity = 1; setTimeout(() => ($('flash').style.opacity = 0), 120);
  burst(P.pos.clone().setY(3 * P.scale), 0xff5a5a, 8, 8, 0.4, 0.3);
  if (P.hp <= 0) {
    P.hp = 0; P.state = 'down'; P.downT = 2.2; P.atk = null; sfx('down');
    toast('KNOCKED OUT!', false, 2200, '#ff6b6b');
    if (P.carry) { toast('You lost the egg!', true, 2200, '#ff8a8a'); dropCarry(); }
  }
}
function dropCarry() { if (P.carry) { P.carry.mesh.parent && P.carry.mesh.parent.remove(P.carry.mesh); P.carry = null; } }
function respawnPlayer() {
  P.state = 'free'; P.pos.set(WORLD.spawn.x, 0, WORLD.spawn.z); P.vel.set(0, 0, 0); P.hp = maxHp(); P.iframe = 1.2; P.ko = 0;
  toast('Train harder, then try again!', true, 2400);
}

// ------------------------------------------------------------------ player update
function updatePlayer(dt) {
  P.iframe = Math.max(0, P.iframe - dt); P.rollCd = Math.max(0, P.rollCd - dt); P.hit = Math.max(0, P.hit - dt * 3);
  P.flash = Math.max(0, P.flash - dt * 4); P.autoCd = Math.max(0, (P.autoCd || 0) - dt); P.pop = Math.max(0, P.pop - dt * 3.5); P.comboT = Math.max(0, P.comboT - dt); P.noHurtT = Math.max(0, P.noHurtT - dt);
  const k = 1 - Math.exp(-dt * 3);
  P.scale = lerp(P.scale, targetScale(), k); P.bulk = lerp(P.bulk, targetBulk(), k); P.rig.setBulk(P.bulk);
  P.rig.root.scale.setScalar(P.scale * (1 + 0.14 * Math.sin(P.pop * Math.PI)));
  const maxH = maxHp(); if (P.noHurtT <= 0 && P.state !== 'down') P.hp = Math.min(maxH, P.hp + maxH * 0.06 * dt); P.hp = Math.min(P.hp, maxH);
  P.ko = lerp(P.ko, P.state === 'down' ? 1 : 0, 1 - Math.exp(-dt * 8));
  const inp = moveInput(), spd = moveSpd() * (P.carry ? 0.85 : 1);
  let walkAnim = 0, pose = 'idle', animAtk = null, rollT = null;
  let station = null, standY = 0;

  switch (P.state) {
    case 'down': P.vel.multiplyScalar(Math.exp(-dt * 8)); P.downT -= dt; if (P.downT <= 0) respawnPlayer(); break;
    case 'free': {
      const kk = 1 - Math.exp(-dt * 14);
      P.vel.x = lerp(P.vel.x, inp.x * spd, kk); P.vel.z = lerp(P.vel.z, inp.z * spd, kk);
      if (inp.mag) P.face = lerpAngle(P.face, Math.atan2(inp.x, inp.z), 1 - Math.exp(-dt * 16));
      walkAnim = Math.min(1.3, Math.hypot(P.vel.x, P.vel.z) / 13);
      if (P.autoCd <= 0 && autoTarget()) startAttack();   // battles are automatic
      break;
    }
    case 'attack': {
      const a = P.atk, c = a.c; a.t += dt / c.dur; P.vel.multiplyScalar(Math.exp(-dt * 9));
      P.vel.x += inp.x * 18 * dt; P.vel.z += inp.z * 18 * dt;
      if (!a.hit && a.t >= c.hitAt) playerHit(c);
      animAtk = { arms: c.arms, t: Math.min(1, a.t), wind: c.wind, back: c.back, fwd: c.fwd, lean: c.lean };
      if (a.t >= 1) { P.comboT = 0.45; P.state = 'free'; P.atk = null; P.autoCd = c.finisher ? 0.3 : 0; if (P.queued) { P.queued = false; startAttack(); } }
      break;
    }
    case 'roll': {
      const r = P.roll; r.t += dt / r.dur; const f = 1 - r.t * 0.45;
      P.vel.set(r.dir.x * r.spd * f, 0, r.dir.z * r.spd * f); rollT = r.t; P.face = Math.atan2(r.dir.x, r.dir.z);
      if (r.t >= 1) { P.state = 'free'; P.roll = null; }
      break;
    }
    case 'train': {
      const t = P.train; station = t.st; standY = station.standY;
      if (inp.mag) { stopTrain(); break; }
      P.vel.set(0, 0, 0);
      P.pos.x = lerp(P.pos.x, station.def.x, 1 - Math.exp(-dt * 10)); P.pos.z = lerp(P.pos.z, station.def.z, 1 - Math.exp(-dt * 10));
      P.face = lerpAngle(P.face, Math.PI, 1 - Math.exp(-dt * 10));
      const speedKind = station.def.kind === 'speed';
      t.rep += dt / (speedKind ? 0.6 : 0.9);
      if (speedKind) { walkAnim = 1.5; world.treadSpeed = 3; } else pose = 'curl';
      if (t.rep >= 1) {
        t.rep -= 1; sfx('rep');
        const at = P.pos.clone().setY(5.2 * P.scale);
        if (speedKind) { S.speed += station.def.gain * 1; P.pop = 0.6; floatText(`+${station.def.gain} Speed`, at, 'spd', 0.8, 2.5); }
        else { const g = station.def.gain * powerMult(); gainPower(g); floatText(`+${+g.toFixed(2)} Power`, at, 'gain', 0.8, 2.5); }
        burst(P.pos.clone().setY(2 * P.scale), station.def.color, 6, 6, 0.5, 0.3);
        if (Math.random() < 0.05) save();
      }
      break;
    }
  }
  P.pos.y = lerp(P.pos.y, standY, 1 - Math.exp(-dt * 12));
  P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
  if (P.state !== 'train') resolveCircle(P.pos, pRadius());
  for (const g of guards) {
    if (g.state === 'ko') continue;
    const dx = P.pos.x - g.pos.x, dz = P.pos.z - g.pos.z, d = Math.hypot(dx, dz), m = g.radius + pRadius() * 0.8;
    if (d < m && d > 0.001) { P.pos.x = g.pos.x + (dx / d) * m; P.pos.z = g.pos.z + (dz / d) * m; }
  }
  const root = P.rig.root; root.position.copy(P.pos); root.rotation.y = P.face;
  animateRig(P.rig, dt, { walk: walkAnim, carry: !!P.carry && P.state === 'free', pose, rep: P.train ? P.train.rep : 0, atk: animAtk, roll: rollT, ko: P.ko, hit: P.hit });
  P.rig.flash(0xff2020, P.flash * 0.7);
  if (P.carry) { P.carry.mesh.position.set(0, 2.6, 1.45); P.carry.mesh.rotation.y += dt * 2; }

  // egg pickup
  for (const g of guards) {
    if (g.state === 'ko' && g.egg.present && !P.carry && P.state !== 'down') {
      if (Math.hypot(P.pos.x - g.pen.egg.x, P.pos.z - g.pen.egg.z) < 3.4 + pRadius()) pickEgg(g);
    }
  }
  // hatchery delivery
  if (P.carry && !hatch.active && Math.hypot(P.pos.x - HATCHERY.x, P.pos.z - HATCHERY.z) < HATCHERY.r + 0.5) deliverEgg();
}

// ------------------------------------------------------------------ eggs & hatchery
const hatch = { active: false, t: 0, tier: 0, mesh: null, bonus: 1 };
function pickEgg(g) {
  g.egg.present = false; g.egg.respawn = 25; g.egg.mesh.visible = false;
  const mesh = makeEgg(g.idx); mesh.scale.multiplyScalar(0.55); P.rig.root.add(mesh);
  P.carry = { tier: g.idx, mesh, t0: T, from: new THREE.Vector2(g.pen.egg.x, g.pen.egg.z) };
  sfx('pickup'); toast('EGG STOLEN! Run to the hatchery!', false, 2800, '#fff'); world.hatchery.beam.visible = true;
  burst(new THREE.Vector3(g.pen.egg.x, 2, g.pen.egg.z), GUARDS[g.idx].egg.color, 20, 9, 0.8, 0.35);
}
function deliverEgg() {
  const c = P.carry; dropCarry(); world.hatchery.beam.visible = false;
  const dist = c.from.distanceTo(new THREE.Vector2(HATCHERY.x, HATCHERY.z)), par = dist / (moveSpd() * 0.85) + 5, el = T - c.t0;
  const bonus = el < par ? 1.5 : el < par * 1.6 ? 1.2 : 1;
  Object.assign(hatch, { active: true, t: 0, tier: c.tier, bonus, mesh: makeEgg(c.tier) });
  hatch.mesh.position.copy(world.hatchery.eggAnchor).setY(2.1); scene.add(hatch.mesh);
  toast(bonus > 1 ? `SPEED BONUS x${bonus}!` : 'Delivered!', true, 2000, bonus > 1 ? '#6dff9c' : '#fff'); sfx('pickup');
}
function updateHatch(dt) {
  if (!hatch.active) return;
  hatch.t += dt; const p = hatch.t / 2.6;
  hatch.mesh.rotation.z = Math.sin(hatch.t * (10 + p * 25)) * 0.12 * (0.3 + p); hatch.mesh.position.y = 2.1 + Math.abs(Math.sin(hatch.t * 6)) * 0.15 * p;
  if (Math.random() < p * 0.6) burst(world.hatchery.eggAnchor, GUARDS[hatch.tier].egg.spot, 1, 4, 0.5, 0.2, 6);
  if (p >= 1) {
    const tier = hatch.tier, e = GUARDS[tier].egg; scene.remove(hatch.mesh); hatch.active = false;
    S.pets.push(tier); if (pets.length < 40) spawnPetMesh(tier, world.hatchery.eggAnchor.clone().setY(0));
    if (S.equipped == null) { S.equipped = tier; applyEquip(); toast(`${e.pet.name} is now your battle buddy!`, true, 2600, '#ffe08a'); }
    const coins = Math.round(e.coins * hatch.bonus); S.coins += coins; refreshPetsHud(); save();
    sfx('hatch'); hitstop = 0.05; cam.shake = 0.4;
    toast(`${e.pet.name} hatched!`, false, 2800, '#' + e.pet.color.toString(16).padStart(6, '0'));
    floatText(`+${fmt(coins)} 🪙`, world.hatchery.eggAnchor.clone().setY(5), 'coin', 1.4, 3); sfx('coin');
    for (const c of [e.color, e.spot, 0xffd23f, 0xffffff]) burst(world.hatchery.eggAnchor, c, 16, 12, 1.2, 0.4, 12, 1.2);
    spawnRing(world.hatchery.eggAnchor, 9, 0xffe27a, 0.7);
  }
}

// ------------------------------------------------------------------ guard AI
function hideTele(g) { for (const k in g.tele) g.tele[k].grp.visible = false; }
function startWind(g, name, dist) {
  const A = ATTACKS[name], f = g.enraged ? 0.75 : 1;
  g.state = 'wind'; g.atk = name; g.timer = g.wind = A.wind * f;
  g.dir.set(P.pos.x - g.pos.x, 0, P.pos.z - g.pos.z).normalize();
  const t = g.tele[name]; t.grp.visible = true; t.grp.position.set(g.pos.x, 0, g.pos.z);
  t.fill.scale.set(0.01, 0.01, 1);
  if (name === 'swing') { t.area.scale.set(g.reach + pRadius() * 0.5, g.reach + pRadius() * 0.5, 1); }
  if (name === 'slam') { t.area.scale.set(g.slamR, g.slamR, 1); }
  if (name === 'charge') { t.area.scale.set(A.len, g.chargeW, 1); }
  const arms = name === 'swing' ? 'R' : 'B';
  g.anim = { t: 0, total: g.wind + 0.3, wf: g.wind / (g.wind + 0.3), arms, back: name === 'charge' ? -1.2 : name === 'swing' ? -2.9 : -3.0, fwd: name === 'charge' ? -1.45 : name === 'swing' ? -0.2 : -0.4, lean: name === 'charge' ? 0.7 : 0.55 };
  sfx('warn');
}
function guardUpdate(g, dt) {
  const d = g.def, dx = P.pos.x - g.pos.x, dz = P.pos.z - g.pos.z, dist = Math.hypot(dx, dz);
  const pen = g.pen, inPen = P.state !== 'down' && P.pos.x > pen.minX - 1 && P.pos.x < pen.maxX + 1 && P.pos.z > pen.minZ && P.pos.z < pen.maxZ + 0.5;
  g.hit = Math.max(0, g.hit - dt * 5); let walk = 0, ko = 0;
  if (!g.egg.present) { g.egg.respawn -= dt; if (g.egg.respawn <= 0) { g.egg.present = true; g.egg.mesh.visible = true; } }
  if (g.anim) { g.anim.t = Math.min(1, g.anim.t + dt / g.anim.total); }
  const toP = Math.atan2(dx, dz);
  switch (g.state) {
    case 'idle':
      g.hp = Math.min(g.max, g.hp + g.max * 0.15 * dt); g.enraged = false;
      g.pos.x = lerp(g.pos.x, pen.home.x, dt); g.pos.z = lerp(g.pos.z, pen.home.z, dt);
      g.face = lerpAngle(g.face, inPen || dist < 30 ? toP : 0, 1 - Math.exp(-dt * 2));
      if (inPen) { g.state = 'chase'; g.engaged = true; g.cd = 0.9; toast(`${d.name}: "Nobody steals my egg!"`, true, 2200, '#ffb0b0'); sfx('warn'); }
      break;
    case 'chase': {
      g.lostT = inPen ? 0 : g.lostT + dt; if (g.lostT > 2.5) { g.state = 'idle'; g.engaged = false; break; }
      g.face = lerpAngle(g.face, toP, 1 - Math.exp(-dt * 8));
      const sp = d.speed * (g.enraged ? 1.35 : 1), stop = Math.max(g.radius + pRadius() * 0.8, g.reach * 0.8);
      if (dist > stop && inPen) { g.pos.x += (dx / dist) * sp * dt; g.pos.z += (dz / dist) * sp * dt; walk = Math.min(1.2, sp / 8); }
      g.cd -= dt;
      if (g.cd <= 0 && inPen) {
        const opts = [];
        if (dist <= g.reach + pRadius() * 0.6) opts.push('swing');
        if (d.attacks.includes('slam') && dist <= g.slamR * 0.9) opts.push('slam', 'slam');
        if (d.attacks.includes('charge') && dist > 9 && dist < 26) opts.push('charge', 'charge');
        if (opts.length) startWind(g, opts[Math.floor(Math.random() * opts.length)], dist);
      }
      break;
    }
    case 'wind': {
      g.timer -= dt; const p = 1 - g.timer / g.wind, t = g.tele[g.atk];
      if (g.atk !== 'charge' ? p < 0.6 : p < 0.4) { g.dir.set(dx, 0, dz).normalize(); g.face = lerpAngle(g.face, toP, 1 - Math.exp(-dt * 10)); }
      t.grp.position.set(g.pos.x, 0, g.pos.z);
      t.fill.scale.x = t.area.scale.x * p; t.fill.scale.y = g.atk === 'charge' ? t.area.scale.y : t.area.scale.y * p;
      t.grp.rotation.y = g.atk === 'slam' ? 0 : -Math.atan2(g.dir.z, g.dir.x);
      if (g.timer <= 0) execAttack(g, dist, dx, dz);
      break;
    }
    case 'dash': {
      const A = ATTACKS.charge, step = A.speed * (g.enraged ? 1.15 : 1) * dt;
      g.pos.x += g.dir.x * step; g.pos.z += g.dir.z * step; g.dashLeft -= step; walk = 1.5;
      if (!g.dashHit && dist < g.radius + pRadius() + 0.6) { g.dashHit = true; hurtPlayer(d.dmg * A.mult, g.pos.x, g.pos.z, true); }
      if (Math.random() < 0.6) burst(g.pos.clone().setY(0.3), 0xd9c9a3, 1, 4, 0.5, 0.5, 4);
      const hitWall = g.pos.x < pen.minX + g.radius + 0.5 || g.pos.x > pen.maxX - g.radius - 0.5 || g.pos.z < pen.minZ + g.radius + 0.5;
      if (hitWall) { g.state = 'stagger'; g.timer = 1.6; g.anim = null; cam.shake = Math.max(cam.shake, 0.6); sfx('slam'); floatText('OUCH!', g.pos.clone().setY(g.def.scale * 6), 'gain', 1, 2); }
      else if (g.dashLeft <= 0) { g.state = 'recover'; g.timer = A.rec; }
      break;
    }
    case 'recover': g.timer -= dt; if (g.timer <= 0) { g.state = 'chase'; g.cd = rnd(0.2, 0.7); g.anim = null; } break;
    case 'stagger': g.timer -= dt; if (Math.random() < 0.15) burst(g.pos.clone().setY(g.def.scale * 6.4), 0xffe27a, 1, 3, 0.6, 0.25, 0); if (g.timer <= 0) { g.state = 'chase'; g.cd = 0.5; } break;
    case 'ko': {
      ko = 1; g.timer -= dt;
      if (g.timer <= 0) {
        g.state = 'chase'; g.hp = g.max * 0.5; g.cd = 1.2; ko = 0; g.engaged = true;
        if (inPen) { toast(`${d.name} got back up!`, true, 2000, '#ff9a9a'); sfx('warn'); }
      }
      break;
    }
  }
  g.ko = lerp(g.ko, ko, 1 - Math.exp(-dt * 6));
  if (g.state !== 'ko') {
    const m = g.radius;
    g.pos.x = clamp(g.pos.x, pen.minX + m * 0.6, pen.maxX - m * 0.6); g.pos.z = clamp(g.pos.z, pen.minZ + m * 0.6, pen.maxZ - m * 0.6);
  }
  if (g.engaged && !inPen && g.state === 'ko') g.engaged = false;
  const root = g.rig.root; root.position.copy(g.pos); root.rotation.y = g.face;
  const a = g.anim;
  animateRig(g.rig, dt, { walk, ko: g.ko, hit: g.hit, atk: a ? { arms: a.arms, t: a.t, wind: a.wf, back: a.back, fwd: a.fwd, lean: a.lean } : null });
  const fl = Math.max(g.hit, g.enraged ? 0.35 + Math.sin(T * 10) * 0.15 : 0);
  g.rig.flash(g.hit > 0.2 ? 0xffffff : 0xff2020, fl * 0.8);
  // egg visuals
  const egg = g.egg.mesh; egg.rotation.y += dt * 1.2; egg.position.y = 1.5 + Math.sin(T * 2 + g.idx) * 0.25;
  g.pen.dome.visible = g.egg.present && g.state !== 'ko';
  g.pen.dome.material.opacity = 0.18 + Math.sin(T * 3) * 0.05;
}
function execAttack(g, dist, dx, dz) {
  const d = g.def, A = ATTACKS[g.atk], t = g.tele[g.atk]; t.grp.visible = false;
  const pr = pRadius();
  if (g.atk === 'swing') {
    sfx('swing');
    const R = g.reach + pr * 0.5;
    const ang = dist > 0.01 ? Math.acos(clamp((g.dir.x * dx + g.dir.z * dz) / dist, -1, 1)) : 0;
    if (dist <= R + pr * 0.5 && ang < 0.95) hurtPlayer(d.dmg * A.mult, g.pos.x, g.pos.z, false);
    burst(g.pos.clone().add(g.dir.clone().multiplyScalar(g.reach * 0.7)).setY(2), 0xffffff, 6, 7, 0.3, 0.3, 2);
    g.state = 'recover'; g.timer = A.rec * (g.enraged ? 0.75 : 1);
  } else if (g.atk === 'slam') {
    sfx('slam'); spawnRing(g.pos, g.slamR, 0xffe0a0, 0.45); cam.shake = Math.max(cam.shake, 0.5 + d.scale * 0.15);
    burst(g.pos.clone().setY(0.4), 0xd9c9a3, 18, 12, 0.7, 0.6, 5, 0.5);
    if (dist <= g.slamR + pr * 0.5) hurtPlayer(d.dmg * A.mult, g.pos.x, g.pos.z, true);
    g.state = 'recover'; g.timer = A.rec * (g.enraged ? 0.75 : 1);
  } else {
    g.state = 'dash'; g.dashLeft = A.len; g.dashHit = false; sfx('slam');
  }
}

// ------------------------------------------------------------------ camera
function updateCamera(dt) {
  if (keys.arrowleft) cam.yaw += dt * 2; if (keys.arrowright) cam.yaw -= dt * 2;
  const sc = P.scale; let bigG = 0, focusBias = null;
  for (const g of guards) if (g.engaged && g.state !== 'idle') { bigG = Math.max(bigG, g.def.scale); focusBias = g; }
  const dist = (13 + 6 * sc + bigG * 4.2) * cam.zoom;
  const f = new THREE.Vector3(P.pos.x, P.pos.y + 2.8 * sc, P.pos.z);
  if (focusBias) f.lerp(new THREE.Vector3(focusBias.pos.x, 3 * focusBias.def.scale, focusBias.pos.z), 0.28);
  cam.focus.lerp(f, 1 - Math.exp(-dt * 7));
  cam.fightK = lerp(cam.fightK || 0, focusBias ? 1 : 0, 1 - Math.exp(-dt * 2));
  const pitch = cam.pitch + 0.42 * cam.fightK, cp = Math.cos(pitch);
  const want = new THREE.Vector3(cam.focus.x + Math.sin(cam.yaw) * cp * dist, cam.focus.y + Math.sin(pitch) * dist, cam.focus.z + Math.cos(cam.yaw) * cp * dist);
  want.x = clamp(want.x, -WORLD.halfX + 1, WORLD.halfX - 1); want.z = clamp(want.z, WORLD.minZ + 1, WORLD.maxZ - 1);
  camera.position.lerp(want, 1 - Math.exp(-dt * 9));
  cam.shake = Math.max(0, cam.shake - dt * 2.2);
  const s = cam.shake * cam.shake * 1.2;
  camera.position.x += rnd(-s, s); camera.position.y += rnd(-s, s);
  camera.lookAt(cam.focus);
  const sun = world.sun; sun.position.set(P.pos.x + 55, 95, P.pos.z + 40); sun.target.position.set(P.pos.x, 0, P.pos.z);
}

// ------------------------------------------------------------------ pets follow
function helperTarget() {
  if (P.state === 'down') return null;
  return guards.find((g) => g.engaged && g.state !== 'ko' && g.state !== 'idle' && P.pos.x > g.pen.minX - 1 && P.pos.x < g.pen.maxX + 1 && P.pos.z > g.pen.minZ && P.pos.z < g.pen.maxZ + 0.5) || null;
}
function moveToward(p, tx, tz, sp, dt, face = true) {
  const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return 0;
  const st = Math.min(d, sp * dt); p.pos.x += (dx / d) * st; p.pos.z += (dz / d) * st;
  if (face) p.mesh.rotation.y = lerpAngle(p.mesh.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
  return d;
}
function updatePets(dt) {
  const tg = helperTarget();
  for (const p of pets) {
    p.t += dt; p.cd = Math.max(0, p.cd - dt); p.lunge = Math.max(0, p.lunge - dt * 4);
    let moving = false, hop = 0;
    if (p.mode === 'follow') {
      const help = GUARDS[p.tier].egg.pet.help;
      if (tg) {
        // battle buddy: circle the guard and strike on a cooldown
        const a = Math.atan2(P.pos.x - tg.pos.x, P.pos.z - tg.pos.z) + 1.1, r = tg.radius + 1.6;
        const tx = tg.pos.x + Math.sin(a) * r, tz = tg.pos.z + Math.cos(a) * r;
        const d = moveToward(p, tx, tz, 16, dt, false); moving = d > 0.3;
        p.mesh.rotation.y = lerpAngle(p.mesh.rotation.y, Math.atan2(tg.pos.x - p.pos.x, tg.pos.z - p.pos.z), 1 - Math.exp(-dt * 10));
        if (d < 2.5 && p.cd <= 0) {
          p.cd = help.cd; p.lunge = 1;
          const nx = (tg.pos.x - p.pos.x), nz = (tg.pos.z - p.pos.z), l = Math.hypot(nx, nz) || 1;
          damageGuard(tg, pDmg() * help.dmg, { finisher: false }, nx / l, nz / l, true);
          if (help.heal && P.state !== 'down') { const h = maxHp() * help.heal; P.hp = Math.min(maxHp(), P.hp + h); floatText('+' + fmt(h), P.pos.clone().setY(5 * P.scale), 'spd', 0.8, 2); }
        }
      } else {
        const gap = 3.5 * P.scale + 1, d = Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z);
        if (d > gap) { moveToward(p, P.pos.x, P.pos.z, Math.max(10, (d - gap) * 5), dt); moving = true; }
      }
    } else {
      // yard pet: walk through the gate, then wander around
      p.wait -= dt;
      if (!inYard(p.pos)) {
        const gx = YARD.minX - 2.5; p.target = null; moving = true;
        if (p.pos.x < YARD.minX - 0.5 && Math.hypot(p.pos.x - gx, p.pos.z - 44) > 1.5) moveToward(p, gx, 44, 12, dt);
        else if (p.pos.x < YARD.minX + 0.5) moveToward(p, YARD.minX + 4, 44, 12, dt);
        else moveToward(p, YARD.cx, YARD.cz, 12, dt);
      }
      else if (p.target) { if (moveToward(p, p.target.x, p.target.z, 4.5, dt) < 0.4) { p.target = null; p.wait = rnd(1, 4); } else moving = true; }
      else if (p.wait <= 0) p.target = yardPoint();
    }
    hop = moving ? Math.abs(Math.sin(p.t * 9)) * 0.6 : Math.sin(p.t * 2) * 0.05 + 0.05;
    p.pos.y = hop + Math.sin(p.lunge * Math.PI) * 1.4;
    p.mesh.userData.head.rotation.x = Math.sin(p.t * 3) * 0.08 - p.lunge * 0.5;
  }
  S.coins += petCps() * dt;
}

// ------------------------------------------------------------------ HUD
const cache = {};
function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function updateHud(dt) {
  setText('v-power', fmtP(S.power)); setText('v-rank', rankOf(S.power)); setText('v-speed', fmtP(S.speed)); setText('v-coins', fmt(S.coins));
  setText('v-cps', petCps() ? `+${petCps().toFixed(1)}/s` : '');
  $('hp-fill').style.width = (100 * P.hp / maxHp()) + '%'; setText('hp-text', `${Math.ceil(P.hp)} / ${maxHp()}`);

  const next = GUARDS.findIndex((_, i) => !S.beaten[i]);
  let gt, gp = 0;
  if (P.carry) { gt = '🥚 Run the egg to the HATCHERY!'; gp = 1; }
  else if (next < 0) { gt = '🏆 All guards beaten! Keep growing & collecting pets.'; gp = 1; }
  else { const g = GUARDS[next]; gt = `Next: ${g.name}<br>Power ${fmtP(S.power)} / ${fmt(g.req)} recommended`; gp = S.power / g.req; }
  if (cache.goal !== gt) { cache.goal = gt; $('goal-text').innerHTML = gt; }
  $('goal-fill').style.width = clamp(gp * 100, 0, 100) + '%';

  // boss bar
  const eg = guards.find((g) => g.engaged);
  if (eg) {
    $('bossbar').style.display = 'block'; setText('boss-name', eg.def.name + ' — ' + eg.def.title);
    $('boss-hp').style.width = (100 * eg.hp / eg.max) + '%';
    setText('boss-info', eg.state === 'ko' ? '💤 DEFEATED — grab the egg!' : (eg.enraged ? '🔥 ENRAGED' : 'Dodge the red zones, punch in the openings!'));
  } else $('bossbar').style.display = 'none';

  // prompt
  let pr = '';
  const st = P.state === 'free' || P.state === 'train' ? nearStation() : null;
  if (P.carry && !hatch.active) pr = '🥚 Carrying egg — bring it to the Hatchery!';
  else if (st) {
    if (!S.owned[st.def.id]) pr = S.coins >= st.def.cost ? `Press E — unlock ${st.def.name} (${fmt(st.def.cost)} 🪙)` : `🔒 ${st.def.name} needs ${fmt(st.def.cost)} 🪙`;
    else if (P.state === 'train') pr = st.def.kind === 'speed' ? 'Running automatically… (move or press E to stop)' : 'Training automatically… (move or press E to stop)';
    else pr = `Press E — auto-${st.def.kind === 'speed' ? 'run' : 'train'} (+${+(st.def.gain * (st.def.kind === 'power' ? powerMult() : 1)).toFixed(2)} ${st.def.kind === 'speed' ? 'Speed' : 'Power'}/rep)`;
  } else {
    const g = guards.find((q) => q.state === 'ko' && q.egg.present && Math.hypot(P.pos.x - q.pen.egg.x, P.pos.z - q.pen.egg.z) < 14);
    if (g && !P.carry) pr = 'Grab the egg!';
  }
  $('prompt').style.display = pr ? 'block' : 'none'; if (cache.prompt !== pr) { cache.prompt = pr; $('prompt').textContent = pr; }

  // labels
  guards.forEach((g, i) => {
    const r = S.power / g.def.req, tag = g.state === 'ko' ? '<span style="color:#9fd">💤 DEFEATED</span>' : r >= 1 ? '<span style="color:#6dff9c">✔ FAIR FIGHT</span>' : r >= 0.6 ? '<span style="color:#ffd23f">⚠ RISKY</span>' : '<span style="color:#ff6b6b">☠ TOO STRONG</span>';
    guardLabels[i].set(`<div class="nm">${g.def.name}</div><div>Rec. Power ${fmt(g.def.req)}</div><div>${tag}</div>`);
  });
  world.stations.forEach((s, i) => {
    const own = S.owned[s.def.id], gain = s.def.kind === 'speed' ? `+${s.def.gain} Speed / rep` : `+${s.def.gain} Power / rep`;
    stationLabels[i].set(`<div class="nm">${s.def.name}</div><div>${own ? gain : `🔒 ${fmt(s.def.cost)} 🪙`}</div>`);
    s.padMat.color.setHex(own || s.def.kind === 'speed' ? s.def.color : 0x666a75);
  });
  hatchLabel.set(P.carry ? '<div class="nm">⬇ DROP EGG HERE ⬇</div>' : '<div class="nm">🥚 HATCHERY</div>');
  yardLabel.set(`<div class="nm">🐾 PET YARD</div><div>${S.pets.length ? 'Click a pet in the list to equip it' : 'Hatch eggs to fill me!'}</div>`);
  playerLabel.set(`<div>${rankOf(S.power)} · ⚡${fmtP(S.power)}</div>`);

  for (const l of labels) {
    if ((l.hideWhen && l.hideWhen())) { l.el.style.display = 'none'; continue; }
    const p = l.getPos(); const dd = Math.hypot(P.pos.x - p.x, P.pos.z - p.z), sp = dd <= l.max ? toScreen(p) : null;
    if (!sp) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block'; l.el.style.left = sp.x + 'px'; l.el.style.top = sp.y + 'px';
    l.el.style.transform = `translate(-50%,-100%) scale(${clamp(30 / (dd + 12) * 1.15, 0.7, 1.2)})`;
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; const k = f.t / f.life;
    if (k >= 1) { f.el.remove(); floats.splice(i, 1); continue; }
    const p = f.pos.clone(); p.y += f.rise * k; const sp = toScreen(p);
    if (sp) { f.el.style.left = sp.x + 'px'; f.el.style.top = sp.y + 'px'; f.el.style.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; f.el.style.transform = `translate(-50%,-50%) scale(${k < 0.15 ? 0.5 + k * 3.3 : 1})`; }
  }
}

// ------------------------------------------------------------------ effects update
function updateFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); parts.splice(i, 1); continue; }
    p.vel.y -= p.grav * dt; p.mesh.position.addScaledVector(p.vel, dt); if (p.mesh.position.y < 0.05) { p.mesh.position.y = 0.05; p.vel.multiplyScalar(0.6); }
    p.mesh.scale.setScalar(p.size * (p.life / p.max)); p.mesh.rotation.x += dt * 6;
  }
  for (let i = ringFx.length - 1; i >= 0; i--) {
    const r = ringFx[i]; r.t += dt; const k = r.t / r.dur;
    if (k >= 1) { scene.remove(r.m); ringFx.splice(i, 1); continue; }
    r.m.scale.setScalar(Math.max(0.1, r.maxR * k)); r.m.material.opacity = 0.8 * (1 - k);
  }
  world.hatchery.beam.material.opacity = 0.22 + Math.sin(T * 4) * 0.08;
  world.stations.forEach((s) => { if (s.group.userData.orb) s.group.userData.orb.rotation.y += dt * 2; });
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started) {
    if (hitstop > 0) { hitstop -= dt; dt *= 0.06; }
    T += dt;
    updatePlayer(dt); guards.forEach((g) => guardUpdate(g, dt)); updateHatch(dt); updatePets(dt); updateFx(dt); world.update(dt); updateCamera(dt); updateHud(dt);
  } else {
    T += dt; cam.yaw += dt * 0.15; updateCamera(dt); world.update(dt);
    guards.forEach((g) => guardUpdate(g, dt)); animateRig(P.rig, dt, { walk: 0 });
  }
  renderer.render(scene, camera);
}
$('play').onclick = () => { initAudio(); started = true; $('start').style.display = 'none'; };
$('reset').onclick = () => { localStorage.removeItem(SAVE_KEY); location.reload(); };
setInterval(save, 5000);
requestAnimationFrame(frame);

window.__egg = { S, P, guards, world, camera, cam, start: () => { started = true; $('start').style.display = 'none'; }, keys, hurtPlayer, toast };
