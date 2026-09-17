# Development setup notes

- Run `docker compose -f docker-compose.base44.yml up -d` for the Base44 preview on port 3000. The container installs locked dependencies, bind-mounts the repository, and runs `node --watch server.js`; no image build or external credentials are needed.
- This is a plain HTML/JavaScript canvas app, not a bundled frontend. Express serves the source directly and Socket.IO shares its origin. Node watch restarts the backend on edits; frontend changes require refreshing the preview because there is no browser HMR.
- Leaderboards are saved lazily to root `leaderboard.json`, which is ignored by git and persists in the bind-mounted workspace. Other player state is in memory; restarting the server disconnects players. Local high scores use browser localStorage. No database/migration/seed step is needed.
- Verify with `docker compose -f docker-compose.base44.yml ps`, `curl -f http://localhost:3000/`, and `curl -f 'http://localhost:3000/socket.io/?EIO=4&transport=polling'`. Compare `/js/main.js` with the checkout to confirm live source is served.
- Browser smoke test: fill the name field, click **Enter Arcade**, and confirm the connecting screen disappears into the canvas world with no console errors. This flow passed during setup. Screenshot verification was unavailable because the preview surface was hidden.
- No automated test script is defined. Use `node --check` for JavaScript syntax checks inside the container, plus the browser smoke test above.
