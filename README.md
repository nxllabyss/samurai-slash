# 🎌 Samurai Slash

A small browser game built with nothing but **HTML, CSS, and vanilla JavaScript**
(HTML5 Canvas for all drawing). No frameworks, no build tools, no external
image or audio assets — every visual is drawn in code.

Survive the night as a lone samurai. Oni spawn from the edges of the screen
and close in on you. Slash them down with your katana before your HP runs out.

---

## How to run

1. Unzip `SamuraiSlash.zip` (or use the folder as-is).
2. Double-click **`index.html`**.
3. It opens directly in your default browser (Chrome, Edge, or Firefox) —
   no server, no install, no internet connection required.

That's it. The game runs entirely client-side.

---

## Controls

### Desktop

| Action          | Input                          |
|------------------|---------------------------------|
| Move             | `WASD` or Arrow Keys            |
| Aim              | Mouse position                  |
| Attack (slash)   | Left Mouse Click                |

Your samurai always faces the mouse cursor, and a left click swings the
katana in a short arc in front of you. Anything caught in that arc takes
damage.

### Mobile / Touch

| Action          | Input                                          |
|------------------|--------------------------------------------------|
| Move             | Drag the joystick (bottom-left)                |
| Attack (slash)   | Tap the **斬** button (bottom-right)            |

On touch devices, the samurai faces whichever direction you're currently
moving, and the attack button swings the sword in that direction. The
joystick and attack button only appear automatically on touch-capable
devices — desktop players never see them.

---

## Gameplay

- You start with **100 HP**.
- Oni (enemies) spawn randomly from the edges of the screen and walk
  straight toward you.
- Each oni has **20 HP** and deals **10 damage** on contact.
- A single sword slash kills one oni in one hit.
- Each kill is worth **+10 score**.
- The game gets gradually harder as enemies spawn more frequently.
- When your HP reaches 0, the **Game Over** screen appears showing your
  final score and kill count, with a **Restart** button to play again.

---

## Visual style

Everything on screen — the moon, the layered mountains, the falling sakura
petals, the torii gate, the samurai, and the oni — is drawn procedurally on
the `<canvas>` element using plain 2D drawing calls (arcs, paths, gradients).
There are no `.png`/`.jpg`/`.svg` files anywhere in this project.

---

## Project structure

```
SamuraiSlash/
├── index.html       Page structure: canvas, HUD, overlays, mobile controls
├── style.css        Visual styling and layout (Japanese night theme)
├── game.js          All game logic: player, enemies, combat, particles, loop
├── README.md        This file
└── build_zip.bat     Windows script that re-packages the folder into a .zip
```

---

## Rebuilding the .zip on Windows

If you make changes to the files and want a fresh `SamuraiSlash.zip`, just
double-click **`build_zip.bat`**. It uses PowerShell's built-in
`Compress-Archive` command (included with Windows 10/11 — no extra tools
needed) to bundle `index.html`, `style.css`, `game.js`, and `README.md` into
`SamuraiSlash.zip` in the same folder.

---

## Technical notes

- Pure vanilla JavaScript — no React, Vue, Angular, TypeScript, Node.js, or
  any external library/framework.
- Frame-rate independent movement using delta-time (`dt`), so the game plays
  at the same speed regardless of monitor refresh rate.
- Enemy and particle counts are capped for smooth performance even on
  modest hardware.
- Touch and mouse/keyboard code paths are fully separated, so desktop and
  mobile each get controls suited to their input method.
