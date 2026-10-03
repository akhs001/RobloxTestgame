// All tuning numbers live here so the prototype is easy to balance.
export const WORLD = { halfX: 80, minZ: -70, maxZ: 70, spawn: { x: 0, z: 24 } };
export const PET_YARD = { minX: 20, maxX: 56, minZ: 30, maxZ: 60 };
export const HATCHERY = { x: 0, z: 44, r: 7 };

export const RANKS = [
  { at: 0, name: 'Noob' },
  { at: 10, name: 'Rookie' },
  { at: 40, name: 'Fit' },
  { at: 150, name: 'Buff' },
  { at: 400, name: 'Beast' },
  { at: 1000, name: 'TITAN' },
];

// Gym stations. Power stations raise POWER (the main stat), treadmill raises SPEED.
export const STATIONS = [
  { id: 'bench', name: 'Dumbbell Bench', kind: 'power', gain: 0.25, cost: 0, x: -66, z: 40, color: 0x66ccff, db: 0.8 },
  { id: 'barbell', name: 'Barbell Rack', kind: 'power', gain: 0.75, cost: 80, x: -55, z: 40, color: 0xffd23f, db: 1.1 },
  { id: 'heavy', name: 'Heavy Rack', kind: 'power', gain: 2.5, cost: 600, x: -44, z: 40, color: 0xff8a3d, db: 1.5 },
  { id: 'titan', name: 'Titan Rig', kind: 'power', gain: 9, cost: 4000, x: -33, z: 40, color: 0xc77dff, db: 2.0 },
  { id: 'treadmill', name: 'Treadmill', kind: 'speed', gain: 0.5, cost: 0, x: -22, z: 40, color: 0x6dff9c, db: 0, standY: 0.7 },
];

// Guards: each pen holds one guard + one egg. req = recommended power.
// Player damage ~ 5 + 1.5*power, player HP ~ 100 + 10*power, so being under-powered is brutal.
export const GUARDS = [
  {
    name: 'Rookie Rick', title: 'Mall Cop', penX: -54, req: 10, hp: 150, dmg: 24, speed: 6, scale: 1.3, bulk: 1.05,
    attacks: ['swing'], tint: 0xffffff, color: 0x4aa3ff,
    look: { skin: 0xf0c8a0, shirt: 0x2f6fe0, pants: 0x232a47, shoes: 0x222222, glove: 0xf0c8a0, face: 'angry', acc: ['cap'], accColor: 0x1d3f9e },
    egg: { name: 'Common Egg', color: 0xd6ecff, spot: 0x6fb7ff, coins: 35, pet: { name: 'Blobby', color: 0x7ec8ff, cps: 0.5, pw: 0.05, help: { dmg: 0.25, cd: 1.6, heal: 0.04, text: 'bites + heals you' } } },
  },
  {
    name: 'Bouncer Bob', title: 'Club Bouncer', penX: -18, req: 40, hp: 600, dmg: 70, speed: 7.5, scale: 1.75, bulk: 1.3,
    attacks: ['swing', 'slam'], tint: 0xfff3c4, color: 0xffcc33,
    look: { skin: 0xdba073, shirt: 0x1d1d25, pants: 0x14141a, shoes: 0x0d0d10, glove: 0xdba073, face: 'angry', acc: ['shades', 'belt'], accColor: 0xd4af37 },
    egg: { name: 'Golden-Spot Egg', color: 0xfff1b8, spot: 0xffa31a, coins: 150, pet: { name: 'Foxy', color: 0xff9a3c, cps: 2, pw: 0.1, help: { dmg: 0.4, cd: 1.1, heal: 0, text: 'fast bites' } } },
  },
  {
    name: 'Brute Bruno', title: 'Viking Brawler', penX: 18, req: 150, hp: 2000, dmg: 220, speed: 9, scale: 2.3, bulk: 1.55,
    attacks: ['swing', 'slam', 'charge'], tint: 0xffd6a8, color: 0xff6a33,
    look: { skin: 0xc98a62, shirt: 0xc4452a, pants: 0x6b4a2b, shoes: 0x3a2514, glove: 0x6b4a2b, face: 'angry', acc: ['viking', 'belt'], accColor: 0x8a8f99 },
    egg: { name: 'Dino Egg', color: 0xc9f5c0, spot: 0x2fae3a, coins: 700, pet: { name: 'Rexy', color: 0x4cd964, cps: 8, pw: 0.2, help: { dmg: 0.8, cd: 1.7, heal: 0, text: 'heavy stomps' } } },
  },
  {
    name: 'Titan Tank', title: 'THE BOSS', penX: 54, req: 500, hp: 7000, dmg: 700, speed: 10.5, scale: 3.1, bulk: 1.85,
    attacks: ['swing', 'slam', 'charge'], tint: 0xe0c0ff, color: 0xb25cff, boss: true,
    look: { skin: 0x9d7bd8, shirt: 0x4b2a8a, pants: 0x2b1a55, shoes: 0x14102a, glove: 0xd4af37, face: 'glow', acc: ['crown', 'shoulders', 'belt'], accColor: 0xffc933 },
    egg: { name: 'Dragon Egg', color: 0xffe08a, spot: 0xff4d2e, coins: 3000, pet: { name: 'Draco', color: 0xb25cff, cps: 30, pw: 0.4, help: { dmg: 1.2, cd: 1.3, heal: 0.02, text: 'fire breath + heals' } }, glow: true },
  },
];

// Guard attack templates (s = guard scale)
export const ATTACKS = {
  swing: { wind: 0.75, rec: 0.9, mult: 1.0 },
  slam: { wind: 1.05, rec: 1.3, mult: 1.4 },
  charge: { wind: 0.95, rec: 1.5, mult: 1.5, len: 24, speed: 36 },
};
