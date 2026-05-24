# Cube Quest 3D

A small browser-based 3D adventure game built with [Three.js](https://threejs.org/) and the Web Audio API. No build step, no external assets — everything is procedurally generated in code.

## Run it

Open `index.html` in a modern browser, or serve the folder with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening the file directly via `file://` works in most browsers, but a static server is recommended for ES modules.)

## Controls

| Key | Action |
| --- | --- |
| `W A S D` or arrows | Move |
| `Space` | Jump (double-jump with the green power-up) |
| `Shift` | Dash with brief invincibility |
| `P` / `Esc` | Pause |
| `M` | Mute / unmute |

## Features

- Five themed levels (Meadow, Sand Dunes, Frostpeak, Emberlands, The Void) with ramping difficulty
- Enemies: patrollers, chasers, spike traps, and a stomp-able boss
- Power-ups: heart, shield, speed, magnet, double-jump
- HP system, dash, double-jump, knockback, slippery ice physics, lava hazards
- Particle effects, screen shake, procedural sound effects and adaptive music
- Star ratings (1–3) per level based on time and HP
- Local high-score list and progression saved to `localStorage`
- Main menu, pause menu, level-complete and game-over screens

## Project layout

```
index.html          # Entry point + DOM for menus and HUD
css/style.css       # All styling
js/main.js          # Renderer/scene/camera bootstrap + main loop
js/game.js          # Game state machine, level orchestration
js/world.js         # Level generation, theming, portal, hazards
js/player.js        # Player movement, jump/dash/health/powerups
js/entities.js      # Coins, power-ups, enemies, boss
js/effects.js       # Particles + camera shake
js/levels.js        # Level definitions
js/audio.js         # Web Audio SFX + procedural music
js/input.js         # Keyboard input
js/storage.js       # localStorage save/load
js/ui.js            # HUD and overlay management
```
