# Лунные дворники

Однопользовательская игра про посёлок **«Тихая осыпь»**: мети лунную пыль, носи её в рюкзаке к зелёному приёмнику и запускай рейс за кредиты. Инструменты, техника и роботы открываются по очереди, участки становятся пыльнее и дороже, а **новая смена** оставляет нашивки и начинает двор сначала.

This is a static browser game. No build step and no external CDNs.

## Play locally

From the repository root:

```bash
python3 -m http.server 8931
```

Open [http://127.0.0.1:8931](http://127.0.0.1:8931).

## Controls

- Phone: virtual joystick on the left. Large buttons on the right.
- Desktop: WASD or arrow keys. `E` opens the shop. Space launches a shipment when you stand on a receiver.
- Walk over grey dust until the ground shows through. A full backpack has to be carried to a green pad. The pad unloads into a shared hopper. **Запустить рейс** pays you.
- At 80% clean, the next yard unlocks across the gangway. Seasons repeat the eight yards with denser, more valuable dust.
- Robots haul dust into the hopper while you play. While the tab is closed they ship it themselves (half pace, 8 hours max) and do not unlock new yards.
- **Новая смена** (prestige) wipes the run and keeps badges that raise shipment pay and cleaning power.
- **Стереть сохранение** in the shop asks before wiping everything, including badges.

The game saves to `localStorage` every 5 seconds and when the page closes.

## Smoke test

Requires Node.js 18+ and Google Chrome:

```bash
node tests/smoke.mjs
```

The test loads the page in headless Chrome, sweeps dust, sells a shipment, buys an upgrade, checks the save, prestige, reset, and offline income. It fails if the page throws or logs a console error.

## GitHub Pages

The site is the repository root: `index.html`, `game.js`, `style.css`, and `assets/`. Nothing needs compiling.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Branch: `main`. Folder: **`/ (root)`**. Save.
5. When the deployment finishes, the game is at `https://<user>.github.io/<repo>/`.

`.nojekyll` is included so Pages serves every file as-is. Paths are relative, so a project site (`username.github.io/repo/`) works the same as a user site.

## Known issues

- Offline robots are less efficient than active play: the away-time math does not walk them tile by tile, and they cannot open the next yard while you are gone.
- There is no sound.
- A very long run without a new shift stores one dust map per yard. Hundreds of yards make a larger `localStorage` save.
- Robots can bunch up and sometimes snap back to the home pad if a rock wedges them.
- Numbers past about `1e300` are not meaningful. Reaching that takes a very long chain of seasons.
- Balance is tuned for a prototype, not a finished economy.
