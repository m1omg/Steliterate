# Older builds

Frozen, playable copies of earlier versions of the game, served next to the live one by GitHub
Pages (Vite copies `public/` into every build as it is).

- `2026-10-13/`: the game as of PR m1omg/Steliterate#27 (merge commit `4aaaa2a`, live script
  `index-B4EKBtSN.js`), the last state before the new version. Play it at
  https://m1omg.github.io/Steliterate/archive/2026-10-13/. It uses the storage keys of its time,
  so it opens the saves made on the main address before the new version. Its source, without Git:
  https://github.com/m1omg/Steliterate/archive/4aaaa2a996b5d4bd62587931737858d76b7f8706.zip

- `2026-10-27/`: today's game as it was when the main address switched to the new version, as of
  PR m1omg/Steliterate#45 (merge commit `0279db1`, live script `index-D13F5Go2.js`). Play it at
  https://m1omg.github.io/Steliterate/archive/2026-10-27/. It uses the same storage keys, so it
  opens every game saved at the main address until the switch (and those of the 13 Oct copy). Its
  source, without Git:
  https://github.com/m1omg/Steliterate/archive/0279db195275c2aecb48ec1fa9e04288364b3d5c.zip

Each built from its commit with `npm run build`, nothing changed (the commit's own copy of this
folder removed first, so it does not nest). Never edit these files, and never
build a later copy from a tree that contains this folder (it would nest).
