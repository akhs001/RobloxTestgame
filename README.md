# 🥚 Egg Brawl – browser prototype

Quick playable prototype to test the core loop before porting to Roblox:

**Train at the gym → fight a guard → steal his egg → hatch it at home → buy better gear → fight a tougher guard.**

## Play
Just open `index.html` in a browser (Chrome/Edge/Firefox). No server needed.
Progress is saved in `localStorage` (use the "New game" button, or add `?reset` to the URL, to wipe it).

### Test shortcuts (URL params)
`index.html?power=150&speed=20&coins=5000&all` – start with those stats and every gym station unlocked.

## Controls
| Key | Action |
|---|---|
| WASD | move |
| Space / Shift | dodge roll (invincible for a moment) |
| E | near a station: start **auto-training** (move or press E again to stop); near a locked one: buy it |
| Right-drag or ←/→ | rotate camera, mouse wheel zooms |

## Design notes
* **Power is king**: Power raises damage *and* max HP *and* makes your character visibly bigger/buffer. Speed (treadmill) is secondary: run speed, shorter dodge cooldown, and the delivery-time bonus on eggs.
* **Fighting is automatic**: stand in a guard's pen and you punch him on your own (3-hit combo, the 3rd is a heavy finisher that can stagger). You only move and dodge.
* **Pets**: all pets live in the fenced Pet Yard. Click one in the top-right list to equip it – that one follows you and fights beside you (Blobby bites+heals, Foxy bites fast, Rexy stomps, Draco breathes fire). Every owned pet still gives passive coins and +% power.
* **4 guards**, each tougher, with new attacks: Rookie Rick (swing) → Bouncer Bob (+slam) → Brute Bruno (+charge) → Titan Tank (boss, enrages under 50%). Attacks are telegraphed with red zones – dodge them, punch during the recovery.
* Beating a guard knocks him out for 10 s; grab the egg and carry it (slowed) to the Hatchery. Quick delivery = coin bonus.
* Eggs hatch into pets that give passive coins and +% power per rep. Coins unlock stronger gym stations (+0.25 / +0.75 / +2.5 / +9 power per rep).
* Everything (world, characters, effects, sounds) is generated in code – no assets.

## Tuning
All numbers (guard HP/damage, station gains/costs, egg rewards, power requirements) are in `src/config.js`.

## Develop
```
npm install
./build.sh        # bundles src/*.js + three.js into game.js (what index.html loads)
```
Code: `src/main.js` (gameplay/HUD), `src/models.js` (blocky characters, eggs, pets), `src/world.js` (map), `src/audio.js` (synth sfx).
