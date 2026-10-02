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
| Click / J | punch (3-hit combo, 3rd hit is a heavy finisher that can stagger a guard) |
| Space / Shift | dodge roll (invincible for a moment) |
| Hold E | train at a station / press E near a locked one to buy it |
| Right-drag or ←/→ | rotate camera, mouse wheel zooms |

## Design notes
* **Power is king**: Power raises damage *and* max HP *and* makes your character visibly bigger/buffer. Speed (treadmill) is secondary: run speed, shorter dodge cooldown, and the delivery-time bonus on eggs.
* **4 guards**, each tougher, with new attacks: Rookie Rick (swing) → Bouncer Bob (+slam) → Brute Bruno (+charge) → Titan Tank (boss, enrages under 50%). Attacks are telegraphed with red zones – dodge them, punch during the recovery.
* Beating a guard knocks him out for 10 s; grab the egg and carry it (slowed) to the Hatchery. Quick delivery = coin bonus.
* Eggs hatch into pets that give passive coins and +% power per rep. Coins unlock stronger gym stations (+1 / +3 / +10 / +35 power per rep).
* Everything (world, characters, effects, sounds) is generated in code – no assets.

## Tuning
All numbers (guard HP/damage, station gains/costs, egg rewards, power requirements) are in `src/config.js`.

## Develop
```
npm install
./build.sh        # bundles src/*.js + three.js into game.js (what index.html loads)
```
Code: `src/main.js` (gameplay/HUD), `src/models.js` (blocky characters, eggs, pets), `src/world.js` (map), `src/audio.js` (synth sfx).
