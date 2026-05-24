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
- Combo system: collect coins quickly for an increasing score multiplier
- Live minimap with player heading, coins, enemies, powerups, and portal
- HDR-based PBR rendering with PMREM environment reflections (HDR from the three.js example pack)
- Real ground/wall textures (grass & brick from three.js examples) with procedural fallback
- Reflective water pond next to the Meadow arena (`Water.js` shader)
- ACES Filmic tone mapping, bloom, vignette, and subtle film grain
- 4k PCF soft shadows that follow the player for tight, crisp shading
- Particle effects, screen shake, procedural sound effects and adaptive music
- Star ratings (1–3) per level based on time and HP
- Local high-score list and progression saved to `localStorage`
- Main menu, pause menu, level-complete and game-over screens

## Project layout

```
index.html          # Entry point + DOM for menus and HUD
css/style.css       # All styling
js/main.js          # Renderer/scene/camera/postprocessing bootstrap + main loop
js/game.js          # Game state machine, level orchestration, combo system
js/world.js         # Level generation, theming, portal, hazards, water
js/player.js        # Player movement, jump/dash/health/powerups, model & trail
js/entities.js      # Coins, power-ups, enemies, boss
js/effects.js       # Particles + camera shake
js/levels.js        # Level definitions
js/audio.js         # Web Audio SFX + procedural music
js/input.js         # Keyboard input
js/storage.js       # localStorage save/load
js/ui.js            # HUD and overlay management
js/sky.js           # Gradient sky-dome shader
js/textures.js      # Procedural canvas-generated textures (fallback)
js/assets.js        # HDR & real texture loading from three.js example CDN
js/minimap.js       # 2D minimap renderer
```

## External assets

The game asynchronously loads (with full procedural fallback) from `unpkg.com/three@0.160.0/examples/textures`:

- `equirectangular/quarry_01_1k.hdr` — HDR environment map for PBR reflections
- `terrain/grasslight-big.jpg` + normal map — meadow ground
- `brick_diffuse.jpg`, `brick_bump.jpg`, `brick_roughness.jpg` — walls
- `waternormals.jpg` — water shader normal map

These are all CC0 / three.js public-domain examples.
