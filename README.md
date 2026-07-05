# KNIGHTFALL — a low poly dark fantasy

A retro PS1-style browser game: a customizable knight wandering the grounds of
a green-lit castle under a nebula sky. Built with Three.js — all models and
textures are generated procedurally in code, no asset files.

## Play it

**No install:** the game builds to a single self-contained `dist/index.html`
(`npm run build`) that runs anywhere — any static host, or even opened
directly as a file. A GitHub Actions workflow (`.github/workflows/deploy.yml`)
deploys it to GitHub Pages on every push; note GitHub Pages requires the
repository to be public (or a paid GitHub plan). Once enabled it serves at
`https://agames21.github.io/Low-poly-fantasy-game/`.

**For development:**

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Pick **PC** or
**Mobile** on the title screen.

- **PC:** WASD / arrows to move, click or `F` to attack, Space to jump, drag
  mouse to look, scroll to zoom, `C` for the customize menu.
- **Mobile:** on-screen joystick to move, ⚔ button (or tap) to attack, Jump
  button, touch-drag to look.

## The demo

Training dummies wait by the path, and wraiths haunt the grounds — slay 5 to
cleanse them. Wraiths claw back: you have 5 hearts, and falling means waking
up back at the gates. Walking blends into a distinct run cycle at speed, and
jumps have proper tuck/fall/landing phases.

## Customize your knight

Open **The Armory** (Customize button or `C`): choose helmet style, armor
material (including glowing Enchanted Marble), armor tint, and weapon/gear —
longsword, sword & shield, or the forbidden tome. Choices are saved in the
browser.

## The retro look

- Renders internally at 240p and upscales with nearest-neighbor pixels
- PS1-style vertex snapping shader for polygon jitter
- Canvas-generated low-res textures with nearest filtering
- Heavy purple fog, saturated point lights, animated green nebula sky shader

## Next up

Game mechanics (combat, enemies, quests) — this build is the world, the look,
and the knight.
